// ─────────────────────────────────────────────────────────────────
// Full sign-in screen — shown when there is no active Firebase session.
// After a successful sign-in the Firebase session is persisted in
// localStorage, so staff only need this screen once per device.
// ─────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { signIn } from '@/lib/firebase';
import { useStaff, setCurrentStaffId } from '@/lib/hooks/useStore';

export function LoginForm({ onLogin }: { onLogin: () => void }) {
  const staff = useStaff();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const cred = await signIn(email.trim().toLowerCase(), password);
      // Map Firebase UID → staff record (by UID first, then by email as fallback)
      const member = staff.find(
        s => s.firebaseUid === cred.user.uid ||
             s.contact?.email?.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!member) {
        throw new Error('No staff account linked to this email. Ask your manager to set up your account in Settings → Staff.');
      }
      setCurrentStaffId(member.id);
      onLogin();
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-y-auto"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm px-5 py-8 sm:px-6 sm:py-10 flex flex-col items-center gap-5"
      >
        {/* Branding */}
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Denz" width={48} height={48} priority className="w-10 h-10 sm:w-12 sm:h-12" />
          <h1 className="text-lg sm:text-xl font-semibold">Denz POS</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        {/* Fields */}
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
