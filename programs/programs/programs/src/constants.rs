use anchor_lang::prelude::*;

#[constant]
pub const PROTOCOL_SEED: &[u8] = b"protocol";

#[constant]
pub const MARKET_SEED: &[u8] = b"market";

#[constant]
pub const POSITION_SEED: &[u8] = b"position";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

pub const PROTOCOL_FEE_BPS: u16 = 100;        // 1% fee on redemptions
pub const DEFAULT_SWAP_FEE_BPS: u16 = 30;     // 0.3% fee on swaps
pub const MAX_SWAP_IMPACT_BPS: u64 = 5000;    // max 50% of pool per single swap

pub const MIN_MARKET_DURATION: i64 = 3600;
pub const MAX_MARKET_DURATION: i64 = 365 * 24 * 3600;
pub const RESOLUTION_WINDOW: i64 = 24 * 3600;
