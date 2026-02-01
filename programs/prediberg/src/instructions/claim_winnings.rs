use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface, transfer_checked, TransferChecked, Mint};
use crate::constants::{MARKET_SEED, VAULT_SEED, POSITION_SEED, PROTOCOL_SEED};
use crate::errors::PredibergError;
use crate::state::{Protocol, Market, Position, MarketStatus};

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
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref(), &[position.outcome]],
        bump = position.bump,
        constraint = position.owner == user.key() @ PredibergError::Unauthorized,
        constraint = position.market == market.key() @ PredibergError::Unauthorized
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

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let protocol = &ctx.accounts.protocol;

    // Validate market is resolved
    require!(market.status == MarketStatus::Resolved, PredibergError::MarketNotActive);

    // Validate position is winning and not claimed
    let winning = market.winning_outcome.ok_or(PredibergError::MarketNotActive)?;
    require!(position.outcome == winning, PredibergError::NoWinnings);
    require!(!position.claimed, PredibergError::NoWinnings);
    require!(position.amount > 0, PredibergError::NoWinnings);

    // Calculate winnings: (position_amount / winning_total) * total_liquidity
    let winning_total = market.outcome_totals[winning as usize];
    let payout = (position.amount as u128)
        .checked_mul(market.total_liquidity as u128)
        .ok_or(PredibergError::Overflow)?
        .checked_div(winning_total as u128)
        .ok_or(PredibergError::Overflow)? as u64;

    // Deduct protocol fee
    let fee = (payout as u128)
        .checked_mul(protocol.fee_bps as u128)
        .ok_or(PredibergError::Overflow)?
        .checked_div(10000)
        .ok_or(PredibergError::Overflow)? as u64;

    let net_payout = payout.checked_sub(fee).ok_or(PredibergError::Overflow)?;

    // Transfer winnings from vault
    let market_id = market.id.to_le_bytes();
    let seeds = &[
        MARKET_SEED,
        market_id.as_ref(),
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

    // Mark as claimed
    position.claimed = true;

    msg!("Claimed {} (fee: {})", net_payout, fee);
    Ok(())
}
