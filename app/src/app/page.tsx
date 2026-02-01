'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Home() {
  const { connected } = useWallet();

  return (
    <main className="min-h-screen p-8">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold">Prediberg</h1>
        <WalletMultiButton />
      </header>

      <div className="max-w-4xl mx-auto">
        {connected ? (
          <div className="space-y-8">
            <section className="p-6 border rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Active Markets</h2>
              <p className="text-gray-500">No markets yet. Create one to get started.</p>
            </section>
          </div>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold mb-4">
              Welcome to Prediberg
            </h2>
            <p className="text-gray-500 mb-8">
              Connect your wallet to start predicting outcomes
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
