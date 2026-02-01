import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey(
  'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
);

// IDL will be populated after anchor build
const IDL = {} as any;

export function getProgram(provider: AnchorProvider): Program {
  return new Program(IDL, PROGRAM_ID, provider);
}
