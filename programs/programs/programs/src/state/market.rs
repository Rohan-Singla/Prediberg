use anchor_lang::prelude::*;
use crate::constants::MAX_OUTCOMES;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MarketStatus {
    Active,
    Resolved,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub id: u64,
    pub creator: Pubkey,
    #[max_len(256)]
    pub question: String,
    #[max_len(1024)]
    pub description: String,
    #[max_len(MAX_OUTCOMES, 64)]
    pub outcomes: Vec<String>,
    #[max_len(MAX_OUTCOMES)]
    pub outcome_mints: Vec<Pubkey>,
    #[max_len(MAX_OUTCOMES)]
    pub outcome_totals: Vec<u64>,
    pub end_time: i64,
    pub resolution_time: i64,
    pub winning_outcome: Option<u8>,
    pub status: MarketStatus,
    pub total_liquidity: u64,
    pub collateral_mint: Pubkey,
    pub vault: Pubkey,
    pub bump: u8,
    pub created_at: i64,
}
