// ─────────────────────────────────────────────────────────────────
// PIN idle-lock screen. Shown when the device has been idle and the
// Firebase session is still valid — the user just needs to re-enter
// their PIN to confirm it's still them.
// ─────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import Image from 'next/image';
import { setCurrentStaffId } from '@/lib/hooks/useStore';
import { verifyPin } from '@/lib/domain/auth';
import type { Staff } from '@/lib/types';

const PIN_LEN = 4;

export function PinPad({ staff, onUnlock }: { staff: Staff; onUnlock: () => void }) {
  const [pin, setPin]     = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const inputRef          = useRef<HTMLInputElement>(null);

  // Capture physical keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setPin(p => (p + e.key).slice(0, PIN_LEN));
      } else if (e.key === 'Backspace') {
        setPin(p => p.slice(0, -1));
      } else if (e.key === 'Enter') {
        void attempt();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // Auto-attempt when full
  useEffect(() => {
    if (pin.length === PIN_LEN) void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function attempt() {
    if (pin.length < PIN_LEN) return;
    setBusy(true);
    const ok = await verifyPin(pin, staff.pinSalt, staff.pinHash);
    setBusy(false);
    if (ok) {
      setCurrentStaffId(staff.id);
      onUnlock();
    } else {
      setError('Wrong PIN');
      setPin('');
      inputRef.current?.focus();
    }
  }

  function tap(d: string) { setPin(p => (p + d).slice(0, PIN_LEN)); setError(null); }
  function backspace()    { setPin(p => p.slice(0, -1)); setError(null); }

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
      <div className="w-full max-w-sm px-5 py-6 sm:px-6 sm:py-10 flex flex-col items-center gap-5 sm:gap-7">
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <Image src="/logo.png" alt="Denz" width={48} height={48} priority className="w-10 h-10 sm:w-12 sm:h-12" />
          <h1 className="text-lg sm:text-xl font-semibold">Denz POS</h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
            <Lock size={12} strokeWidth={2} />
            Locked
          </p>
        </div>

        {/* Current user */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl border border-border bg-black/3 dark:bg-white/3">
          <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
            {staff.initials}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-medium">{staff.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
          </div>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3 h-3">
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i < pin.length ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400 -mt-2">{error}</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[320px]">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              onClick={() => tap(d)}
              disabled={busy}
              className="h-14 sm:h-16 rounded-2xl text-xl font-semibold bg-white/60 dark:bg-white/5 border border-border hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer tabular-nums touch-manipulation select-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {d}
            </button>
          ))}
          <span />
          <button
            onClick={() => tap('0')}
            disabled={busy}
            className="h-14 sm:h-16 rounded-2xl text-xl font-semibold bg-white/60 dark:bg-white/5 border border-border hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer tabular-nums touch-manipulation select-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            0
          </button>
          <button
            onClick={backspace}
            aria-label="Backspace"
            disabled={busy || pin.length === 0}
            className="h-14 sm:h-16 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer touch-manipulation select-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Delete size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Hidden input for mobile keyboard */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={() => {}}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
