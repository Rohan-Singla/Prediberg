use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked,
};
use crate::constants::{
    PROTOCOL_SEED, MARKET_SEED, VAULT_SEED,
    MIN_MARKET_DURATION, MAX_MARKET_DURATION, DEFAULT_SWAP_FEE_BPS,
};
use crate::errors::PredibergError;
use crate::state::{Protocol, Market, MarketStatus};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateMarketParams {
    pub end_time: i64,
    pub initial_liquidity: u64,
    pub swap_fee_bps: Option<u16>,
}

#[derive(Accounts)]
#[instruction(params: CreateMarketParams)]
pub struct CreateMarket<'info> {
    #[account(
        mut,
        constraint = creator.key() == protocol.authority @ PredibergError::Unauthorized
    )]
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

    #[account(
        mut,
        constraint = creator_token_account.owner == creator.key(),
        constraint = creator_token_account.mint == collateral_mint.key()
    )]
    pub creator_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
    let clock = Clock::get()?;
    let now   = clock.unix_timestamp;

    let duration = params.end_time
        .checked_sub(now)
        .ok_or(PredibergError::Overflow)?;
    require!(
        duration >= MIN_MARKET_DURATION && duration <= MAX_MARKET_DURATION,
        PredibergError::InvalidDuration
    );

    require!(params.initial_liquidity > 0, PredibergError::ZeroLiquidity);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from:      ctx.accounts.creator_token_account.to_account_info(),
                to:        ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
                mint:      ctx.accounts.collateral_mint.to_account_info(),
            },
        ),
        params.initial_liquidity,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let protocol = &mut ctx.accounts.protocol;
    let market   = &mut ctx.accounts.market;

    market.id               = protocol.total_markets;
    market.collateral_mint  = ctx.accounts.collateral_mint.key();
    market.yes_reserve      = params.initial_liquidity;
    market.no_reserve       = params.initial_liquidity;
    market.yes_shares_total = 0;
    market.no_shares_total  = 0;
    market.swap_fee_bps     = params.swap_fee_bps.unwrap_or(DEFAULT_SWAP_FEE_BPS);
    market.end_time         = params.end_time;
    market.winning_outcome  = None;
    market.status           = MarketStatus::Active;
    market.bump             = ctx.bumps.market;

    protocol.total_markets = protocol.total_markets
        .checked_add(1)
        .ok_or(PredibergError::Overflow)?;

    msg!("Market {} created | pool={}", market.id, params.initial_liquidity);
    Ok(())
}
