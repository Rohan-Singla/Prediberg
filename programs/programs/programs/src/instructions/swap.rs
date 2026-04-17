use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    TokenAccount, TokenInterface, transfer_checked, TransferChecked, Mint,
};
use crate::constants::{MARKET_SEED, VAULT_SEED, POSITION_SEED, MAX_SWAP_IMPACT_BPS};
use crate::errors::PredibergError;
use crate::state::{Market, Position, MarketStatus};

pub const YES: u8 = 0;
pub const NO: u8 = 1;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SwapParams {
    /// 0 = buy YES shares, 1 = buy NO shares
    pub outcome: u8,
    /// Amount of collateral (USDC) to spend
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(params: SwapParams)]
pub struct Swap<'info> {
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
        space = Position::LEN,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
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

pub fn handler(ctx: Context<Swap>, params: SwapParams) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;

    require!(market.status == MarketStatus::Active, PredibergError::MarketNotActive);
    require!(clock.unix_timestamp < market.end_time, PredibergError::MarketEnded);
    require!(params.outcome == YES || params.outcome == NO, PredibergError::InvalidOutcome);
    require!(params.amount > 0, PredibergError::InvalidAmount);

    // ── CPMM ──────────────────────────────────────────────────────────────
    let fee = (params.amount as u128)
        .checked_mul(market.swap_fee_bps as u128)
        .ok_or(PredibergError::Overflow)?
        .checked_div(10_000)
        .ok_or(PredibergError::Overflow)? as u64;

    let amount_in = params.amount
        .checked_sub(fee)
        .ok_or(PredibergError::Overflow)?;

    let k = market.k();
    require!(k > 0, PredibergError::ZeroLiquidity);

    let shares_out: u64 = if params.outcome == YES {
        let new_no = (market.no_reserve as u128)
            .checked_add(amount_in as u128)
            .ok_or(PredibergError::Overflow)?;
        let new_yes = k
            .checked_div(new_no)
            .ok_or(PredibergError::InsufficientLiquidity)?;
        let shares = (market.yes_reserve as u128)
            .checked_sub(new_yes)
            .ok_or(PredibergError::InsufficientLiquidity)? as u64;

        let max_out = (market.yes_reserve as u128)
            .checked_mul(MAX_SWAP_IMPACT_BPS as u128)
            .ok_or(PredibergError::Overflow)?
            .checked_div(10_000)
            .ok_or(PredibergError::Overflow)? as u64;
        require!(shares <= max_out, PredibergError::SwapTooLarge);

        market.yes_reserve = new_yes as u64;
        market.no_reserve = new_no as u64;
        market.yes_shares_total = market.yes_shares_total
            .checked_add(shares)
            .ok_or(PredibergError::Overflow)?;
        shares
    } else {
        let new_yes = (market.yes_reserve as u128)
            .checked_add(amount_in as u128)
            .ok_or(PredibergError::Overflow)?;
        let new_no = k
            .checked_div(new_yes)
            .ok_or(PredibergError::InsufficientLiquidity)?;
        let shares = (market.no_reserve as u128)
            .checked_sub(new_no)
            .ok_or(PredibergError::InsufficientLiquidity)? as u64;

        let max_out = (market.no_reserve as u128)
            .checked_mul(MAX_SWAP_IMPACT_BPS as u128)
            .ok_or(PredibergError::Overflow)?
            .checked_div(10_000)
            .ok_or(PredibergError::Overflow)? as u64;
        require!(shares <= max_out, PredibergError::SwapTooLarge);

        market.no_reserve = new_no as u64;
        market.yes_reserve = new_yes as u64;
        market.no_shares_total = market.no_shares_total
            .checked_add(shares)
            .ok_or(PredibergError::Overflow)?;
        shares
    };

    require!(shares_out > 0, PredibergError::InsufficientLiquidity);

    // ── Transfer collateral: user → vault ─────────────────────────────────
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

    // ── Init or update position ────────────────────────────────────────────
    let position = &mut ctx.accounts.position;
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.owner = ctx.accounts.user.key();
        position.yes_shares = 0;
        position.no_shares = 0;
        position.redeemed = false;
        position.bump = ctx.bumps.position;
    }

    if params.outcome == YES {
        position.yes_shares = position.yes_shares
            .checked_add(shares_out)
            .ok_or(PredibergError::Overflow)?;
    } else {
        position.no_shares = position.no_shares
            .checked_add(shares_out)
            .ok_or(PredibergError::Overflow)?;
    }

    msg!(
        "swap outcome={} amount={} fee={} shares_out={} | yes_res={} no_res={} yes_price_pct={}",
        params.outcome,
        params.amount,
        fee,
        shares_out,
        market.yes_reserve,
        market.no_reserve,
        market.yes_price_scaled() / 10_000,
    );

    Ok(())
}
