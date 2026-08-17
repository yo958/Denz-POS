// ─────────────────────────────────────────────────────────────────
// Central store — slices of versioned localStorage + cross-tab sync
// via BroadcastChannel. Use the React hook `useSlice()` to subscribe.
// ─────────────────────────────────────────────────────────────────

import type {
  AuditAction, AuditEntry, Bill, BillTag, CoworkSpace, Customer, Equipment, KitchenTicket, LineItem, ModifierGroup, Product,
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

/** Tombstones older than this are purged during merge (safe: by then every
 *  device has seen the deletion). */
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Effective "last touched" time for a tab. Falls back to paidAt then openedAt
 *  so legacy tabs without an `updatedAt` still order sensibly — a paid version
 *  (has paidAt) beats a stale open version of the same tab. */
function tabStamp(t: Tab): number {
  const d = t.updatedAt ?? t.paidAt ?? t.openedAt;
  const ms = d ? new Date(d).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/** Stable key for a line item (id, or productId for legacy id-less lines). */
function lineKey(li: LineItem): string {
  return li.id ?? `p:${li.productId}`;
}

/**
 * Reconcile two versions of the SAME tab seen on two devices.
 *
 * While BOTH versions are still open, union their line items by id so that a
 * concurrent add on another device is never dropped — the common case when two
 * staff build up one table's order at the same time (counter + phone). The
 * newer version wins for shared lines and for all scalar fields (status,
 * discount, customer, etc.).
 *
 * If either side is already settled (paid/refunded) or deleted, we do NOT
 * merge items — the newest whole-tab state wins, so we never inject items into
 * a closed tab or un-close a settled one.
 */
function reconcileTab(a: Tab, b: Tab): Tab {
  const newer = tabStamp(a) >= tabStamp(b) ? a : b;
  const older = newer === a ? b : a;
  if (newer.status !== 'open' || older.status !== 'open' || newer.deleted || older.deleted) {
    return newer;
  }
  const byKey = new Map<string, LineItem>();
  for (const li of newer.items) byKey.set(lineKey(li), li);
  for (const li of older.items) {
    const k = lineKey(li);
    if (!byKey.has(k)) byKey.set(k, li); // line only on the other device — keep it
  }
  return { ...newer, items: [...byKey.values()] };
}

/**
 * Merge two tab lists entity-by-entity: for each id, reconcile the two versions
 * (see reconcileTab). Old tombstones are dropped. This replaces the old
 * whole-array last-write-wins that let a stale device overwrite completed tabs
 * and let concurrent edits clobber each other.
 */
export function mergeTabs(remote: Tab[], local: Tab[]): Tab[] {
  const byId = new Map<string, Tab>();
  for (const t of local) byId.set(t.id, t);
  for (const t of remote) {
    const cur = byId.get(t.id);
    byId.set(t.id, cur ? reconcileTab(cur, t) : t);
  }
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  return [...byId.values()].filter(t => !(t.deleted && tabStamp(t) < cutoff));
}

class Store {
  readonly settings = new StorageSlice<Settings>('denz.settings', CURRENT_SCHEMA, () => SEED_SETTINGS);
  readonly staff    = new StorageSlice<Staff[]>('denz.staff',    CURRENT_SCHEMA, () => SEED_STAFF);
  readonly products = new StorageSlice<Product[]>(
    'denz.products', CURRENT_SCHEMA, () => SEED_PRODUCTS,
    undefined,
    // Strip base64 images before writing to Firestore — keeps the slice under 1 MB.
    // Images are written separately to `product-images/{id}`.
    (products) => products.map(({ image: _img, ...p }) => p as Product),
    // When a Firestore snapshot arrives (without images), restore local images.
    (remote, local) => {
      const localById = new Map(local.map(p => [p.id, p.image]));
      return remote.map(p => ({ ...p, image: localById.get(p.id) ?? p.image }));
    },
  );
  readonly modifierGroups = new StorageSlice<ModifierGroup[]>('denz.modifierGroups', CURRENT_SCHEMA, () => SEED_MODIFIER_GROUPS);
  readonly tabs     = new StorageSlice<Tab[]>(
    'denz.tabs', CURRENT_SCHEMA, () => SEED_TABS,
    undefined,   // migrate
    undefined,   // firestoreTransform
    undefined,   // firestoreRecvMerge
    mergeTabs,   // entityMerge — per-tab conflict resolution across devices
  );
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

    // Auto-stamp tab mutations (must run before the BroadcastChannel wrap so
    // that wrap composes on top of the stamping set).
    this.applyTabStamping();

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

  /**
   * Wrap `tabs.set` so every mutation stamps changed/created tabs with a fresh
   * `updatedAt`, and converts any removed tab into a soft-delete tombstone.
   * This centralizes the per-tab timestamping the Firestore merge relies on, so
   * individual call sites don't have to remember to set it. Unchanged tabs keep
   * their object identity (updaters return the same reference for untouched
   * rows) and are left alone.
   */
  private applyTabStamping() {
    const slice = this.tabs;
    const original = slice.set.bind(slice);
    slice.set = (updater: Tab[] | ((prev: Tab[]) => Tab[])) => {
      original((prev: Tab[]) => {
        const next = typeof updater === 'function'
          ? (updater as (p: Tab[]) => Tab[])(prev)
          : updater;
        const now = new Date();
        const prevById = new Map(prev.map(t => [t.id, t]));
        // Stamp new or modified tabs (identity change signals a mutation).
        const stamped = next.map(t => {
          const old = prevById.get(t.id);
          return old === t ? t : { ...t, updatedAt: now };
        });
        // Any tab present before but gone now becomes a tombstone so the
        // deletion propagates instead of being silently resurrected elsewhere.
        const nextIds = new Set(next.map(t => t.id));
        const tombstones = prev
          .filter(t => !nextIds.has(t.id) && !t.deleted)
          .map(t => ({ ...t, deleted: true, updatedAt: now }));
        return tombstones.length ? [...stamped, ...tombstones] : stamped;
      });
    };
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
