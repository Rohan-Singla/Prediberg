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
///
/// Both prices are always bounded (0, 1) and sum to 1.
#[account]
#[derive(InitSpace)]
pub struct Market {
    /// Sequential market ID (used as PDA seed)
    pub id: u64,
    /// Wallet that created this market (protocol authority)
    pub creator: Pubkey,
    /// The prediction question, e.g. "Will India win T20 WC 2026?"
    #[max_len(256)]
    pub question: String,
    /// Additional context for resolution
    #[max_len(1024)]
    pub description: String,
    /// Label for outcome 0, e.g. "YES"
    #[max_len(32)]
    pub yes_label: String,
    /// Label for outcome 1, e.g. "NO"
    #[max_len(32)]
    pub no_label: String,

    // ── AMM pool state ─────────────────────────────────────────────────────
    /// Virtual YES liquidity in pool (decreases when users buy YES)
    pub yes_reserve: u64,
    /// Virtual NO liquidity in pool (increases when users buy YES)
    pub no_reserve: u64,
    /// Total YES shares outstanding (issued to users)
    pub yes_shares_total: u64,
    /// Total NO shares outstanding (issued to users)
    pub no_shares_total: u64,
    /// Swap fee in basis points (default: 30 = 0.3%)
    pub swap_fee_bps: u16,

    // ── Resolution ─────────────────────────────────────────────────────────
    pub end_time: i64,
    pub resolution_time: i64,
    /// 0 = YES won, 1 = NO won
    pub winning_outcome: Option<u8>,
    pub status: MarketStatus,

    // ── Vault ──────────────────────────────────────────────────────────────
    /// Total USDC locked in vault (initial_liquidity + all swap amounts)
    pub total_liquidity: u64,
    pub collateral_mint: Pubkey,
    pub vault: Pubkey,

    pub bump: u8,
    pub created_at: i64,
}

impl Market {
    /// Current implied probability of YES (scaled by 1e6 for precision)
    /// Returns value in range (0, 1_000_000) representing 0%–100%
    pub fn yes_price_scaled(&self) -> u64 {
        if self.yes_reserve == 0 && self.no_reserve == 0 {
            return 500_000; // 50% default
        }
        let total = self.yes_reserve.saturating_add(self.no_reserve);
        (self.no_reserve as u128)
            .saturating_mul(1_000_000)
            .checked_div(total as u128)
            .unwrap_or(500_000) as u64
    }

    /// The AMM invariant k = yes_reserve * no_reserve
    pub fn k(&self) -> u128 {
        (self.yes_reserve as u128)
            .checked_mul(self.no_reserve as u128)
            .unwrap_or(0)
    }
}
