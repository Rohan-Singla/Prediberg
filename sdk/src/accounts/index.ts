import { PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from '../program.js';

const PROTOCOL_SEED = Buffer.from('protocol');
const MARKET_SEED = Buffer.from('market');
const POSITION_SEED = Buffer.from('position');
const VAULT_SEED = Buffer.from('vault');
const OUTCOME_MINT_SEED = Buffer.from('outcome_mint');

export function findProtocolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
}

export function findMarketPda(marketId: bigint | number): [PublicKey, number] {
  const idBuffer = Buffer.alloc(8);
  idBuffer.writeBigUInt64LE(BigInt(marketId));
  return PublicKey.findProgramAddressSync([MARKET_SEED, idBuffer], PROGRAM_ID);
}

export function findVaultPda(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, market.toBuffer()],
    PROGRAM_ID
  );
}

export function findPositionPda(
  market: PublicKey,
  owner: PublicKey,
  outcome: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POSITION_SEED, market.toBuffer(), owner.toBuffer(), Buffer.from([outcome])],
    PROGRAM_ID
  );
}

export function findOutcomeMintPda(
  market: PublicKey,
  outcome: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [OUTCOME_MINT_SEED, market.toBuffer(), Buffer.from([outcome])],
    PROGRAM_ID
  );
}
