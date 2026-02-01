use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::constants::{PROTOCOL_SEED, MARKET_SEED, VAULT_SEED, MAX_OUTCOMES, MIN_MARKET_DURATION, MAX_MARKET_DURATION};
use crate::errors::PredibergError;
use crate::state::{Protocol, Market, MarketStatus};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateMarketParams {
    pub question: String,
    pub description: String,
    pub outcomes: Vec<String>,
    pub end_time: i64,
}

#[derive(Accounts)]
#[instruction(params: CreateMarketParams)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, &protocol.total_markets.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    /// Collateral mint (e.g., USDC)
    pub collateral_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = creator,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = market,
        token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Validate duration
    let duration = params.end_time.checked_sub(current_time).ok_or(PredibergError::Overflow)?;
    require!(
        duration >= MIN_MARKET_DURATION && duration <= MAX_MARKET_DURATION,
        PredibergError::InvalidDuration
    );

    // Validate outcomes
    require!(
        params.outcomes.len() >= 2 && params.outcomes.len() <= MAX_OUTCOMES,
        PredibergError::TooManyOutcomes
    );

    let protocol = &mut ctx.accounts.protocol;
    let market = &mut ctx.accounts.market;

    market.id = protocol.total_markets;
    market.creator = ctx.accounts.creator.key();
    market.question = params.question;
    market.description = params.description;
    market.outcomes = params.outcomes;
    market.outcome_mints = Vec::new();
    market.outcome_totals = vec![0; market.outcomes.len()];
    market.end_time = params.end_time;
    market.resolution_time = 0;
    market.winning_outcome = None;
    market.status = MarketStatus::Active;
    market.total_liquidity = 0;
    market.collateral_mint = ctx.accounts.collateral_mint.key();
    market.vault = ctx.accounts.vault.key();
    market.bump = ctx.bumps.market;
    market.created_at = current_time;

    protocol.total_markets = protocol.total_markets.checked_add(1).ok_or(PredibergError::Overflow)?;

    msg!("Market {} created: {}", market.id, market.question);
    Ok(())
}
