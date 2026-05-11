/**
 * Number formatting utilities.
 * Using 'en' locale explicitly so thousands separators are always commas
 * and decimal separator is always a period, regardless of the browser locale.
 */

/** Format a monetary amount with 2 decimal places and thousands commas. e.g. 14000 → "14,000.00" */
export function fmtCur(amount: number): string {
  return amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format an integer/count with thousands commas. e.g. 14000 → "14,000" */
export function fmtNum(n: number): string {
  return n.toLocaleString('en');
}
