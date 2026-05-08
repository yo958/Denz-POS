// ─────────────────────────────────────────────────────────────────
// Imperative confirm dialog. Optionally requires a manager PIN.
// Usage:  const ok = await confirm({ title, message, danger: true });
// ─────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { verifyPin } from '@/lib/domain/auth';
import { getStore } from '@/lib/store/store';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** If true, requires a manager PIN to proceed. */
  requireManagerPin?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const listeners = new Set<(r: ConfirmRequest | null) => void>();
let current: ConfirmRequest | null = null;

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    current = { ...opts, resolve };
    listeners.forEach(l => l(current));
  });
}

function close(ok: boolean) {
  if (!current) return;
  current.resolve(ok);
  current = null;
  listeners.forEach(l => l(null));
}

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(current);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listeners.add(setReq);
    return () => { listeners.delete(setReq); };
  }, []);

  useEffect(() => {
    setPin('');
    setPinError(null);
    setBusy(false);
  }, [req]);

  if (!req) return null;

  async function onConfirm() {
    if (!req) return;
    if (req.requireManagerPin) {
      setBusy(true);
      const managers = getStore().staff.get().filter(s => s.role === 'manager' && !s.archived);
      let ok = false;
      for (const m of managers) {
        if (await verifyPin(pin, m.pinSalt, m.pinHash)) { ok = true; break; }
      }
      setBusy(false);
      if (!ok) { setPinError('Manager PIN incorrect'); return; }
    }
    close(true);
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={req.title}
    >
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
        onClick={() => close(false)}
      />
      <div className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          {req.danger && (
            <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle size={18} strokeWidth={2} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold">{req.title}</h2>
            {req.message && <p className="text-sm text-muted-foreground mt-1">{req.message}</p>}
          </div>
          <button
            onClick={() => close(false)}
            aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {req.requireManagerPin && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Manager PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') onConfirm(); }}
              className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums tracking-widest"
            />
            {pinError && <p className="text-xs text-rose-600 dark:text-rose-400">{pinError}</p>}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => close(false)}
            className="flex-1 h-10 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {req.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 h-10 rounded-2xl text-sm font-semibold active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 ${
              req.danger
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            {req.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
