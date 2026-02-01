# Prediberg - AI-Powered Prediction Markets on Solana

## Project Overview

Prediberg is a decentralized prediction market platform built on Solana using SPL Token-2022. Markets are resolved by an AI oracle service that aggregates evidence from multiple data sources.

## Architecture

```
prediberg/
├── programs/prediberg/     # Anchor/Solana program
├── app/                    # Next.js frontend
├── backend/                # Fastify API server
├── sdk/                    # TypeScript SDK
├── oracle/                 # AI Judge oracle service
└── tests/                  # Integration tests
```

### Key Components

- **Solana Program**: Anchor-based smart contract handling markets, predictions, and payouts
- **Frontend**: Next.js 14 with Tailwind CSS and Solana wallet adapter
- **Backend**: Fastify API with Drizzle ORM (PostgreSQL) for off-chain data
- **SDK**: TypeScript SDK for program interaction
- **Oracle**: AI judge service for market resolution (pluggable LLM providers)

## Development Commands

### Root Level
```bash
pnpm install           # Install all dependencies
anchor build           # Build Solana program
anchor test            # Run program tests
pnpm build            # Build all packages
```

### Frontend (app/)
```bash
pnpm --filter app dev      # Start Next.js dev server
pnpm --filter app build    # Build for production
```

### Backend (backend/)
```bash
pnpm --filter backend dev      # Start Fastify dev server
pnpm --filter backend db:push  # Push schema to database
pnpm --filter backend db:studio # Open Drizzle Studio
```

### SDK (sdk/)
```bash
pnpm --filter sdk build    # Build SDK
pnpm --filter sdk dev      # Watch mode
```

### Oracle (oracle/)
```bash
pnpm --filter oracle dev   # Start oracle service
```

## Key Files

| File | Purpose |
|------|---------|
| `programs/prediberg/src/lib.rs` | Program entry point with instruction handlers |
| `programs/prediberg/src/state/` | Account structures (Protocol, Market, Position) |
| `programs/prediberg/src/instructions/` | Instruction implementations |
| `programs/prediberg/src/errors.rs` | Custom error definitions |
| `app/src/components/Providers.tsx` | Solana wallet provider setup |
| `backend/src/db/schema.ts` | Drizzle database schema |
| `sdk/src/accounts/` | PDA derivation helpers |
| `sdk/src/instructions/` | Instruction builders |
| `oracle/src/judges/interface.ts` | AI judge interface |

## Code Conventions

### Rust (Solana Program)
- Use `anchor_lang` and `anchor_spl` for Solana interactions
- Define accounts in `state/` directory
- Keep instruction handlers in `instructions/` directory
- Use `#[derive(InitSpace)]` for automatic space calculation
- Validate all inputs before state changes

### TypeScript
- Use strict mode (`"strict": true`)
- Prefer `type` over `interface` for simple types
- Use barrel exports (`index.ts`) in each directory
- Use `.js` extensions in imports for ESM compatibility

## Program Instructions

1. **initialize** - Set up protocol with oracle and treasury
2. **create_market** - Create new prediction market
3. **place_prediction** - Buy outcome tokens
4. **resolve_market** - Oracle resolves winning outcome
5. **claim_winnings** - Winners claim their payout

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# Required
DATABASE_URL=postgresql://...
SOLANA_RPC_URL=https://api.devnet.solana.com

# For oracle
ORACLE_PRIVATE_KEY=[...] # JSON array of secret key bytes
OPENAI_API_KEY=sk-...    # For AI judge (future)
```

## Adding New Features

### New Instruction
1. Create handler in `programs/prediberg/src/instructions/`
2. Export from `instructions/mod.rs`
3. Add to `lib.rs` program module
4. Add SDK instruction builder in `sdk/src/instructions/`
5. Update types in `sdk/src/types/`

### New Data Source (Oracle)
1. Implement `IDataSource` interface in `oracle/src/sources/`
2. Export from `oracle/src/sources/index.ts`
3. Register in oracle service

### New AI Judge Provider
1. Implement `IJudge` interface in `oracle/src/judges/`
2. Add provider-specific configuration
3. Export from `oracle/src/judges/index.ts`

## Token Standard

Using SPL Token-2022 for outcome tokens with potential for:
- Transfer hooks (fee collection)
- Metadata extensions
- Non-transferable tokens (soulbound positions)
