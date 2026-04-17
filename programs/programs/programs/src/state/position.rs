use anchor_lang::prelude::*;

#[account]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub yes_shares: u64,
    pub no_shares: u64,
    pub redeemed: bool,
    pub bump: u8,
}

impl Position {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;

    pub fn has_yes_shares(&self) -> bool {
        self.yes_shares > 0
    }

    pub fn has_no_shares(&self) -> bool {
        self.no_shares > 0
    }
}
