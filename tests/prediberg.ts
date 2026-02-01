import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { expect } from 'chai';

describe('prediberg', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Program will be loaded after anchor build generates IDL
  // const program = anchor.workspace.Prediberg as Program;

  const authority = provider.wallet;
  const oracle = Keypair.generate();
  const treasury = Keypair.generate();

  it('Initializes the protocol', async () => {
    // TODO: Implement after anchor build
    // const [protocolPda] = PublicKey.findProgramAddressSync(
    //   [Buffer.from('protocol')],
    //   program.programId
    // );
    //
    // await program.methods
    //   .initialize({
    //     oracle: oracle.publicKey,
    //     treasury: treasury.publicKey,
    //   })
    //   .accounts({
    //     authority: authority.publicKey,
    //     protocol: protocolPda,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .rpc();
    //
    // const protocol = await program.account.protocol.fetch(protocolPda);
    // expect(protocol.authority.toString()).to.equal(authority.publicKey.toString());
  });

  it('Creates a market', async () => {
    // TODO: Implement after anchor build
  });

  it('Places a prediction', async () => {
    // TODO: Implement after anchor build
  });

  it('Resolves a market', async () => {
    // TODO: Implement after anchor build
  });

  it('Claims winnings', async () => {
    // TODO: Implement after anchor build
  });
});
