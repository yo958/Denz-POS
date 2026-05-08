// ─────────────────────────────────────────────────────────────────
// PIN-based lock screen. Soft auth — protects a shared device.
// ─────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import Image from 'next/image';
import { useStaff, setCurrentStaffId } from '@/lib/hooks/useStore';
import { verifyPin } from '@/lib/domain/auth';
import type { Staff } from '@/lib/types';

const PIN_LEN = 4;

export function PinPad({ onUnlock }: { onUnlock: () => void }) {
  const staff = useStaff().filter(s => !s.archived);
  const [selected, setSelected] = useState<Staff | null>(staff[0] ?? null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep selected in sync if staff list changes.
  useEffect(() => {
    if (!selected || !staff.find(s => s.id === selected.id)) {
      setSelected(staff[0] ?? null);
    }
  }, [staff, selected]);

  // Capture physical keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setPin(p => (p + e.key).slice(0, PIN_LEN));
      } else if (e.key === 'Backspace') {
        setPin(p => p.slice(0, -1));
      } else if (e.key === 'Enter') {
        attempt();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, pin]);

  // Auto-attempt when full
  useEffect(() => {
    if (pin.length === PIN_LEN) {
      void attempt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function attempt() {
    if (!selected) return;
    if (pin.length < PIN_LEN) return;
    setBusy(true);
    const ok = await verifyPin(pin, selected.pinSalt, selected.pinHash);
    setBusy(false);
    if (ok) {
      setCurrentStaffId(selected.id);
      onUnlock();
    } else {
      setError('Wrong PIN');
      setPin('');
      inputRef.current?.focus();
    }
  }

  function tap(d: string) { setPin(p => (p + d).slice(0, PIN_LEN)); setError(null); }
  function backspace() { setPin(p => p.slice(0, -1)); setError(null); }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6 py-10 flex flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Denz" width={48} height={48} priority />
          <h1 className="text-xl font-semibold">Denz POS</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Lock size={12} strokeWidth={2} />
            Locked
          </p>
        </div>

        {/* Staff selector */}
        <div className="w-full flex flex-wrap gap-2 justify-center">
          {staff.map(s => {
            const active = selected?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { setSelected(s); setPin(''); setError(null); }}
                className={`flex items-center gap-2 h-10 px-3 rounded-2xl text-sm font-medium border transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  active
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-white/50 dark:bg-white/5 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  active ? 'bg-primary/20 text-primary' : 'bg-muted'
                }`}>{s.initials}</span>
                {s.name}
              </button>
            );
          })}
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
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              onClick={() => tap(d)}
              disabled={busy}
              className="h-16 rounded-2xl text-xl font-semibold bg-white/60 dark:bg-white/5 border border-border hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer tabular-nums disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {d}
            </button>
          ))}
          <span />
          <button
            onClick={() => tap('0')}
            disabled={busy}
            className="h-16 rounded-2xl text-xl font-semibold bg-white/60 dark:bg-white/5 border border-border hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer tabular-nums disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            0
          </button>
          <button
            onClick={backspace}
            aria-label="Backspace"
            disabled={busy || pin.length === 0}
            className="h-16 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Delete size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Hidden input keeps mobile keyboards happy if user prefers typing */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={() => { /* keyboard handler updates state */ }}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        <p className="text-xs text-muted-foreground">Default PINs: Manager 1234 · Staff 0000</p>
      </div>
    </div>
  );
}
