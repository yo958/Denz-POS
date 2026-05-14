// ─────────────────────────────────────────────────────────────────
// Typed localStorage with Date round-tripping + versioning + pub/sub
// + optional Firestore real-time sync (write-through, offline-first)
// ─────────────────────────────────────────────────────────────────

import type { DocumentReference } from 'firebase/firestore';

const DATE_TAG = '__d';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function replacer(_: string, v: unknown) {
  if (v instanceof Date) return { [DATE_TAG]: v.toISOString() };
  return v;
}
function reviver(_: string, v: unknown) {
  if (typeof v === 'string' && ISO_DATE_RE.test(v)) return new Date(v);
  if (v && typeof v === 'object' && DATE_TAG in (v as Record<string, unknown>)) {
    const iso = (v as Record<string, unknown>)[DATE_TAG];
    if (typeof iso === 'string') return new Date(iso);
  }
  return v;
}

interface Envelope<T> {
  v: number;
  data: T;
}

export class StorageSlice<T> {
  private cache: T;
  private listeners = new Set<() => void>();
  private firestoreUnsub?: () => void;
  private firestoreDoc?: DocumentReference;
  private _suppressFirestoreWrite = false;
  // Timestamp of our last write to Firestore. Used to reject stale remote
  // snapshots that arrive after a local write (race condition guard).
  private _lastLocalWriteAt = 0;

  constructor(
    private readonly key: string,
    private readonly version: number,
    private readonly initial: () => T,
    private readonly migrate?: (oldVersion: number, oldData: unknown) => T,
  ) {
    this.cache = this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', e => {
        if (e.key === this.key) {
          this.cache = this.load();
          this.listeners.forEach(l => l());
        }
      });
    }
  }

  private load(): T {
    if (typeof window === 'undefined') return this.initial();
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) {
        const seeded = this.initial();
        this.localPersist(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw, reviver) as Envelope<unknown>;
      if (!parsed || typeof parsed !== 'object' || !('v' in parsed)) {
        const seeded = this.initial();
        this.localPersist(seeded);
        return seeded;
      }
      if (parsed.v !== this.version) {
        const migrated = this.migrate
          ? this.migrate(parsed.v, parsed.data)
          : this.initial();
        this.localPersist(migrated);
        return migrated;
      }
      return parsed.data as T;
    } catch {
      const seeded = this.initial();
      this.localPersist(seeded);
      return seeded;
    }
  }

  private localPersist(value: T) {
    if (typeof window === 'undefined') return;
    const env: Envelope<T> = { v: this.version, data: value };
    try {
      window.localStorage.setItem(this.key, JSON.stringify(env, replacer));
    } catch (e) {
      console.error(`[storage] failed to persist ${this.key}`, e);
    }
  }

  private firestorePersist(value: T) {
    if (!this.firestoreDoc) return;
    // Serialize with our custom replacer so Dates survive the round-trip
    const serialized = JSON.stringify(value, replacer);
    // Record write time BEFORE the async import so the guard is set
    // even if the import takes a moment to resolve.
    this._lastLocalWriteAt = Date.now();
    const writtenAt = this._lastLocalWriteAt;
    import('firebase/firestore').then(({ setDoc }) => {
      setDoc(this.firestoreDoc!, { v: this.version, serialized, writtenAt })
        .catch(e => console.warn(`[firestore] write error for ${this.key}`, e));
    });
  }

  get(): T {
    return this.cache;
  }

  set(updater: T | ((prev: T) => T)) {
    const next = typeof updater === 'function'
      ? (updater as (p: T) => T)(this.cache)
      : updater;
    this.cache = next;
    this.localPersist(next);
    this.firestorePersist(next);
    this.listeners.forEach(l => l());
  }

  /** Force re-read from localStorage (used by BroadcastChannel sync). */
  refresh() {
    this.cache = this.load();
    this.listeners.forEach(l => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** For backup/import — raw read/write of the whole envelope. */
  rawWrite(data: T) {
    this.cache = data;
    this.localPersist(data);
    this.firestorePersist(data); // sets _lastLocalWriteAt internally
    this.listeners.forEach(l => l());
  }

  get storageKey(): string {
    return this.key;
  }

  /**
   * Connect this slice to a Firestore document for real-time multi-device sync.
   * Firestore is the source of truth when online; localStorage is the offline cache.
   */
  connectFirestore(docRef: DocumentReference) {
    this.firestoreDoc = docRef;

    import('firebase/firestore').then(({ onSnapshot }) => {
      this.firestoreUnsub = onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        (snap) => {
          // Skip snapshots caused by our own pending writes to avoid loops
          if (snap.metadata.hasPendingWrites) return;
          if (!snap.exists()) {
            // No remote data yet — push our local data up
            this.firestorePersist(this.cache);
            return;
          }
          const remote = snap.data() as { v: number; serialized: string; writtenAt?: number } | null;
          if (!remote?.serialized) return;
          // Reject snapshots that are older than our last local write.
          // This prevents a stale write from another device (or a slow
          // Firestore delivery) from overwriting a more-recent local change
          // (e.g. a tab being marked paid and then reverting to open).
          const remoteWrittenAt = remote.writtenAt ?? 0;
          if (this._lastLocalWriteAt > 0 && remoteWrittenAt < this._lastLocalWriteAt) {
            return;
          }
          try {
            const parsed = JSON.parse(remote.serialized, reviver) as T;
            this._suppressFirestoreWrite = true;
            this.cache = parsed;
            this.localPersist(parsed);
            this.listeners.forEach(l => l());
          } catch (e) {
            console.warn(`[firestore] parse error for ${this.key}`, e);
          } finally {
            this._suppressFirestoreWrite = false;
          }
        },
        (err) => console.warn(`[firestore] listener error for ${this.key}`, err),
      );
    });
  }

  disconnectFirestore() {
    this.firestoreUnsub?.();
    this.firestoreUnsub = undefined;
    this.firestoreDoc = undefined;
  }
}

/** Serialize/deserialize a Date-aware value (used by backup). */
export const json = {
  stringify: <T>(v: T) => JSON.stringify(v, replacer),
  parse: <T>(s: string): T => JSON.parse(s, reviver) as T,
};
