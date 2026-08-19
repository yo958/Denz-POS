// One-time migration: move settled (paid/refunded) tabs out of the single
// oversized `stores/default/slices/tabs` document and into individual documents
// under `stores/default/tab-archive/{id}`, then rewrite the live slice with only
// the working set. This immediately drops the live document back under
// Firestore's 1 MB limit, restoring cross-device tab sync.
//
// Idempotent: safe to run more than once. Run AFTER the new client code is
// deployed and both devices have reloaded.
//
//   node --env-file .env.local scripts/migrate-tab-archive.mjs         # dry run
//   node --env-file .env.local scripts/migrate-tab-archive.mjs --write # apply

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const WRITE = process.argv.includes('--write');
const LIVE_PAID_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const now = Date.now();

const app = getApps().find(a => a.name === 'migrate')
  ?? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) }, 'migrate');
const db = getFirestore(app);

// ── Date handling mirrors lib/store/storage.ts (replacer / reviver / stamp) ──
const DATE_TAG = '__d';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const replacer = (_k, v) => (v instanceof Date ? { [DATE_TAG]: v.toISOString() } : v);
const reviver = (_k, v) => {
  if (typeof v === 'string' && ISO_DATE_RE.test(v)) return new Date(v);
  if (v && typeof v === 'object' && DATE_TAG in v && typeof v[DATE_TAG] === 'string') return new Date(v[DATE_TAG]);
  return v;
};
const asMs = (d) => {
  if (!d) return 0;
  const raw = (typeof d === 'object' && d[DATE_TAG]) ? d[DATE_TAG] : d;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
};
const stampMs = (t) => asMs(t.updatedAt) || asMs(t.paidAt) || asMs(t.openedAt);
const isSettled = (t) => !t.deleted && (t.status === 'paid' || t.status === 'refunded');

function keepInLiveSync(t) {
  if (t.status === 'open') return true;
  if (t.deleted) return stampMs(t) >= now - TOMBSTONE_TTL_MS;
  if (t.status === 'paid' || t.status === 'refunded') {
    if (t.bookingEndsAt && asMs(t.bookingEndsAt) > now) return true;
    const paidMs = asMs(t.paidAt) || stampMs(t);
    return paidMs >= now - LIVE_PAID_WINDOW_MS;
  }
  return true;
}

const liveRef = db.doc('stores/default/slices/tabs');
const snap = await liveRef.get();
if (!snap.exists) { console.log('No tabs slice — nothing to do.'); process.exit(0); }
const docData = snap.data();
const tabs = JSON.parse(docData.serialized, reviver);

const settled = tabs.filter(isSettled);
const working = tabs.filter(keepInLiveSync);
const beforeBytes = Buffer.byteLength(docData.serialized, 'utf8');
const afterSerialized = JSON.stringify(working, replacer);
const afterBytes = Buffer.byteLength(afterSerialized, 'utf8');

console.log(`Total tabs:        ${tabs.length}`);
console.log(`Settled → archive: ${settled.length}`);
console.log(`Working set kept:  ${working.length}`);
console.log(`Live doc size:     ${(beforeBytes / 1024).toFixed(1)} KB  →  ${(afterBytes / 1024).toFixed(1)} KB`);

if (!WRITE) { console.log('\nDRY RUN — re-run with --write to apply.'); process.exit(0); }

// 1) Write every settled tab as its own archive document (batched).
let batch = db.batch();
let n = 0, total = 0;
for (const t of settled) {
  batch.set(db.doc(`stores/default/tab-archive/${t.id}`), {
    v: 1,
    serialized: JSON.stringify(t, replacer),
    paidAtMs: asMs(t.paidAt) || stampMs(t),
    updatedAtMs: stampMs(t),
  });
  if (++n === 400) { await batch.commit(); total += n; n = 0; batch = db.batch(); console.log(`  archived ${total}...`); }
}
if (n) { await batch.commit(); total += n; }
console.log(`Archived ${total} settled tabs.`);

// 2) Rewrite the live slice with only the working set.
await liveRef.set({ v: docData.v ?? 1, serialized: afterSerialized, writtenAt: now });
console.log(`Live tabs document rewritten to ${(afterBytes / 1024).toFixed(1)} KB. Sync restored.`);
