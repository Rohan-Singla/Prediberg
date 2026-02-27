export type Category = 'Crypto' | 'Politics' | 'Tech' | 'Finance';

export type Market = {
  id: string;
  question: string;
  category: Category;
  yesProb: number;
  volume: number;
  liquidity: number;
  endDate: string;
  description: string;
  resolutionCriteria: string;
  status: 'active' | 'resolved' | 'pending';
  resolvedOutcome?: 'YES' | 'NO';
  createdAt: string;
  totalPredictors: number;
};

export const MARKETS: Market[] = [
  {
    id: '1',
    question: 'Will Bitcoin exceed $150,000 before July 2026?',
    category: 'Crypto',
    yesProb: 72,
    volume: 284500,
    liquidity: 45000,
    endDate: '2026-07-01',
    description:
      'This market resolves YES if the price of Bitcoin (BTC) exceeds $150,000 USD on any major exchange (Coinbase, Binance, or Kraken) before July 1, 2026 at 00:00 UTC.',
    resolutionCriteria:
      'The AI oracle checks BTC/USD prices on Coinbase Pro, Binance, and Kraken. If any exchange reports BTC ≥ $150,000 for a sustained 5-minute window, this market resolves YES.',
    status: 'active',
    createdAt: '2026-01-15',
    totalPredictors: 1247,
  },
  {
    id: '2',
    question: 'Will Solana flip Ethereum by Total Value Locked in 2026?',
    category: 'Crypto',
    yesProb: 31,
    volume: 156200,
    liquidity: 28000,
    endDate: '2026-12-31',
    description:
      "This market resolves YES if Solana's total value locked (TVL) across all DeFi protocols exceeds Ethereum's TVL at any point before December 31, 2026.",
    resolutionCriteria:
      'Data sourced from DeFiLlama. Oracle checks TVL snapshots every 24 hours. Resolves YES if SOL TVL > ETH TVL for 3 consecutive daily snapshots.',
    status: 'active',
    createdAt: '2026-01-20',
    totalPredictors: 834,
  },
  {
    id: '3',
    question: 'Will the Federal Reserve cut interest rates in March 2026?',
    category: 'Finance',
    yesProb: 58,
    volume: 421800,
    liquidity: 67000,
    endDate: '2026-03-31',
    description:
      'This market resolves YES if the Federal Open Market Committee (FOMC) announces an interest rate cut at their March 2026 meeting.',
    resolutionCriteria:
      'Oracle resolves based on the official FOMC statement released after the March 2026 meeting. Any reduction in the federal funds rate target range resolves YES.',
    status: 'active',
    createdAt: '2026-01-10',
    totalPredictors: 2156,
  },
  {
    id: '4',
    question: 'Will the US pass comprehensive crypto legislation by Q2 2026?',
    category: 'Politics',
    yesProb: 45,
    volume: 198600,
    liquidity: 34000,
    endDate: '2026-06-30',
    description:
      'Market resolves YES if the US Congress passes and the President signs comprehensive federal cryptocurrency regulation legislation before July 1, 2026.',
    resolutionCriteria:
      'Oracle verifies via official Congressional records and White House announcements. Legislation must establish a clear regulatory framework for digital assets to resolve YES.',
    status: 'active',
    createdAt: '2026-01-25',
    totalPredictors: 1089,
  },
  {
    id: '5',
    question: 'Will an Ethereum ETF with staking rewards be approved in 2026?',
    category: 'Crypto',
    yesProb: 67,
    volume: 312400,
    liquidity: 52000,
    endDate: '2026-12-31',
    description:
      'Resolves YES if the SEC approves a spot Ethereum ETF that includes staking rewards distribution to ETF shareholders.',
    resolutionCriteria:
      'Oracle monitors SEC announcements and official ETF filings. An approved staking Ethereum ETF from any major issuer (BlackRock, Fidelity, etc.) resolves this YES.',
    status: 'active',
    createdAt: '2026-02-01',
    totalPredictors: 1567,
  },
  {
    id: '6',
    question: 'Will Apple release a Vision Pro successor before WWDC 2026?',
    category: 'Tech',
    yesProb: 29,
    volume: 87300,
    liquidity: 15000,
    endDate: '2026-06-15',
    description:
      "Market resolves YES if Apple announces and/or begins shipping a second-generation Vision Pro spatial computing device before WWDC 2026.",
    resolutionCriteria:
      "Oracle verifies via Apple's official press releases and product listings. The device must be a distinct hardware revision, not a software update.",
    status: 'active',
    createdAt: '2026-02-10',
    totalPredictors: 445,
  },
];

export const RECENT_ACTIVITY = [
  { user: '7xK9...mP3f', action: 'YES' as const, amount: 250, time: '2m ago' },
  { user: '3nRq...4vLw', action: 'NO' as const, amount: 100, time: '8m ago' },
  { user: '9pWz...2kJr', action: 'YES' as const, amount: 500, time: '15m ago' },
  { user: '5mTd...8dNh', action: 'YES' as const, amount: 75, time: '23m ago' },
  { user: '2hVb...6cRs', action: 'NO' as const, amount: 300, time: '41m ago' },
  { user: '8qLp...1fSt', action: 'YES' as const, amount: 1000, time: '1h ago' },
];

export const MOCK_POSITIONS = [
  {
    market: 'Will Bitcoin exceed $150,000 before July 2026?',
    marketId: '1',
    outcome: 'YES' as const,
    shares: 145.5,
    avgPrice: 0.68,
    currentPrice: 0.72,
    invested: 99,
    pnl: 5.88,
  },
  {
    market: 'Will the Federal Reserve cut interest rates in March 2026?',
    marketId: '3',
    outcome: 'NO' as const,
    shares: 80.0,
    avgPrice: 0.44,
    currentPrice: 0.42,
    invested: 35,
    pnl: -1.6,
  },
  {
    market: 'Will an Ethereum ETF with staking rewards be approved in 2026?',
    marketId: '5',
    outcome: 'YES' as const,
    shares: 210.2,
    avgPrice: 0.6,
    currentPrice: 0.67,
    invested: 126,
    pnl: 14.71,
  },
];

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
