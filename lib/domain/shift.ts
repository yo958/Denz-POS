// ─────────────────────────────────────────────────────────────────
// Shift / Z-report calculations.
// ─────────────────────────────────────────────────────────────────

import type { PaymentMethod, Refund, Shift, Tab } from '../types';
import { tabGrandTotal, tabCardFee } from './tabs';

export interface ZReport {
  shift: Shift;
  durationMinutes: number;
  totalsByMethod: Record<PaymentMethod, number>;
  totalSales: number;
  refundsTotal: number;
  netSales: number;
  expectedCash: number;
  countedCash: number | null;
  variance: number | null;
  voidsCount: number;
  refundsCount: number;
  paidTabsCount: number;
}

function inShift(shift: Shift, at: Date): boolean {
  const atD = at instanceof Date ? at : new Date(at as unknown as string);
  const openedD = shift.openedAt instanceof Date ? shift.openedAt : new Date(shift.openedAt as unknown as string);
  if (atD < openedD) return false;
  if (shift.closedAt) {
    const closedD = shift.closedAt instanceof Date ? shift.closedAt : new Date(shift.closedAt as unknown as string);
    if (atD > closedD) return false;
  }
  return true;
}

export function buildZReport(shift: Shift, tabs: Tab[]): ZReport {
  const totals: Record<PaymentMethod, number> = { card: 0, qr: 0, cash: 0, room: 0 };
  let totalSales = 0;
  let refundsTotal = 0;
  let voidsCount = 0;
  let refundsCount = 0;
  let paidTabsCount = 0;

  for (const tab of tabs) {
    if (tab.paidAt && tab.paymentMethod && inShift(shift, tab.paidAt)) {
      const fee = tab.paymentMethod === 'card' ? tabCardFee(tab.items, tab.discount) : 0;
      const t = tabGrandTotal(tab.items, tab.discount) + fee;
      totals[tab.paymentMethod] += t;
      totalSales += t;
      paidTabsCount += 1;
    }

    voidsCount += (tab.voids?.length ?? 0);

    for (const r of tab.refunds ?? []) {
      if (inShift(shift, r.at)) {
        refundsTotal += r.amount;
        refundsCount += 1;
        // refund reduces the same payment method bucket
        totals[r.method] -= r.amount;
      }
    }
  }

  const expectedCash = shift.openingFloat + totals.cash;
  const countedCash = shift.countedCash ?? null;
  const variance = countedCash === null ? null : countedCash - expectedCash;
  const closedAt = shift.closedAt ?? new Date();
  const closedD = closedAt instanceof Date ? closedAt : new Date(closedAt as unknown as string);
  const openedD = shift.openedAt instanceof Date ? shift.openedAt : new Date(shift.openedAt as unknown as string);
  const durationMinutes = Math.max(
    0,
    Math.floor((closedD.getTime() - openedD.getTime()) / 60_000),
  );

  return {
    shift,
    durationMinutes,
    totalsByMethod: totals,
    totalSales,
    refundsTotal,
    netSales: totalSales - refundsTotal,
    expectedCash,
    countedCash,
    variance,
    voidsCount,
    refundsCount,
    paidTabsCount,
  };
}

// Re-export for convenience
export type { Refund };
