'use client';

import { CreditCard, QrCode, Banknote, X, Check, Tag } from 'lucide-react';
import type { PaymentMethod, Tab } from '@/lib/types';
import {
  tabDiscountAmount, tabTax, tabGrandTotal, tabCardFee, CARD_FEE_RATE,
  lineUnitPrice, lineEffectiveUnitPrice,
} from '@/lib/domain/tabs';
import { useSettings } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';

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

  const taxRate   = settings.taxEnabled === false ? 0 : settings.taxRate;
  const isCard    = method === 'card';
  const isQR      = method === 'qr';
  const isCash    = method === 'cash';

  const subtotal  = tab.items.reduce((s, li) => s + lineUnitPrice(li) * Math.max(0, li.qty - (li.refundedQty ?? 0)), 0);
  const lineDiscountTotal = tab.items.reduce((s, li) => {
    const saving = lineUnitPrice(li) - lineEffectiveUnitPrice(li);
    return s + saving * Math.max(0, li.qty - (li.refundedQty ?? 0));
  }, 0);
  const discount  = tabDiscountAmount(tab.items, tab.discount);
  const tax       = tabTax(tab.items, tab.discount, taxRate);
  const baseTotal = tabGrandTotal(tab.items, tab.discount, taxRate);
  const cardFee   = isCard ? tabCardFee(tab.items, tab.discount, taxRate) : 0;
  const total     = baseTotal + cardFee;
  const change    = isCash ? Math.max(0, cashTendered - total) : 0;
  const canConfirm = !isCash || cashTendered >= total;
  const cur = settings.currency;

  const methodIcon = isCard ? <CreditCard size={18} strokeWidth={2} /> : isQR ? <QrCode size={18} strokeWidth={2} /> : <Banknote size={18} strokeWidth={2} />;
  const methodLabel = isCard ? 'Card' : isQR ? 'QR' : 'Cash';
  const methodColors = isCard
    ? 'bg-primary/10 text-primary'
    : isQR
    ? 'bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400'
    : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Payment confirmation">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-background rounded-3xl p-6 shadow-2xl space-y-5 border border-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Confirm Payment</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tab.customerName} · {tab.label}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className={`flex items-center justify-center gap-2 py-3 rounded-2xl ${methodColors}`}>
          {methodIcon}
          <span className="font-semibold">{methodLabel} Payment</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{cur}{fmtCur(subtotal)}</span>
          </div>

          {lineDiscountTotal > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <Tag size={11} strokeWidth={2} />
                Item discounts
              </span>
              <span className="tabular-nums">−{cur}{fmtCur(lineDiscountTotal)}</span>
            </div>
          )}

          {discount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <Tag size={11} strokeWidth={2} />
                {tab.discount!.type === 'pct' ? `Discount (${tab.discount!.value}%)` : 'Discount'}
              </span>
              <span className="tabular-nums">−{cur}{fmtCur(discount)}</span>
            </div>
          )}

          {settings.taxEnabled !== false && (
            <div className="flex justify-between text-muted-foreground">
              <span>{settings.taxLabel} ({Math.round(settings.taxRate * 100)}%)</span>
              <span className="tabular-nums">{cur}{fmtCur(tax)}</span>
            </div>
          )}

          {isCard && (
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
              <span>Card fee ({Math.round(CARD_FEE_RATE * 100)}%)</span>
              <span className="tabular-nums">+{cur}{fmtCur(cardFee)}</span>
            </div>
          )}

          <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
            <span>Amount Due</span>
            <span className="tabular-nums">{cur}{fmtCur(total)}</span>
          </div>

          {isCash && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cash Tendered</span>
                <input
                  type="number"
                  min={total}
                  step="0.01"
                  value={cashTendered || ''}
                  onChange={e => onCashTenderedChange(parseFloat(e.target.value) || 0)}
                  placeholder={fmtCur(total)}
                  aria-label="Cash tendered"
                  autoFocus
                  className="w-28 h-9 px-3 text-right text-sm rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                />
              </div>
              {cashTendered > 0 && (
                <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Change Due</span>
                  <span className="tabular-nums">{cur}{fmtCur(change)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {isCash && (
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
