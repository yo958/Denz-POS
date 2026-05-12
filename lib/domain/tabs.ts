// ─────────────────────────────────────────────────────────────────
// Pure tab math + formatting helpers (no React, no storage).
// ─────────────────────────────────────────────────────────────────

import type { Discount, LineItem, SelectedModifier, Tab } from '../types';
import { getStore } from '../store/store';
import { fmtCur } from '../format';

/** Net qty = ordered qty minus refunded qty. */
export function effectiveQty(li: LineItem): number {
  return Math.max(0, li.qty - (li.refundedQty ?? 0));
}

/** Per-unit price including selected modifier deltas (before any per-item discount). */
export function lineUnitPrice(li: LineItem): number {
  const mods = (li.modifiers ?? []).reduce((s, m) => s + (m.priceDelta || 0), 0);
  return Math.max(0, li.product.price + mods);
}

/**
 * Per-unit price after applying the line-item's own discount.
 * Pct discounts reduce the unit price by that percentage.
 * Fixed discounts subtract a flat amount from the unit price.
 * Tab-level discounts are applied separately on top of this in tabDiscountAmount().
 */
export function lineEffectiveUnitPrice(li: LineItem): number {
  const base = lineUnitPrice(li);
  if (!li.discount || li.discount.value === 0) return base;
  if (li.discount.type === 'pct') return Math.max(0, base * (1 - li.discount.value / 100));
  return Math.max(0, base - li.discount.value);
}

/** The per-unit saving from the line-item's own discount. */
export function lineDiscountAmount(li: LineItem): number {
  return lineUnitPrice(li) - lineEffectiveUnitPrice(li);
}

/** Stable key for a line item (falls back to productId for legacy lines). */
export function lineKey(li: LineItem): string {
  return li.id ?? li.productId;
}

/** Deterministic string for matching identical modifier sets when stacking. */
export function modifiersStableKey(modifiers?: SelectedModifier[]): string {
  if (!modifiers || modifiers.length === 0) return '';
  return [...modifiers]
    .map(m => `${m.groupId}:${m.optionId}`)
    .sort()
    .join('|');
}

/** Short human-readable summary of selected modifiers. */
export function modifiersSummary(modifiers?: SelectedModifier[]): string {
  if (!modifiers || modifiers.length === 0) return '';
  return modifiers.map(m => m.name).join(' · ');
}

export function tabSubtotal(items: LineItem[]): number {
  return items.reduce((sum, li) => sum + lineEffectiveUnitPrice(li) * effectiveQty(li), 0);
}
/** @deprecated alias kept so existing imports compile. */
export const tabTotal = tabSubtotal;

export function tabDiscountAmount(items: LineItem[], discount?: Discount): number {
  if (!discount || discount.value === 0) return 0;
  const sub = tabSubtotal(items);
  return discount.type === 'pct'
    ? sub * (discount.value / 100)
    : Math.min(discount.value, sub);
}

function currentTaxRate(): number {
  if (typeof window === 'undefined') return 0.10;
  try {
    const s = getStore().settings.get();
    return s.taxEnabled === false ? 0 : s.taxRate;
  } catch {
    return 0.10;
  }
}

export function tabTax(items: LineItem[], discount?: Discount, taxRate?: number): number {
  const rate = taxRate ?? currentTaxRate();
  return Math.max(0, tabSubtotal(items) - tabDiscountAmount(items, discount)) * rate;
}

export function tabGrandTotal(items: LineItem[], discount?: Discount, taxRate?: number): number {
  const rate = taxRate ?? currentTaxRate();
  const discounted = Math.max(0, tabSubtotal(items) - tabDiscountAmount(items, discount));
  return discounted * (1 + rate);
}

export const CARD_FEE_RATE = 0.05;

export function tabCardFee(items: LineItem[], discount?: Discount, taxRate?: number): number {
  return tabGrandTotal(items, discount, taxRate) * CARD_FEE_RATE;
}

export function tabGrandTotalWithCardFee(items: LineItem[], discount?: Discount, taxRate?: number): number {
  return tabGrandTotal(items, discount, taxRate) * (1 + CARD_FEE_RATE);
}

export function tabRefundedAmount(tab: Tab): number {
  return (tab.refunds ?? []).reduce((s, r) => s + r.amount, 0);
}

export function tabPartialPaidAmount(tab: Tab): number {
  return (tab.partialPayments ?? []).reduce((s, p) => s + p.amount, 0);
}

/* ── Formatting ───────────────────────────────────────────────── */
function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

export function formatTime(date: Date | string): string {
  return toDate(date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date | string): string {
  return toDate(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatElapsed(date: Date | string): string {
  const mins = Math.floor((Date.now() - toDate(date).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatMoney(amount: number, currency?: string): string {
  let cur = currency;
  if (cur === undefined) {
    try {
      cur = getStore().settings.get().currency;
    } catch {
      cur = '$';
    }
  }
  return `${cur}${fmtCur(amount)}`;
}

export { newId } from './id';
