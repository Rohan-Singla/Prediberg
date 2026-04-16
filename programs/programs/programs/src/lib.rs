use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("ERBbHZVm9JdNv31YDj8SstNy6vwuCyAwifhUWtQKdtN5");

#[program]
pub mod prediberg {
    use super::*;

    /// One-time protocol setup — sets oracle, treasury, fee config.
    pub fn initialize(ctx: Context<Initialize>, config: InitializeConfig) -> Result<()> {
        instructions::initialize::handler(ctx, config)
    }

    /// Create a binary (YES/NO) prediction market and seed the AMM pool.
    pub fn create_market(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
        instructions::create_market::handler(ctx, params)
    }

    /// Buy YES or NO shares via the CPMM. Encrypted position updated via Encrypt FHE.
    pub fn swap(ctx: Context<Swap>, params: SwapParams) -> Result<()> {
        instructions::swap::handler(ctx, params)
    }

    /// Oracle resolves the market by declaring the winning outcome.
    pub fn resolve_market(ctx: Context<ResolveMarket>, params: ResolveMarketParams) -> Result<()> {
        instructions::resolve_market::handler(ctx, params)
    }

    /// Step 1 of redemption: request Encrypt decryption of the user's position.
    pub fn request_redeem(ctx: Context<RequestRedeem>) -> Result<()> {
        instructions::redeem::request_redeem_handler(ctx)
    }

    /// Step 2 of redemption: claim payout using the decrypted share count.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>, params: ClaimWinningsParams) -> Result<()> {
        instructions::redeem::claim_winnings_handler(ctx, params)
    }
}
