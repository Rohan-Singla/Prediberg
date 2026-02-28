use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("65y5sBTQ8rfth35N1qmH57z1s6JrhNevGTFfiTV6kait");

#[program]
pub mod prediberg {
    use super::*;

    /// Initialize the protocol configuration
    pub fn initialize(ctx: Context<Initialize>, config: InitializeConfig) -> Result<()> {
        instructions::initialize::handler(ctx, config)
    }

    /// Create a new prediction market
    pub fn create_market(ctx: Context<CreateMarket>, params: CreateMarketParams) -> Result<()> {
        instructions::create_market::handler(ctx, params)
    }

    /// Place a prediction (buy outcome tokens)
    pub fn place_prediction(
        ctx: Context<PlacePrediction>,
        params: PlacePredictionParams,
    ) -> Result<()> {
        instructions::place_prediction::handler(ctx, params)
    }

    /// Resolve market outcome (oracle only)
    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        params: ResolveMarketParams,
    ) -> Result<()> {
        instructions::resolve_market::handler(ctx, params)
    }

    /// Claim winnings after market resolution
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }
}

