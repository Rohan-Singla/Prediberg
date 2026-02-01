use anchor_lang::prelude::*;
use crate::constants::{PROTOCOL_SEED, PROTOCOL_FEE_BPS};
use crate::state::Protocol;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeConfig {
    pub oracle: Pubkey,
    pub treasury: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Protocol::INIT_SPACE,
        seeds = [PROTOCOL_SEED],
        bump
    )]
    pub protocol: Account<'info, Protocol>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, config: InitializeConfig) -> Result<()> {
    let protocol = &mut ctx.accounts.protocol;

    protocol.authority = ctx.accounts.authority.key();
    protocol.oracle = config.oracle;
    protocol.treasury = config.treasury;
    protocol.fee_bps = PROTOCOL_FEE_BPS;
    protocol.total_markets = 0;
    protocol.total_volume = 0;
    protocol.bump = ctx.bumps.protocol;

    msg!("Protocol initialized");
    Ok(())
}
