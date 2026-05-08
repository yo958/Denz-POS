// ─────────────────────────────────────────────────────────────────
// Backup: export / import the entire local store as one JSON blob.
// ─────────────────────────────────────────────────────────────────

import type {
  AuditEntry, KitchenTicket, Product, Settings, Shift, Staff, Stay, Tab,
} from '../types';
import { getStore } from './store';
import { json } from './storage';

const SCHEMA = 1;

export interface Backup {
  schema: number;
  exportedAt: Date;
  appVersion: string;
  data: {
    settings: Settings;
    staff: Staff[];
    products: Product[];
    tabs: Tab[];
    stays: Stay[];
    shift: Shift | null;
    tickets: KitchenTicket[];
    audit: AuditEntry[];
  };
}

export function exportBackup(): Backup {
  const s = getStore();
  return {
    schema: SCHEMA,
    exportedAt: new Date(),
    appVersion: '1.0.0',
    data: {
      settings: s.settings.get(),
      staff:    s.staff.get(),
      products: s.products.get(),
      tabs:     s.tabs.get(),
      stays:    s.stays.get(),
      shift:    s.shift.get(),
      tickets:  s.tickets.get(),
      audit:    s.audit.get(),
    },
  };
}

export function exportBackupAsString(): string {
  return json.stringify(exportBackup());
}

export function downloadBackup() {
  const blob = new Blob([exportBackupAsString()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `denz-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  getStore().log('data.export', 'Backup exported');
}

export function importBackupFromString(raw: string): { ok: true } | { ok: false; error: string } {
  let parsed: Backup;
  try {
    parsed = json.parse<Backup>(raw);
  } catch (e) {
    return { ok: false, error: `Not valid JSON (${(e as Error).message})` };
  }
  if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || !('schema' in parsed)) {
    return { ok: false, error: 'File is not a Denz POS backup' };
  }
  if (parsed.schema !== SCHEMA) {
    return { ok: false, error: `Backup schema v${parsed.schema} is not supported (expected v${SCHEMA})` };
  }
  const s = getStore();
  s.settings.rawWrite(parsed.data.settings);
  s.staff.rawWrite(parsed.data.staff);
  s.products.rawWrite(parsed.data.products);
  s.tabs.rawWrite(parsed.data.tabs);
  s.stays.rawWrite(parsed.data.stays);
  s.shift.rawWrite(parsed.data.shift);
  s.tickets.rawWrite(parsed.data.tickets);
  s.audit.rawWrite(parsed.data.audit);
  s.log('data.import', `Backup imported (${parsed.data.tabs.length} tabs, ${parsed.data.products.length} products)`);
  return { ok: true };
}
