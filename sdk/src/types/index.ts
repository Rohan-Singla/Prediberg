import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export interface ProtocolAccount {
  authority: PublicKey;
  oracle: PublicKey;
  treasury: PublicKey;
  feeBps: number;
  totalMarkets: BN;
  totalVolume: BN;
  bump: number;
}

export interface MarketAccount {
  id: BN;
  creator: PublicKey;
  question: string;
  description: string;
  outcomes: string[];
  outcomeMints: PublicKey[];
  outcomeTotals: BN[];
  endTime: BN;
  resolutionTime: BN;
  winningOutcome: number | null;
  status: MarketStatus;
  totalLiquidity: BN;
  collateralMint: PublicKey;
  vault: PublicKey;
  bump: number;
  createdAt: BN;
}

export type MarketStatus =
  | { active: Record<string, never> }
  | { resolved: Record<string, never> }
  | { cancelled: Record<string, never> };

export interface PositionAccount {
  market: PublicKey;
  owner: PublicKey;
  outcome: number;
  amount: BN;
  claimed: boolean;
  bump: number;
}

export interface CreateMarketParams {
  question: string;
  description: string;
  outcomes: string[];
  endTime: BN;
}

export interface PlacePredictionParams {
  outcome: number;
  amount: BN;
}

export interface ResolveMarketParams {
  winningOutcome: number;
}
