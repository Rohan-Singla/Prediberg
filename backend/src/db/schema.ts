import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

export const markets = pgTable('markets', {
  id: serial('id').primaryKey(),
  onChainId: bigint('on_chain_id', { mode: 'number' }),
  pubkey: varchar('pubkey', { length: 44 }).notNull().unique(),
  creator: varchar('creator', { length: 44 }).notNull(),
  question: varchar('question', { length: 256 }).notNull(),
  description: text('description'),
  outcomes: jsonb('outcomes').$type<string[]>().notNull(),
  outcomeTotals: jsonb('outcome_totals').$type<string[]>().default([]),
  endTime: timestamp('end_time').notNull(),
  resolutionTime: timestamp('resolution_time'),
  winningOutcome: integer('winning_outcome'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  totalLiquidity: bigint('total_liquidity', { mode: 'number' }).default(0),
  collateralMint: varchar('collateral_mint', { length: 44 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  pubkey: varchar('pubkey', { length: 44 }).notNull().unique(),
  marketId: integer('market_id')
    .references(() => markets.id)
    .notNull(),
  owner: varchar('owner', { length: 44 }).notNull(),
  outcome: integer('outcome').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  claimed: boolean('claimed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const resolutions = pgTable('resolutions', {
  id: serial('id').primaryKey(),
  marketId: integer('market_id')
    .references(() => markets.id)
    .notNull(),
  winningOutcome: integer('winning_outcome').notNull(),
  proof: jsonb('proof').$type<{
    sources: string[];
    reasoning: string;
    confidence: number;
  }>(),
  resolvedBy: varchar('resolved_by', { length: 44 }).notNull(),
  resolvedAt: timestamp('resolved_at').defaultNow().notNull(),
});
