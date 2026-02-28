use anchor_lang::prelude::*;

#[constant]
pub const PROTOCOL_SEED: &[u8] = b"protocol";

#[constant]
pub const MARKET_SEED: &[u8] = b"market";

#[constant]
pub const POSITION_SEED: &[u8] = b"position";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const OUTCOME_MINT_SEED: &[u8] = b"outcome_mint";

pub const PROTOCOL_FEE_BPS: u16 = 100; // 1%
pub const MAX_OUTCOMES: usize = 10;
pub const MIN_MARKET_DURATION: i64 = 3600;
pub const MAX_MARKET_DURATION: i64 = 365 * 24 * 3600;
pub const RESOLUTION_WINDOW: i64 = 24 * 3600;
