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
    /// Unique market identifier
    pub id: u64,

    /// Market creator
    pub creator: Pubkey,

    /// Market question/title
    #[max_len(256)]
    pub question: String,

    /// Market description
    #[max_len(1024)]
    pub description: String,

    /// Outcome labels
    #[max_len(MAX_OUTCOMES, 64)]
    pub outcomes: Vec<String>,

    /// Outcome token mints (Token-2022)
    #[max_len(MAX_OUTCOMES)]
    pub outcome_mints: Vec<Pubkey>,

    /// Total tokens minted per outcome
    #[max_len(MAX_OUTCOMES)]
    pub outcome_totals: Vec<u64>,

    /// Market end timestamp
    pub end_time: i64,

    /// Resolution timestamp (0 if not resolved)
    pub resolution_time: i64,

    /// Winning outcome index (None if not resolved)
    pub winning_outcome: Option<u8>,

    /// Market status
    pub status: MarketStatus,

    /// Total liquidity in vault
    pub total_liquidity: u64,

    /// Collateral mint (USDC, etc.)
    pub collateral_mint: Pubkey,

    /// Vault holding collateral
    pub vault: Pubkey,

    /// Bump seed for PDA
    pub bump: u8,

    /// Created at timestamp
    pub created_at: i64,
}
