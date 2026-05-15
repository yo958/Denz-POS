'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { signIn, auth } from '@/lib/firebase';
import { useStaff, setCurrentStaffId } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { hashPin, newSalt } from '@/lib/domain/auth';
import { newId } from '@/lib/domain/id';
import type { Staff } from '@/lib/types';

export function LoginForm({ onLogin }: { onLogin: () => void }) {
  const staff = useStaff();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  // Bootstrap setup state — shown after Firebase auth when no staff record exists
  const [setupUid, setSetupUid]   = useState<string | null>(null);
  const [setupEmail, setSetupEmail] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupPin, setSetupPin]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const cred = await signIn(email.trim().toLowerCase(), password);
      const member = staff.find(
        s => s.firebaseUid === cred.user.uid ||
             s.contact?.email?.toLowerCase() === email.trim().toLowerCase(),
      );
      if (member) {
        setCurrentStaffId(member.id);
        onLogin();
      } else {
        // No matching staff record — enter first-time setup
        setSetupUid(cred.user.uid);
        setSetupEmail(email.trim().toLowerCase());
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('invalid-credential') || raw.includes('wrong-password') || raw.includes('user-not-found')) {
        setError('Incorrect email or password.');
      } else if (raw.includes('too-many-requests')) {
        setError('Too many attempts. Try again later or reset your password.');
      } else {
        setError(raw.replace('Firebase: ', '').split(' (auth/')[0]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupName.trim())        { setError('Name required'); return; }
    if (!/^\d{4}$/.test(setupPin)) { setError('PIN must be exactly 4 digits'); return; }
    setBusy(true);
    setError(null);
    try {
      const salt     = newSalt();
      const hash     = await hashPin(setupPin, salt);
      const name     = setupName.trim();
      const initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
      const newStaff: Staff = {
        id: newId('staff'),
        name,
        role: 'manager',
        initials,
        pinHash: hash,
        pinSalt: salt,
        contact: { email: setupEmail },
        firebaseUid: setupUid!,
      };
      getStore().staff.set(prev => [...prev, newStaff]);
      setCurrentStaffId(newStaff.id);
      onLogin();
    } catch {
      setError('Failed to create account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const wrapperCls = "fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-y-auto";
  const wrapperStyle = {
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
  };

  // ── First-time setup screen ──────────────────────────────
  if (setupUid) {
    return (
      <div className={wrapperCls} style={wrapperStyle}>
        <form
          onSubmit={handleSetup}
          className="w-full max-w-sm px-5 py-8 sm:px-6 sm:py-10 flex flex-col items-center gap-5"
        >
          <div className="flex flex-col items-center gap-2">
            <Image src="/logo.png" alt="Denz" width={48} height={48} priority className="w-10 h-10 sm:w-12 sm:h-12" />
            <h1 className="text-lg sm:text-xl font-semibold">Set up your account</h1>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Enter your name and choose a PIN for the idle lock screen.
            </p>
          </div>

          <div className="w-full space-y-3">
            <input
              type="text"
              value={setupName}
              onChange={e => { setSetupName(e.target.value); setError(null); }}
              placeholder="Your full name"
              autoFocus
              required
              className="w-full h-12 px-4 rounded-2xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={setupPin}
              onChange={e => { setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(null); }}
              placeholder="4-digit PIN"
              autoComplete="new-password"
              required
              className="w-full h-12 px-4 rounded-2xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground tracking-widest"
            />
          </div>

          {error && (
            <p className="w-full text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !setupName.trim() || setupPin.length < 4}
            className="w-full h-12 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Get started
          </button>
        </form>
      </div>
    );
  }

  // ── Normal sign-in screen ────────────────────────────────
  return (
    <div className={wrapperCls} style={wrapperStyle}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm px-5 py-8 sm:px-6 sm:py-10 flex flex-col items-center gap-5"
      >
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Denz" width={48} height={48} priority className="w-10 h-10 sm:w-12 sm:h-12" />
          <h1 className="text-lg sm:text-xl font-semibold">Denz POS</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <div className="w-full space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
            placeholder="Email address"
            autoComplete="email"
            required
            className="w-full h-12 px-4 rounded-2xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              placeholder="Password"
              autoComplete="current-password"
              required
              className="w-full h-12 px-4 pr-11 rounded-2xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="w-full text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="w-full h-12 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Sign in
        </button>
      </form>
    </div>
  );
}
