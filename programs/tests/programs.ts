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
} from '@solana/spl-token';
import { startAnchor, ProgramTestContext, Clock } from 'solana-bankrun';
import { BankrunProvider } from 'anchor-bankrun';
import { expect } from 'chai';

const PROGRAM_ID   = new PublicKey('ERBbHZVm9JdNv31YDj8SstNy6vwuCyAwifhUWtQKdtN5');
const TOKEN_DECIMALS = 6;
const ONE_UNIT       = 10 ** TOKEN_DECIMALS;
const INITIAL_BALANCE = 100_000 * ONE_UNIT;
const ONE_HOUR       = 3600;
const YES = 0;
const NO  = 1;

// ── PDA helpers ────────────────────────────────────────────────────────────

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

function positionPda(market: PublicKey, user: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  );
}

// ── Test utilities ─────────────────────────────────────────────────────────

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

async function getTokenBalance(
  provider: BankrunProvider,
  account: PublicKey,
): Promise<number> {
  const info = await getAccount(
    provider.connection, account, 'confirmed', TOKEN_2022_PROGRAM_ID,
  );
  return Number(info.amount);
}

// ── Global state ───────────────────────────────────────────────────────────

let context: ProgramTestContext;
let provider: BankrunProvider;
let program: Program<any>;

const authority = Keypair.generate();
const oracle    = Keypair.generate();
const treasury  = Keypair.generate();
const userA     = Keypair.generate();
const userB     = Keypair.generate();
const stranger  = Keypair.generate();

let collateralMint:  PublicKey;
let userAToken:      PublicKey;
let userBToken:      PublicKey;
let strangerToken:   PublicKey;
let authorityToken:  PublicKey;   // creator's token account for seeding pools

// ── Setup ──────────────────────────────────────────────────────────────────

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
  const payer  = authority;

  // Create Token-2022 mint
  const mintKp       = Keypair.generate();
  collateralMint     = mintKp.publicKey;
  const mintSpace    = getMintLen([]);
  const mintRent     = await client.getRent();
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

  // Create ATAs and fund each participant
  for (const [kp, label] of [
    [authority, 'auth'],
    [userA,     'A'],
    [userB,     'B'],
    [stranger,  'S'],
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

    if (label === 'auth') authorityToken = ata;
    else if (label === 'A') userAToken = ata;
    else if (label === 'B') userBToken = ata;
    else strangerToken = ata;
  }
});

// ── Helpers for common instructions ────────────────────────────────────────

const INIT_LIQ   = 10_000 * ONE_UNIT;   // default initial liquidity per market
const SWAP_FEE   = 30;                   // 0.3 %

async function createMarket(params: {
  endTime?:          typeof BN.prototype;
  initialLiquidity?: typeof BN.prototype;
  swapFeeBps?:       number | null;
  signer?:           Keypair;
  signerToken?:      PublicKey;
} = {}) {
  const [protocol] = protocolPda();
  const state      = await program.account.protocol.fetch(protocol);
  const id         = state.totalMarkets.toNumber();
  const [market]   = marketPda(id);
  const [vault]    = vaultPda(market);
  const endTime    = params.endTime ?? new BN((await now(context)) + ONE_HOUR + 120);
  const signer     = params.signer     ?? authority;
  const signerTok  = params.signerToken ?? authorityToken;

  await program.methods
    .createMarket({
      endTime,
      initialLiquidity: params.initialLiquidity ?? new BN(INIT_LIQ),
      swapFeeBps:       params.swapFeeBps !== undefined ? params.swapFeeBps : SWAP_FEE,
    })
    .accounts({
      creator:             signer.publicKey,
      protocol,
      market,
      collateralMint,
      vault,
      creatorTokenAccount: signerTok,
      tokenProgram:        TOKEN_2022_PROGRAM_ID,
      systemProgram:       SystemProgram.programId,
    })
    .signers([signer])
    .rpc();

  return { id, market, vault };
}

