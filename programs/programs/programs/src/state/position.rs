use anchor_lang::prelude::*;

/// A user's position in a binary prediction market.
///
/// # Encrypt (FHE) Integration
///
/// `yes_shares` and `no_shares` are stored as `EUint64` handles — each is
/// a Pubkey pointing to a separate ciphertext account managed by the
/// Encrypt program (`4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8`).
///
/// The plaintext share counts are never visible on-chain. Only the Encrypt
/// network and the position owner (who holds the decryption key) can learn
/// the actual values. Pool-level reserves (`yes_reserve`, `no_reserve`) in
/// the Market account remain public for price discovery.
///
/// Off-chain FHE evaluation flow (per swap):
///   1. Program calls `encrypt_program::add_euint64(current_ct, delta_ct)`
///   2. Encrypt executors evaluate the FHE graph off-chain
///   3. Resulting ciphertext address stored back in this Position
///
/// Decryption flow (redemption):
///   1. User calls `request_redeem` → triggers Encrypt decryption CPI
///   2. Encrypt executors decrypt → write plaintext to reveal account
///   3. User calls `claim_winnings` → reads reveal account, computes payout
///
/// See: https://docs.encrypt.xyz
#[account]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    /// Encrypt ciphertext account holding encrypted YES share count (EUint64)
    pub yes_shares_ct: Pubkey,
    /// Encrypt ciphertext account holding encrypted NO share count (EUint64)
    pub no_shares_ct: Pubkey,
    /// True once the position has been fully redeemed post-resolution
    pub redeemed: bool,
    pub bump: u8,
}

impl Position {
    /// Account space: 8 discriminator + 32 + 32 + 32 + 32 + 1 + 1
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 1 + 1;

    /// Sentinel Pubkey used when a side has zero shares (no ciphertext created yet)
    pub fn zero_ct() -> Pubkey {
        Pubkey::default()
    }

    pub fn has_yes_shares(&self) -> bool {
        self.yes_shares_ct != Self::zero_ct()
    }

    pub fn has_no_shares(&self) -> bool {
        self.no_shares_ct != Self::zero_ct()
    }
}
