'use client';

import { useState } from 'react';
import { X, Tag, Percent, DollarSign } from 'lucide-react';
import type { Discount, Tab } from '@/lib/types';
import { tabSubtotal, tabDiscountAmount } from '@/lib/domain/tabs';
import { useSettings } from '@/lib/hooks/useStore';

interface DiscountDialogProps {
  open: boolean;
  tab: Tab | null;
  onApply: (discount: Discount | null) => void;
  onClose: () => void;
}

export function DiscountDialog({ open, tab, onApply, onClose }: DiscountDialogProps) {
  const settings = useSettings();
  const [type, setType] = useState<'pct' | 'fixed'>('pct');
  const [value, setValue] = useState<string>('');

  if (!open || !tab) return null;

  // The tab-level discount applies to the effective subtotal (already net of per-item discounts).
  const subtotal = tabSubtotal(tab.items);
  const numValue = parseFloat(value) || 0;
  const previewDiscount: Discount | null = numValue > 0 ? { type, value: numValue } : null;
  const discountAmount = previewDiscount ? tabDiscountAmount(tab.items, previewDiscount) : 0;
  const newSubtotal = Math.max(0, subtotal - discountAmount);
  const cur = settings.currency;

  const handleApply = () => { onApply(previewDiscount); onClose(); setValue(''); };
  const handleRemove = () => { onApply(null); onClose(); setValue(''); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Apply discount">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              <Tag size={16} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Apply Discount</h2>
              <p className="text-xs text-muted-foreground">{tab.label}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/5 dark:bg-white/5">
          <button onClick={() => setType('pct')} className={`flex items-center justify-center gap-1.5 h-9 rounded-xl text-sm font-medium transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${type === 'pct' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Percent size={13} strokeWidth={2} /> Percent
          </button>
          <button onClick={() => setType('fixed')} className={`flex items-center justify-center gap-1.5 h-9 rounded-xl text-sm font-medium transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${type === 'fixed' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <DollarSign size={13} strokeWidth={2} /> Amount
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="discount-input" className="text-xs font-medium text-muted-foreground">{type === 'pct' ? 'Percentage off' : 'Amount off'}</label>
          <div className="relative">
            <input
              id="discount-input"
              type="number" min="0" max={type === 'pct' ? 100 : subtotal} step={type === 'pct' ? 1 : 0.01}
              value={value} onChange={e => setValue(e.target.value)}
              placeholder={type === 'pct' ? '10' : '5.00'} autoFocus
              className="w-full h-11 px-4 pr-10 text-sm rounded-2xl bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{type === 'pct' ? '%' : cur}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(type === 'pct' ? [5, 10, 15, 20] : [5, 10, 15, 20]).map(qa => (
              <button key={qa} onClick={() => setValue(String(qa))} className="h-8 rounded-lg text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {type === 'pct' ? `${qa}%` : `${cur}${qa}`}
              </button>
            ))}
          </div>
        </div>

        {previewDiscount && (
          <div className="space-y-1.5 text-sm p-3 rounded-2xl bg-black/5 dark:bg-white/5">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{cur}{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Discount</span><span className="tabular-nums">−{cur}{discountAmount.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>New Subtotal</span><span className="tabular-nums">{cur}{newSubtotal.toFixed(2)}</span></div>
          </div>
        )}

        <div className="flex gap-2">
          {tab.discount && (
            <button onClick={handleRemove} className="h-11 px-4 rounded-2xl text-sm font-medium border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Remove</button>
          )}
          <button onClick={handleApply} disabled={!previewDiscount} className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Apply Discount</button>
        </div>
      </div>
    </div>
  );
}
