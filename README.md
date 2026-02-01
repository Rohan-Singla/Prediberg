# Prediberg

Decentralized prediction markets on Solana with AI-powered outcome resolution.

## Features

- Create prediction markets with multiple outcomes
- SPL Token-2022 based outcome tokens
- AI oracle for automated market resolution
- Real-time market data via API

## Tech Stack

- **Blockchain**: Solana + Anchor Framework
- **Token Standard**: SPL Token-2022
- **Frontend**: Next.js 14, Tailwind CSS, Solana Wallet Adapter
- **Backend**: Fastify, Drizzle ORM, PostgreSQL
- **Oracle**: Node.js service with pluggable AI judges

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Rust & Cargo
- Solana CLI
- Anchor CLI 0.30+

### Installation

```bash
# Clone and install dependencies
git clone <repo-url>
cd prediberg
pnpm install

# Build Solana program
anchor build

# Copy environment file
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
# Start frontend
pnpm --filter app dev

# Start backend
pnpm --filter backend dev

# Start oracle (optional)
pnpm --filter oracle dev
```

### Testing

```bash
# Run Anchor tests
anchor test

# Run with local validator
anchor localnet
```

## Project Structure

```
prediberg/
├── programs/prediberg/  # Solana program
├── app/                 # Next.js frontend
├── backend/             # Fastify API
├── sdk/                 # TypeScript SDK
├── oracle/              # AI judge service
├── tests/               # Integration tests
└── scripts/             # Deployment scripts
```

## License

MIT
