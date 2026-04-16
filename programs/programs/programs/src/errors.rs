use anchor_lang::prelude::*;

#[error_code]
pub enum PredibergError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Market not active")]
    MarketNotActive,
    #[msg("Market already resolved")]
    MarketAlreadyResolved,
    #[msg("Market has not ended yet")]
    MarketNotEnded,
    #[msg("Market ended")]
    MarketEnded,
    #[msg("Invalid outcome — must be 0 (YES) or 1 (NO)")]
    InvalidOutcome,
    #[msg("Invalid duration")]
    InvalidDuration,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Resolution window expired")]
    ResolutionWindowExpired,
    #[msg("Already redeemed")]
    AlreadyRedeemed,
    #[msg("Not a winner")]
    NotAWinner,
    #[msg("Insufficient liquidity — swap too large for pool depth")]
    InsufficientLiquidity,
    #[msg("Swap too large — exceeds 50% of pool")]
    SwapTooLarge,
    #[msg("Zero initial liquidity")]
    ZeroLiquidity,
    #[msg("Overflow")]
    Overflow,
}
