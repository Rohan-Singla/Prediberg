import * as anchor from '@coral-xyz/anchor';
import { BN, Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { startAnchor, BanksClient, ProgramTestContext, Clock } from 'solana-bankrun';
import { BankrunProvider } from 'anchor-bankrun';
import { expect } from 'chai';

type PredibergProgram = Program<any>;

const PROGRAM_ID = new PublicKey('65y5sBTQ8rfth35N1qmH57z1s6JrhNevGTFfiTV6kait');
const TOKEN_DECIMALS = 6;
const INITIAL_BALANCE = 10_000 * 10 ** TOKEN_DECIMALS; // 10,000 USDC per user
const ONE_HOUR = 3600;
const ONE_DAY = 86_400;


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


/** Expects a transaction to fail. Optionally asserts the error message contains `code`. */
async function expectFail(fn: () => Promise<unknown>, code?: string) {
  try {
    await fn();
    throw new Error(`Expected failure${code ? ` with "${code}"` : ''} but transaction succeeded`);
  } catch (err: any) {
    if (err.message?.startsWith('Expected failure')) throw err;
    if (code) {
      const msg: string = err?.message ?? err?.toString() ?? '';
      expect(msg, `Expected error to contain "${code}"`).to.include(code);
    }
  }
}

/** Warp the bankrun clock forward by `seconds`. */
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

/** Return the current bankrun unix timestamp as a number. */
async function now(context: ProgramTestContext): Promise<number> {
  const clock = await context.banksClient.getClock();
  return Number(clock.unixTimestamp);
}


let context: ProgramTestContext;
let provider: BankrunProvider;
let program: PredibergProgram;

const authority = Keypair.generate(); // protocol authority + market creator
const oracle = Keypair.generate();
const treasury = Keypair.generate();
const userA = Keypair.generate(); // will bet YES
const userB = Keypair.generate(); // will bet NO
const stranger = Keypair.generate(); // has no permissions

let collateralMint: PublicKey;
let userAToken: PublicKey;
let userBToken: PublicKey;
let strangerToken: PublicKey;


before('boot bankrun + create mint + fund wallets', async () => {
  context = await startAnchor(
    '',
    [{ name: 'prediberg', programId: PROGRAM_ID }],
    // Pre-fund wallets with SOL for rent + fees
    [
      authority,
      oracle,
      treasury,
      userA,
      userB,
      stranger,
    ].map((kp) => ({
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
  program = anchor.workspace.Prediberg as PredibergProgram;

  const conn = provider.connection;

  // Create Token-2022 collateral mint
  collateralMint = await createMint(
    conn, authority, authority.publicKey, null,
    TOKEN_DECIMALS, undefined, undefined, TOKEN_2022_PROGRAM_ID,
  );

  // Create token accounts and mint initial balances
  for (const [kp, ref] of [
    [userA, 'userAToken'],
    [userB, 'userBToken'],
    [stranger, 'strangerToken'],
  ] as const) {
    const ata = await createAssociatedTokenAccount(
      conn, authority, collateralMint, kp.publicKey,
      undefined, TOKEN_2022_PROGRAM_ID,
    );
    await mintTo(
      conn, authority, collateralMint, ata,
      authority.publicKey, INITIAL_BALANCE, [],
      undefined, TOKEN_2022_PROGRAM_ID,
    );
    if (ref === 'userAToken') userAToken = ata;
    else if (ref === 'userBToken') userBToken = ata;
    else strangerToken = ata;
  }
});

describe('initialize', () => {
  it('✅ sets authority, oracle, treasury and default fee of 100 bps', async () => {
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

  it('❌ cannot initialize the protocol a second time', async () => {
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

  it('✅ creates a binary YES/NO market with correct initial state', async () => {
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
    expect(state.outcomeTotals.map((t: BN) => t.toNumber())).to.deep.equal([0, 0]);
    expect(state.collateralMint.toString()).to.equal(collateralMint.toString());
  });

  it('✅ creates a multi-outcome market (5 options)', async () => {
    const outcomes = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026', 'Never'];
    const { market } = await createMarket({ outcomes });

    const state = await program.account.market.fetch(market);
    expect(state.outcomes).to.deep.equal(outcomes);
    expect(state.outcomeTotals.length).to.equal(5);
  });

  it('✅ protocol.totalMarkets increments after each market', async () => {
    const [protocol] = protocolPda();
    const before = await program.account.protocol.fetch(protocol);
    const countBefore = before.totalMarkets.toNumber();

    await createMarket({ question: 'Increment test market' });

    const after = await program.account.protocol.fetch(protocol);
    expect(after.totalMarkets.toNumber()).to.equal(countBefore + 1);
  });

  it('✅ market IDs are sequential and unique', async () => {
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

  it('❌ non-authority wallet cannot create a market', async () => {
    await expectFail(
      () => createMarket({ signer: stranger }),
      'Unauthorized',
    );
  });

  it('❌ rejects end time less than 1 hour from now (too short)', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault] = vaultPda(market);

    await expectFail(
      () =>
        program.methods
          .createMarket({
            question: 'Short market',
            description: 'Should fail',
            outcomes: ['YES', 'NO'],
            endTime: new BN((await now(context)) + 30 * 60), // 30 minutes
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

  it('❌ rejects end time with only 1 outcome', async () => {
    await expectFail(
      () => createMarket({ outcomes: ['ONLY_ONE'] }),
      'TooManyOutcomes',
    );
  });

  it('❌ rejects market with more than 10 outcomes', async () => {
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
  const BET_A = 1_000 * 10 ** TOKEN_DECIMALS; // 1,000 USDC
  const BET_B = 500 * 10 ** TOKEN_DECIMALS;   //   500 USDC
  const ADD_A = 200 * 10 ** TOKEN_DECIMALS;   //   200 USDC (top-up by userA)

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

  it('✅ user A places a YES prediction — position created and tokens move to vault', async () => {
    const [market] = marketPda(MARKET_ID);
    const [vault] = vaultPda(market);
    const [position] = positionPda(market, userA.publicKey, YES);

    const vaultBefore = await getAccount(
      provider.connection, vault, 'confirmed', TOKEN_2022_PROGRAM_ID,
    );

    await predict(userA, userAToken, YES, BET_A);

    // Position state
    const pos = await program.account.position.fetch(position);
    expect(pos.owner.toString()).to.equal(userA.publicKey.toString());
    expect(pos.outcome).to.equal(YES);
    expect(pos.amount.toNumber()).to.equal(BET_A);
    expect(pos.claimed).to.be.false;

    // Vault received the tokens
    const vaultAfter = await getAccount(
      provider.connection, vault, 'confirmed', TOKEN_2022_PROGRAM_ID,
    );
    expect(Number(vaultAfter.amount) - Number(vaultBefore.amount)).to.equal(BET_A);

    // Market totals updated
    const mkt = await program.account.market.fetch(market);
    expect(mkt.outcomeTotals[YES].toNumber()).to.equal(BET_A);
    expect(mkt.totalLiquidity.toNumber()).to.equal(BET_A);
  });

  it('✅ user B places a NO prediction — separate position, totals correct', async () => {
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

  it('✅ user A adds to existing YES position (init_if_needed accumulates)', async () => {
    const [market] = marketPda(MARKET_ID);
    const [position] = positionPda(market, userA.publicKey, YES);

    await predict(userA, userAToken, YES, ADD_A);

    const pos = await program.account.position.fetch(position);
    // Should accumulate, not reset
    expect(pos.amount.toNumber()).to.equal(BET_A + ADD_A);

    const mkt = await program.account.market.fetch(market);
    expect(mkt.outcomeTotals[YES].toNumber()).to.equal(BET_A + ADD_A);
    expect(mkt.totalLiquidity.toNumber()).to.equal(BET_A + ADD_A + BET_B);
  });

  it('✅ YES and NO totals are tracked independently', async () => {
    const [market] = marketPda(MARKET_ID);
    const mkt = await program.account.market.fetch(market);

    const expectedYes = BET_A + ADD_A;
    const expectedNo = BET_B;
    expect(mkt.outcomeTotals[YES].toNumber()).to.equal(expectedYes);
    expect(mkt.outcomeTotals[NO].toNumber()).to.equal(expectedNo);
    expect(mkt.totalLiquidity.toNumber()).to.equal(expectedYes + expectedNo);
  });

  it('❌ rejects prediction on an out-of-range outcome index', async () => {
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

  it('❌ rejects prediction with amount = 0', async () => {
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

  it('❌ rejects prediction after market end_time has passed', async () => {
    // Warp clock past market #0 end time
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

    // Warp back to just before end for next test group
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

  it('❌ non-oracle wallet cannot resolve market', async () => {
    await expectFail(
      () => resolve(stranger, YES),
      'Unauthorized',
    );
  });

  it('❌ oracle cannot resolve with an invalid outcome index', async () => {
    await expectFail(
      () => resolve(oracle, 99),
      'InvalidOutcome',
    );
  });

  it('✅ oracle resolves market after end_time — status becomes Resolved', async () => {
    await resolve(oracle, YES);

    const [market] = marketPda(MARKET_ID);
    const mkt = await program.account.market.fetch(market);

    expect(mkt.status).to.deep.equal({ resolved: {} });
    expect(mkt.winningOutcome).to.equal(YES);
    expect(mkt.resolutionTime.toNumber()).to.be.greaterThan(0);
  });

  it('❌ oracle cannot resolve the same market twice', async () => {
    await expectFail(
      () => resolve(oracle, YES),
      'MarketAlreadyResolved',
    );
  });

  it('❌ oracle cannot resolve before market end_time (fresh market)', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault] = vaultPda(market);
    const endTime = new BN((await now(context)) + ONE_HOUR + 300);

    await program.methods
      .createMarket({
        question: 'Resolve-before-end test market',
        description: 'Should not be resolvable yet',
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

  it('❌ resolution window expiry is enforced (24 h after end_time)', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber() - 1; // last created
    const [market] = marketPda(id);
    const mkt = await program.account.market.fetch(market);

    // Warp clock to end_time + 25 hours (outside 24 h resolution window)
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

  // Pre-computed expected payout for userA (sole YES bettor)
  // gross = (1200 / 1200) * 1700 = 1700 USDC
  // fee   = 1700 * 1% = 17 USDC
  // net   = 1683 USDC
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

  it('✅ winner (userA) receives the correct proportional net payout', async () => {
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

  it('✅ 1% protocol fee is deducted from gross payout', async () => {
    const [market] = marketPda(MARKET_ID);
    const [vault] = vaultPda(market);
    const vaultBalance = await getAccount(
      provider.connection, vault, 'confirmed', TOKEN_2022_PROGRAM_ID,
    );
    expect(Number(vaultBalance.amount)).to.equal(FEE);
  });

  it('✅ position is marked as claimed after successful withdrawal', async () => {
    const [market] = marketPda(MARKET_ID);
    const [position] = positionPda(market, userA.publicKey, YES);
    const pos = await program.account.position.fetch(position);
    expect(pos.claimed).to.be.true;
  });

  it('❌ winner cannot claim winnings twice', async () => {
    await expectFail(
      () => claim(userA, userAToken, YES),
      'NoWinnings',
    );
  });

  it('❌ loser (userB) cannot claim winnings', async () => {
    await expectFail(
      () => claim(userB, userBToken, NO),
      'NoWinnings',
    );
  });

  it('❌ cannot claim from an unresolved market', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault] = vaultPda(market);

    await program.methods
      .createMarket({
        question: 'Unresolved claim test',
        description: 'Should not be claimable',
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
