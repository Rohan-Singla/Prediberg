use anchor_lang::prelude::*;
use crate::constants::{PROTOCOL_SEED, MARKET_SEED, RESOLUTION_WINDOW};
use crate::errors::PredibergError;
use crate::state::{Protocol, Market, MarketStatus};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ResolveMarketParams {
    pub winning_outcome: u8,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        constraint = oracle.key() == protocol.oracle @ PredibergError::Unauthorized
    )]
    pub oracle: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        mut,
        seeds = [MARKET_SEED, &market.id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<ResolveMarket>, params: ResolveMarketParams) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;

    require!(market.status == MarketStatus::Active, PredibergError::MarketAlreadyResolved);
    require!(clock.unix_timestamp >= market.end_time, PredibergError::MarketNotEnded);

    let window_end = market.end_time.checked_add(RESOLUTION_WINDOW).ok_or(PredibergError::Overflow)?;
    require!(clock.unix_timestamp <= window_end, PredibergError::ResolutionWindowExpired);
    require!((params.winning_outcome as usize) < market.outcomes.len(), PredibergError::InvalidOutcome);

    market.winning_outcome = Some(params.winning_outcome);
    market.status = MarketStatus::Resolved;
    market.resolution_time = clock.unix_timestamp;

    msg!("Market {} resolved -> outcome {}", market.id, params.winning_outcome);
    Ok(())
}
