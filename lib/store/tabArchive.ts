// ─────────────────────────────────────────────────────────────────
// Tab archive — immutable settled-tab history stored as INDIVIDUAL
// Firestore documents (one per tab) instead of a single blob.
//
// Why: the live `tabs` slice syncs its whole array into one Firestore
// document, which is capped at 1 MB. Paid tabs are never mutated again but
// were accumulating in that one document forever, and once it crossed 1 MB
// every write was silently rejected — freezing cross-device sync. Settled
// tabs now live here, one small document each (no combined size limit), and
// the live slice only syncs the small working set (see `tabsFirestoreTransform`
// in store.ts). Readers fold this archive back into the in-memory list via
// `StorageSlice.absorb`, so History / Reports / Customers see the full history.
// ─────────────────────────────────────────────────────────────────

'use client';

import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { json } from './storage';
import type { Tab } from '../types';

const ARCHIVE_SCHEMA = 1;
const archiveCol = () => collection(db, 'stores', 'default', 'tab-archive');
const archiveDoc = (id: string) => doc(db, 'stores', 'default', 'tab-archive', id);

/** id -> updatedAt(ms) of what we've already written, so repeated sweeps skip
 *  unchanged tabs and don't hammer Firestore. Cached in localStorage. */
const KNOWN_KEY = 'denz.tabArchive.known';

function loadKnown(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(KNOWN_KEY) || '{}'); } catch { return {}; }
}
function saveKnown(m: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KNOWN_KEY, JSON.stringify(m)); } catch { /* quota — ignore */ }
}
let known = loadKnown();

function stampMs(t: Tab): number {
  const d = (t.updatedAt ?? t.paidAt ?? t.openedAt) as unknown as string | Date | undefined;
  const ms = d ? new Date(d).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/** A tab belongs in the archive once it is settled (paid or refunded) and not
 *  a deletion tombstone. Open tabs stay only in the live slice. */
function isSettled(t: Tab): boolean {
  return !t.deleted && (t.status === 'paid' || t.status === 'refunded');
}

/**
 * Load the entire tab archive into a Tab[]. Best-effort: on any failure returns
 * what it has (or an empty array) so the app still works from the live slice.
 */
export async function loadArchive(): Promise<Tab[]> {
  try {
    const snap = await getDocs(archiveCol());
    const out: Tab[] = [];
    snap.forEach(d => {
      const data = d.data() as { serialized?: string } | undefined;
      if (!data?.serialized) return;
      try { out.push(json.parse<Tab>(data.serialized)); } catch { /* skip bad doc */ }
    });
    return out;
  } catch (e) {
    console.warn('[tabArchive] load failed', e);
    return [];
  }
}

/**
 * Persist settled tabs to the archive as individual documents. Idempotent and
 * deduped by `updatedAt`, so it's cheap to call on every tab mutation — only
 * genuinely new/changed settled tabs (e.g. a fresh payment, or a later refund)
 * produce a write. Fire-and-forget: this is history durability, not the
 * interactive hot path.
 */
export function upsertSettledTabs(tabs: Tab[]): void {
  if (typeof window === 'undefined') return;
  const pending = tabs.filter(t => isSettled(t) && known[t.id] !== stampMs(t));
  if (pending.length === 0) return;
  for (const t of pending) {
    const ms = stampMs(t);
    known[t.id] = ms; // optimistic — the write below is idempotent
    setDoc(archiveDoc(t.id), {
      v: ARCHIVE_SCHEMA,
      serialized: json.stringify(t),
      paidAtMs: t.paidAt ? new Date(t.paidAt as unknown as string).getTime() : ms,
      updatedAtMs: ms,
    }).catch(e => {
      console.warn('[tabArchive] write failed', t.id, e);
      delete known[t.id]; // let a later sweep retry
      saveKnown(known);
    });
  }
  saveKnown(known);
}
