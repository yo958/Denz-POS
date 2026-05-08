'use client';

import { CreditCard, Banknote, X, Check } from 'lucide-react';
import type { PaymentMethod, Tab } from '@/lib/types';
import { tabGrandTotal, tabCardFee, CARD_FEE_RATE } from '@/lib/domain/tabs';
import { useSettings } from '@/lib/hooks/useStore';

interface PaymentDialogProps {
  open: boolean;
  tab: Tab | null;
  method: PaymentMethod | null;
  cashTendered: number;
  onCashTenderedChange: (v: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function PaymentDialog({
  open, tab, method, cashTendered, onCashTenderedChange, onConfirm, onClose,
}: PaymentDialogProps) {
  const settings = useSettings();
  if (!open || !tab || !method || method === 'room') return null;

  const isCard = method === 'card';
  const baseTotal = tabGrandTotal(tab.items, tab.discount, settings.taxRate);
  const cardFee = isCard ? tabCardFee(tab.items, tab.discount, settings.taxRate) : 0;
  const total = baseTotal + cardFee;
  const change = method === 'cash' ? Math.max(0, cashTendered - total) : 0;
  const canConfirm = isCard || cashTendered >= total;
  const cur = settings.currency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Payment confirmation">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Confirm Payment</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tab.customerName} · {tab.label}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className={`flex items-center justify-center gap-2 py-3 rounded-2xl ${
          isCard ? 'bg-primary/10 text-primary' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
        }`}>
          {isCard ? <CreditCard size={18} strokeWidth={2} /> : <Banknote size={18} strokeWidth={2} />}
          <span className="font-semibold">{isCard ? 'Card' : 'Cash'} Payment</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{cur}{baseTotal.toFixed(2)}</span>
          </div>

          {isCard && (
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
              <span>Card fee ({Math.round(CARD_FEE_RATE * 100)}%)</span>
              <span className="tabular-nums">+{cur}{cardFee.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
            <span>Amount Due</span>
            <span className="tabular-nums">{cur}{total.toFixed(2)}</span>
          </div>

          {!isCard && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cash Tendered</span>
                <input
                  type="number"
                  min={total}
                  step="0.01"
                  value={cashTendered || ''}
                  onChange={e => onCashTenderedChange(parseFloat(e.target.value) || 0)}
                  placeholder={total.toFixed(2)}
                  aria-label="Cash tendered"
                  autoFocus
                  className="w-28 h-9 px-3 text-right text-sm rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                />
              </div>
              {cashTendered > 0 && (
                <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Change Due</span>
                  <span className="tabular-nums">{cur}{change.toFixed(2)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {!isCard && (
          <div className="flex gap-2">
            {[Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20, Math.ceil(total / 50) * 50].map(amt => (
              <button
                key={amt}
                onClick={() => onCashTenderedChange(amt)}
                className="flex-1 h-9 rounded-xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {cur}{amt}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="w-full h-11 rounded-2xl font-semibold text-sm bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Check size={16} strokeWidth={2.5} />
          Confirm Payment
        </button>
      </div>
    </div>
  );
}
