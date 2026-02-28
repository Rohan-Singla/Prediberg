use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub outcome: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}
