'use client';

import { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import type { Tab } from '@/lib/types';
import { effectiveQty, formatMoney, lineKey, lineUnitPrice, modifiersSummary, tabGrandTotal, tabSubtotal } from '@/lib/domain/tabs';

interface RefundDialogProps {
  open: boolean;
  tab: Tab | null;
  onClose: () => void;
  onConfirm: (lines: { lineKey: string; qty: number }[], reason: string) => void;
}

export function RefundDialog({ open, tab, onClose, onConfirm }: RefundDialogProps) {
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open && tab) {
      setQtys(Object.fromEntries(tab.items.map(li => [lineKey(li), effectiveQty(li)])));
      setReason('');
    }
  }, [open, tab]);

  if (!open || !tab) return null;

  const lines = tab.items
    .map(li => ({ li, qty: qtys[lineKey(li)] ?? 0 }))
    .filter(x => x.qty > 0);

  const ratio = (() => {
    const remaining = lines.reduce((s, x) => s + x.qty * lineUnitPrice(x.li), 0);
    const sub = tabSubtotal(tab.items);
    return sub > 0 ? remaining / sub : 0;
  })();
  const refundAmount = tabGrandTotal(tab.items, tab.discount) * ratio;

  const canConfirm = lines.length > 0 && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Refund">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RotateCcw size={16} strokeWidth={2} className="text-rose-600 dark:text-rose-400" />
              Refund
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tab.customerName} · {tab.label}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
          {tab.items.map(li => {
            const max = effectiveQty(li);
            if (max === 0) return null;
            const k = lineKey(li);
            const cur = qtys[k] ?? 0;
            const mods = modifiersSummary(li.modifiers);
            return (
              <div key={k} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white/50 dark:bg-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{li.product.name}</p>
                  {mods && <p className="text-[11px] text-muted-foreground/80 truncate">{mods}</p>}
                  <p className="text-xs text-muted-foreground">{formatMoney(lineUnitPrice(li))} × {max} purchased</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQtys(q => ({ ...q, [k]: Math.max(0, (q[k] ?? 0) - 1) }))}
                    aria-label="Decrease"
                    className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >−</button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{cur}</span>
                  <button
                    onClick={() => setQtys(q => ({ ...q, [k]: Math.min(max, (q[k] ?? 0) + 1) }))}
                    aria-label="Increase"
                    className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >+</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reason (required)</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Customer dissatisfied, wrong order…"
            className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">Refund amount</span>
          <span className="font-bold text-base text-rose-600 dark:text-rose-400 tabular-nums">{formatMoney(refundAmount)}</span>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm(lines.map(x => ({ lineKey: lineKey(x.li), qty: x.qty })), reason.trim())}
            className="flex-1 h-10 rounded-2xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Refund
          </button>
        </div>
      </div>
    </div>
  );
}