async function swap(
  user:      Keypair,
  userToken: PublicKey,
  marketId:  number,
  outcome:   number,
  amount:    number,
) {
  const [market]   = marketPda(marketId);
  const [vault]    = vaultPda(market);
  const [position] = positionPda(market, user.publicKey);

  await program.methods
    .swap({ outcome, amount: new BN(amount) })
    .accounts({
      user:             user.publicKey,
      market,
      position,
      userTokenAccount: userToken,
      vault,
      collateralMint,
      tokenProgram:     TOKEN_2022_PROGRAM_ID,
      systemProgram:    SystemProgram.programId,
    })
    .signers([user])
    .rpc();
}

async function resolveMarket(oracleSigner: Keypair, marketId: number, winningOutcome: number) {
  const [protocol] = protocolPda();
  const [market]   = marketPda(marketId);

  await program.methods
    .resolveMarket({ winningOutcome })
    .accounts({ oracle: oracleSigner.publicKey, protocol, market })
    .signers([oracleSigner])
    .rpc();
}

async function requestRedeem(user: Keypair, marketId: number) {
  const [market]   = marketPda(marketId);
  const [position] = positionPda(market, user.publicKey);

  await program.methods
    .requestRedeem()
    .accounts({ user: user.publicKey, market, position })
    .signers([user])
    .rpc();
}

async function claimWinnings(
  user:      Keypair,
  userToken: PublicKey,
  marketId:  number,
) {
  const [market]   = marketPda(marketId);
  const [vault]    = vaultPda(market);
  const [position] = positionPda(market, user.publicKey);

  await program.methods
    .claimWinnings()
    .accounts({
      user:             user.publicKey,
      market,
      position,
      userTokenAccount: userToken,
      vault,
      collateralMint,
      tokenProgram:     TOKEN_2022_PROGRAM_ID,
    })
    .signers([user])
    .rpc();
}

// ══════════════════════════════════════════════════════════════════════════════
// Test suites
// ══════════════════════════════════════════════════════════════════════════════

