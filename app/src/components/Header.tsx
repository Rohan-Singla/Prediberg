'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const BASE_NAV = [
  { label: 'Markets', href: '/' },
  { label: 'Portfolio', href: '/portfolio' },
];

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET ?? '';

export function Header() {
  const pathname = usePathname();
  const { publicKey } = useWallet();

  const isAdmin =
    ADMIN_WALLET === '' || publicKey?.toBase58() === ADMIN_WALLET;

  const NAV = [
    ...BASE_NAV,
    ...(isAdmin ? [{ label: 'Admin', href: '/admin' }] : []),
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(6, 6, 13, 0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="relative w-5 h-5">
            <div
              className="absolute inset-0 rotate-45 rounded-sm"
              style={{
                background: 'var(--cyan)',
                boxShadow: '0 0 10px var(--cyan-glow)',
              }}
            />
          </div>
          <span
            className="text-sm font-bold tracking-widest"
            style={{ color: 'var(--text-100)', letterSpacing: '0.18em' }}
          >
            PREDIBERG
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 flex-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-4 py-1.5 text-sm font-medium rounded-md transition-all"
                style={
                  item.href === '/admin'
                    ? {
                        color: active ? 'var(--gold)' : 'rgba(240,192,64,0.5)',
                        background: active ? 'rgba(240,192,64,0.07)' : 'transparent',
                        border: '1px solid rgba(240,192,64,0.15)',
                      }
                    : {
                        color: active ? 'var(--text-100)' : 'var(--text-300)',
                        background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                      }
                }
              >
                {item.label}
                {active && item.href !== '/admin' && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-px"
                    style={{ background: 'var(--cyan)', boxShadow: '0 0 6px var(--cyan)' }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: status + wallet */}
        <div className="flex items-center gap-4 shrink-0">
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
            style={{
              fontFamily: 'var(--font-dm-mono)',
              color: 'var(--cyan)',
              background: 'var(--cyan-dim)',
              border: '1px solid rgba(0,229,204,0.15)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--cyan)', animation: 'pulse 2s infinite' }}
            />
            ORACLE LIVE
          </div>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
