import anchor from '@coral-xyz/anchor';
const { BN, Program } = anchor;
import {
  PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Transaction,
} from '@solana/web3.js';
import {
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { startAnchor, ProgramTestContext, Clock } from 'solana-bankrun';
import { BankrunProvider } from 'anchor-bankrun';
import { expect } from 'chai';

const PROGRAM_ID = new PublicKey('ERBbHZVm9JdNv31YDj8SstNy6vwuCyAwifhUWtQKdtN5');
const TOKEN_DECIMALS = 6;
const INITIAL_BALANCE = 10_000 * 10 ** TOKEN_DECIMALS;
const ONE_HOUR = 3600;

function protocolPda() {
  return PublicKey.findProgramAddressSync([Buffer.from('protocol')], PROGRAM_ID);
}

function marketPda(id: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(id));
  return PublicKey.findProgramAddressSync([Buffer.from('market'), buf], PROGRAM_ID);
}

function vaultPda(market: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), market.toBuffer()],
    PROGRAM_ID,
  );
}

function positionPda(market: PublicKey, user: PublicKey, outcome: number) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), market.toBuffer(), user.toBuffer(), Buffer.from([outcome])],
    PROGRAM_ID,
  );
}

async function expectFail(fn: () => Promise<unknown>, code?: string) {
  try {
    await fn();
    throw new Error(`Expected failure${code ? ` with "${code}"` : ''} but tx succeeded`);
  } catch (err: any) {
    if (err.message?.startsWith('Expected failure')) throw err;
    if (code) {
      const msg: string = err?.message ?? err?.toString() ?? '';
      expect(msg, `Expected error to contain "${code}"`).to.include(code);
    }
  }
}

async function warpBy(context: ProgramTestContext, seconds: number) {
  const clock = await context.banksClient.getClock();
  context.setClock(
    new Clock(
      clock.slot,
      clock.epochStartTimestamp,
      clock.epoch,
      clock.leaderScheduleEpoch,
      clock.unixTimestamp + BigInt(seconds),
    ),
  );
}

async function now(context: ProgramTestContext): Promise<number> {
  const clock = await context.banksClient.getClock();
  return Number(clock.unixTimestamp);
}


let context: ProgramTestContext;
let provider: BankrunProvider;
let program: Program<any>;

const authority = Keypair.generate();
const oracle = Keypair.generate();
const treasury = Keypair.generate();
const userA = Keypair.generate();
const userB = Keypair.generate();
const stranger = Keypair.generate();

let collateralMint: PublicKey;
let userAToken: PublicKey;
let userBToken: PublicKey;
let strangerToken: PublicKey;


before(async () => {
  context = await startAnchor(
    '',
    [],
    [authority, oracle, treasury, userA, userB, stranger].map((kp) => ({
      address: kp.publicKey,
      info: {
        lamports: 10 * LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: SystemProgram.programId,
        executable: false,
      },
    })),
  );

  provider = new BankrunProvider(context);
  anchor.setProvider(provider);
  program = anchor.workspace.Prediberg as Program<any>;

  const client = context.banksClient;
  const payer = authority;

  // create Token-2022 mint
  const mintKp = Keypair.generate();
  collateralMint = mintKp.publicKey;
  const mintSpace = getMintLen([]);
  const mintRent = await client.getRent();
  const mintLamports = Number(mintRent.minimumBalance(BigInt(mintSpace)));

  const createMintTx = new Transaction();
  createMintTx.recentBlockhash = context.lastBlockhash;
  createMintTx.feePayer = payer.publicKey;
  createMintTx.add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: collateralMint,
      space: mintSpace,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      collateralMint, TOKEN_DECIMALS, payer.publicKey, null, TOKEN_2022_PROGRAM_ID,
    ),
  );
  createMintTx.sign(payer, mintKp);
  await client.processTransaction(createMintTx);

  // create ATAs and mint tokens for each user
  for (const [kp, label] of [
    [userA, 'A'],
    [userB, 'B'],
    [stranger, 'S'],
  ] as const) {
    const ata = getAssociatedTokenAddressSync(
      collateralMint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID,
    );

    const createAtaTx = new Transaction();
    createAtaTx.recentBlockhash = context.lastBlockhash;
    createAtaTx.feePayer = payer.publicKey;
    createAtaTx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey, ata, kp.publicKey, collateralMint, TOKEN_2022_PROGRAM_ID,
      ),
    );
    createAtaTx.sign(payer);
    await client.processTransaction(createAtaTx);

    const mintToTx = new Transaction();
    mintToTx.recentBlockhash = context.lastBlockhash;
    mintToTx.feePayer = payer.publicKey;
    mintToTx.add(
      createMintToInstruction(
        collateralMint, ata, payer.publicKey, INITIAL_BALANCE, [], TOKEN_2022_PROGRAM_ID,
      ),
    );
    mintToTx.sign(payer);
    await client.processTransaction(mintToTx);

    if (label === 'A') userAToken = ata;
    else if (label === 'B') userBToken = ata;
    else strangerToken = ata;
  }
});

