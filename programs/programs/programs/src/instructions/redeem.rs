use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    TokenAccount, TokenInterface, transfer_checked, TransferChecked, Mint,
};
use crate::constants::{MARKET_SEED, VAULT_SEED, POSITION_SEED, PROTOCOL_SEED, PROTOCOL_FEE_BPS};
use crate::errors::PredibergError;
use crate::state::{Protocol, Market, Position, MarketStatus};

// ─────────────────────────────────────────────────────────────────────────────
// Instruction 1: request_redeem
//
// Called by a winner after the market resolves.
// Triggers the Encrypt decryption CPI so that off-chain executors decrypt the
// user's encrypted share balance and write the plaintext to a reveal account.
//
// Flow:
//   1. User calls request_redeem
//   2. Encrypt executors decrypt position.yes_shares_ct (or no_shares_ct)
//   3. Plaintext written to a Reveal account by the Encrypt program
//   4. User calls claim_winnings with the decrypted share count
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RequestRedeem<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [MARKET_SEED, &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == user.key() @ PredibergError::Unauthorized,
        constraint = position.market == market.key() @ PredibergError::Unauthorized,
    )]
    pub position: Account<'info, Position>,
}

pub fn request_redeem_handler(ctx: Context<RequestRedeem>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.position;

    require!(market.status == MarketStatus::Resolved, PredibergError::MarketNotActive);
    require!(!position.redeemed, PredibergError::AlreadyRedeemed);

    let winning = market.winning_outcome.ok_or(PredibergError::MarketNotActive)?;

    // Verify caller holds the winning side
    let has_winning_shares = if winning == 0 {
        position.has_yes_shares()
    } else {
        position.has_no_shares()
    };
    require!(has_winning_shares, PredibergError::NotAWinner);

    // ── Encrypt Decryption CPI (pre-alpha stub) ────────────────────────────
    //
    // In production, call the Encrypt program to initiate decryption of the
    // winning ciphertext account. Off-chain executors observe this request,
    // decrypt using the FHE key, and write the plaintext to a reveal account.
    //
    // Encrypt program ID: 4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8
    // gRPC endpoint:      https://pre-alpha-dev-1.encrypt.ika-network.net:443
    //
    // CPI call (conceptual):
    //   encrypt_program::request_decrypt(
    //       ciphertext_pubkey = if winning == 0 {
    //           position.yes_shares_ct
    //       } else {
    //           position.no_shares_ct
    //       },
    //       reveal_account = ...,
    //   )
    //
    // See: https://docs.encrypt.xyz/tutorial/request-tally-decryption

    msg!(
        "Decryption requested for market {} user {} winning_outcome={}",
        market.id,
        ctx.accounts.user.key(),
        winning,
    );
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Instruction 2: claim_winnings
//
// Called after Encrypt executors have decrypted the position.
// The user provides the plaintext share count (learned from the reveal account
// via the Encrypt gRPC API). Program verifies and transfers payout.
//
// Payout formula:
//   gross = (shares / winning_shares_total) * vault_balance
//   fee   = gross * PROTOCOL_FEE_BPS / 10_000
//   net   = gross - fee
// ─────────────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ClaimWinningsParams {
    /// Decrypted share count — obtained from Encrypt reveal account via gRPC
    pub shares: u64,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        seeds = [MARKET_SEED, &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == user.key() @ PredibergError::Unauthorized,
        constraint = position.market == market.key() @ PredibergError::Unauthorized,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == market.collateral_mint
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn claim_winnings_handler(
    ctx: Context<ClaimWinnings>,
    params: ClaimWinningsParams,
) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let _protocol = &ctx.accounts.protocol;

    require!(market.status == MarketStatus::Resolved, PredibergError::MarketNotActive);
    require!(!position.redeemed, PredibergError::AlreadyRedeemed);
    require!(params.shares > 0, PredibergError::InvalidAmount);

    let winning = market.winning_outcome.ok_or(PredibergError::MarketNotActive)?;

    // Determine total winning shares for payout denominator
    let winning_shares_total = if winning == 0 {
        require!(position.has_yes_shares(), PredibergError::NotAWinner);
        market.yes_shares_total
    } else {
        require!(position.has_no_shares(), PredibergError::NotAWinner);
        market.no_shares_total
    };

    require!(winning_shares_total > 0, PredibergError::InsufficientLiquidity);

    // ── Payout calculation ─────────────────────────────────────────────────
    // gross = (user_shares / total_winning_shares) * vault_balance
    // The vault holds: initial_liquidity + all swap amounts (including fees)
    let vault_balance = ctx.accounts.vault.amount;

    let gross = (params.shares as u128)
        .checked_mul(vault_balance as u128)
        .ok_or(PredibergError::Overflow)?
        .checked_div(winning_shares_total as u128)
        .ok_or(PredibergError::Overflow)? as u64;

    let fee = (gross as u128)
        .checked_mul(PROTOCOL_FEE_BPS as u128)
        .ok_or(PredibergError::Overflow)?
        .checked_div(10_000)
        .ok_or(PredibergError::Overflow)? as u64;

    let net_payout = gross.checked_sub(fee).ok_or(PredibergError::Overflow)?;
    require!(net_payout > 0, PredibergError::InsufficientLiquidity);

    // ── Transfer vault → user ──────────────────────────────────────────────
    let market_id_bytes = market.id.to_le_bytes();
    let seeds = &[
        MARKET_SEED,
        market_id_bytes.as_ref(),
        &[market.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
            },
            signer_seeds,
        ),
        net_payout,
        ctx.accounts.collateral_mint.decimals,
    )?;

    position.redeemed = true;

    msg!(
        "Claimed: shares={} gross={} fee={} net={}",
        params.shares, gross, fee, net_payout
    );
    Ok(())
}
