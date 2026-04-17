use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    TokenAccount, TokenInterface, transfer_checked, TransferChecked, Mint,
};
use crate::constants::{MARKET_SEED, VAULT_SEED, POSITION_SEED, PROTOCOL_FEE_BPS};
use crate::errors::PredibergError;
use crate::state::{Market, Position, MarketStatus};

// ─────────────────────────────────────────────────────────────────────────────
// Instruction 1: request_redeem
//
// Winner calls this after market resolves to verify they hold the winning side.
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

    if winning == 0 {
        require!(position.has_yes_shares(), PredibergError::NotAWinner);
    } else {
        require!(position.has_no_shares(), PredibergError::NotAWinner);
    }

    msg!(
        "Redeem verified — market={} user={} winning_outcome={}",
        market.id,
        ctx.accounts.user.key(),
        winning,
    );
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Instruction 2: claim_winnings
//
// Transfer net payout to user; protocol fee stays in vault.
//
// Payout:
//   gross = (user_shares / winning_shares_total) * vault_balance
//   fee   = gross * PROTOCOL_FEE_BPS / 10_000   (stays in vault)
//   net   = gross - fee                          → user
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
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

pub fn claim_winnings_handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    require!(market.status == MarketStatus::Resolved, PredibergError::MarketNotActive);
    require!(!position.redeemed, PredibergError::AlreadyRedeemed);

    let winning = market.winning_outcome.ok_or(PredibergError::MarketNotActive)?;

    let (user_shares, winning_shares_total) = if winning == 0 {
        require!(position.has_yes_shares(), PredibergError::NotAWinner);
        (position.yes_shares, market.yes_shares_total)
    } else {
        require!(position.has_no_shares(), PredibergError::NotAWinner);
        (position.no_shares, market.no_shares_total)
    };

    require!(winning_shares_total > 0, PredibergError::InsufficientLiquidity);

    let vault_balance = ctx.accounts.vault.amount;

    let gross = (user_shares as u128)
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

    let market_id_bytes = market.id.to_le_bytes();
    let seeds = &[MARKET_SEED, market_id_bytes.as_ref(), &[market.bump]];
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
        user_shares, gross, fee, net_payout
    );
    Ok(())
}
