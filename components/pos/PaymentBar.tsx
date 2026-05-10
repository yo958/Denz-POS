'use client';

import { CreditCard, QrCode, Banknote, BedDouble, Tag, Printer, ChefHat, RotateCcw } from 'lucide-react';
import type { PaymentMethod, Tab } from '@/lib/types';
import {
  tabSubtotal, tabDiscountAmount, tabTax, tabGrandTotal, tabRefundedAmount,
} from '@/lib/domain/tabs';
import { useSettings } from '@/lib/hooks/useStore';

interface PaymentBarProps {
  tab: Tab;
  onPay: (method: PaymentMethod) => void;
  onDiscount: () => void;
  onSendKitchen: () => void;
  onPrint: () => void;
  onRefund: () => void;
  /** Hide "Charge to Room" (used inside the room folio itself). */
  hideCharge?: boolean;
  unsentItemsCount: number;
}

export function PaymentBar({
  tab, onPay, onDiscount, onSendKitchen, onPrint, onRefund, hideCharge, unsentItemsCount,
}: PaymentBarProps) {
  const settings  = useSettings();
  const taxRate   = settings.taxEnabled === false ? 0 : settings.taxRate;
  const subtotal  = tabSubtotal(tab.items);
  const discount  = tabDiscountAmount(tab.items, tab.discount);
  const tax       = tabTax(tab.items, tab.discount, taxRate);
  const total     = tabGrandTotal(tab.items, tab.discount, taxRate);
  const refunded  = tabRefundedAmount(tab);
  const isOpen    = tab.status === 'open';
  const hasDiscount = discount > 0;
  const cur = settings.currency;

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{cur}{subtotal.toFixed(2)}</span>
        </div>

        {hasDiscount && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1">
              <Tag size={11} strokeWidth={2} />
              {tab.discount!.type === 'pct' ? `Discount (${tab.discount!.value}%)` : 'Discount'}
            </span>
            <span className="tabular-nums">−{cur}{discount.toFixed(2)}</span>
          </div>
        )}

        {settings.taxEnabled !== false && (
          <div className="flex justify-between text-muted-foreground">
            <span>{settings.taxLabel} ({Math.round(settings.taxRate * 100)}%)</span>
            <span className="tabular-nums">{cur}{tax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
          <span>Total</span>
          <span className="tabular-nums">{cur}{total.toFixed(2)}</span>
        </div>
        {refunded > 0 && (
          <div className="flex justify-between text-rose-600 dark:text-rose-400 text-xs">
            <span>Refunded</span>
            <span className="tabular-nums">−{cur}{refunded.toFixed(2)}</span>
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
          <div className={`grid gap-2 ${hideCharge ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <button
              onClick={() => onPay('card')}
              className="flex flex-col items-center justify-center gap-1 h-14 rounded-2xl bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <CreditCard size={16} strokeWidth={2} />
              Card
            </button>
            <button
              onClick={() => onPay('qr')}
              className="flex flex-col items-center justify-center gap-1 h-14 rounded-2xl border border-border bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 font-medium text-xs hover:bg-violet-100 dark:hover:bg-violet-900/30 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <QrCode size={16} strokeWidth={2} />
              QR
            </button>
            <button
              onClick={() => onPay('cash')}
              className="flex flex-col items-center justify-center gap-1 h-14 rounded-2xl border border-border bg-white/50 dark:bg-white/5 font-medium text-xs hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Banknote size={16} strokeWidth={2} />
              Cash
            </button>
            {!hideCharge && (
              <button
                onClick={() => onPay('room')}
                className="flex flex-col items-center justify-center gap-1 h-14 rounded-2xl border border-border bg-white/50 dark:bg-white/5 font-medium text-xs hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <BedDouble size={16} strokeWidth={2} />
                Room
              </button>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onDiscount}
              className={`flex-1 h-8 rounded-xl text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
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
              className={`flex-1 h-8 rounded-xl text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring flex items-center justify-center gap-1 ${
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
              className="flex-1 h-8 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring flex items-center justify-center gap-1"
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
    case 'card': return 'Card';
    case 'qr':   return 'QR';
    case 'cash': return 'Cash';
    case 'room': return 'Room charge';
    default:     return '—';
  }
}
