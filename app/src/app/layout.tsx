import type { Metadata } from 'next';
import { Syne, DM_Mono } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Prediberg — AI-Powered Prediction Markets',
  description: 'Trustless prediction markets resolved by AI oracle on Solana. No human bias, no delays.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
