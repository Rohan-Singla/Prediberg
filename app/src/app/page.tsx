'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { MarketCard } from '@/components/MarketCard';
import { MARKETS, type Category } from '@/lib/mockData';

type Filter = 'All' | Category;

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'All' },
  { label: 'Crypto', value: 'Crypto' },
  { label: 'Finance', value: 'Finance' },
  { label: 'Politics', value: 'Politics' },
  { label: 'Tech', value: 'Tech' },
];

const STATS = [
  { label: 'Total Volume', value: '$1.46M' },
  { label: 'Active Markets', value: '6' },
  { label: 'AI Resolutions', value: '24' },
  { label: 'Predictors', value: '6,338' },
];

export default function HomePage() {
  const [filter, setFilter] = useState<Filter>('All');
  const [sort, setSort] = useState<'volume' | 'closing' | 'probability'>('volume');

  const markets = MARKETS.filter((m) => filter === 'All' || m.category === filter).sort((a, b) => {
    if (sort === 'volume') return b.volume - a.volume;
    if (sort === 'probability') return b.yesProb - a.yesProb;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-void)' }}>
      <Header />

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden grid-bg">
        {/* Ambient glows */}
        <div
          className="pointer-events-none absolute -top-32 left-1/4 w-[480px] h-[480px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,229,204,0.08) 0%, transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute top-10 right-1/4 w-72 h-72 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
          }}
        />

        <div className="max-w-7xl mx-auto relative">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs mb-7"
            style={{
              borderColor: 'rgba(0,229,204,0.25)',
              background: 'rgba(0,229,204,0.05)',
              color: 'var(--cyan)',
              fontFamily: 'var(--font-dm-mono)',
              letterSpacing: '0.08em',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--cyan)', animation: 'pulse 2s infinite' }}
            />
            ORACLE ONLINE · SOLANA DEVNET
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight mb-5 max-w-2xl"
            style={{ color: 'var(--text-100)' }}
          >
            Predict the future.
            <br />
            <span
              style={{
                background: 'linear-gradient(110deg, var(--cyan) 0%, #00B4D8 60%, #0EA5E9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Get paid to be right.
            </span>
          </h1>

          <p className="text-base max-w-lg mb-12" style={{ color: 'var(--text-300)' }}>
            AI-resolved prediction markets on Solana. No human oracles, no bias — just
            evidence-based resolution from our AI judge.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <div
                  className="text-2xl font-bold tabular-nums"
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
      </section>

      {/* ── Markets ── */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          {/* Category filters */}
          <div
            className="flex items-center gap-1 p-1 rounded-lg"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    color: active ? 'var(--text-100)' : 'var(--text-300)',
                    background: active ? 'var(--bg-elevated)' : 'transparent',
                    border: active ? '1px solid var(--border-dim)' : '1px solid transparent',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs"
              style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
            >
              SORT:
            </span>
            {(['volume', 'closing', 'probability'] as const).map((s) => {
              const active = sort === s;
              return (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className="px-3 py-1.5 rounded text-xs transition-all"
                  style={{
                    fontFamily: 'var(--font-dm-mono)',
                    color: active ? 'var(--cyan)' : 'var(--text-300)',
                    background: active ? 'var(--cyan-dim)' : 'transparent',
                    border: active
                      ? '1px solid rgba(0,229,204,0.2)'
                      : '1px solid transparent',
                    letterSpacing: '0.05em',
                  }}
                >
                  {s.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Market grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market, i) => (
            <div
              key={market.id}
              className="animate-slide-up stagger-child"
              style={{ opacity: 0 }}
            >
              <MarketCard market={market} index={i} />
            </div>
          ))}
        </div>

        {markets.length === 0 && (
          <div
            className="rounded-xl p-16 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-300)' }}>
              No markets in this category yet.
            </p>
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer
        className="border-t mt-16 py-10 px-6"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rotate-45 rounded-sm"
              style={{ background: 'var(--cyan)', opacity: 0.7 }}
            />
            <span
              className="text-xs font-bold tracking-widest"
              style={{ color: 'var(--text-300)', letterSpacing: '0.15em' }}
            >
              PREDIBERG
            </span>
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--text-400)', fontFamily: 'var(--font-dm-mono)' }}
          >
            AI-powered · Solana · Trustless
          </span>
        </div>
      </footer>
    </div>
  );
}
