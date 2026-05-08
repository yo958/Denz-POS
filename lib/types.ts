// ─────────────────────────────────────────────────────────────────
// Domain types — Denz POS v1
// ─────────────────────────────────────────────────────────────────

export type TabType = 'cafe' | 'desk' | 'room';
export type TabStatus = 'open' | 'paid' | 'refunded';
export type PaymentMethod = 'card' | 'cash' | 'room';
export type ProductCategory = 'food' | 'drinks' | 'desks' | 'rooms';
export type StaffRole = 'manager' | 'staff';

/* ── Discount ─────────────────────────────────────────────────── */
export interface Discount {
  type: 'pct' | 'fixed';
  value: number;
}

/* ── Product ──────────────────────────────────────────────────── */
export interface Product {
  id: string;
  name: string;
  price: number;
  category: ProductCategory;
  description: string;
  /** Null = not stocked (desks, rooms, services, or stock tracking disabled). Number = current units in stock. */
  stock: number | null;
  /** Optional low-stock threshold. */
  lowStockAt: number | null;
  /** Optional cost price (per unit) used for margin reporting. */
  cost?: number | null;
  /** Optional image (data URL or path). Takes precedence over `glyph` and the category default. */
  image?: string | null;
  /** Optional emoji/glyph shown when no image is set. Falls back to category default. */
  glyph?: string | null;
  /** True = item is sent to the kitchen on "Send to Kitchen". */
  sendToKitchen: boolean;
  /** Hidden from the POS grid (still in Menu management). */
  archived?: boolean;
}

/* ── Line items ───────────────────────────────────────────────── */
export interface LineItem {
  productId: string;
  product: Product;
  qty: number;
  /** Per-line note (eg "no onion"). */
  note?: string;
  /** Quantity already sent to kitchen (for diffing on resend). */
  sentToKitchenQty?: number;
  /** Quantity refunded against this line. */
  refundedQty?: number;
}

/* ── Voids ────────────────────────────────────────────────────── */
export interface VoidEntry {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  reason: string;
  staffId: string;
  at: Date;
}

/* ── Refunds ──────────────────────────────────────────────────── */
export interface RefundLine {
  productId: string;
  qty: number;
}
export interface Refund {
  id: string;
  tabId: string;
  lines: RefundLine[];
  amount: number;
  reason: string;
  method: PaymentMethod;
  staffId: string;
  at: Date;
}

/* ── Tab ──────────────────────────────────────────────────────── */
export interface Tab {
  id: string;
  customerName: string;
  type: TabType;
  label: string;
  items: LineItem[];
  openedAt: Date;
  status: TabStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: Date;
  paidByStaffId?: string;
  cashTendered?: number;
  changeGiven?: number;
  discount?: Discount;
  /** If charged to a room, this is the parent stay. */
  stayId?: string;
  voids?: VoidEntry[];
  refunds?: Refund[];
  /** Latest "send to kitchen" timestamp. */
  kitchenSentAt?: Date;
}

/* ── Stay (folio) ─────────────────────────────────────────────── */
export type StayStatus = 'active' | 'checked-out';
export interface Stay {
  id: string;
  guestName: string;
  guestPhone?: string;
  roomId: string;             // points to a Product in `rooms` category
  roomName: string;           // snapshot
  nightlyRate: number;        // snapshot
  nights: number;
  checkInAt: Date;
  checkOutAt?: Date;
  /** Long-running tab that all charges flow into. */
  folioTabId: string;
  status: StayStatus;
  notes?: string;
}

/* ── Staff ────────────────────────────────────────────────────── */
export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  /** SHA-256 hex of `pin + salt`. Never store raw PIN. */
  pinHash: string;
  pinSalt: string;
  initials: string;
  archived?: boolean;
}

/* ── Shift / cash drawer ──────────────────────────────────────── */
export interface Shift {
  id: string;
  openedAt: Date;
  openedByStaffId: string;
  openingFloat: number;
  closedAt?: Date;
  closedByStaffId?: string;
  countedCash?: number;
  notes?: string;
}

/* ── Kitchen tickets ──────────────────────────────────────────── */
export type TicketStatus = 'new' | 'preparing' | 'ready' | 'done';
export interface KitchenTicketItem {
  productId: string;
  productName: string;
  qty: number;
  note?: string;
}
export interface KitchenTicket {
  id: string;
  tabId: string;
  tabLabel: string;
  customerName: string;
  items: KitchenTicketItem[];
  createdAt: Date;
  status: TicketStatus;
  bumpedAt?: Date;
}

/* ── Audit log ────────────────────────────────────────────────── */
export type AuditAction =
  | 'tab.create' | 'tab.update' | 'tab.pay' | 'tab.void' | 'tab.refund' | 'tab.kitchen-send'
  | 'stay.checkin' | 'stay.checkout' | 'stay.charge'
  | 'product.create' | 'product.update' | 'product.delete' | 'product.stock'
  | 'shift.open' | 'shift.close'
  | 'staff.create' | 'staff.update' | 'staff.delete'
  | 'settings.update' | 'data.export' | 'data.import' | 'data.wipe';
export interface AuditEntry {
  id: string;
  at: Date;
  action: AuditAction;
  staffId?: string;
  detail: string;
}

/* ── Settings ─────────────────────────────────────────────────── */
export interface VenueSettings {
  name: string;
  address: string;
  phone: string;
  abn: string;
}
export interface ReceiptSettings {
  header: string;
  footer: string;
}
export interface DeviceSettings {
  /** Auto-lock idle minutes (0 = never). */
  idleLockMinutes: number;
  /** Play sound on new kitchen ticket. */
  kdsSound: boolean;
}
export interface Settings {
  venue: VenueSettings;
  taxEnabled: boolean;      // false = no tax line on receipts/totals
  taxRate: number;          // 0.10 = 10%
  taxLabel: string;         // "Tax", "GST"
  currency: string;         // "$", "€"
  receipt: ReceiptSettings;
  device: DeviceSettings;
}
