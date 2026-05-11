'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Check } from 'lucide-react';
import type { Tab } from '@/lib/types';
import {
  tabDiscountAmount, tabTax, tabGrandTotal, CARD_FEE_RATE, lineUnitPrice, lineEffectiveUnitPrice,
} from '@/lib/domain/tabs';
import { useSettings } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';

interface SplitPaymentDialogProps {
  open: boolean;
  tab: Tab | null;
  onConfirm: (cashPortion: number, cashTendered: number) => void;
  onClose: () => void;
}

export function SplitPaymentDialog({ open, tab, onConfirm, onClose }: SplitPaymentDialogProps) {
  const settings = useSettings();
  const [cashPortion, setCashPortion] = useState<number>(0);
  const [cashTendered, setCashTendered] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setCashPortion(0);
      setCashTendered(0);
    }
  }, [open]);

  if (!open || !tab) return null;

  const taxRate    = settings.taxEnabled === false ? 0 : settings.taxRate;
  const subtotal   = tab.items.reduce((s, li) => s + lineUnitPrice(li) * Math.max(0, li.qty - (li.refundedQty ?? 0)), 0);
  const lineDiscountTotal = tab.items.reduce((s, li) => {
    const saving = lineUnitPrice(li) - lineEffectiveUnitPrice(li);
    return s + saving * Math.max(0, li.qty - (li.refundedQty ?? 0));
  }, 0);
  const discount   = tabDiscountAmount(tab.items, tab.discount);
  const tax        = tabTax(tab.items, tab.discount, taxRate);
  const baseTotal  = tabGrandTotal(tab.items, tab.discount, taxRate);
  const cardPortion = Math.max(0, baseTotal - cashPortion);
  const cardFee    = cardPortion * CARD_FEE_RATE;
  const totalDue   = baseTotal + cardFee;
  const change     = Math.max(0, cashTendered - cashPortion);
  const cur = settings.currency;

  const validCash = cashPortion > 0 && cashPortion < baseTotal;
  const canConfirm = validCash && cashTendered >= cashPortion;

  // Suggested cash portion amounts (round numbers near 25 / 50 / 75%)
  const quickPortions = [
    Math.round(baseTotal * 0.25 / 10) * 10,
    Math.round(baseTotal * 0.5  / 10) * 10,
    Math.round(baseTotal * 0.75 / 10) * 10,
  ].filter((a, i, arr) => a > 0 && a < baseTotal && arr.indexOf(a) === i);

  // Quick cash-tendered amounts (rounded up to nearest 10/20/50)
  const quickTendered = cashPortion > 0
    ? [
        Math.ceil(cashPortion / 10) * 10,
        Math.ceil(cashPortion / 20) * 20,
        Math.ceil(cashPortion / 50) * 50,
      ].filter((a, i, arr) => arr.indexOf(a) === i)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Split payment"
    >
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-background rounded-3xl p-6 shadow-2xl space-y-4 border border-border">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Split Payment</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tab.customerName} · {tab.label}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Order summary */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{cur}{fmtCur(subtotal)}</span>
          </div>
          {lineDiscountTotal > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Item discounts</span>
              <span className="tabular-nums">−{cur}{fmtCur(lineDiscountTotal)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount</span>
              <span className="tabular-nums">−{cur}{fmtCur(discount)}</span>
            </div>
          )}
          {settings.taxEnabled !== false && (
            <div className="flex justify-between text-muted-foreground">
              <span>{settings.taxLabel} ({Math.round(settings.taxRate * 100)}%)</span>
              <span className="tabular-nums">{cur}{fmtCur(tax)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border">
            <span>Base Total</span>
            <span className="tabular-nums">{cur}{fmtCur(baseTotal)}</span>
          </div>
        </div>

        {/* Split breakdown card */}
        <div className="rounded-2xl border border-border bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-3">

          {/* Cash portion row */}
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="split-cash-portion"
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 shrink-0"
            >
              <Banknote size={14} strokeWidth={2} />
              Cash
            </label>
            <input
              id="split-cash-portion"
              type="number"
              min={0}
              max={baseTotal - 0.01}
              step="0.01"
              value={cashPortion || ''}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                setCashPortion(val);
                // Auto-match cash tendered to the cash portion (exact change by default).
                // The user can still override the tendered field below.
                setCashTendered(val);
              }}
              placeholder="0.00"
              autoFocus
              className="w-28 h-9 px-3 text-right text-sm rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
            />
          </div>

          {/* Quick portion buttons */}
          {quickPortions.length > 0 && (
            <div className="flex gap-1.5">
              {quickPortions.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => { setCashPortion(a); setCashTendered(a); }}
                  className="flex-1 h-7 rounded-lg text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 transition-colors cursor-pointer tabular-nums"
                >
                  {cur}{a}
                </button>
              ))}
            </div>
          )}

          {cashPortion >= baseTotal && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Cash covers the full amount — use the Cash button instead.
            </p>
          )}

          <div className="border-t border-border" />

          {/* Card portion */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <CreditCard size={14} strokeWidth={2} />
              Card
            </span>
            <span className="tabular-nums font-medium">{cur}{fmtCur(cardPortion)}</span>
          </div>
          {cardPortion > 0 && (
            <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
              <span>Card fee ({Math.round(CARD_FEE_RATE * 100)}%)</span>
              <span className="tabular-nums">+{cur}{fmtCur(cardFee)}</span>
            </div>
          )}
        </div>

        {/* Total due */}
        <div className="flex justify-between font-bold text-base">
          <span>Total Due</span>
          <span className="tabular-nums">{cur}{fmtCur(totalDue)}</span>
        </div>

        {/* Cash tendered — only show once a valid cash split is entered */}
        {validCash && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground shrink-0">Cash Tendered</span>
              <input
                type="number"
                min={cashPortion}
                step="0.01"
                value={cashTendered || ''}
                onChange={e => setCashTendered(parseFloat(e.target.value) || 0)}
                placeholder={fmtCur(cashPortion)}
                className="w-28 h-9 px-3 text-right text-sm rounded-xl bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
              />
            </div>
            {quickTendered.length > 0 && (
              <div className="flex gap-1.5">
                {quickTendered.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setCashTendered(a)}
                    className="flex-1 h-7 rounded-lg text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 transition-colors cursor-pointer tabular-nums"
                  >
                    {cur}{a}
                  </button>
                ))}
              </div>
            )}
            {cashTendered > 0 && (
              <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Change Due</span>
                <span className="tabular-nums">{cur}{fmtCur(change)}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => { if (canConfirm) onConfirm(cashPortion, cashTendered); }}
          disabled={!canConfirm}
          className="w-full h-11 rounded-2xl font-semibold text-sm bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Check size={16} strokeWidth={2.5} />
          Confirm Split Payment
        </button>
      </div>
    </div>
  );
}
