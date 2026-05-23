// ─────────────────────────────────────────────────────────────────
// Domain types — Denz POS v1
// ─────────────────────────────────────────────────────────────────

export type TabType = 'cafe' | 'desk' | 'room';
export type TabStatus = 'open' | 'paid' | 'refunded';
export type PaymentMethod = 'card' | 'qr' | 'cash' | 'room' | 'split';

/* ── Split payment ────────────────────────────────────────────── */
export interface SplitPaymentLine {
  method: 'cash' | 'card' | 'qr';
  /** Portion of the base total allocated to this method (before any card fee). */
  amount: number;
  /** Cash payments only: how much the customer tendered. */
  cashTendered?: number;
  /** Cash payments only: change returned. */
  changeGiven?: number;
}
export type ProductCategory = 'food' | 'drinks' | 'dessert' | 'desks' | 'rooms' | 'equipment-rental';
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
   * Per-product option visibility. Keyed by `[groupId] → string[]` of enabled optionIds.
   * Only options listed here are shown in the POS picker for this product.
   * If undefined (legacy) or the group key is absent, all non-archived options are shown.
   */
  modifierEnabledOptions?: Record<string, string[]>;
  /**
   * Per-product price deltas. Keyed by `[groupId][optionId] = priceDelta`.
   * Prices are set at the product level; the shared group options carry no default price.
   */
  modifierOptionPriceOverrides?: Record<string, Record<string, number>>;
  /** Extended description shown on the room's individual page on the website. */
  longDescription?: string;
  /** Gallery images (data URLs) shown on the room's detail page. Max 6 images. */
  gallery?: string[];
  /** Seasonal pricing — only used when category === 'rooms'. */
  seasons?: RoomSeason[];
  /** If true, room is blocked from website bookings (e.g. under renovation). */
  blocked?: boolean;
}

/* ── Room seasonal pricing ────────────────────────────────────── */
export interface RoomSeason {
  name: string;        // e.g. "High Season"
  price: number;
  startMonth: number;  // 1–12
  startDay: number;    // 1–31
  endMonth: number;    // 1–12
  endDay: number;      // 1–31
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
  /** Per-line item discount (applied before the tab-level discount). */
  discount?: Discount;
  /** Quantity already sent to kitchen (for diffing on resend). */
  sentToKitchenQty?: number;
  /** Quantity refunded against this line. */
  refundedQty?: number;
  /** When this line was first added to the tab. */
  addedAt?: Date;
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

/* ── Partial payment (logged against an open tab) ─────────────── */
export interface PartialPayment {
  id: string;
  amount: number;
  method: 'cash' | 'card' | 'qr' | 'bank';
  note?: string;
  recordedAt: Date;
  staffId?: string;
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
  /** Populated when paymentMethod === 'split'. Each line is a partial payment. */
  splitPayments?: SplitPaymentLine[];
  discount?: Discount;
  /** If charged to a room, this is the parent stay. */
  stayId?: string;
  /** Linked customer profile id (set when staff picks from CustomerPicker). */
  customerId?: string;
  voids?: VoidEntry[];
  refunds?: Refund[];
  partialPayments?: PartialPayment[];
  /** Latest "send to kitchen" timestamp. */
  kitchenSentAt?: Date;
  /** For dedicated-desk and multi-day hot-desk bookings: when the booked period expires. */
  bookingEndsAt?: Date;
  /** Distinguishes Hot Desk from Dedicated Desk bookings (set when type === 'desk'). */
  bookingType?: 'hot' | 'dedicated';
  /** Manager marks payment as physically received/reconciled. Syncs across devices via Firestore. */
  paymentReceived?: boolean;
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
  cost?: number | null;
  enabled: boolean;
  /** Per-hour tiers — only used when period === 'hourly'.
   *  tiers[0] = hr 1 price, tiers[1] = hr 2 price, last entry repeats.
   *  When present and length > 0, overrides the flat `price` field. */
  tiers?: EquipmentTier[];
}

export interface CoworkSpace {
  id: string;
  name: string;
  type: CoworkSpaceType;
  description?: string;
  /** Extended description shown on the space's individual page on the website. */
  longDescription?: string;
  /** Hot desk / walk-in rates. */
  rates: CoworkSpaceRate[];
  /** If present (and has enabled entries), desk also supports dedicated (block) bookings at these rates. */
  dedicatedRates?: CoworkSpaceRate[];
  /**
   * Maximum simultaneous bookings. Undefined / 1 = single occupancy (default).
   * When > 1, the space stays available until this many tabs are open.
   */
  capacity?: number;
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
  /** Cost per hour (e.g. depreciation). Multiplied by rental hours at booking time. */
  costPerHour?: number | null;
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
  /** ID / passport scan — data URL. Stored locally, never leaves the device. */
  idImage?: string;
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
  /** Firebase Auth UID — set when a Firebase account has been created for this staff member. */
  firebaseUid?: string;
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
  | 'tab.create' | 'tab.update' | 'tab.pay' | 'tab.void' | 'tab.refund' | 'tab.kitchen-send' | 'tab.desk-added' | 'tab.partial-pay' | 'tab.web-booking-accepted' | 'tab.web-booking-declined'
  | 'stay.checkin' | 'stay.checkout' | 'stay.charge'
  | 'product.create' | 'product.update' | 'product.delete' | 'product.stock'
  | 'modifier.create' | 'modifier.update' | 'modifier.delete'
  | 'shift.open' | 'shift.close'
  | 'staff.create' | 'staff.update' | 'staff.delete'
  | 'customer.create' | 'customer.update' | 'customer.delete'
  | 'equipment.create' | 'equipment.update' | 'equipment.delete' | 'rental.create'
  | 'settings.update' | 'data.export' | 'data.import' | 'data.wipe'
  | 'gmail.connect' | 'gmail.disconnect' | 'gmail.reply'
  | 'ads.connect' | 'ads.disconnect' | 'ads.refresh'
  | 'analytics.refresh'
  | 'gsc.refresh' | 'gsc.insights'
  | 'settings.openai';
export interface AuditEntry {
  id: string;
  at: Date;
  action: AuditAction;
  staffId?: string;
  detail: string;
}

/* ── Bills / Expenses ─────────────────────────────────────────── */
export type BillCategory = 'cafe' | 'rooms' | 'coworking' | 'general';

export interface BillTag {
  id: string;
  name: string;
  color?: string; // optional tailwind-safe hex or preset name
  archived?: boolean;
}

export type BillPayer = 'JD' | 'Sasinee';

export interface Bill {
  id: string;
  description: string;
  amount: number;
  category: BillCategory;
  /** IDs of BillTags. */
  tagIds: string[];
  date: Date;
  /** Who paid this bill. */
  paidBy?: BillPayer;
  /** Optional supplier / payee name. */
  supplier?: string;
  /** Optional free-text notes. */
  notes?: string;
  createdAt: Date;
  createdByStaffId?: string;
}

/* ── Settings ─────────────────────────────────────────────────── */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayHours {
  open: string;   // 'HH:MM'
  close: string;  // 'HH:MM'
  closed: boolean;
}

export interface VenueSettings {
  name: string;
  address: string;
  phone: string;
  abn: string;
  timezone?: string;                              // IANA e.g. 'Asia/Bangkok'
  openingHours?: Record<DayOfWeek, DayHours>;
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
