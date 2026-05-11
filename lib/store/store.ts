// ─────────────────────────────────────────────────────────────────
// Central store — slices of versioned localStorage + cross-tab sync
// via BroadcastChannel. Use the React hook `useSlice()` to subscribe.
// ─────────────────────────────────────────────────────────────────

import type {
  AuditAction, AuditEntry, Bill, BillTag, CoworkSpace, Customer, Equipment, KitchenTicket, ModifierGroup, Product,
  Settings, Shift, Staff, Stay, Tab,
} from '../types';
import { StorageSlice } from './storage';
import {
  SEED_AUDIT, SEED_CUSTOMERS, SEED_EQUIPMENT, SEED_MODIFIER_GROUPS, SEED_PRODUCTS, SEED_SETTINGS, SEED_SHIFT,
  SEED_SPACES, SEED_STAFF, SEED_STAYS, SEED_TABS, SEED_TICKETS,
} from './seed';
import { newId } from '../domain/id';
import { db, ensureAuth } from '../firebase';
import { doc } from 'firebase/firestore';

const FS = (name: string) => doc(db, 'stores', 'default', 'slices', name);

const CHANNEL = 'denz-pos';
const CURRENT_SCHEMA = 1;

class Store {
  readonly settings = new StorageSlice<Settings>('denz.settings', CURRENT_SCHEMA, () => SEED_SETTINGS);
  readonly staff    = new StorageSlice<Staff[]>('denz.staff',    CURRENT_SCHEMA, () => SEED_STAFF);
  readonly products = new StorageSlice<Product[]>('denz.products', CURRENT_SCHEMA, () => SEED_PRODUCTS);
  readonly modifierGroups = new StorageSlice<ModifierGroup[]>('denz.modifierGroups', CURRENT_SCHEMA, () => SEED_MODIFIER_GROUPS);
  readonly tabs     = new StorageSlice<Tab[]>('denz.tabs',       CURRENT_SCHEMA, () => SEED_TABS);
  readonly stays    = new StorageSlice<Stay[]>('denz.stays',     CURRENT_SCHEMA, () => SEED_STAYS);
  readonly shift    = new StorageSlice<Shift | null>('denz.shift', CURRENT_SCHEMA, () => SEED_SHIFT);
  readonly tickets   = new StorageSlice<KitchenTicket[]>('denz.tickets',   CURRENT_SCHEMA, () => SEED_TICKETS);
  readonly audit     = new StorageSlice<AuditEntry[]>('denz.audit',       CURRENT_SCHEMA, () => SEED_AUDIT);
  readonly customers  = new StorageSlice<Customer[]>('denz.customers',    CURRENT_SCHEMA, () => SEED_CUSTOMERS);
  readonly spaces     = new StorageSlice<CoworkSpace[]>('denz.spaces',    CURRENT_SCHEMA, () => SEED_SPACES);
  readonly equipment  = new StorageSlice<Equipment[]>('denz.equipment',   CURRENT_SCHEMA, () => SEED_EQUIPMENT);
  readonly bills      = new StorageSlice<Bill[]>('denz.bills',            CURRENT_SCHEMA, () => []);
  readonly billTags   = new StorageSlice<BillTag[]>('denz.billTags',      CURRENT_SCHEMA, () => []);

  /** Map of storage key -> slice for cross-tab sync. */
  private readonly slicesByKey: Map<string, { refresh(): void }>;
  private readonly channel?: BroadcastChannel;

  constructor() {
    const entries: [string, { refresh(): void }][] = [
      [this.settings.storageKey, this.settings],
      [this.staff.storageKey,    this.staff],
      [this.products.storageKey, this.products],
      [this.modifierGroups.storageKey, this.modifierGroups],
      [this.tabs.storageKey,     this.tabs],
      [this.stays.storageKey,    this.stays],
      [this.shift.storageKey,    this.shift],
      [this.tickets.storageKey,   this.tickets],
      [this.audit.storageKey,     this.audit],
      [this.customers.storageKey,  this.customers],
      [this.spaces.storageKey,     this.spaces],
      [this.equipment.storageKey,  this.equipment],
      [this.bills.storageKey,      this.bills],
      [this.billTags.storageKey,   this.billTags],
    ];
    this.slicesByKey = new Map(entries);

    // Connect all slices to Firestore after anonymous auth is ready
    if (typeof window !== 'undefined') {
      ensureAuth().then(() => {
        this.settings.connectFirestore(FS('settings'));
        this.staff.connectFirestore(FS('staff'));
        this.products.connectFirestore(FS('products'));
        this.modifierGroups.connectFirestore(FS('modifierGroups'));
        this.tabs.connectFirestore(FS('tabs'));
        this.stays.connectFirestore(FS('stays'));
        this.shift.connectFirestore(FS('shift'));
        this.tickets.connectFirestore(FS('tickets'));
        this.audit.connectFirestore(FS('audit'));
        this.customers.connectFirestore(FS('customers'));
        this.spaces.connectFirestore(FS('spaces'));
        this.equipment.connectFirestore(FS('equipment'));
        this.bills.connectFirestore(FS('bills'));
        this.billTags.connectFirestore(FS('billTags'));
      });
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL);

      // Re-broadcast our own writes so other tabs refresh their slice from storage.
      const wrap = (slice: StorageSlice<unknown>) => {
        const original = slice.set.bind(slice);
        slice.set = (updater) => {
          original(updater as never);
          this.channel?.postMessage({ key: slice.storageKey });
        };
      };
      for (const slice of [
        this.settings, this.staff, this.products, this.modifierGroups, this.tabs,
        this.stays, this.shift, this.tickets, this.audit, this.customers, this.spaces, this.equipment,
        this.bills, this.billTags,
      ]) {
        wrap(slice as unknown as StorageSlice<unknown>);
      }

      this.channel.addEventListener('message', e => {
        const key = (e.data as { key?: string } | null)?.key;
        if (key) this.slicesByKey.get(key)?.refresh();
      });
    }
  }

  /* ── Audit helper ───────────────────────────────────────────── */
  log(action: AuditAction, detail: string, staffId?: string) {
    this.audit.set(prev => [
      { id: newId('aud'), at: new Date(), action, staffId, detail },
      ...prev,
    ].slice(0, 1000)); // keep last 1000 entries
  }

  /* ── Wipe + reseed (factory reset) ──────────────────────────── */
  wipe() {
    if (typeof window === 'undefined') return;
    for (const slice of this.slicesByKey.values()) {
      window.localStorage.removeItem((slice as unknown as { storageKey: string }).storageKey);
      slice.refresh();
    }
  }
}

let _store: Store | null = null;
export function getStore(): Store {
  if (!_store) _store = new Store();
  return _store;
}

export type { Store };
