import { PublicKey } from '@solana/web3.js';

export interface Market {
  id: number;
  creator: PublicKey;
  question: string;
  description: string;
  outcomes: string[];
  outcomeTotals: bigint[];
  endTime: number;
  resolutionTime: number;
  winningOutcome: number | null;
  status: MarketStatus;
  totalLiquidity: bigint;
  collateralMint: PublicKey;
  vault: PublicKey;
}

export type MarketStatus = 'active' | 'resolved' | 'cancelled';

export interface Position {
  market: PublicKey;
  owner: PublicKey;
  outcome: number;
  amount: bigint;
  claimed: boolean;
}

export interface Protocol {
  authority: PublicKey;
  oracle: PublicKey;
  treasury: PublicKey;
  feeBps: number;
  totalMarkets: bigint;
  totalVolume: bigint;
}
