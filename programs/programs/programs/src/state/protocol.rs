use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Protocol {
    /// Protocol authority (can update settings)
    pub authority: Pubkey,

    /// Oracle authority (can resolve markets)
    pub oracle: Pubkey,

    /// Treasury for protocol fees
    pub treasury: Pubkey,

    /// Protocol fee in basis points
    pub fee_bps: u16,

    /// Total markets created
    pub total_markets: u64,

    /// Total volume in lamports
    pub total_volume: u64,

    /// Bump seed for PDA
    pub bump: u8,
}
