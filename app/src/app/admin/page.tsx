'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Header } from '@/components/Header';

// ─── Types ───────────────────────────────────────────────────────────────────

type FormState = {
  question: string;
  description: string;
  outcomes: string[];
  endDate: string;
  endTime: string;
  collateralMint: string;
};

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

// ─── Constants ───────────────────────────────────────────────────────────────

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET ?? '';

// Devnet USDC mint (Circle)
const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

const CATEGORY_SUGGESTIONS = ['Crypto', 'Finance', 'Politics', 'Tech', 'Sports', 'Science'];

const EMPTY_FORM: FormState = {
  question: '',
  description: '',
  outcomes: ['YES', 'NO'],
  endDate: '',
  endTime: '12:00',
  collateralMint: DEVNET_USDC,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div
        className="w-14 h-14 rounded-xl mb-6 flex items-center justify-center"
        style={{ background: 'rgba(255,61,107,0.08)', border: '1px solid rgba(255,61,107,0.2)' }}
      >
        <span className="text-xl">⊘</span>
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-100)' }}>
        Access Denied
      </h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-300)' }}>
        This wallet is not authorised to access the admin dashboard. Connect the protocol
        authority wallet to continue.
      </p>
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div
        className="w-14 h-14 rounded-xl mb-6 flex items-center justify-center"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)' }}
      >
        <div
          className="w-6 h-6 rotate-45 rounded-sm"
          style={{ background: 'var(--cyan)', opacity: 0.6 }}
        />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-100)' }}>
        Admin Access
      </h2>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--text-300)' }}>
        Connect the protocol authority wallet to access the admin dashboard.
      </p>
      <WalletMultiButton />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { connected, publicKey } = useWallet();

  const isAdmin =
    connected &&
    ADMIN_WALLET !== '' &&
    publicKey?.toBase58() === ADMIN_WALLET;

  const isDevMode = connected && ADMIN_WALLET === '';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-void)' }}>
      <Header />

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-20">
        {/* Page title — always visible */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-100)' }}>
              Admin
            </h1>
            {(isAdmin || isDevMode) && (
              <span
                className="text-xs px-2 py-0.5 rounded font-semibold"
                style={{
                  color: isDevMode ? 'var(--gold)' : 'var(--cyan)',
                  background: isDevMode ? 'rgba(240,192,64,0.08)' : 'var(--cyan-dim)',
                  border: `1px solid ${isDevMode ? 'rgba(240,192,64,0.2)' : 'rgba(0,229,204,0.18)'}`,
                  fontFamily: 'var(--font-dm-mono)',
                }}
              >
                {isDevMode ? 'DEV MODE' : 'AUTHORISED'}
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: 'var(--text-300)' }}>
            Protocol management — create and manage prediction markets.
          </p>
        </div>

        {/* Dev mode warning */}
        {isDevMode && (
          <div
            className="rounded-lg px-4 py-3 mb-8 flex items-start gap-3"
            style={{
              background: 'rgba(240,192,64,0.05)',
              border: '1px solid rgba(240,192,64,0.2)',
            }}
          >
            <span style={{ color: 'var(--gold)' }}>⚠</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--gold)', opacity: 0.8 }}>
              <strong>NEXT_PUBLIC_ADMIN_WALLET</strong> is not set. All connected wallets can
              access admin in dev mode. Set it in <code>.env.local</code> before deploying.
            </p>
          </div>
        )}

        {/* Auth gates */}
        {!connected && <ConnectPrompt />}
        {connected && !isAdmin && !isDevMode && <AccessDenied />}

        {/* Dashboard */}
        {(isAdmin || isDevMode) && <CreateMarketForm />}
      </main>
    </div>
  );
}

// ─── Create Market Form ───────────────────────────────────────────────────────

function CreateMarketForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastCreated, setLastCreated] = useState<FormState | null>(null);

  // ── Outcome helpers ──
  const addOutcome = () => {
    if (form.outcomes.length >= 10) return;
    setForm((f) => ({ ...f, outcomes: [...f.outcomes, ''] }));
  };

  const removeOutcome = (i: number) => {
    if (form.outcomes.length <= 2) return;
    setForm((f) => ({ ...f, outcomes: f.outcomes.filter((_, idx) => idx !== i) }));
  };

  const updateOutcome = (i: number, val: string) => {
    setForm((f) => {
      const next = [...f.outcomes];
      next[i] = val;
      return { ...f, outcomes: next };
    });
  };

  // ── Validation ──
  const validate = (): string | null => {
    if (!form.question.trim()) return 'Question is required.';
    if (form.question.length > 256) return 'Question must be 256 chars or fewer.';
    if (!form.description.trim()) return 'Description is required.';
    if (form.description.length > 1024) return 'Description must be 1024 chars or fewer.';
    if (form.outcomes.length < 2) return 'At least 2 outcomes required.';
    if (form.outcomes.some((o) => !o.trim())) return 'All outcomes must have a label.';
    if (!form.endDate) return 'End date is required.';
    const endTs = new Date(`${form.endDate}T${form.endTime}`).getTime();
    if (endTs <= Date.now() + 60 * 60 * 1000)
      return 'End time must be at least 1 hour from now.';
    if (!form.collateralMint.trim()) return 'Collateral mint is required.';
    return null;
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setErrorMsg(err);
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');

    try {
      // TODO: replace with actual SDK call once IDL is generated via `anchor build`
      // const endTimestamp = Math.floor(new Date(`${form.endDate}T${form.endTime}`).getTime() / 1000);
      // const tx = await program.methods
      //   .createMarket({ question: form.question, description: form.description,
      //     outcomes: form.outcomes, endTime: new BN(endTimestamp) })
      //   .accounts({ ... })
      //   .rpc();

      // Simulate network delay for now
      await new Promise((r) => setTimeout(r, 1200));

      setLastCreated(form);
      setForm(EMPTY_FORM);
      setStatus('success');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Transaction failed. Check console for details.');
      setStatus('error');
    }
  };

  const resetStatus = () => {
    setStatus('idle');
    setErrorMsg('');
  };

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {status === 'success' && lastCreated && (
        <div
          className="rounded-xl p-5 flex items-start justify-between gap-4"
          style={{
            background: 'rgba(0,229,204,0.05)',
            border: '1px solid rgba(0,229,204,0.2)',
          }}
        >
          <div>
            <div
              className="text-xs font-semibold mb-1"
              style={{ color: 'var(--cyan)', fontFamily: 'var(--font-dm-mono)' }}
            >
              MARKET QUEUED
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>
              "{lastCreated.question}"
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-300)' }}>
              Transaction will execute once IDL is populated via{' '}
              <code
                className="px-1 py-0.5 rounded"
                style={{ background: 'var(--bg-elevated)', fontFamily: 'var(--font-dm-mono)' }}
              >
                anchor build
              </code>
            </p>
          </div>
          <button
            onClick={resetStatus}
            className="text-xs shrink-0 transition-colors"
            style={{ color: 'var(--text-300)' }}
          >
            ✕ dismiss
          </button>
        </div>
      )}

      {/* Form card */}
      <div
        className="rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Card header */}
        <div
          className="px-6 py-4 border-b flex items-center gap-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: 'var(--cyan-dim)',
              border: '1px solid rgba(0,229,204,0.2)',
              color: 'var(--cyan)',
              fontFamily: 'var(--font-dm-mono)',
            }}
          >
            +
          </div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
            Create New Market
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Question */}
          <Field
            label="MARKET QUESTION"
            hint={`${form.question.length}/256`}
            hintWarning={form.question.length > 230}
          >
            <input
              type="text"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="e.g. Will Bitcoin exceed $200,000 before December 2026?"
              maxLength={256}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </Field>

          {/* Description */}
          <Field
            label="DESCRIPTION"
            hint={`${form.description.length}/1024`}
            hintWarning={form.description.length > 950}
          >
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the market, the conditions, and any relevant context..."
              maxLength={1024}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </Field>

          {/* Outcomes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-xs font-semibold"
                style={{
                  color: 'var(--text-300)',
                  fontFamily: 'var(--font-dm-mono)',
                  letterSpacing: '0.06em',
                }}
              >
                OUTCOMES
                <span className="ml-2 font-normal" style={{ color: 'var(--text-400)' }}>
                  ({form.outcomes.length}/10)
                </span>
              </label>
              {form.outcomes.length < 10 && (
                <button
                  type="button"
                  onClick={addOutcome}
                  className="text-xs transition-colors flex items-center gap-1"
                  style={{ color: 'var(--cyan)' }}
                >
                  + Add outcome
                </button>
              )}
            </div>

            <div className="space-y-2">
              {form.outcomes.map((outcome, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-xs shrink-0"
                    style={{
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-300)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    {i}
                  </div>
                  <input
                    type="text"
                    value={outcome}
                    onChange={(e) => updateOutcome(i, e.target.value)}
                    placeholder={`Outcome ${i}`}
                    maxLength={64}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                  {form.outcomes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOutcome(i)}
                      className="w-7 h-7 rounded flex items-center justify-center text-xs transition-all shrink-0"
                      style={{
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-300)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Quick suggestions */}
            <div className="flex items-center gap-2 mt-3">
              <span
                className="text-xs"
                style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
              >
                CATEGORY HINT:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_SUGGESTIONS.map((cat) => (
                  <span
                    key={cat}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      color: 'var(--text-300)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* End date + time */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="END DATE">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                min={new Date(Date.now() + 3600_000).toISOString().split('T')[0]}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ ...inputStyle, colorScheme: 'dark' }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>
            <Field label="END TIME (UTC)">
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ ...inputStyle, colorScheme: 'dark' }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>
          </div>

          {/* Collateral mint */}
          <Field
            label="COLLATERAL MINT"
            hint="SPL token address (USDC recommended)"
          >
            <div className="relative">
              <input
                type="text"
                value={form.collateralMint}
                onChange={(e) => setForm((f) => ({ ...f, collateralMint: e.target.value }))}
                placeholder="Token mint public key"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none pr-24"
                style={{ ...inputStyle, fontFamily: 'var(--font-dm-mono)' }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
              {form.collateralMint !== DEVNET_USDC && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, collateralMint: DEVNET_USDC }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs transition-colors"
                  style={{ color: 'var(--cyan)' }}
                >
                  Use USDC
                </button>
              )}
            </div>
          </Field>

          {/* Preview */}
          {form.question && (
            <div
              className="rounded-lg p-4"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-dim)',
              }}
            >
              <div
                className="text-xs font-semibold mb-2"
                style={{ color: 'var(--text-300)', fontFamily: 'var(--font-dm-mono)' }}
              >
                PREVIEW
              </div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-100)' }}>
                {form.question}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {form.outcomes
                  .filter((o) => o.trim())
                  .map((o, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        color: i === 0 ? 'var(--cyan)' : i === 1 ? 'var(--red)' : 'var(--text-200)',
                        background:
                          i === 0
                            ? 'rgba(0,229,204,0.08)'
                            : i === 1
                            ? 'rgba(255,61,107,0.08)'
                            : 'var(--bg-card)',
                        border: '1px solid var(--border-dim)',
                        fontFamily: 'var(--font-dm-mono)',
                      }}
                    >
                      {o}
                    </span>
                  ))}
                {form.endDate && (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      color: 'var(--text-300)',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-dim)',
                      fontFamily: 'var(--font-dm-mono)',
                    }}
                  >
                    Closes {form.endDate} {form.endTime} UTC
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && errorMsg && (
            <div
              className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
              style={{
                background: 'rgba(255,61,107,0.06)',
                border: '1px solid rgba(255,61,107,0.2)',
                color: 'var(--red)',
              }}
            >
              <span>✕</span>
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="px-6 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background:
                  status === 'submitting'
                    ? 'var(--bg-elevated)'
                    : 'linear-gradient(135deg, rgba(0,229,204,0.28), rgba(0,229,204,0.14))',
                border:
                  status === 'submitting'
                    ? '1px solid var(--border-dim)'
                    : '1px solid rgba(0,229,204,0.4)',
                color: status === 'submitting' ? 'var(--text-300)' : 'var(--cyan)',
                cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                boxShadow:
                  status !== 'submitting' ? '0 0 20px rgba(0,229,204,0.1)' : 'none',
              }}
            >
              {status === 'submitting' ? 'Creating...' : 'Create Market'}
            </button>

            <button
              type="button"
              onClick={() => { setForm(EMPTY_FORM); resetStatus(); }}
              className="text-sm transition-colors"
              style={{ color: 'var(--text-300)' }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  hintWarning = false,
  children,
}: {
  label: string;
  hint?: string;
  hintWarning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label
          className="text-xs font-semibold"
          style={{
            color: 'var(--text-300)',
            fontFamily: 'var(--font-dm-mono)',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </label>
        {hint && (
          <span
            className="text-xs"
            style={{
              color: hintWarning ? 'var(--gold)' : 'var(--text-400)',
              fontFamily: 'var(--font-dm-mono)',
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-dim)',
  color: 'var(--text-100)',
  transition: 'border-color 0.18s ease',
};

const focusStyle = (e: React.FocusEvent<HTMLElement>) => {
  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,204,0.35)';
};

const blurStyle = (e: React.FocusEvent<HTMLElement>) => {
  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)';
};
