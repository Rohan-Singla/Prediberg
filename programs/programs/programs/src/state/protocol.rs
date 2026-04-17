use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Protocol {
    pub authority: Pubkey,
    pub oracle: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub total_markets: u64,
    pub bump: u8,
}
