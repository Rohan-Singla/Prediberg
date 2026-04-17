use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MarketStatus {
    Active,
    Resolved,
    Cancelled,
}

/// Binary prediction market (YES / NO).
///
/// AMM model: Constant Product Market Maker (x * y = k)
///   yes_reserve * no_reserve = k
///
/// Price of YES = no_reserve / (yes_reserve + no_reserve)
/// Price of NO  = yes_reserve / (yes_reserve + no_reserve)
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub id: u64,
    pub collateral_mint: Pubkey,
    pub yes_reserve: u64,
    pub no_reserve: u64,
    pub yes_shares_total: u64,
    pub no_shares_total: u64,
    pub swap_fee_bps: u16,
    pub end_time: i64,
    pub winning_outcome: Option<u8>,
    pub status: MarketStatus,
    pub bump: u8,
}

impl Market {
    pub fn yes_price_scaled(&self) -> u64 {
        if self.yes_reserve == 0 && self.no_reserve == 0 {
            return 500_000;
        }
        let total = self.yes_reserve.saturating_add(self.no_reserve);
        (self.no_reserve as u128)
            .saturating_mul(1_000_000)
            .checked_div(total as u128)
            .unwrap_or(500_000) as u64
    }

    pub fn k(&self) -> u128 {
        (self.yes_reserve as u128)
            .checked_mul(self.no_reserve as u128)
            .unwrap_or(0)
    }
}
