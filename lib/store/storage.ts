// ─────────────────────────────────────────────────────────────────
// Typed localStorage with Date round-tripping + versioning + pub/sub
// ─────────────────────────────────────────────────────────────────

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
        this.persist(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw, reviver) as Envelope<unknown>;
      if (!parsed || typeof parsed !== 'object' || !('v' in parsed)) {
        const seeded = this.initial();
        this.persist(seeded);
        return seeded;
      }
      if (parsed.v !== this.version) {
        const migrated = this.migrate
          ? this.migrate(parsed.v, parsed.data)
          : this.initial();
        this.persist(migrated);
        return migrated;
      }
      return parsed.data as T;
    } catch {
      const seeded = this.initial();
      this.persist(seeded);
      return seeded;
    }
  }

  private persist(value: T) {
    if (typeof window === 'undefined') return;
    const env: Envelope<T> = { v: this.version, data: value };
    try {
      window.localStorage.setItem(this.key, JSON.stringify(env, replacer));
    } catch (e) {
      // Quota exceeded or serialisation error — surface to console; data is in-memory.
      console.error(`[storage] failed to persist ${this.key}`, e);
    }
  }

  get(): T {
    return this.cache;
  }

  set(updater: T | ((prev: T) => T)) {
    const next = typeof updater === 'function'
      ? (updater as (p: T) => T)(this.cache)
      : updater;
    this.cache = next;
    this.persist(next);
    this.listeners.forEach(l => l());
  }

  /** Force re-read from storage (used by BroadcastChannel sync). */
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
    this.persist(data);
    this.listeners.forEach(l => l());
  }

  get storageKey(): string {
    return this.key;
  }
}

/** Serialize/deserialize a Date-aware value (used by backup). */
export const json = {
  stringify: <T>(v: T) => JSON.stringify(v, replacer),
  parse: <T>(s: string): T => JSON.parse(s, reviver) as T,
};
