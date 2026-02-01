use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface, transfer_checked, TransferChecked, Mint};
use crate::constants::{MARKET_SEED, VAULT_SEED, POSITION_SEED};
use crate::errors::PredibergError;
use crate::state::{Market, Position, MarketStatus};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PlacePredictionParams {
    pub outcome: u8,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(params: PlacePredictionParams)]
pub struct PlacePrediction<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref(), &[params.outcome]],
        bump
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
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PlacePrediction>, params: PlacePredictionParams) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;

    // Validate market is active
    require!(market.status == MarketStatus::Active, PredibergError::MarketNotActive);
    require!(clock.unix_timestamp < market.end_time, PredibergError::MarketEnded);

    // Validate outcome
    require!(
        (params.outcome as usize) < market.outcomes.len(),
        PredibergError::InvalidOutcome
    );

    // Validate amount
    require!(params.amount > 0, PredibergError::InvalidAmount);

    // Transfer collateral to vault
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
            },
        ),
        params.amount,
        ctx.accounts.collateral_mint.decimals,
    )?;

    // Update market totals
    market.total_liquidity = market.total_liquidity.checked_add(params.amount).ok_or(PredibergError::Overflow)?;
    market.outcome_totals[params.outcome as usize] = market.outcome_totals[params.outcome as usize]
        .checked_add(params.amount)
        .ok_or(PredibergError::Overflow)?;

    // Update position
    let position = &mut ctx.accounts.position;
    if position.amount == 0 {
        position.market = market.key();
        position.owner = ctx.accounts.user.key();
        position.outcome = params.outcome;
        position.claimed = false;
        position.bump = ctx.bumps.position;
    }
    position.amount = position.amount.checked_add(params.amount).ok_or(PredibergError::Overflow)?;

    msg!(
        "Prediction placed: {} tokens on outcome {}",
        params.amount,
        params.outcome
    );
    Ok(())
}
