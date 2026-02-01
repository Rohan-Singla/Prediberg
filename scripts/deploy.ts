#!/usr/bin/env tsx
/**
 * Deploy script for Prediberg program
 *
 * Usage:
 *   pnpm tsx scripts/deploy.ts [cluster]
 *
 * Clusters: localnet, devnet, mainnet
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const cluster = process.argv[2] || 'devnet';

console.log(`Deploying to ${cluster}...`);

// Validate cluster
if (!['localnet', 'devnet', 'mainnet'].includes(cluster)) {
  console.error('Invalid cluster. Use: localnet, devnet, or mainnet');
  process.exit(1);
}

// Build the program
console.log('Building program...');
execSync('anchor build', { stdio: 'inherit' });

// Get program ID
const keypairPath = resolve(__dirname, '../target/deploy/prediberg-keypair.json');
try {
  const keypair = JSON.parse(readFileSync(keypairPath, 'utf-8'));
  console.log(`Program keypair loaded from ${keypairPath}`);
} catch {
  console.log('No existing keypair found, will generate new one');
}

// Deploy
console.log(`Deploying to ${cluster}...`);
execSync(`anchor deploy --provider.cluster ${cluster}`, { stdio: 'inherit' });

// Get deployed program ID
const programId = execSync('anchor keys list', { encoding: 'utf-8' })
  .split('\n')
  .find(line => line.includes('prediberg'))
  ?.split(':')[1]
  ?.trim();

console.log(`\nDeployed program ID: ${programId}`);
console.log('\nNext steps:');
console.log('1. Update NEXT_PUBLIC_PROGRAM_ID in app/.env');
console.log('2. Update program IDs in Anchor.toml');
console.log('3. Initialize the protocol with your oracle and treasury addresses');
