'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Tab } from '@/lib/types';
import { effectiveQty, formatMoney } from '@/lib/domain/tabs';

interface VoidDialogProps {
  open: boolean;
  tab: Tab | null;
  onConfirm: (productId: string, qty: number, reason: string) => void;
  onClose: () => void;
}

export function VoidDialog({ open, tab, onConfirm, onClose }: VoidDialogProps) {
  const [productId, setProductId] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');

  if (!open || !tab) return null;

  const lines = tab.items.filter(li => effectiveQty(li) > 0);
  const selected = lines.find(li => li.productId === productId);
  const maxQty = selected ? effectiveQty(selected) : 0;

  const submit = () => {
    if (!selected || qty < 1 || qty > maxQty || reason.trim().length < 2) return;
    onConfirm(selected.productId, qty, reason.trim());
    setProductId(''); setQty(1); setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Void item">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
              <Trash2 size={16} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Void Item</h2>
              <p className="text-xs text-muted-foreground">{tab.label} · before payment</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {lines.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No items to void.</p>
          )}
          {lines.map(li => (
            <button
              key={li.productId}
              onClick={() => { setProductId(li.productId); setQty(1); }}
              className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                productId === li.productId
                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/10'
                  : 'border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8'
              }`}
            >
              <div className="text-left">
                <p className="text-sm font-medium">{li.product.name}</p>
                <p className="text-xs text-muted-foreground">{formatMoney(li.product.price)} · qty {effectiveQty(li)}</p>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Quantity to void (max {maxQty})</label>
            <input
              type="number" min={1} max={maxQty} step={1}
              value={qty} onChange={e => setQty(Math.max(1, Math.min(maxQty, parseInt(e.target.value, 10) || 1)))}
              className="w-full h-10 px-3 text-sm rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Reason</label>
          <input
            type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. wrong order, customer changed mind"
            className="w-full h-10 px-3 text-sm rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          onClick={submit}
          disabled={!selected || reason.trim().length < 2}
          className="w-full h-11 rounded-2xl font-semibold text-sm bg-rose-600 text-white hover:bg-rose-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Void Item
        </button>
      </div>
    </div>
  );
}
