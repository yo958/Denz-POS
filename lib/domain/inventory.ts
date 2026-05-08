// ─────────────────────────────────────────────────────────────────
// Inventory helpers — pure functions over the store slices.
// ─────────────────────────────────────────────────────────────────

import type { Product, LineItem, Tab } from '../types';
import { effectiveQty } from './tabs';

export function isStocked(product: Product): boolean {
  return product.stock !== null;
}

export function isOutOfStock(product: Product): boolean {
  return product.stock !== null && product.stock <= 0;
}

export function isLowStock(product: Product): boolean {
  return product.stock !== null
      && product.lowStockAt !== null
      && product.stock <= product.lowStockAt
      && product.stock > 0;
}

/** Apply a quantity delta to a product's stock (clamped at 0). Null stock = no-op. */
export function adjustStock(products: Product[], productId: string, delta: number): Product[] {
  return products.map(p => {
    if (p.id !== productId || p.stock === null) return p;
    return { ...p, stock: Math.max(0, p.stock + delta) };
  });
}

/** Decrement stock for every line in a tab (called when paid). */
export function decrementForTab(products: Product[], items: LineItem[]): Product[] {
  let next = products;
  for (const li of items) {
    const qty = effectiveQty(li);
    if (qty > 0) next = adjustStock(next, li.productId, -qty);
  }
  return next;
}

/** Restock for a single line (refund or void). */
export function restock(products: Product[], productId: string, qty: number): Product[] {
  return adjustStock(products, productId, +qty);
}

/** Has any product stock been reserved by another open tab? (FYI only.) */
export function reservedQty(tabs: Tab[], productId: string): number {
  let total = 0;
  for (const t of tabs) {
    if (t.status !== 'open') continue;
    for (const li of t.items) {
      if (li.productId === productId) total += effectiveQty(li);
    }
  }
  return total;
}