describe('initialize', () => {
  it('sets up protocol with correct config', async () => {
    const [protocol] = protocolPda();

    await program.methods
      .initialize({ oracle: oracle.publicKey, treasury: treasury.publicKey })
      .accounts({
        authority: authority.publicKey,
        protocol,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const state = await program.account.protocol.fetch(protocol);
    expect(state.authority.toString()).to.equal(authority.publicKey.toString());
    expect(state.oracle.toString()).to.equal(oracle.publicKey.toString());
    expect(state.treasury.toString()).to.equal(treasury.publicKey.toString());
    expect(state.feeBps).to.equal(100);
    expect(state.totalMarkets.toNumber()).to.equal(0);
    expect(state.totalVolume.toNumber()).to.equal(0);
  });

  it('blocks double init', async () => {
    const [protocol] = protocolPda();

    await expectFail(() =>
      program.methods
        .initialize({ oracle: oracle.publicKey, treasury: treasury.publicKey })
        .accounts({
          authority: authority.publicKey,
          protocol,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc(),
    );
  });
});

describe('create_market', () => {
  async function createMarket(params: {
    question?: string;
    description?: string;
    outcomes?: string[];
    endTime?: BN;
    signer?: Keypair;
  } = {}) {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault] = vaultPda(market);
    const endTime = params.endTime ?? new BN((await now(context)) + ONE_HOUR + 120);
    const signer = params.signer ?? authority;

    await program.methods
      .createMarket({
        question: params.question ?? 'Will BTC exceed $150k before July 2026?',
        description: params.description ?? 'Resolves YES if BTC >= $150k on Coinbase.',
        outcomes: params.outcomes ?? ['YES', 'NO'],
        endTime,
      })
      .accounts({
        creator: signer.publicKey,
        protocol,
        market,
        collateralMint,
        vault,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc();

    return { id, market, vault };
  }

  it('creates a binary market', async () => {
    const { id, market } = await createMarket({
      question: 'Will BTC exceed $150k before July 2026?',
      outcomes: ['YES', 'NO'],
    });

    const state = await program.account.market.fetch(market);

    expect(state.id.toNumber()).to.equal(id);
    expect(state.creator.toString()).to.equal(authority.publicKey.toString());
    expect(state.question).to.equal('Will BTC exceed $150k before July 2026?');
    expect(state.outcomes).to.deep.equal(['YES', 'NO']);
    expect(state.status).to.deep.equal({ active: {} });
    expect(state.winningOutcome).to.be.null;
    expect(state.totalLiquidity.toNumber()).to.equal(0);
    expect(state.outcomeTotals.map((t: any) => t.toNumber())).to.deep.equal([0, 0]);
    expect(state.collateralMint.toString()).to.equal(collateralMint.toString());
  });

  it('handles multi-outcome markets (5 options)', async () => {
    const outcomes = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026', 'Never'];
    const { market } = await createMarket({ outcomes });

    const state = await program.account.market.fetch(market);
    expect(state.outcomes).to.deep.equal(outcomes);
    expect(state.outcomeTotals.length).to.equal(5);
  });

  it('increments totalMarkets counter', async () => {
    const [protocol] = protocolPda();
    const before = await program.account.protocol.fetch(protocol);
    const countBefore = before.totalMarkets.toNumber();

    await createMarket({ question: 'Increment test market' });

    const after = await program.account.protocol.fetch(protocol);
    expect(after.totalMarkets.toNumber()).to.equal(countBefore + 1);
  });

  it('assigns sequential ids', async () => {
    const [protocol] = protocolPda();
    const { totalMarkets } = await program.account.protocol.fetch(protocol);
    const startId = totalMarkets.toNumber();

    const { market: m1 } = await createMarket({ question: 'Market A' });
    const { market: m2 } = await createMarket({ question: 'Market B' });

    const s1 = await program.account.market.fetch(m1);
    const s2 = await program.account.market.fetch(m2);
    expect(s1.id.toNumber()).to.equal(startId);
    expect(s2.id.toNumber()).to.equal(startId + 1);
    expect(m1.toString()).to.not.equal(m2.toString());
  });

  it('rejects non-authority caller', async () => {
    await expectFail(
      () => createMarket({ signer: stranger }),
      'Unauthorized',
    );
  });

  it('rejects end time < 1 hour', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault] = vaultPda(market);

    await expectFail(
      async () =>
        program.methods
          .createMarket({
            question: 'Short market',
            description: 'Should fail',
            outcomes: ['YES', 'NO'],
            endTime: new BN((await now(context)) + 30 * 60),
          })
          .accounts({
            creator: authority.publicKey,
            protocol,
            market,
            collateralMint,
            vault,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc(),
      'InvalidDuration',
    );
  });

  it('rejects single outcome', async () => {
    await expectFail(
      () => createMarket({ outcomes: ['ONLY_ONE'] }),
      'TooManyOutcomes',
    );
  });

  it('rejects > 10 outcomes', async () => {
    const outcomes = Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`);
    await expectFail(
      () => createMarket({ outcomes }),
      'TooManyOutcomes',
    );
  });
});

describe('place_prediction', () => {
  const MARKET_ID = 0;
  const YES = 0;
  const NO = 1;
  const BET_A = 1_000 * 10 ** TOKEN_DECIMALS;
  const BET_B = 500 * 10 ** TOKEN_DECIMALS;
  const ADD_A = 200 * 10 ** TOKEN_DECIMALS;

  async function predict(user: Keypair, userToken: PublicKey, outcome: number, amount: number) {
    const [market] = marketPda(MARKET_ID);
    const [vault] = vaultPda(market);
    const [position] = positionPda(market, user.publicKey, outcome);

    await program.methods
      .placePrediction({ outcome, amount: new BN(amount) })
      .accounts({
        user: user.publicKey,
        market,
        position,
        userTokenAccount: userToken,
        vault,
        collateralMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
  }

  it('userA bets YES — position + vault updated', async () => {
    const [market] = marketPda(MARKET_ID);
    const [vault] = vaultPda(market);
    const [position] = positionPda(market, userA.publicKey, YES);

    const vaultBefore = await getAccount(
      provider.connection, vault, 'confirmed', TOKEN_2022_PROGRAM_ID,
    );

    await predict(userA, userAToken, YES, BET_A);

    const pos = await program.account.position.fetch(position);
    expect(pos.owner.toString()).to.equal(userA.publicKey.toString());
    expect(pos.outcome).to.equal(YES);
    expect(pos.amount.toNumber()).to.equal(BET_A);
    expect(pos.claimed).to.be.false;

    const vaultAfter = await getAccount(
      provider.connection, vault, 'confirmed', TOKEN_2022_PROGRAM_ID,
    );
    expect(Number(vaultAfter.amount) - Number(vaultBefore.amount)).to.equal(BET_A);

    const mkt = await program.account.market.fetch(market);
    expect(mkt.outcomeTotals[YES].toNumber()).to.equal(BET_A);
    expect(mkt.totalLiquidity.toNumber()).to.equal(BET_A);
  });

  it('userB bets NO — separate position', async () => {
    const [market] = marketPda(MARKET_ID);
    const [position] = positionPda(market, userB.publicKey, NO);

    await predict(userB, userBToken, NO, BET_B);

    const pos = await program.account.position.fetch(position);
    expect(pos.outcome).to.equal(NO);
    expect(pos.amount.toNumber()).to.equal(BET_B);

    const mkt = await program.account.market.fetch(market);
    expect(mkt.outcomeTotals[NO].toNumber()).to.equal(BET_B);
    expect(mkt.totalLiquidity.toNumber()).to.equal(BET_A + BET_B);
  });

  it('userA tops up YES — amount accumulates', async () => {
    const [market] = marketPda(MARKET_ID);
    const [position] = positionPda(market, userA.publicKey, YES);

    await predict(userA, userAToken, YES, ADD_A);

    const pos = await program.account.position.fetch(position);
    expect(pos.amount.toNumber()).to.equal(BET_A + ADD_A);

    const mkt = await program.account.market.fetch(market);
    expect(mkt.outcomeTotals[YES].toNumber()).to.equal(BET_A + ADD_A);
    expect(mkt.totalLiquidity.toNumber()).to.equal(BET_A + ADD_A + BET_B);
  });

  it('tracks YES and NO pools independently', async () => {
    const [market] = marketPda(MARKET_ID);
    const mkt = await program.account.market.fetch(market);

    const expectedYes = BET_A + ADD_A;
    const expectedNo = BET_B;
    expect(mkt.outcomeTotals[YES].toNumber()).to.equal(expectedYes);
    expect(mkt.outcomeTotals[NO].toNumber()).to.equal(expectedNo);
    expect(mkt.totalLiquidity.toNumber()).to.equal(expectedYes + expectedNo);
  });

  it('rejects out-of-range outcome', async () => {
    const [market] = marketPda(MARKET_ID);
    const [vault] = vaultPda(market);
    const INVALID_OUTCOME = 5;
    const [position] = positionPda(market, userA.publicKey, INVALID_OUTCOME);

    await expectFail(
      () =>
        program.methods
          .placePrediction({ outcome: INVALID_OUTCOME, amount: new BN(100) })
          .accounts({
            user: userA.publicKey,
            market,
            position,
            userTokenAccount: userAToken,
            vault,
            collateralMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc(),
      'InvalidOutcome',
    );
  });

  it('rejects zero amount', async () => {
    const [market] = marketPda(MARKET_ID);
    const [vault] = vaultPda(market);
    const [position] = positionPda(market, userA.publicKey, YES);

    await expectFail(
      () =>
        program.methods
          .placePrediction({ outcome: YES, amount: new BN(0) })
          .accounts({
            user: userA.publicKey,
            market,
            position,
            userTokenAccount: userAToken,
            vault,
            collateralMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc(),
      'InvalidAmount',
    );
  });

  it('rejects bet after market ended', async () => {
    const [market] = marketPda(MARKET_ID);
    const mkt = await program.account.market.fetch(market);
    await warpBy(context, mkt.endTime.toNumber() - (await now(context)) + 10);

    const [vault] = vaultPda(market);
    const [position] = positionPda(market, userA.publicKey, YES);

    await expectFail(
      () =>
        program.methods
          .placePrediction({ outcome: YES, amount: new BN(100) })
          .accounts({
            user: userA.publicKey,
            market,
            position,
            userTokenAccount: userAToken,
            vault,
            collateralMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc(),
      'MarketEnded',
    );
  });
});


describe('resolve_market', () => {
  const MARKET_ID = 0;
  const YES = 0;

  async function resolve(oracleSigner: Keypair, winningOutcome: number) {
    const [protocol] = protocolPda();
    const [market] = marketPda(MARKET_ID);

    await program.methods
      .resolveMarket({ winningOutcome })
      .accounts({
        oracle: oracleSigner.publicKey,
        protocol,
        market,
      })
      .signers([oracleSigner])
      .rpc();
  }

  it('rejects non-oracle signer', async () => {
    await expectFail(
      () => resolve(stranger, YES),
      'Unauthorized',
    );
  });

  it('rejects invalid outcome index', async () => {
    await expectFail(
      () => resolve(oracle, 99),
      'InvalidOutcome',
    );
  });

  it('oracle resolves after end_time', async () => {
    await resolve(oracle, YES);

    const [market] = marketPda(MARKET_ID);
    const mkt = await program.account.market.fetch(market);

    expect(mkt.status).to.deep.equal({ resolved: {} });
    expect(mkt.winningOutcome).to.equal(YES);
    expect(mkt.resolutionTime.toNumber()).to.be.greaterThan(0);
  });

  it('blocks double resolution', async () => {
    await expectFail(
      () => resolve(oracle, YES),
      'MarketAlreadyResolved',
    );
  });

  it('blocks resolution before end_time', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault] = vaultPda(market);
    const endTime = new BN((await now(context)) + ONE_HOUR + 300);

    await program.methods
      .createMarket({
        question: 'Resolve-before-end test',
        description: 'not resolvable yet',
        outcomes: ['YES', 'NO'],
        endTime,
      })
      .accounts({
        creator: authority.publicKey,
        protocol,
        market,
        collateralMint,
        vault,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    await expectFail(
      () =>
        program.methods
          .resolveMarket({ winningOutcome: 0 })
          .accounts({ oracle: oracle.publicKey, protocol, market })
          .signers([oracle])
          .rpc(),
      'MarketNotEnded',
    );
  });

  it('blocks resolution after 24h window', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber() - 1;
    const [market] = marketPda(id);
    const mkt = await program.account.market.fetch(market);

    const target = mkt.endTime.toNumber() + 25 * 3600;
    await warpBy(context, target - (await now(context)));

    await expectFail(
      () =>
        program.methods
          .resolveMarket({ winningOutcome: 0 })
          .accounts({ oracle: oracle.publicKey, protocol, market })
          .signers([oracle])
          .rpc(),
      'ResolutionWindowExpired',
    );
  });
});

describe('claim_winnings', () => {
  const MARKET_ID = 0;
  const YES = 0;
  const NO = 1;

  // userA: 1200 USDC on YES, userB: 500 on NO, pool = 1700
  // gross = (1200/1200)*1700 = 1700, fee = 17, net = 1683
  const BET_A_TOTAL = (1_000 + 200) * 10 ** TOKEN_DECIMALS;
  const TOTAL_LIQ = (1_000 + 200 + 500) * 10 ** TOKEN_DECIMALS;
  const GROSS = Math.floor((BET_A_TOTAL * TOTAL_LIQ) / BET_A_TOTAL);
  const FEE = Math.floor((GROSS * 100) / 10_000);
  const NET = GROSS - FEE;

  async function claim(user: Keypair, userToken: PublicKey, outcome: number) {
    const [protocol] = protocolPda();
    const [market] = marketPda(MARKET_ID);
    const [vault] = vaultPda(market);
    const [position] = positionPda(market, user.publicKey, outcome);

    await program.methods
      .claimWinnings()
      .accounts({
        user: user.publicKey,
        protocol,
        market,
        position,
        userTokenAccount: userToken,
        vault,
        collateralMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
  }

  it('pays winner the right amount', async () => {
    const before = await getAccount(
      provider.connection, userAToken, 'confirmed', TOKEN_2022_PROGRAM_ID,
    );

    await claim(userA, userAToken, YES);

    const after = await getAccount(
      provider.connection, userAToken, 'confirmed', TOKEN_2022_PROGRAM_ID,
    );
    const received = Number(after.amount) - Number(before.amount);
    expect(received).to.equal(NET);
  });

  it('fee stays in vault', async () => {
    const [market] = marketPda(MARKET_ID);
    const [vault] = vaultPda(market);
    const vaultBalance = await getAccount(
      provider.connection, vault, 'confirmed', TOKEN_2022_PROGRAM_ID,
    );
    expect(Number(vaultBalance.amount)).to.equal(FEE);
  });

  it('marks position as claimed', async () => {
    const [market] = marketPda(MARKET_ID);
    const [position] = positionPda(market, userA.publicKey, YES);
    const pos = await program.account.position.fetch(position);
    expect(pos.claimed).to.be.true;
  });

  it('blocks double claim', async () => {
    await expectFail(
      () => claim(userA, userAToken, YES),
      'NoWinnings',
    );
  });

  it('blocks loser from claiming', async () => {
    await expectFail(
      () => claim(userB, userBToken, NO),
      'NoWinnings',
    );
  });

  it('blocks claim on unresolved market', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault] = vaultPda(market);

    await program.methods
      .createMarket({
        question: 'Unresolved claim test',
        description: 'not claimable',
        outcomes: ['YES', 'NO'],
        endTime: new BN((await now(context)) + ONE_HOUR + 300),
      })
      .accounts({
        creator: authority.publicKey,
        protocol,
        market,
        collateralMint,
        vault,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const [position] = positionPda(market, userA.publicKey, 0);
    await program.methods
      .placePrediction({ outcome: 0, amount: new BN(100 * 10 ** TOKEN_DECIMALS) })
      .accounts({
        user: userA.publicKey,
        market,
        position,
        userTokenAccount: userAToken,
        vault,
        collateralMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userA])
      .rpc();

    await expectFail(
      () =>
        program.methods
          .claimWinnings()
          .accounts({
            user: userA.publicKey,
            protocol,
            market,
            position,
            userTokenAccount: userAToken,
            vault,
            collateralMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([userA])
          .rpc(),
      'MarketNotActive',
    );
  });
});
