// ─────────────────────────────────────────────────────────────────
// Initial seed — used on first load and after a wipe.
// ─────────────────────────────────────────────────────────────────

import type {
  Product,
  Tab,
  Settings,
  Staff,
  Shift,
  Stay,
  KitchenTicket,
  AuditEntry,
} from '../types';

export const SEED_PRODUCTS: Product[] = [
  // Food
  { id: 'f1', name: 'Avo Toast',      price: 14, category: 'food', description: 'Sourdough, smashed avo, feta, chilli', stock: 24, lowStockAt: 6, sendToKitchen: true },
  { id: 'f2', name: 'Granola Bowl',   price: 11, category: 'food', description: 'Coconut yoghurt, seasonal fruit, honey', stock: 18, lowStockAt: 5, sendToKitchen: true },
  { id: 'f3', name: 'Club Sandwich',  price: 16, category: 'food', description: 'Turkey, bacon, lettuce, aioli, fries',   stock: 14, lowStockAt: 5, sendToKitchen: true },
  { id: 'f4', name: 'Caesar Salad',   price: 15, category: 'food', description: 'Cos, parmesan, croutons, anchovy',       stock: 12, lowStockAt: 4, sendToKitchen: true },
  { id: 'f5', name: 'Banana Bread',   price: 7,  category: 'food', description: 'Thick slice, whipped ricotta, jam',      stock: 10, lowStockAt: 3, sendToKitchen: true },
  // Drinks
  { id: 'd1', name: 'Flat White',     price: 5,  category: 'drinks', description: 'Double ristretto, steamed milk',       stock: null, lowStockAt: null, sendToKitchen: true },
  { id: 'd2', name: 'Oat Latte',      price: 6,  category: 'drinks', description: 'Single origin espresso, oat milk',     stock: null, lowStockAt: null, sendToKitchen: true },
  { id: 'd3', name: 'Cold Brew',      price: 7,  category: 'drinks', description: '12-hour brew, served over ice',        stock: 22,   lowStockAt: 6,    sendToKitchen: true },
  { id: 'd4', name: 'Fresh OJ',       price: 6,  category: 'drinks', description: 'Freshly squeezed Valencia oranges',    stock: 15,   lowStockAt: 5,    sendToKitchen: true },
  { id: 'd5', name: 'Sparkling Water',price: 4,  category: 'drinks', description: '500ml San Pellegrino',                 stock: 30,   lowStockAt: 8,    sendToKitchen: false },
  // Desks
  { id: 'ds1', name: 'Hot Desk — Hourly',  price: 8,  category: 'desks', description: 'Any open desk, per hour',          stock: null, lowStockAt: null, sendToKitchen: false },
  { id: 'ds2', name: 'Hot Desk — Full Day',price: 35, category: 'desks', description: 'Any open desk, 8 hours',           stock: null, lowStockAt: null, sendToKitchen: false },
  { id: 'ds3', name: 'Meeting Room',       price: 25, category: 'desks', description: 'Seats 6, AV included, per hour',   stock: null, lowStockAt: null, sendToKitchen: false },
  // Rooms
  { id: 'r1', name: 'Room 1 — Deluxe',   price: 195, category: 'rooms', description: 'King, ensuite, city view, per night',     stock: null, lowStockAt: null, sendToKitchen: false },
  { id: 'r2', name: 'Room 2 — Standard', price: 145, category: 'rooms', description: 'Queen, ensuite, garden view, per night', stock: null, lowStockAt: null, sendToKitchen: false },
  { id: 'r3', name: 'Room 3 — Standard', price: 145, category: 'rooms', description: 'Queen, ensuite, garden view, per night', stock: null, lowStockAt: null, sendToKitchen: false },
];

const now = new Date();
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

export const SEED_TABS: Tab[] = [
  {
    id: 't1', customerName: 'Emma K.', type: 'cafe', label: 'Table 4',
    openedAt: minsAgo(34), status: 'open',
    items: [
      { productId: 'd2', product: SEED_PRODUCTS.find(p => p.id === 'd2')!, qty: 2 },
      { productId: 'f1', product: SEED_PRODUCTS.find(p => p.id === 'f1')!, qty: 1 },
    ],
  },
  {
    id: 't2', customerName: 'Marcus L.', type: 'desk', label: 'Desk 7',
    openedAt: minsAgo(142), status: 'open',
    items: [
      { productId: 'ds2', product: SEED_PRODUCTS.find(p => p.id === 'ds2')!, qty: 1 },
      { productId: 'd1',  product: SEED_PRODUCTS.find(p => p.id === 'd1')!,  qty: 1 },
    ],
  },
  {
    id: 't4', customerName: 'Group Tab', type: 'cafe', label: 'Table 1',
    openedAt: minsAgo(18), status: 'open',
    items: [
      { productId: 'd1', product: SEED_PRODUCTS.find(p => p.id === 'd1')!, qty: 3 },
      { productId: 'd3', product: SEED_PRODUCTS.find(p => p.id === 'd3')!, qty: 1 },
      { productId: 'f3', product: SEED_PRODUCTS.find(p => p.id === 'f3')!, qty: 2 },
      { productId: 'f5', product: SEED_PRODUCTS.find(p => p.id === 'f5')!, qty: 1 },
    ],
  },
];

export const SEED_STAYS: Stay[] = [];

export const SEED_TICKETS: KitchenTicket[] = [];

export const SEED_AUDIT: AuditEntry[] = [];

/**
 * Default staff:
 *   Manager  · PIN 1234
 *   Staff    · PIN 0000
 * Stored as SHA-256(pin + salt). Salt is `denz`. Change PINs in Settings.
 */
export const SEED_STAFF: Staff[] = [
  {
    id: 'staff-manager',
    name: 'Manager',
    role: 'manager',
    initials: 'MG',
    pinHash: '84085bd273e574e517590cb662b8f99ee7d8e08fb2b818b88cacda36419ede9e',
    pinSalt: 'denz',
  },
  {
    id: 'staff-default',
    name: 'Staff',
    role: 'staff',
    initials: 'ST',
    pinHash: 'd1f9bfe3f272acbdfdcd17bfccda96dd841dcfaa19b98b2cde41c734a7d09f52',
    pinSalt: 'denz',
  },
];

export const SEED_SHIFT: Shift | null = null;

export const SEED_SETTINGS: Settings = {
  venue: {
    name:    'Denz Coworking Cafe',
    address: '',
    phone:   '',
    abn:     '',
  },
  taxEnabled: true,
  taxRate:  0.10,
  taxLabel: 'GST',
  currency: '$',
  receipt: {
    header: 'Thanks for visiting Denz!',
    footer: 'See you again soon ✌',
  },
  device: {
    idleLockMinutes: 5,
    kdsSound: true,
  },
};