describe('initialize', () => {
  it('sets up protocol with correct config', async () => {
    const [protocol] = protocolPda();

    await program.methods
      .initialize({ oracle: oracle.publicKey, treasury: treasury.publicKey })
      .accounts({ authority: authority.publicKey, protocol, systemProgram: SystemProgram.programId })
      .signers([authority])
      .rpc();

    const state = await program.account.protocol.fetch(protocol);
    expect(state.authority.toString()).to.equal(authority.publicKey.toString());
    expect(state.oracle.toString()).to.equal(oracle.publicKey.toString());
    expect(state.treasury.toString()).to.equal(treasury.publicKey.toString());
    expect(state.feeBps).to.equal(100);
    expect(state.totalMarkets.toNumber()).to.equal(0);
  });

  it('blocks double init', async () => {
    const [protocol] = protocolPda();
    await expectFail(() =>
      program.methods
        .initialize({ oracle: oracle.publicKey, treasury: treasury.publicKey })
        .accounts({ authority: authority.publicKey, protocol, systemProgram: SystemProgram.programId })
        .signers([authority])
        .rpc(),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('create_market', () => {
  it('creates market with correct AMM initial state (50/50)', async () => {
    const { id, market, vault } = await createMarket({ initialLiquidity: new BN(INIT_LIQ) });

    const mkt = await program.account.market.fetch(market);

    expect(mkt.id.toNumber()).to.equal(id);
    expect(mkt.status).to.deep.equal({ active: {} });
    expect(mkt.winningOutcome).to.be.null;

    expect(mkt.yesReserve.toNumber()).to.equal(INIT_LIQ);
    expect(mkt.noReserve.toNumber()).to.equal(INIT_LIQ);
    expect(mkt.yesSharesTotal.toNumber()).to.equal(0);
    expect(mkt.noSharesTotal.toNumber()).to.equal(0);
    expect(mkt.swapFeeBps).to.equal(30);

    const vaultBal = await getTokenBalance(provider, vault);
    expect(vaultBal).to.equal(INIT_LIQ);
  });

  it("debits creator's token account for initial liquidity", async () => {
    const before = await getTokenBalance(provider, authorityToken);
    await createMarket({ initialLiquidity: new BN(INIT_LIQ) });
    const after = await getTokenBalance(provider, authorityToken);
    expect(before - after).to.equal(INIT_LIQ);
  });

  it('increments totalMarkets counter', async () => {
    const [protocol] = protocolPda();
    const before = (await program.account.protocol.fetch(protocol)).totalMarkets.toNumber();
    await createMarket();
    const after = (await program.account.protocol.fetch(protocol)).totalMarkets.toNumber();
    expect(after).to.equal(before + 1);
  });

  it('assigns sequential IDs', async () => {
    const [protocol] = protocolPda();
    const startId = (await program.account.protocol.fetch(protocol)).totalMarkets.toNumber();

    const { market: m1 } = await createMarket();
    const { market: m2 } = await createMarket();

    const s1 = await program.account.market.fetch(m1);
    const s2 = await program.account.market.fetch(m2);
    expect(s1.id.toNumber()).to.equal(startId);
    expect(s2.id.toNumber()).to.equal(startId + 1);
    expect(m1.toString()).to.not.equal(m2.toString());
  });

  it('rejects non-authority creator', async () => {
    await expectFail(
      () => createMarket({ signer: stranger, signerToken: strangerToken }),
      'Unauthorized',
    );
  });

  it('rejects end_time < 1 hour from now', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id    = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault]  = vaultPda(market);
    const t     = await now(context);

    await expectFail(
      () =>
        program.methods
          .createMarket({
            endTime:          new BN(t + 1800), // 30 min
            initialLiquidity: new BN(INIT_LIQ),
            swapFeeBps:       30,
          })
          .accounts({
            creator: authority.publicKey, protocol, market, collateralMint,
            vault, creatorTokenAccount: authorityToken,
            tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc(),
      'InvalidDuration',
    );
  });

  it('rejects zero initial liquidity', async () => {
    const [protocol] = protocolPda();
    const state = await program.account.protocol.fetch(protocol);
    const id    = state.totalMarkets.toNumber();
    const [market] = marketPda(id);
    const [vault]  = vaultPda(market);
    const t     = await now(context);

    await expectFail(
      () =>
        program.methods
          .createMarket({
            endTime:          new BN(t + ONE_HOUR + 300),
            initialLiquidity: new BN(0),
            swapFeeBps:       30,
          })
          .accounts({
            creator: authority.publicKey, protocol, market, collateralMint,
            vault, creatorTokenAccount: authorityToken,
            tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc(),
      'ZeroLiquidity',
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('swap', () => {
  // All swap tests operate on market 0 (first created)
  const MARKET_ID = 0;
  const YES = 0;
  const NO  = 1;

  it('buying YES increases YES price (no_reserve up, yes_reserve down)', async () => {
    const [market] = marketPda(MARKET_ID);
    const mktBefore = await program.account.market.fetch(market);
    const yesBefore = mktBefore.yesReserve.toNumber();
    const noBefore  = mktBefore.noReserve.toNumber();

    const BUY = 500 * ONE_UNIT;
    await swap(userA, userAToken, MARKET_ID, YES, BUY);

    const mktAfter = await program.account.market.fetch(market);
    const yesAfter = mktAfter.yesReserve.toNumber();
    const noAfter  = mktAfter.noReserve.toNumber();

    // YES reserve decreased → fewer YES in pool → YES is more expensive
    expect(yesAfter).to.be.lessThan(yesBefore);
    // NO reserve increased → amount_in deposited to NO side
    expect(noAfter).to.be.greaterThan(noBefore);
    // YES shares issued to user
    expect(mktAfter.yesSharesTotal.toNumber()).to.be.greaterThan(0);
  });

  it('buying NO increases NO price (yes_reserve up, no_reserve down)', async () => {
    const [market] = marketPda(MARKET_ID);
    const mktBefore = await program.account.market.fetch(market);
    const yesBefore = mktBefore.yesReserve.toNumber();
    const noBefore  = mktBefore.noReserve.toNumber();

    await swap(userB, userBToken, MARKET_ID, NO, 500 * ONE_UNIT);

    const mktAfter = await program.account.market.fetch(market);
    expect(mktAfter.noReserve.toNumber()).to.be.lessThan(noBefore);
    expect(mktAfter.yesReserve.toNumber()).to.be.greaterThan(yesBefore);
    expect(mktAfter.noSharesTotal.toNumber()).to.be.greaterThan(0);
  });

  it('CPMM invariant k maintained after swap (within rounding)', async () => {
    const [market] = marketPda(MARKET_ID);

    // Snapshot k before
    const mktBefore = await program.account.market.fetch(market);
    const kBefore = BigInt(mktBefore.yesReserve.toString()) *
                    BigInt(mktBefore.noReserve.toString());

    await swap(userA, userAToken, MARKET_ID, YES, 200 * ONE_UNIT);

    const mktAfter = await program.account.market.fetch(market);
    const kAfter  = BigInt(mktAfter.yesReserve.toString()) *
                    BigInt(mktAfter.noReserve.toString());

    // k should be maintained (allow 1 unit rounding tolerance from integer division)
    const diff = kAfter >= kBefore ? kAfter - kBefore : kBefore - kAfter;
    expect(Number(diff)).to.be.lessThanOrEqual(
      mktAfter.noReserve.toNumber(), // rounding tolerance proportional to pool size
    );
  });

  it('prices are bounded (0, 1) and sum to ~1', async () => {
    const [market] = marketPda(MARKET_ID);
    const mkt = await program.account.market.fetch(market);

    const total = mkt.yesReserve.toNumber() + mkt.noReserve.toNumber();
    const yesPrice = mkt.noReserve.toNumber() / total;
    const noPrice  = mkt.yesReserve.toNumber() / total;

    expect(yesPrice).to.be.greaterThan(0);
    expect(yesPrice).to.be.lessThan(1);
    expect(noPrice).to.be.greaterThan(0);
    expect(noPrice).to.be.lessThan(1);
    expect(yesPrice + noPrice).to.be.closeTo(1.0, 0.0001);
  });

  it('swap fee deducted — vault gets full amount, fee stays in vault', async () => {
    const [market] = marketPda(MARKET_ID);
    const [vault]  = vaultPda(market);

    const vaultBefore = await getTokenBalance(provider, vault);
    const userBefore  = await getTokenBalance(provider, userAToken);
    const BUY = 1000 * ONE_UNIT;

    await swap(userA, userAToken, MARKET_ID, YES, BUY);

    const vaultAfter = await getTokenBalance(provider, vault);
    const userAfter  = await getTokenBalance(provider, userAToken);

    // Full buy amount leaves user wallet
    expect(userBefore - userAfter).to.equal(BUY);
    // Full amount arrives in vault (fee stays inside vault)
    expect(vaultAfter - vaultBefore).to.equal(BUY);
  });

  it('position created with correct owner and market', async () => {
    const [market]   = marketPda(MARKET_ID);
    const [position] = positionPda(market, userA.publicKey);
    const pos = await program.account.position.fetch(position);

    expect(pos.owner.toString()).to.equal(userA.publicKey.toString());
    expect(pos.market.toString()).to.equal(market.toString());
    expect(pos.redeemed).to.be.false;
    // Ciphertext handles stay as zero Pubkey (Encrypt integration stubbed; real EUint64 wired when SDK ships)
  });

  it('second swap accumulates — yes_shares_total increases further', async () => {
    const [market] = marketPda(MARKET_ID);
    const before   = (await program.account.market.fetch(market)).yesSharesTotal.toNumber();

    await swap(userA, userAToken, MARKET_ID, YES, 300 * ONE_UNIT);

    const after = (await program.account.market.fetch(market)).yesSharesTotal.toNumber();
    expect(after).to.be.greaterThan(before);
  });

  it('rejects zero amount', async () => {
    const [market]   = marketPda(MARKET_ID);
    const [vault]    = vaultPda(market);
    const [position] = positionPda(market, userA.publicKey);

    await expectFail(
      () =>
        program.methods
          .swap({ outcome: YES, amount: new BN(0) })
          .accounts({
            user: userA.publicKey, market, position,
            userTokenAccount: userAToken, vault, collateralMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc(),
      'InvalidAmount',
    );
  });

  it('rejects invalid outcome (not 0 or 1)', async () => {
    const [market]   = marketPda(MARKET_ID);
    const [vault]    = vaultPda(market);
    const [position] = positionPda(market, userA.publicKey);

    await expectFail(
      () =>
        program.methods
          .swap({ outcome: 5, amount: new BN(100 * ONE_UNIT) })
          .accounts({
            user: userA.publicKey, market, position,
            userTokenAccount: userAToken, vault, collateralMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc(),
      'InvalidOutcome',
    );
  });

  it('rejects swap after market ended', async () => {
    const [market] = marketPda(MARKET_ID);
    const mkt      = await program.account.market.fetch(market);
    await warpBy(context, mkt.endTime.toNumber() - (await now(context)) + 10);

    const [vault]    = vaultPda(market);
    const [position] = positionPda(market, userA.publicKey);

    await expectFail(
      () =>
        program.methods
          .swap({ outcome: YES, amount: new BN(100 * ONE_UNIT) })
          .accounts({
            user: userA.publicKey, market, position,
            userTokenAccount: userAToken, vault, collateralMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
          })
          .signers([userA])
          .rpc(),
      'MarketEnded',
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('resolve_market', () => {
  const MARKET_ID = 0;

  it('rejects non-oracle signer', async () => {
    await expectFail(
      () => resolveMarket(stranger, MARKET_ID, 0),
      'Unauthorized',
    );
  });

  it('rejects invalid outcome (>1)', async () => {
    await expectFail(
      () => resolveMarket(oracle, MARKET_ID, 99),
      'InvalidOutcome',
    );
  });

  it('oracle resolves YES after end_time', async () => {
    // Market 0 is already past end_time from the swap tests
    await resolveMarket(oracle, MARKET_ID, 0);

    const [market] = marketPda(MARKET_ID);
    const mkt      = await program.account.market.fetch(market);

    expect(mkt.status).to.deep.equal({ resolved: {} });
    expect(mkt.winningOutcome).to.equal(0);
  });

  it('blocks double resolution', async () => {
    await expectFail(
      () => resolveMarket(oracle, MARKET_ID, 0),
      'MarketAlreadyResolved',
    );
  });

  it('blocks resolution before end_time', async () => {
    const { id } = await createMarket({
      endTime: new BN((await now(context)) + ONE_HOUR + 300),
    });

    await expectFail(
      () => resolveMarket(oracle, id, 0),
      'MarketNotEnded',
    );
  });

  it('blocks resolution after 24h window', async () => {
    const { id, market } = await createMarket({
      endTime: new BN((await now(context)) + ONE_HOUR + 300),
    });

    const mkt    = await program.account.market.fetch(market);
    const target = mkt.endTime.toNumber() + 25 * 3600;
    await warpBy(context, target - (await now(context)));

    await expectFail(
      () => resolveMarket(oracle, id, 0),
      'ResolutionWindowExpired',
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('redeem', () => {
  // Use a dedicated market so we have full control over its lifecycle
  let redeemMarketId: number;

  const BUY_A = 2_000 * ONE_UNIT; // userA buys YES

  before(async () => {
    // Create a fresh market, let userA buy YES, then resolve YES wins
    const { id, market } = await createMarket({
      endTime: new BN((await now(context)) + ONE_HOUR + 300),
    });
    redeemMarketId = id;

    // userA buys YES
    await swap(userA, userAToken, redeemMarketId, YES, BUY_A);

    // Warp past end_time
    const mkt = await program.account.market.fetch(market);
    await warpBy(context, mkt.endTime.toNumber() - (await now(context)) + 10);

    // Oracle resolves YES (outcome 0)
    await resolveMarket(oracle, redeemMarketId, 0);
  });

  it('blocks redeem on unresolved market', async () => {
    // Create a market, buy shares so the position exists, then try to redeem
    // before the market is resolved — should fail with MarketNotActive.
    const { id, market } = await createMarket();
    await swap(userA, userAToken, id, YES, BUY_A);

    const [position] = positionPda(market, userA.publicKey);

    await expectFail(
      () =>
        program.methods
          .requestRedeem()
          .accounts({ user: userA.publicKey, market, position })
          .signers([userA])
          .rpc(),
      'MarketNotActive',
    );
  });

  it('loser (NO holder) cannot claim', async () => {
    // userB has NO position on redeemMarketId but YES won
    // First give userB a NO position
    const BUY_B = 500 * ONE_UNIT;

    // Create a second redeem market for the loser test
    const { id, market } = await createMarket({
      endTime: new BN((await now(context)) + ONE_HOUR + 300),
    });

    await swap(userA, userAToken, id, YES, BUY_A);
    await swap(userB, userBToken, id, NO, BUY_B);

    const mkt = await program.account.market.fetch(market);
    await warpBy(context, mkt.endTime.toNumber() - (await now(context)) + 10);
    await resolveMarket(oracle, id, 0); // YES wins

    // userB has NO shares but YES won → should fail on claim
    const [position] = positionPda(market, userB.publicKey);
    await expectFail(
      () =>
        program.methods
          .requestRedeem()
          .accounts({ user: userB.publicKey, market, position })
          .signers([userB])
          .rpc(),
      'NotAWinner',
    );
  });

  it('winner requests redeem successfully', async () => {
    // Should not throw
    await requestRedeem(userA, redeemMarketId);
  });

  it('winner claims correct payout', async () => {
    const [market] = marketPda(redeemMarketId);
    const mkt      = await program.account.market.fetch(market);
    const [vault]  = vaultPda(market);

    const vaultBalance    = await getTokenBalance(provider, vault);
    const yesSharesTotal  = mkt.yesSharesTotal.toNumber();

    const [position] = positionPda(market, userA.publicKey);
    const pos        = await program.account.position.fetch(position);
    const userShares = pos.yesShares.toNumber();

    const gross = Math.floor((userShares * vaultBalance) / yesSharesTotal);
    const fee   = Math.floor((gross * 100) / 10_000);  // 1% protocol fee
    const net   = gross - fee;

    const userBefore = await getTokenBalance(provider, userAToken);
    await claimWinnings(userA, userAToken, redeemMarketId);
    const userAfter  = await getTokenBalance(provider, userAToken);

    expect(userAfter - userBefore).to.equal(net);
  });

  it('fee stays in vault after claim', async () => {
    const [market] = marketPda(redeemMarketId);
    const [vault]  = vaultPda(market);
    const mkt      = await program.account.market.fetch(market);

    const vaultBalance = await getTokenBalance(provider, vault);
    // vault should hold the fee remainder
    expect(vaultBalance).to.be.greaterThan(0);
  });

  it('marks position as redeemed', async () => {
    const [market]   = marketPda(redeemMarketId);
    const [position] = positionPda(market, userA.publicKey);
    const pos        = await program.account.position.fetch(position);
    expect(pos.redeemed).to.be.true;
  });

  it('blocks double claim', async () => {
    await expectFail(
      () => claimWinnings(userA, userAToken, redeemMarketId),
      'AlreadyRedeemed',
    );
  });
});
