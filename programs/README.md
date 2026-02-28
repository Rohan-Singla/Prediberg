# Prediberg Solana Program

Decentralized prediction market protocol built with Anchor on Solana. Users create markets with multiple outcomes, place predictions by depositing collateral, and claim winnings after an oracle resolves the market.

**Program ID:** `ERBbHZVm9JdNv31YDj8SstNy6vwuCyAwifhUWtQKdtN5`

**Network:** Devnet

## Architecture

```
programs/prediberg/src/
├── lib.rs                # Program entry point
├── constants.rs          # Seeds, fees, limits
├── errors.rs             # Custom error codes
├── state/
│   ├── protocol.rs       # Global protocol config (authority, oracle, treasury, fees)
│   ├── market.rs         # Market account (question, outcomes, liquidity, status)
│   └── position.rs       # User position per market/outcome
└── instructions/
    ├── initialize.rs     # Set up protocol
    ├── create_market.rs  # Create a new market
    ├── place_prediction.rs # Buy into an outcome
    ├── resolve_market.rs # Oracle resolves the winner
    └── claim_winnings.rs # Winners withdraw payout
```

## Accounts

### Protocol
Global singleton PDA storing protocol-level configuration.

| Field          | Type   | Description                      |
|----------------|--------|----------------------------------|
| authority      | Pubkey | Admin who can update settings    |
| oracle         | Pubkey | Authorized market resolver       |
| treasury       | Pubkey | Fee collection address           |
| fee_bps        | u16    | Protocol fee (default: 100 = 1%) |
| total_markets  | u64    | Counter for market IDs           |
| total_volume   | u64    | Cumulative volume                |

**PDA:** `[b"protocol"]`

### Market
One account per prediction market.

| Field            | Type          | Description                         |
|------------------|---------------|-------------------------------------|
| id               | u64           | Unique market ID                    |
| creator          | Pubkey        | Market creator                      |
| question         | String (256)  | Market question                     |
| description      | String (1024) | Detailed description                |
| outcomes         | Vec\<String\> | Outcome labels (max 10, 64 chars)   |
| outcome_totals   | Vec\<u64\>    | Total tokens per outcome            |
| end_time         | i64           | Betting deadline (unix timestamp)   |
| resolution_time  | i64           | When market was resolved            |
| winning_outcome  | Option\<u8\>  | Winning outcome index               |
| status           | MarketStatus  | Active / Resolved / Cancelled       |
| total_liquidity  | u64           | Total collateral in vault           |
| collateral_mint  | Pubkey        | Accepted token mint (e.g., USDC)    |
| vault            | Pubkey        | Token account holding collateral    |

**PDA:** `[b"market", market_id.to_le_bytes()]`

### Position
One account per user per market per outcome.

| Field   | Type   | Description                |
|---------|--------|----------------------------|
| market  | Pubkey | Associated market          |
| owner   | Pubkey | Position owner             |
| outcome | u8     | Outcome index              |
| amount  | u64    | Collateral deposited       |
| claimed | bool   | Whether winnings claimed   |

**PDA:** `[b"position", market_key, user_key, outcome]`

## Instructions

### 1. `initialize`
Sets up the global protocol account.

- **Signer:** Authority
- **Params:** `oracle` (Pubkey), `treasury` (Pubkey)
- **Effect:** Creates Protocol PDA with default 1% fee

### 2. `create_market`
Creates a new prediction market with a collateral vault.

- **Signer:** Protocol authority
- **Params:** `question`, `description`, `outcomes` (Vec\<String\>), `end_time` (i64)
- **Validations:**
  - Duration between 1 hour and 365 days
  - 2-10 outcomes
- **Effect:** Creates Market PDA and associated token vault

### 3. `place_prediction`
Deposits collateral to back a specific outcome.

- **Signer:** User
- **Params:** `outcome` (u8), `amount` (u64)
- **Validations:**
  - Market is active and not past end time
  - Valid outcome index
  - Amount > 0
- **Effect:** Transfers collateral to vault, creates/updates Position PDA

### 4. `resolve_market`
Oracle declares the winning outcome.

- **Signer:** Oracle (must match `protocol.oracle`)
- **Params:** `winning_outcome` (u8)
- **Validations:**
  - Market is active
  - Past end time but within 24-hour resolution window
  - Valid outcome index
- **Effect:** Sets winning outcome and market status to Resolved

### 5. `claim_winnings`
Winners withdraw their proportional share of the pool.

- **Signer:** User
- **Validations:**
  - Market is resolved
  - Position is on the winning outcome
  - Not already claimed
- **Payout formula:** `(position_amount / winning_total) * total_liquidity - 1% fee`
- **Effect:** Transfers net payout from vault, marks position as claimed

## Constants

| Name               | Value        | Description                   |
|--------------------|--------------|-------------------------------|
| PROTOCOL_FEE_BPS   | 100          | 1% fee on winnings            |
| MAX_OUTCOMES       | 10           | Max outcomes per market       |
| MIN_MARKET_DURATION| 3600         | 1 hour minimum                |
| MAX_MARKET_DURATION| 31,536,000   | 365 days maximum              |
| RESOLUTION_WINDOW  | 86,400       | 24 hours for oracle to resolve|

## Token Standard

Uses **SPL Token-2022** (`TokenInterface`) for collateral handling, enabling future support for transfer hooks, metadata extensions, and non-transferable tokens.

## Build & Deploy

```bash
# Install dependencies
anchor build

# Deploy to devnet
anchor deploy

# Run tests
anchor test
```

## PDA Seeds Reference

```
Protocol:  [b"protocol"]
Market:    [b"market",    market_id (u64 LE bytes)]
Position:  [b"position",  market_key, user_key, outcome (u8)]
Vault:     [b"vault",     market_key]
```
