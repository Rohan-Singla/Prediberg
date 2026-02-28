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

    pub fn initialize(ctx: Context<Initialize>, config: InitializeConfig) -> Result<()> {
        instructions::initialize::handler(ctx, config)
    }

    pub fn create_market(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
        instructions::create_market::handler(ctx, params)
    }

    pub fn place_prediction(
        ctx: Context<PlacePrediction>,
        params: PlacePredictionParams,
    ) -> Result<()> {
        instructions::place_prediction::handler(ctx, params)
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        params: ResolveMarketParams,
    ) -> Result<()> {
        instructions::resolve_market::handler(ctx, params)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }
}
