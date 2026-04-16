# Prediberg — Solana Program

Binary prediction markets on Solana using a CPMM (Constant Product Market Maker) AMM, with per-user position privacy via [Encrypt](https://docs.encrypt.xyz/) (FHE).

**Program ID:** `ERBbHZVm9JdNv31YDj8SstNy6vwuCyAwifhUWtQKdtN5`  
**Network:** Devnet

---

## Overview

Each market is a YES/NO binary market seeded with collateral (USDC).
Prices are determined by the AMM at all times — no order book needed.
Individual position sizes are stored as Encrypt ciphertext handles so on-chain observers cannot read any user's total exposure; pool reserves (and therefore prices) remain fully public.

---

## Architecture

```
programs/programs/programs/src/
├── lib.rs                  # Anchor entry point — instruction dispatch
├── constants.rs            # Seeds, fee constants, time constraints
├── errors.rs               # Custom error codes
├── state/
│   ├── market.rs           # Market account (AMM state, reserves, labels)
│   ├── position.rs         # Per-user position (Encrypt ciphertext handles)
│   └── protocol.rs         # Protocol config (oracle, treasury)
└── instructions/
    ├── initialize.rs       # Deploy protocol
    ├── create_market.rs    # Create a YES/NO market + seed the AMM
    ├── swap.rs             # CPMM swap (buy YES or NO shares)
    ├── resolve_market.rs   # Oracle resolves winning outcome
    └── redeem.rs           # request_redeem + claim_winnings
```

---

## Instructions

### `initialize`
Deploys the protocol singleton. Sets the oracle address, treasury, and protocol fee.

### `create_market`
Creates a new binary market. The creator seeds the AMM pool with `initial_liquidity` USDC, setting both YES and NO reserves to the same value (50/50 starting price).

**Parameters**
| Field | Type | Description |
|-------|------|-------------|
| `question` | `String` | Market question (max 256 chars) |
| `description` | `String` | Additional context (max 1024 chars) |
| `yes_label` | `String` | Label for YES outcome (max 32 chars) |
| `no_label` | `String` | Label for NO outcome (max 32 chars) |
| `end_time` | `i64` | Unix timestamp for market close |
| `initial_liquidity` | `u64` | USDC (in base units) to seed both sides |
| `swap_fee_bps` | `u16` | Swap fee in basis points (default 30 = 0.3%) |

### `swap`
Buys YES or NO shares using USDC. Implements the CPMM formula:

```
# Buying YES (add to NO side, draw from YES side)
fee           = amount × swap_fee_bps / 10000
amount_in     = amount − fee
new_no_res    = no_reserve + amount_in
new_yes_res   = k / new_no_res          # k = yes_reserve × no_reserve
shares_out    = yes_reserve − new_yes_res
```

A single swap cannot take more than `MAX_SWAP_IMPACT_BPS` (50%) of the pool.

**Parameters**
| Field | Type | Description |
|-------|------|-------------|
| `outcome` | `u8` | `0` = buy YES, `1` = buy NO |
| `amount` | `u64` | USDC to spend (base units) |

### `resolve_market`
Called by the oracle after `end_time`. Sets `winning_outcome` (0=YES, 1=NO) and transitions market to `Resolved`. Must be called within the 24-hour resolution window.

### `request_redeem`
Called by a winner after resolution. Validates that the caller holds the winning side. Triggers the Encrypt decryption CPI so off-chain executors decrypt the user's ciphertext share balance and write the plaintext to a reveal account.

### `claim_winnings`
Called after Encrypt decryption is complete. The user provides their plaintext share count (from the Encrypt reveal account via gRPC). Program computes payout and transfers USDC from vault to user.

```
gross  = (shares / winning_shares_total) × vault_balance
fee    = gross × PROTOCOL_FEE_BPS / 10000
payout = gross − fee
```

---

## AMM Price Discovery

At any time the implied market probability is:

```
price_YES = no_reserve  / (yes_reserve + no_reserve)
price_NO  = yes_reserve / (yes_reserve + no_reserve)
price_YES + price_NO = 1.0
```

Starting at 50/50 (both reserves equal), prices shift as traders buy shares.

---

## Privacy via Encrypt (FHE)

Pool reserves and prices are public — anyone can observe market sentiment.
What Encrypt hides is each user's *accumulated position size*. The `Position` account stores only ciphertext handles (`yes_shares_ct`, `no_shares_ct`) — references to EUint64 ciphertext accounts managed by the Encrypt network:

- **On swap**: `encrypt_program::create_plaintext_typed::<Uint64>(shares_out)` or homomorphic addition to existing handle
- **On redeem**: `encrypt_program::request_decrypt(ciphertext_pubkey)` → executors write plaintext to a reveal account
- **On claim**: user reads their plaintext from the reveal account via Encrypt gRPC and submits it on-chain

Encrypt program ID: `4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8`  
gRPC endpoint: `https://pre-alpha-dev-1.encrypt.ika-network.net:443`

> **Status**: Encrypt integration is architected and documented in `swap.rs` / `redeem.rs`. The CPI calls are stubbed pending `encrypt-anchor` SDK stabilisation (pre-alpha). Position handles currently use the vault pubkey as a sentinel.

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_SWAP_FEE_BPS` | `30` | 0.3% swap fee |
| `MAX_SWAP_IMPACT_BPS` | `5000` | 50% max pool impact per swap |
| `PROTOCOL_FEE_BPS` | `100` | 1% protocol fee on winnings |
| `MIN_MARKET_DURATION` | `3600 s` | Markets must run at least 1 hour |
| `MAX_MARKET_DURATION` | `2592000 s` | Markets must close within 30 days |
| `RESOLUTION_WINDOW` | `86400 s` | Oracle has 24 hours after close to resolve |

---

## PDAs

| Account | Seeds |
|---------|-------|
| Protocol | `["protocol"]` |
| Market | `["market", market_id (u64 LE)]` |
| Vault | `["vault", market_pubkey]` |
| Position | `["position", market_pubkey, user_pubkey]` |

---

## Building & Testing

```bash
# From the programs/ directory
anchor build        # compile the program
anchor test         # run all 32 tests via bankrun (no local validator needed)
```

Tests use [solana-bankrun](https://github.com/kevinheavey/solana-bankrun) — an in-memory validator — so runs are fast (< 2 seconds).

### Test Coverage

| Suite | Tests |
|-------|-------|
| initialize | 2 |
| create_market | 7 |
| swap | 9 |
| resolve_market | 6 |
| redeem | 8 |
| **Total** | **32** |

Key invariants verified:
- `yes_reserve × no_reserve ≥ k` after every swap (CPMM invariant holds)
- `price_YES + price_NO ≈ 1.0`, both bounded `(0, 1)`
- Vault balance = initial liquidity + Σ swap amounts
- Fee accounting: 0.3% stays in vault on swap, 1% deducted on claim

---

## Token Standard

Collateral is SPL Token-2022 (USDC or any compatible mint). The vault is a standard token account owned by the market PDA.
