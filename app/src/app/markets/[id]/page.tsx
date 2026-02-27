'use client';

import { useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Header';
import {
  MARKETS,
  RECENT_ACTIVITY,
  formatVolume,
  formatDate,
  daysUntil,
} from '@/lib/mockData';

const ORACLE_SOURCES: Record<string, { source: string; status: string; ok: boolean }[]> = {
  '1': [
    { source: 'Coinbase Pro API', status: 'Connected', ok: true },
    { source: 'Binance Market Data', status: 'Connected', ok: true },
    { source: 'CoinGecko Index', status: 'Connected', ok: true },
    { source: 'Resolution Trigger', status: 'Awaiting $150k', ok: false },
  ],
  '2': [
    { source: 'DeFiLlama SOL TVL', status: 'Connected', ok: true },
    { source: 'DeFiLlama ETH TVL', status: 'Connected', ok: true },
    { source: 'Resolution Trigger', status: 'Awaiting condition', ok: false },
  ],
  '3': [
    { source: 'Federal Reserve RSS', status: 'Connected', ok: true },
    { source: 'FOMC Statement Parser', status: 'Monitoring', ok: true },
    { source: 'Resolution Trigger', status: 'Meeting pending', ok: false },
  ],
};

const QUICK_AMOUNTS = ['10', '50', '100', '500'];

export default function MarketDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const market = MARKETS.find((m) => m.id === id);

  const { connected } = useWallet();
  const [outcome, setOutcome] = useState<'YES' | 'NO' | null>(null);
  const [amount, setAmount] = useState('');

  if (!market) return notFound();

  const yesProb = market.yesProb;
  const noProb = 100 - yesProb;
  const days = daysUntil(market.endDate);
  const oracleSources = ORACLE_SOURCES[id] ?? ORACLE_SOURCES['1'];

  const potentialPayout =
    amount && outcome
      ? (parseFloat(amount) / (outcome === 'YES' ? yesProb / 100 : noProb / 100)).toFixed(2)
      : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-void)' }}>
      <Header />

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        {/* Breadcrumb */}
        <div
          className="flex items-center gap-2 text-xs mb-8"
          style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--text-300)' }}
        >
          <Link href="/" className="hover:text-[var(--text-100)] transition-colors">
            MARKETS
          </Link>
          <span>/</span>
          <span>{market.category.toUpperCase()}</span>
          <span>/</span>
          <span style={{ color: 'var(--text-200)' }}>#{market.id}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Info ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header card */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{
                    color: '#F0C040',
                    background: 'rgba(240,192,64,0.08)',
                    border: '1px solid rgba(240,192,64,0.2)',
                    fontFamily: 'var(--font-dm-mono)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {market.category.toUpperCase()}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    color: 'var(--cyan)',
                    background: 'var(--cyan-dim)',
                    border: '1px solid rgba(0,229,204,0.18)',
                    fontFamily: 'var(--font-dm-mono)',
                  }}
                >
                  ACTIVE
                </span>
                <span
                  className="ml-auto text-xs"
                  style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
                >
                  Closes {formatDate(market.endDate)} · {days}d remaining
                </span>
              </div>

              <h1
                className="text-xl font-bold leading-snug mb-7"
                style={{ color: 'var(--text-100)' }}
              >
                {market.question}
              </h1>

              {/* Probability display */}
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-5xl font-bold tabular-nums"
                      style={{ color: 'var(--cyan)', fontFamily: 'var(--font-dm-mono)' }}
                    >
                      {yesProb}%
                    </span>
                    <span className="text-base font-semibold" style={{ color: 'rgba(0,229,204,0.7)' }}>
                      YES
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-semibold" style={{ color: 'rgba(255,61,107,0.7)' }}>
                      NO
                    </span>
                    <span
                      className="text-3xl font-bold tabular-nums"
                      style={{ color: 'var(--red)', fontFamily: 'var(--font-dm-mono)' }}
                    >
                      {noProb}%
                    </span>
                  </div>
                </div>

                {/* Bar */}
                <div
                  className="h-3 rounded-full overflow-hidden flex"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <div
                    className="h-full rounded-l-full"
                    style={{
                      width: `${yesProb}%`,
                      background: 'linear-gradient(90deg, var(--cyan), rgba(0,229,204,0.75))',
                      boxShadow: '2px 0 14px rgba(0,229,204,0.38)',
                      transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  />
                  <div
                    className="h-full rounded-r-full flex-1"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(255,61,107,0.38), rgba(255,61,107,0.58))',
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Volume', value: formatVolume(market.volume) },
                  { label: 'Liquidity', value: formatVolume(market.liquidity) },
                  { label: 'Predictors', value: market.totalPredictors.toLocaleString() },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg p-3"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      className="text-base font-bold tabular-nums"
                      style={{ color: 'var(--text-100)', fontFamily: 'var(--font-dm-mono)' }}
                    >
                      {s.value}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-300)' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* About */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <h2
                className="text-sm font-semibold mb-3"
                style={{ color: 'var(--text-100)' }}
              >
                About this Market
              </h2>
              <p
                className="text-sm leading-relaxed mb-5"
                style={{ color: 'var(--text-300)' }}
              >
                {market.description}
              </p>

              {/* Resolution criteria */}
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'rgba(0,229,204,0.04)',
                  border: '1px solid rgba(0,229,204,0.14)',
                }}
              >
                <div
                  className="text-xs font-semibold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--cyan)', fontFamily: 'var(--font-dm-mono)' }}
                >
                  Resolution Criteria
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-300)' }}>
                  {market.resolutionCriteria}
                </p>
              </div>
            </div>

            {/* Activity */}
            <div
              className="rounded-xl p-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-100)' }}>
                Recent Activity
              </h2>

              <div className="space-y-1">
                {RECENT_ACTIVITY.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 border-b transition-colors rounded px-1 hover:bg-white/[0.02]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: a.action === 'YES' ? 'var(--cyan)' : 'var(--red)',
                          background:
                            a.action === 'YES'
                              ? 'rgba(0,229,204,0.08)'
                              : 'rgba(255,61,107,0.08)',
                          fontFamily: 'var(--font-dm-mono)',
                        }}
                      >
                        {a.action}
                      </span>
                      <span
                        className="text-xs"
                        style={{
                          color: 'var(--text-300)',
                          fontFamily: 'var(--font-dm-mono)',
                        }}
                      >
                        {a.user}
                      </span>
                    </div>
                    <div className="flex items-center gap-5">
                      <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color: 'var(--text-100)', fontFamily: 'var(--font-dm-mono)' }}
                      >
                        ${a.amount}
                      </span>
                      <span
                        className="text-xs w-14 text-right"
                        style={{ color: 'var(--text-300)' }}
                      >
                        {a.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Sidebar ── */}
          <div className="space-y-4">
            {/* Prediction card */}
            <div
              className="rounded-xl p-5 sticky top-20"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-100)' }}>
                Place Prediction
              </h2>

              {/* YES / NO */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <button
                  onClick={() => setOutcome('YES')}
                  className={`btn-yes py-3 rounded-lg font-bold text-sm ${outcome === 'YES' ? 'selected' : ''}`}
                >
                  YES · {yesProb}%
                </button>
                <button
                  onClick={() => setOutcome('NO')}
                  className={`btn-no py-3 rounded-lg font-bold text-sm ${outcome === 'NO' ? 'selected' : ''}`}
                >
                  NO · {noProb}%
                </button>
              </div>

              {/* Amount */}
              <label
                className="block text-xs mb-1.5"
                style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
              >
                AMOUNT (USDC)
              </label>
              <div className="relative mb-3">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: 'var(--text-300)' }}
                >
                  $
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-dim)',
                    color: 'var(--text-100)',
                    fontFamily: 'var(--font-dm-mono)',
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = 'rgba(0,229,204,0.3)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--border-dim)')
                  }
                />
              </div>

              {/* Quick amounts */}
              <div className="flex gap-1.5 mb-4">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className="flex-1 py-1 rounded text-xs transition-all"
                    style={{
                      background: amount === v ? 'var(--bg-elevated)' : 'var(--bg-deep)',
                      border:
                        amount === v
                          ? '1px solid var(--border-dim)'
                          : '1px solid var(--border-subtle)',
                      color: amount === v ? 'var(--text-100)' : 'var(--text-300)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    ${v}
                  </button>
                ))}
              </div>

              {/* Estimate */}
              {outcome && amount && potentialPayout && (
                <div
                  className="rounded-lg p-3 mb-4 space-y-2"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-dim)',
                  }}
                >
                  <div
                    className="flex justify-between text-xs"
                    style={{
                      color: 'var(--text-300)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    <span>If {outcome} wins, you get</span>
                    <span
                      style={{
                        color: outcome === 'YES' ? 'var(--cyan)' : 'var(--red)',
                        fontWeight: 600,
                      }}
                    >
                      ${potentialPayout}
                    </span>
                  </div>
                  <div
                    className="flex justify-between text-xs"
                    style={{
                      color: 'var(--text-300)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    <span>Return</span>
                    <span style={{ color: 'var(--text-200)' }}>
                      {((parseFloat(potentialPayout) / parseFloat(amount) - 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                disabled={!connected || !outcome || !amount}
                className="w-full py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  background:
                    connected && outcome && amount
                      ? outcome === 'YES'
                        ? 'linear-gradient(135deg, rgba(0,229,204,0.28), rgba(0,229,204,0.14))'
                        : 'linear-gradient(135deg, rgba(255,61,107,0.28), rgba(255,61,107,0.14))'
                      : 'var(--bg-elevated)',
                  border:
                    connected && outcome && amount
                      ? outcome === 'YES'
                        ? '1px solid rgba(0,229,204,0.4)'
                        : '1px solid rgba(255,61,107,0.4)'
                      : '1px solid var(--border-dim)',
                  color:
                    connected && outcome && amount
                      ? outcome === 'YES'
                        ? 'var(--cyan)'
                        : 'var(--red)'
                      : 'var(--text-300)',
                  cursor: connected && outcome && amount ? 'pointer' : 'not-allowed',
                  boxShadow:
                    connected && outcome && amount
                      ? outcome === 'YES'
                        ? '0 0 20px rgba(0,229,204,0.12)'
                        : '0 0 20px rgba(255,61,107,0.12)'
                      : 'none',
                }}
              >
                {!connected
                  ? 'Connect Wallet to Predict'
                  : !outcome
                  ? 'Select YES or NO'
                  : !amount
                  ? 'Enter Amount'
                  : `Predict ${outcome} — $${amount}`}
              </button>
            </div>

            {/* Oracle status */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: 'rgba(0,229,204,0.1)',
                    border: '1px solid rgba(0,229,204,0.2)',
                    color: 'var(--cyan)',
                    fontFamily: 'var(--font-dm-mono)',
                  }}
                >
                  AI
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
                  Oracle Status
                </span>
                <span
                  className="ml-auto text-xs px-2 py-0.5 rounded-full"
                  style={{
                    color: 'var(--cyan)',
                    background: 'var(--cyan-dim)',
                    border: '1px solid rgba(0,229,204,0.18)',
                    fontFamily: 'var(--font-dm-mono)',
                    letterSpacing: '0.05em',
                  }}
                >
                  MONITORING
                </span>
              </div>

              <div className="space-y-3">
                {oracleSources.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
                    >
                      {item.source}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: item.ok ? 'var(--cyan)' : 'var(--gold)',
                          boxShadow: item.ok
                            ? '0 0 5px rgba(0,229,204,0.5)'
                            : '0 0 5px rgba(240,192,64,0.5)',
                        }}
                      />
                      <span
                        className="text-xs"
                        style={{
                          color: item.ok ? 'var(--cyan)' : 'var(--gold)',
                          fontFamily: 'var(--font-dm-mono)',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
