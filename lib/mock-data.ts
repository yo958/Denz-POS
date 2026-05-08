// ─────────────────────────────────────────────────────────────────
// Compatibility shim. Real data now lives in lib/store/*.
// Re-exports the pure helpers from lib/domain/tabs so existing
// component imports keep compiling. Will be deleted in a future pass.
// ─────────────────────────────────────────────────────────────────

export {
  tabSubtotal as tabTotal,
  tabDiscountAmount,
  tabTax,
  tabGrandTotal,
  formatTime,
  formatElapsed,
  formatMoney,
  formatDate,
} from './domain/tabs';

export { SEED_PRODUCTS as PRODUCTS, SEED_TABS as INITIAL_TABS } from './store/seed';
export const TAX_RATE = 0.10;
