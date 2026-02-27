'use client';

import Link from 'next/link';
import { type Market, formatVolume, daysUntil } from '@/lib/mockData';

const CATEGORY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Crypto: {
    color: '#F0C040',
    bg: 'rgba(240,192,64,0.08)',
    border: 'rgba(240,192,64,0.22)',
  },
  Finance: {
    color: '#00E5CC',
    bg: 'rgba(0,229,204,0.08)',
    border: 'rgba(0,229,204,0.22)',
  },
  Politics: {
    color: '#FF6B6B',
    bg: 'rgba(255,107,107,0.08)',
    border: 'rgba(255,107,107,0.22)',
  },
  Tech: {
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.22)',
  },
};

export function MarketCard({ market, index = 0 }: { market: Market; index?: number }) {
  const yesProb = market.yesProb;
  const noProb = 100 - yesProb;
  const days = daysUntil(market.endDate);
  const cat = CATEGORY_STYLES[market.category] ?? CATEGORY_STYLES.Crypto;

  return (
    <Link href={`/markets/${market.id}`} className="block h-full">
      <article
        className="market-card h-full flex flex-col rounded-xl p-5 gap-4"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
            style={{
              color: cat.color,
              background: cat.bg,
              border: `1px solid ${cat.border}`,
              fontFamily: 'var(--font-dm-mono)',
              letterSpacing: '0.06em',
            }}
          >
            {market.category.toUpperCase()}
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
          >
            {days}d left
          </span>
        </div>

        {/* Question */}
        <p
          className="text-sm font-semibold leading-snug flex-1"
          style={{ color: 'var(--text-100)' }}
        >
          {market.question}
        </p>

        {/* Probability */}
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: 'var(--cyan)', fontFamily: 'var(--font-dm-mono)' }}
              >
                {yesProb}%
              </span>
              <span className="text-xs font-semibold" style={{ color: 'rgba(0,229,204,0.65)' }}>
                YES
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,61,107,0.65)' }}>
                NO
              </span>
              <span
                className="text-lg font-bold tabular-nums"
                style={{ color: 'var(--red)', fontFamily: 'var(--font-dm-mono)' }}
              >
                {noProb}%
              </span>
            </div>
          </div>

          {/* Split bar */}
          <div
            className="h-1.5 rounded-full overflow-hidden flex"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div
              className="h-full rounded-l-full"
              style={{
                width: `${yesProb}%`,
                background: 'linear-gradient(90deg, var(--cyan), rgba(0,229,204,0.7))',
                boxShadow: '1px 0 10px rgba(0,229,204,0.35)',
                transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
            <div
              className="h-full rounded-r-full flex-1"
              style={{
                background: 'linear-gradient(90deg, rgba(255,61,107,0.35), rgba(255,61,107,0.55))',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-4">
            <div>
              <div
                className="text-xs font-medium tabular-nums"
                style={{ color: 'var(--text-100)', fontFamily: 'var(--font-dm-mono)' }}
              >
                {formatVolume(market.volume)}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-300)' }}>
                volume
              </div>
            </div>
            <div>
              <div
                className="text-xs font-medium tabular-nums"
                style={{ color: 'var(--text-100)', fontFamily: 'var(--font-dm-mono)' }}
              >
                {market.totalPredictors.toLocaleString()}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-300)' }}>
                predictors
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-slow"
              style={{ background: 'var(--cyan)', boxShadow: '0 0 5px var(--cyan)' }}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--cyan)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.05em' }}
            >
              LIVE
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
