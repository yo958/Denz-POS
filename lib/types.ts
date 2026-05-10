// ─────────────────────────────────────────────────────────────────
// Domain types — Denz POS v1
// ─────────────────────────────────────────────────────────────────

export type TabType = 'cafe' | 'desk' | 'room';
export type TabStatus = 'open' | 'paid' | 'refunded';
export type PaymentMethod = 'card' | 'qr' | 'cash' | 'room';
export type ProductCategory = 'food' | 'drinks' | 'desks' | 'rooms' | 'equipment-rental';
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
  /** IDs of shared ModifierGroups offered when adding this product to a tab. */
  modifierGroupIds?: string[];
  /**
   * Per-product overrides for modifier option prices. Keyed by `[groupId][optionId] = priceDelta`.
   * If an override is present, it replaces the group's option `priceDelta` for this product only.
   * Absent entries fall back to the shared group price.
   */
  modifierOptionPriceOverrides?: Record<string, Record<string, number>>;
}

/* ── Modifier groups (shared, reused across products) ─────────── */
export type ModifierGroupType = 'single' | 'multi';

export interface ModifierOption {
  id: string;
  name: string;
  /** Added to the line unit price. Can be 0 or negative. */
  priceDelta: number;
  archived?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  /** 'single' = pick exactly one (radio); 'multi' = pick zero or more (checkboxes). */
  type: ModifierGroupType;
  /** Only meaningful for 'single' — if true, customer must pick one. */
  required?: boolean;
  /** Optional default option (id) for 'single' groups. */
  defaultOptionId?: string;
  options: ModifierOption[];
  archived?: boolean;
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDelta: number;
}

/* ── Line items ───────────────────────────────────────────────── */
export interface LineItem {
  /** Stable per-line identifier. New lines should always be given an id; legacy lines fall back to productId. */
  id?: string;
  productId: string;
  product: Product;
  qty: number;
  /** Selected modifier options for this line. */
  modifiers?: SelectedModifier[];
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
  /** Linked customer profile id (set when staff picks from CustomerPicker). */
  customerId?: string;
  voids?: VoidEntry[];
  refunds?: Refund[];
  /** Latest "send to kitchen" timestamp. */
  kitchenSentAt?: Date;
  /** For dedicated-desk bookings: when the booked period expires. */
  bookingEndsAt?: Date;
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
  /** Linked customer profile id. */
  customerId?: string;
  status: StayStatus;
  notes?: string;
}

/* ── Coworking spaces ─────────────────────────────────────────── */
export type CoworkSpaceType = 'desk' | 'private-office';
export type CoworkRatePeriod = 'hourly' | 'daily' | 'weekly' | '2-weeks' | 'monthly' | '3-months' | '6-months' | 'yearly';

export interface CoworkSpaceRate {
  period: CoworkRatePeriod;
  price: number;
  enabled: boolean;
}

export interface CoworkSpace {
  id: string;
  name: string;
  type: CoworkSpaceType;
  description?: string;
  /** Hot desk / walk-in rates. */
  rates: CoworkSpaceRate[];
  /** If present (and has enabled entries), desk also supports dedicated (block) bookings at these rates. */
  dedicatedRates?: CoworkSpaceRate[];
  archived?: boolean;
}

/* ── Equipment Rental ─────────────────────────────────────────── */
export interface EquipmentTier {
  price: number; // price for this hour slot; the last entry repeats for all additional hours
}

export interface Equipment {
  id: string;
  name: string;
  description?: string;
  tiers: EquipmentTier[]; // tiers[0] = hr 1, tiers[1] = hr 2, … last tier repeats
  archived?: boolean;
}

/* ── Customer ─────────────────────────────────────────────────── */
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  jobRole?: string;
  /** Profile photo — data URL or hosted path. */
  image?: string;
  discount?: Discount;
  vip?: boolean;
  visitorType?: 'local' | 'tourist' | 'expat' | 'semi-expat';
  country?: string;
  notes?: string;
  createdAt: Date;
  archived?: boolean;
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
  /** Profile photo — data URL or hosted path. */
  image?: string;
  contact?: { phone?: string; email?: string };
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
  modifiers?: Pick<SelectedModifier, 'groupName' | 'name'>[];
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
  | 'modifier.create' | 'modifier.update' | 'modifier.delete'
  | 'shift.open' | 'shift.close'
  | 'staff.create' | 'staff.update' | 'staff.delete'
  | 'customer.create' | 'customer.update' | 'customer.delete'
  | 'equipment.create' | 'equipment.update' | 'equipment.delete' | 'rental.create'
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
