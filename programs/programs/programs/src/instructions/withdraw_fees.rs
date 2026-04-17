use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    TokenAccount, TokenInterface, transfer_checked, TransferChecked, Mint,
};
use crate::constants::{PROTOCOL_SEED, MARKET_SEED, VAULT_SEED};
use crate::errors::PredibergError;
use crate::state::{Protocol, Market, MarketStatus};

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(
        constraint = authority.key() == protocol.authority @ PredibergError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Account<'info, Protocol>,

    #[account(
        seeds = [MARKET_SEED, &market.id.to_le_bytes()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Resolved @ PredibergError::MarketNotActive,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Treasury token account — must be owned by protocol.treasury
    #[account(
        mut,
        constraint = treasury_token_account.owner == protocol.treasury,
        constraint = treasury_token_account.mint == market.collateral_mint
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<WithdrawFees>) -> Result<()> {
    let vault_balance = ctx.accounts.vault.amount;
    require!(vault_balance > 0, PredibergError::InsufficientLiquidity);

    let market        = &ctx.accounts.market;
    let market_id_bytes = market.id.to_le_bytes();
    let seeds         = &[MARKET_SEED, market_id_bytes.as_ref(), &[market.bump]];
    let signer_seeds  = &[&seeds[..]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from:      ctx.accounts.vault.to_account_info(),
                to:        ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
                mint:      ctx.accounts.collateral_mint.to_account_info(),
            },
            signer_seeds,
        ),
        vault_balance,
        ctx.accounts.collateral_mint.decimals,
    )?;

    msg!("Fees withdrawn: {} from market {}", vault_balance, market.id);
    Ok(())
}
