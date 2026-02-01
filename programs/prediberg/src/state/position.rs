use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Position {
    /// Market this position belongs to
    pub market: Pubkey,

    /// Position owner
    pub owner: Pubkey,

    /// Outcome index
    pub outcome: u8,

    /// Amount of outcome tokens held
    pub amount: u64,

    /// Claimed status
    pub claimed: bool,

    /// Bump seed for PDA
    pub bump: u8,
}
