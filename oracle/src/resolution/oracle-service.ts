import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import type { IJudge } from '../judges/interface.js';
import { PlaceholderJudge } from '../judges/placeholder.js';

export interface PendingMarket {
  pubkey: PublicKey;
  id: number;
  question: string;
  outcomes: string[];
  endTime: Date;
}

export class OracleService {
  private connection: Connection;
  private oracleKeypair: Keypair | null = null;
  private judge: IJudge;
  private running = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.judge = new PlaceholderJudge();

    // Load oracle keypair from env if available
    if (process.env.ORACLE_PRIVATE_KEY) {
      try {
        const secretKey = JSON.parse(process.env.ORACLE_PRIVATE_KEY);
        this.oracleKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        console.log(`Oracle pubkey: ${this.oracleKeypair.publicKey.toBase58()}`);
      } catch {
        console.warn('Failed to parse ORACLE_PRIVATE_KEY');
      }
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log('Oracle service started');
    console.log('Polling for markets pending resolution...');

    // Poll every 60 seconds for markets to resolve
    this.pollInterval = setInterval(() => this.pollMarkets(), 60_000);

    // Initial poll
    await this.pollMarkets();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('Oracle service stopped');
  }

  private async pollMarkets(): Promise<void> {
    if (!this.running) return;

    try {
      const pendingMarkets = await this.fetchPendingMarkets();

      for (const market of pendingMarkets) {
        await this.resolveMarket(market);
      }
    } catch (err) {
      console.error('Error polling markets:', err);
    }
  }

  private async fetchPendingMarkets(): Promise<PendingMarket[]> {
    // TODO: Fetch markets from program accounts that:
    // 1. Have status = Active
    // 2. Have end_time < now
    // 3. Are within the resolution window

    console.log('Fetching pending markets...');
    return [];
  }

  private async resolveMarket(market: PendingMarket): Promise<void> {
    if (!this.oracleKeypair) {
      console.warn('Oracle keypair not configured, skipping resolution');
      return;
    }

    console.log(`Resolving market ${market.id}: ${market.question}`);

    // TODO:
    // 1. Fetch evidence from data sources
    // 2. Call judge to determine outcome
    // 3. Submit resolution transaction

    const result = await this.judge.judge({
      question: market.question,
      outcomes: market.outcomes,
      evidence: [],
      endTime: market.endTime,
    });

    console.log(`Judge result: outcome=${result.winningOutcome}, confidence=${result.confidence}`);
    console.log(`Reasoning: ${result.reasoning}`);

    // TODO: Submit on-chain resolution transaction
  }
}
