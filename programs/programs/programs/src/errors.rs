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
    #[msg("Invalid outcome")]
    InvalidOutcome,
    #[msg("Invalid duration")]
    InvalidDuration,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Resolution window expired")]
    ResolutionWindowExpired,
    #[msg("Nothing to claim")]
    NoWinnings,
    #[msg("Too many outcomes")]
    TooManyOutcomes,
    #[msg("Overflow")]
    Overflow,
    #[msg("Invalid oracle signature")]
    InvalidOracleSignature,
}
