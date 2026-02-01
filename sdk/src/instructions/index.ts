import { Program, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  findProtocolPda,
  findMarketPda,
  findVaultPda,
  findPositionPda,
} from '../accounts/index.js';
import type { CreateMarketParams, PlacePredictionParams, ResolveMarketParams } from '../types/index.js';

export function createInitializeInstruction(
  program: Program,
  authority: PublicKey,
  oracle: PublicKey,
  treasury: PublicKey
): Promise<TransactionInstruction> {
  const [protocol] = findProtocolPda();

  return program.methods
    .initialize({ oracle, treasury })
    .accounts({
      authority,
      protocol,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function createMarketInstruction(
  program: Program,
  creator: PublicKey,
  collateralMint: PublicKey,
  params: CreateMarketParams,
  marketId: number
): Promise<TransactionInstruction> {
  const [protocol] = findProtocolPda();
  const [market] = findMarketPda(marketId);
  const [vault] = findVaultPda(market);

  return program.methods
    .createMarket(params)
    .accounts({
      creator,
      protocol,
      market,
      collateralMint,
      vault,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function createPlacePredictionInstruction(
  program: Program,
  user: PublicKey,
  market: PublicKey,
  marketId: number,
  userTokenAccount: PublicKey,
  collateralMint: PublicKey,
  params: PlacePredictionParams
): Promise<TransactionInstruction> {
  const [vault] = findVaultPda(market);
  const [position] = findPositionPda(market, user, params.outcome);

  return program.methods
    .placePrediction(params)
    .accounts({
      user,
      market,
      position,
      userTokenAccount,
      vault,
      collateralMint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function createResolveMarketInstruction(
  program: Program,
  oracle: PublicKey,
  marketId: number,
  params: ResolveMarketParams
): Promise<TransactionInstruction> {
  const [protocol] = findProtocolPda();
  const [market] = findMarketPda(marketId);

  return program.methods
    .resolveMarket(params)
    .accounts({
      oracle,
      protocol,
      market,
    })
    .instruction();
}

export async function createClaimWinningsInstruction(
  program: Program,
  user: PublicKey,
  market: PublicKey,
  outcome: number,
  userTokenAccount: PublicKey,
  collateralMint: PublicKey
): Promise<TransactionInstruction> {
  const [protocol] = findProtocolPda();
  const [vault] = findVaultPda(market);
  const [position] = findPositionPda(market, user, outcome);

  return program.methods
    .claimWinnings()
    .accounts({
      user,
      protocol,
      market,
      position,
      userTokenAccount,
      vault,
      collateralMint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}
