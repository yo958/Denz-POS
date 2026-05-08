'use client';

import { useRef, useState } from 'react';
import { Save, Upload, Download, Trash2, KeyRound, UserPlus, AlertTriangle } from 'lucide-react';
import { useSettings, useStaff, useCurrentStaff } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { downloadBackup, importBackupFromString } from '@/lib/store/backup';
import { hashPin, newSalt } from '@/lib/domain/auth';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { newId } from '@/lib/domain/id';
import type { Settings, Staff, StaffRole } from '@/lib/types';

export default function SettingsPage() {
  const settings = useSettings();
  const staff = useStaff();
  const me = useCurrentStaff();
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Settings>(settings);
  const [dirty, setDirty] = useState(false);

  function update(patch: Partial<Settings>) {
    setDraft(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }
  function updateVenue(patch: Partial<Settings['venue']>) {
    setDraft(prev => ({ ...prev, venue: { ...prev.venue, ...patch } }));
    setDirty(true);
  }
  function updateReceipt(patch: Partial<Settings['receipt']>) {
    setDraft(prev => ({ ...prev, receipt: { ...prev.receipt, ...patch } }));
    setDirty(true);
  }
  function updateDevice(patch: Partial<Settings['device']>) {
    setDraft(prev => ({ ...prev, device: { ...prev.device, ...patch } }));
    setDirty(true);
  }

  function save() {
    getStore().settings.set(() => draft);
    getStore().log('settings.update', 'Settings updated', me?.id);
    setDirty(false);
    toast.success('Settings saved');
  }

  /* ── Staff ─────────────────────────── */
  async function resetPin(s: Staff) {
    const pin = window.prompt(`New 4-digit PIN for ${s.name}:`);
    if (!pin || !/^\d{4}$/.test(pin)) { toast.error('PIN must be 4 digits'); return; }
    const ok = await confirm({
      title: `Reset PIN for ${s.name}?`,
      requireManagerPin: true,
      danger: true,
      confirmLabel: 'Reset',
    });
    if (!ok) return;
    const salt = newSalt();
    const hash = await hashPin(pin, salt);
    getStore().staff.set(prev => prev.map(x => x.id === s.id ? { ...x, pinSalt: salt, pinHash: hash } : x));
    getStore().log('staff.update', `PIN reset for ${s.name}`, me?.id);
    toast.success('PIN updated');
  }

  async function addStaff() {
    const name = window.prompt('Name?');
    if (!name) return;
    const role = window.prompt('Role? (manager / staff)', 'staff') as StaffRole;
    if (role !== 'manager' && role !== 'staff') { toast.error('Invalid role'); return; }
    const pin = window.prompt('4-digit PIN?');
    if (!pin || !/^\d{4}$/.test(pin)) { toast.error('PIN must be 4 digits'); return; }
    const ok = await confirm({ title: 'Create staff?', requireManagerPin: true, confirmLabel: 'Create' });
    if (!ok) return;
    const salt = newSalt();
    const hash = await hashPin(pin, salt);
    const initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    const newStaff: Staff = { id: newId('staff'), name, role, initials, pinHash: hash, pinSalt: salt };
    getStore().staff.set(prev => [...prev, newStaff]);
    getStore().log('staff.create', `${name} (${role})`, me?.id);
    toast.success(`${name} added`);
  }

  async function archiveStaff(s: Staff) {
    if (s.id === me?.id) { toast.error("Can't archive yourself"); return; }
    const ok = await confirm({ title: `Archive ${s.name}?`, requireManagerPin: true, danger: true, confirmLabel: 'Archive' });
    if (!ok) return;
    getStore().staff.set(prev => prev.map(x => x.id === s.id ? { ...x, archived: true } : x));
    getStore().log('staff.delete', s.name, me?.id);
    toast.success('Archived');
  }

  /* ── Backup ────────────────────────── */
  function handleExport() {
    downloadBackup();
    toast.success('Backup downloaded');
  }
  function handleImportClick() { fileRef.current?.click(); }
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = await confirm({
      title: 'Replace all data?',
      message: 'This will overwrite all tabs, products, settings, and staff with the contents of the backup.',
      requireManagerPin: true, danger: true, confirmLabel: 'Restore',
    });
    if (!ok) return;
    const text = await file.text();
    const r = importBackupFromString(text);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success('Backup restored');
  }
  async function handleWipe() {
    const ok = await confirm({
      title: 'Factory reset?',
      message: 'This deletes ALL local data and reseeds the demo. Cannot be undone. Export a backup first.',
      requireManagerPin: true, danger: true, confirmLabel: 'Wipe everything',
    });
    if (!ok) return;
    getStore().wipe();
    getStore().log('data.wipe', 'Factory reset');
    toast.success('Factory reset complete');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Venue, tax, staff, devices, and data</p>
        </div>
        {dirty && (
          <button onClick={save} className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">
            <Save size={14} /> Save Changes
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">

        <Section title="Venue">
          <Field label="Name"><input value={draft.venue.name} onChange={e => updateVenue({ name: e.target.value })} className={inputCls} /></Field>
          <Field label="Address"><input value={draft.venue.address} onChange={e => updateVenue({ address: e.target.value })} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input value={draft.venue.phone} onChange={e => updateVenue({ phone: e.target.value })} className={inputCls} /></Field>
            <Field label="ABN"><input value={draft.venue.abn} onChange={e => updateVenue({ abn: e.target.value })} className={inputCls} /></Field>
          </div>
        </Section>

        <Section title="Tax">
          <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-white/50 dark:bg-white/5 cursor-pointer">
            <span className="text-sm font-medium">Charge tax on sales</span>
            <input
              type="checkbox"
              checked={draft.taxEnabled !== false}
              onChange={e => update({ taxEnabled: e.target.checked })}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </label>
          <div className={`grid grid-cols-2 gap-3 transition-opacity ${draft.taxEnabled === false ? 'opacity-50 pointer-events-none' : ''}`}>
            <Field label="Tax label"><input value={draft.taxLabel} onChange={e => update({ taxLabel: e.target.value })} className={inputCls} /></Field>
            <Field label="Tax rate (%)"><input type="number" min={0} max={100} step={0.1} value={(draft.taxRate * 100).toFixed(1)} onChange={e => update({ taxRate: Math.max(0, Math.min(1, parseFloat(e.target.value) / 100)) })} className={inputCls + ' tabular-nums'} /></Field>
          </div>
        </Section>

        <Section title="Currency">
          <Field label="Currency symbol">
            <input value={draft.currency} maxLength={3} onChange={e => update({ currency: e.target.value })} className={inputCls + ' max-w-[8rem]'} />
          </Field>
        </Section>

        <Section title="Receipt">
          <Field label="Header"><input value={draft.receipt.header} onChange={e => updateReceipt({ header: e.target.value })} className={inputCls} /></Field>
          <Field label="Footer"><input value={draft.receipt.footer} onChange={e => updateReceipt({ footer: e.target.value })} className={inputCls} /></Field>
        </Section>

        <Section title="Devices">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Idle auto-lock (minutes, 0 = never)">
              <input type="number" min={0} max={120} step={1} value={draft.device.idleLockMinutes} onChange={e => updateDevice({ idleLockMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })} className={inputCls + ' tabular-nums'} />
            </Field>
            <Field label="Kitchen ticket sound">
              <button type="button" onClick={() => updateDevice({ kdsSound: !draft.device.kdsSound })} className={`h-10 px-3 rounded-xl border border-border text-sm font-medium ${draft.device.kdsSound ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-white/50 dark:bg-white/5 text-muted-foreground'}`}>
                {draft.device.kdsSound ? 'On' : 'Off'}
              </button>
            </Field>
          </div>
        </Section>

        <Section
          title="Staff"
          action={<button onClick={addStaff} className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer"><UserPlus size={12} /> Add</button>}
        >
          <div className="rounded-xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
            {staff.filter(s => !s.archived).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary text-xs font-bold">{s.initials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.name}{s.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p>
                  <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                </div>
                <button onClick={() => resetPin(s)} className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
                  <KeyRound size={11} /> Reset PIN
                </button>
                {s.id !== me?.id && (
                  <button onClick={() => archiveStaff(s)} aria-label={`Archive ${s.name}`} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Data">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={handleExport} className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-border bg-white/50 dark:bg-white/5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
              <Download size={14} /> Export Backup
            </button>
            <button onClick={handleImportClick} className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-border bg-white/50 dark:bg-white/5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
              <Upload size={14} /> Restore Backup
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
            <button onClick={handleWipe} className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 text-sm font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/20 cursor-pointer">
              <AlertTriangle size={14} /> Factory Reset
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Backups are local-only JSON files. Keep one off-device.</p>
        </Section>

      </div>
    </div>
  );
}

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring';

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
