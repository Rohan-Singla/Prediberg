use anchor_lang::prelude::*;

#[error_code]
pub enum PredibergError {
    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Market is not active")]
    MarketNotActive,

    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,

    #[msg("Market has not ended yet")]
    MarketNotEnded,

    #[msg("Market end time has passed")]
    MarketEnded,

    #[msg("Invalid outcome index")]
    InvalidOutcome,

    #[msg("Invalid market duration")]
    InvalidDuration,

    #[msg("Insufficient funds")]
    InsufficientFunds,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Resolution window has expired")]
    ResolutionWindowExpired,

    #[msg("No winnings to claim")]
    NoWinnings,

    #[msg("Too many outcomes")]
    TooManyOutcomes,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Invalid oracle signature")]
    InvalidOracleSignature,
}
