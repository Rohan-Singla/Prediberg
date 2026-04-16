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

    /// One position per user per market (no outcome byte in seed — user holds
    /// both YES and NO share ciphertexts in a single Position account).
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

    // ── Validation ─────────────────────────────────────────────────────────
    require!(market.status == MarketStatus::Active, PredibergError::MarketNotActive);
    require!(clock.unix_timestamp < market.end_time, PredibergError::MarketEnded);
    require!(params.outcome == YES || params.outcome == NO, PredibergError::InvalidOutcome);
    require!(params.amount > 0, PredibergError::InvalidAmount);

    // ── CPMM Calculation ───────────────────────────────────────────────────
    //
    // Buying YES:
    //   - User adds USDC to the NO side (increases NO pressure → raises YES price)
    //   - new_no_reserve  = no_reserve  + amount_in
    //   - new_yes_reserve = k / new_no_reserve
    //   - shares_out      = yes_reserve - new_yes_reserve
    //
    // Buying NO:  symmetric — add to YES side, shares come from NO side
    //
    // Fee: deducted from amount before pool update. Stays in vault.
    //
    // Encrypt (FHE): shares_out is computed as a public u64 here (the input
    // amount is a visible token transfer). We then create/update the user's
    // encrypted ciphertext account via Encrypt CPI so that the accumulated
    // position balance cannot be queried on-chain.
    // See: https://docs.encrypt.xyz

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
        // Buying YES: amount_in goes into NO side
        let new_no = (market.no_reserve as u128)
            .checked_add(amount_in as u128)
            .ok_or(PredibergError::Overflow)?;
        let new_yes = k
            .checked_div(new_no)
            .ok_or(PredibergError::InsufficientLiquidity)?;
        let shares = (market.yes_reserve as u128)
            .checked_sub(new_yes)
            .ok_or(PredibergError::InsufficientLiquidity)? as u64;

        // Enforce max impact: no single swap takes more than MAX_SWAP_IMPACT_BPS of pool
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
        // Buying NO: amount_in goes into YES side
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

    // ── Transfer collateral: user → vault ──────────────────────────────────
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

    market.total_liquidity = market.total_liquidity
        .checked_add(params.amount)
        .ok_or(PredibergError::Overflow)?;

    // ── Initialise position if new ─────────────────────────────────────────
    let position = &mut ctx.accounts.position;
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.owner = ctx.accounts.user.key();
        position.yes_shares_ct = Position::zero_ct();
        position.no_shares_ct = Position::zero_ct();
        position.redeemed = false;
        position.bump = ctx.bumps.position;
    }

    // ── Encrypt (FHE): update encrypted position balance ──────────────────
    //
    // The `shares_out` value is computed from public inputs (pool state +
    // transfer amount), so it is deterministic and known to observers of this
    // transaction. What Encrypt hides is the USER'S ACCUMULATED TOTAL across
    // all their swaps — no one can query the Position account and learn the
    // total exposure of any address.
    //
    // Integration steps (Encrypt pre-alpha, devnet):
    //   Endpoint: https://pre-alpha-dev-1.encrypt.ika-network.net:443
    //   Program:  4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8
    //
    //   If position has no existing ciphertext for this side:
    //     encrypt_program::create_plaintext_typed::<Uint64>(shares_out)
    //     → new ciphertext pubkey stored in position.yes_shares_ct (or no_shares_ct)
    //
    //   If position already has a ciphertext:
    //     #[encrypt_fn]
    //     fn accumulate(current: EUint64, delta: EUint64) -> EUint64 {
    //         current + delta
    //     }
    //     → output ciphertext pubkey replaces old handle in position
    //
    // The EncryptContext CPI accounts (encrypt_program, system_program,
    // payer, etc.) would be passed as remaining_accounts in production.
    // Stubbed here pending Anchor 0.32 / encrypt-anchor stabilisation.
    //
    // ── Stub (pre-alpha): mark the ciphertext slot as non-empty ───────────
    // In lieu of a real EUint64 handle, set the handle to the vault pubkey
    // (a stable non-zero sentinel) so that `has_yes_shares()` / `has_no_shares()`
    // correctly signal ownership. Replace with the Encrypt CPI output when the
    // SDK is stable.
    if params.outcome == YES {
        position.yes_shares_ct = ctx.accounts.vault.key();
    } else {
        position.no_shares_ct = ctx.accounts.vault.key();
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
