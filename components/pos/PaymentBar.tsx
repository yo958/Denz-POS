'use client';

import { useState } from 'react';
import { CreditCard, QrCode, Banknote, BedDouble, Tag, Printer, ChefHat, RotateCcw, SplitSquareVertical, Plus, X } from 'lucide-react';
import type { PartialPayment, PaymentMethod, Tab } from '@/lib/types';
import {
  tabDiscountAmount, tabTax, tabGrandTotal, tabRefundedAmount, tabPartialPaidAmount, lineUnitPrice, lineEffectiveUnitPrice,
  formatDate,
} from '@/lib/domain/tabs';
import { useSettings } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';

type PartialMethod = PartialPayment['method'];

interface PaymentBarProps {
  tab: Tab;
  onPay: (method: PaymentMethod) => void;
  onSplit: () => void;
  onDiscount: () => void;
  onSendKitchen: () => void;
  onPrint: () => void;
  onRefund: () => void;
  onPartialPay: (amount: number, method: PartialMethod, note?: string) => void;
  /** Hide "Charge to Room" (used inside the room folio itself). */
  hideCharge?: boolean;
  unsentItemsCount: number;
}

export function PaymentBar({
  tab, onPay, onSplit, onDiscount, onSendKitchen, onPrint, onRefund, onPartialPay, hideCharge, unsentItemsCount,
}: PaymentBarProps) {
  const settings  = useSettings();
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialMethod, setPartialMethod] = useState<PartialMethod>('cash');
  const [partialNote, setPartialNote] = useState('');
  const taxRate   = settings.taxEnabled === false ? 0 : settings.taxRate;
  // Gross subtotal (before per-item discounts) — used as the "Subtotal" display label
  const grossSubtotal = tab.items.reduce((s, li) => s + lineUnitPrice(li) * (Math.max(0, li.qty - (li.refundedQty ?? 0))), 0);
  // Per-item discount total (the difference between gross and net subtotals)
  const lineDiscountTotal = tab.items.reduce((s, li) => {
    const saving = lineUnitPrice(li) - lineEffectiveUnitPrice(li);
    return s + saving * Math.max(0, li.qty - (li.refundedQty ?? 0));
  }, 0);
  const discount       = tabDiscountAmount(tab.items, tab.discount);
  const tax            = tabTax(tab.items, tab.discount, taxRate);
  const total          = tabGrandTotal(tab.items, tab.discount, taxRate);
  const refunded       = tabRefundedAmount(tab);
  const partialPaid    = tabPartialPaidAmount(tab);
  const remaining      = Math.max(0, total - partialPaid);
  const isOpen         = tab.status === 'open';
  const hasDiscount    = discount > 0;
  const cur = settings.currency;

  function submitPartialPay() {
    const amt = parseFloat(partialAmount);
    if (!amt || amt <= 0) return;
    onPartialPay(Math.min(amt, remaining), partialMethod, partialNote.trim() || undefined);
    setPartialAmount('');
    setPartialNote('');
    setShowPartialForm(false);
  }

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{cur}{fmtCur(grossSubtotal)}</span>
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

        {hasDiscount && (
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
        <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
          <span>Total</span>
          <span className="tabular-nums">{cur}{fmtCur(total)}</span>
        </div>
        {refunded > 0 && (
          <div className="flex justify-between text-rose-600 dark:text-rose-400 text-xs">
            <span>Refunded</span>
            <span className="tabular-nums">−{cur}{fmtCur(refunded)}</span>
          </div>
        )}
        {isOpen && (tab.partialPayments ?? []).map(p => (
          <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
            <span>Paid ({p.method}{p.note ? ` · ${p.note}` : ''} · {formatDate(p.recordedAt)})</span>
            <span className="tabular-nums">−{cur}{fmtCur(p.amount)}</span>
          </div>
        ))}
        {isOpen && partialPaid > 0 && (
          <div className="flex justify-between font-semibold text-amber-600 dark:text-amber-400 pt-1 border-t border-border">
            <span>Remaining</span>
            <span className="tabular-nums">{cur}{fmtCur(remaining)}</span>
          </div>
        )}
      </div>

      {!isOpen ? (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
            <span className="text-sm font-semibold">
              {tab.status === 'refunded' ? 'Fully refunded' : `Paid via ${methodLabel(tab.paymentMethod)}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onPrint}
              className="flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Printer size={12} strokeWidth={2} /> Receipt
            </button>
            {tab.status === 'paid' && (
              <button
                onClick={onRefund}
                className="flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-700 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <RotateCcw size={12} strokeWidth={2} /> Refund
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className={`grid gap-2 ${hideCharge ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
            <button
              onClick={() => onPay('card')}
              className="flex flex-col items-center justify-center gap-1 h-16 lg:h-14 rounded-2xl bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <CreditCard size={16} strokeWidth={2} />
              Card
            </button>
            <button
              onClick={() => onPay('qr')}
              className="flex flex-col items-center justify-center gap-1 h-16 lg:h-14 rounded-2xl border border-border bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 font-medium text-xs hover:bg-violet-100 dark:hover:bg-violet-900/30 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <QrCode size={16} strokeWidth={2} />
              QR
            </button>
            <button
              onClick={() => onPay('cash')}
              className="flex flex-col items-center justify-center gap-1 h-16 lg:h-14 rounded-2xl border border-border bg-white/50 dark:bg-white/5 font-medium text-xs hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Banknote size={16} strokeWidth={2} />
              Cash
            </button>
            {!hideCharge && (
              <button
                onClick={() => onPay('room')}
                className="flex flex-col items-center justify-center gap-1 h-16 lg:h-14 rounded-2xl border border-border bg-white/50 dark:bg-white/5 font-medium text-xs hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <BedDouble size={16} strokeWidth={2} />
                Room
              </button>
            )}
          </div>

          {/* Split payment — cash + card */}
          <button
            onClick={onSplit}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-2xl border border-border bg-white/50 dark:bg-white/5 font-medium text-xs text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <SplitSquareVertical size={14} strokeWidth={2} />
            Split (Cash + Card)
          </button>

          {/* Log partial payment */}
          {!showPartialForm ? (
            <button
              onClick={() => setShowPartialForm(true)}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-2xl border border-border bg-white/50 dark:bg-white/5 font-medium text-xs text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Plus size={13} strokeWidth={2} />
              Log partial payment
            </button>
          ) : (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/15 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Partial payment</span>
                <button onClick={() => { setShowPartialForm(false); setPartialAmount(''); setPartialNote(''); }} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={13} /></button>
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={remaining}
                value={partialAmount}
                onChange={e => setPartialAmount(e.target.value)}
                placeholder={`Amount (max ${cur}${fmtCur(remaining)})`}
                className="w-full h-9 px-3 rounded-xl text-sm bg-white dark:bg-white/10 border border-border focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex gap-1.5">
                {(['cash', 'card', 'qr', 'bank'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPartialMethod(m)}
                    className={`flex-1 h-7 rounded-lg text-xs font-medium transition-colors cursor-pointer capitalize ${partialMethod === m ? 'bg-amber-500 text-white' : 'bg-white/70 dark:bg-white/10 text-muted-foreground hover:text-foreground border border-border'}`}
                  >
                    {m === 'bank' ? 'Bank' : m === 'qr' ? 'QR' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={partialNote}
                onChange={e => setPartialNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full h-9 px-3 rounded-xl text-sm bg-white dark:bg-white/10 border border-border focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={submitPartialPay}
                disabled={!partialAmount || parseFloat(partialAmount) <= 0}
                className="w-full h-9 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
              >
                Save partial payment
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onDiscount}
              className={`flex-1 h-10 rounded-xl text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                hasDiscount
                  ? 'border-emerald-400/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {hasDiscount
                ? `${tab.discount!.type === 'pct' ? tab.discount!.value + '%' : cur + tab.discount!.value} off`
                : 'Discount'}
            </button>
            <button
              onClick={onSendKitchen}
              disabled={unsentItemsCount === 0}
              className={`flex-1 h-10 rounded-xl text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring flex items-center justify-center gap-1 ${
                unsentItemsCount > 0
                  ? 'border-amber-400/50 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20'
                  : 'border-border text-muted-foreground opacity-60 cursor-not-allowed'
              }`}
              title={unsentItemsCount === 0 ? 'No new kitchen items' : `${unsentItemsCount} new item${unsentItemsCount === 1 ? '' : 's'} for kitchen`}
            >
              <ChefHat size={11} strokeWidth={2} />
              Kitchen{unsentItemsCount > 0 ? ` (${unsentItemsCount})` : ''}
            </button>
            <button
              onClick={onPrint}
              className="flex-1 h-10 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring flex items-center justify-center gap-1"
            >
              <Printer size={11} strokeWidth={2} />
              Print
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function methodLabel(m?: PaymentMethod): string {
  switch (m) {
    case 'card':  return 'Card';
    case 'qr':    return 'QR';
    case 'cash':  return 'Cash';
    case 'room':  return 'Room charge';
    case 'split': return 'Split (Cash + Card)';
    default:      return '—';
  }
}
