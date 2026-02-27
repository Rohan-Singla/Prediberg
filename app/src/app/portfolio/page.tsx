'use client';

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Header } from '@/components/Header';
import { MOCK_POSITIONS, formatVolume } from '@/lib/mockData';

const SUMMARY = {
  totalInvested: 260,
  currentValue: 279.59,
  totalPnl: 19.59,
  winRate: 67,
  openPositions: 3,
  resolvedPositions: 2,
};

const RESOLVED = [
  {
    market: 'Will ETH break ATH in January 2026?',
    outcome: 'YES' as const,
    result: 'WIN' as const,
    invested: 50,
    returned: 78,
    pnl: 28,
  },
  {
    market: 'Will the Fed pause hikes in December 2025?',
    outcome: 'NO' as const,
    result: 'LOSS' as const,
    invested: 30,
    returned: 0,
    pnl: -30,
  },
];

export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-void)' }}>
      <Header />

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        {/* Page header */}
        <div className="mb-10">
          <h1
            className="text-4xl font-extrabold tracking-tight mb-2"
            style={{ color: 'var(--text-100)' }}
          >
            Portfolio
          </h1>
          <p
            className="text-xs"
            style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
          >
            {connected
              ? publicKey?.toBase58().slice(0, 20) + '...'
              : 'Connect wallet to view your positions'}
          </p>
        </div>

        {!connected ? (
          /* ── Not connected ── */
          <div
            className="rounded-xl p-20 flex flex-col items-center text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="w-14 h-14 rounded-xl rotate-45 mb-6"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-dim)',
              }}
            />
            <h2
              className="text-lg font-bold mb-2"
              style={{ color: 'var(--text-100)' }}
            >
              Connect your wallet
            </h2>
            <p className="text-sm mb-8 max-w-xs" style={{ color: 'var(--text-300)' }}>
              Connect your Solana wallet to view your open positions, prediction history,
              and P&amp;L.
            </p>
            <Link
              href="/"
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--cyan)' }}
            >
              Browse Markets →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Summary ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Invested', value: `$${SUMMARY.totalInvested}`, accent: false },
                {
                  label: 'Current Value',
                  value: `$${SUMMARY.currentValue.toFixed(2)}`,
                  accent: true,
                  positive: true,
                },
                {
                  label: 'Total P&L',
                  value: `+$${SUMMARY.totalPnl.toFixed(2)}`,
                  accent: true,
                  positive: true,
                },
                { label: 'Win Rate', value: `${SUMMARY.winRate}%`, accent: true, positive: true },
                {
                  label: 'Open Positions',
                  value: `${SUMMARY.openPositions}`,
                  accent: false,
                },
                {
                  label: 'Resolved',
                  value: `${SUMMARY.resolvedPositions}`,
                  accent: false,
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    className="text-xl font-bold tabular-nums"
                    style={{
                      color:
                        s.accent && s.positive
                          ? 'var(--cyan)'
                          : 'var(--text-100)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    {s.value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-300)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Open Positions ── */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="px-6 py-4 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
                  Open Positions
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    color: 'var(--cyan)',
                    background: 'var(--cyan-dim)',
                    border: '1px solid rgba(0,229,204,0.18)',
                    fontFamily: 'var(--font-dm-mono)',
                  }}
                >
                  {SUMMARY.openPositions} ACTIVE
                </span>
              </div>

              {/* Table head */}
              <div
                className="hidden md:grid grid-cols-6 px-6 py-2.5 border-b"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-deep)' }}
              >
                {['Market', 'Outcome', 'Shares', 'Avg Price', 'Invested', 'P&L'].map((h) => (
                  <div
                    key={h}
                    className="text-xs font-semibold"
                    style={{
                      color: 'var(--text-300)',
                      fontFamily: 'var(--font-dm-mono)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {MOCK_POSITIONS.map((pos, i) => (
                <Link
                  key={i}
                  href={`/markets/${pos.marketId}`}
                  className="grid grid-cols-2 md:grid-cols-6 items-center gap-2 px-6 py-4 border-b transition-colors hover:bg-white/[0.025]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {/* Market */}
                  <div
                    className="col-span-2 md:col-span-1 text-xs leading-snug pr-2"
                    style={{ color: 'var(--text-200)' }}
                  >
                    {pos.market.length > 50
                      ? pos.market.slice(0, 50) + '...'
                      : pos.market}
                  </div>

                  {/* Outcome */}
                  <div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        color: pos.outcome === 'YES' ? 'var(--cyan)' : 'var(--red)',
                        background:
                          pos.outcome === 'YES'
                            ? 'rgba(0,229,204,0.08)'
                            : 'rgba(255,61,107,0.08)',
                        fontFamily: 'var(--font-dm-mono)',
                      }}
                    >
                      {pos.outcome}
                    </span>
                  </div>

                  {/* Shares */}
                  <div
                    className="text-xs tabular-nums"
                    style={{ color: 'var(--text-100)', fontFamily: 'var(--font-dm-mono)' }}
                  >
                    {pos.shares.toFixed(1)}
                  </div>

                  {/* Avg price */}
                  <div
                    className="text-xs tabular-nums"
                    style={{ color: 'var(--text-200)', fontFamily: 'var(--font-dm-mono)' }}
                  >
                    ${pos.avgPrice.toFixed(2)}
                  </div>

                  {/* Invested */}
                  <div
                    className="text-xs tabular-nums"
                    style={{ color: 'var(--text-200)', fontFamily: 'var(--font-dm-mono)' }}
                  >
                    ${pos.invested}
                  </div>

                  {/* P&L */}
                  <div
                    className="text-xs font-semibold tabular-nums"
                    style={{
                      color: pos.pnl >= 0 ? 'var(--cyan)' : 'var(--red)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                  </div>
                </Link>
              ))}
            </div>

            {/* ── Resolved ── */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="px-6 py-4 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
                  Resolved Markets
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    color: 'var(--text-300)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-dim)',
                    fontFamily: 'var(--font-dm-mono)',
                  }}
                >
                  {SUMMARY.resolvedPositions} CLOSED
                </span>
              </div>

              {RESOLVED.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 px-6 py-4 border-b"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs leading-snug truncate"
                      style={{ color: 'var(--text-200)' }}
                    >
                      {r.market}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: r.outcome === 'YES' ? 'var(--cyan)' : 'var(--red)',
                          background:
                            r.outcome === 'YES'
                              ? 'rgba(0,229,204,0.08)'
                              : 'rgba(255,61,107,0.08)',
                          fontFamily: 'var(--font-dm-mono)',
                        }}
                      >
                        {r.outcome}
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{
                          color: r.result === 'WIN' ? 'var(--gold)' : 'var(--text-300)',
                          background:
                            r.result === 'WIN'
                              ? 'rgba(240,192,64,0.08)'
                              : 'var(--bg-elevated)',
                          fontFamily: 'var(--font-dm-mono)',
                        }}
                      >
                        {r.result}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className="text-sm font-bold tabular-nums"
                      style={{
                        color: r.pnl >= 0 ? 'var(--cyan)' : 'var(--red)',
                        fontFamily: 'var(--font-dm-mono)',
                      }}
                    >
                      {r.pnl >= 0 ? '+' : ''}${r.pnl}
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
                    >
                      ${r.invested} invested
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
