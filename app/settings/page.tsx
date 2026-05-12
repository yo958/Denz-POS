'use client';

import { useRef, useState } from 'react';
import { Save, Upload, Download, Trash2, KeyRound, UserPlus, AlertTriangle, Plus, Pencil, X, Phone, Mail, Image as ImageIcon } from 'lucide-react';
import { useSettings, useStaff, useCurrentStaff, useModifierGroups } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { downloadBackup, importBackupFromString } from '@/lib/store/backup';
import { hashPin, newSalt } from '@/lib/domain/auth';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { newId } from '@/lib/domain/id';
import type { DayOfWeek, ModifierGroup, ModifierOption, Settings, Staff, StaffRole } from '@/lib/types';

export default function SettingsPage() {
  const settings = useSettings();
  const staff = useStaff();
  const me = useCurrentStaff();
  const fileRef = useRef<HTMLInputElement>(null);

  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">Manager access required.</p>
      </div>
    );
  }

  const [draft, setDraft] = useState<Settings>(settings);
  const [dirty, setDirty] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

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
  function updateHours(day: DayOfWeek, patch: Partial<{ open: string; close: string; closed: boolean }>) {
    const current = draft.venue.openingHours?.[day] ?? { open: '09:00', close: '22:00', closed: false };
    setDraft(prev => ({
      ...prev,
      venue: {
        ...prev.venue,
        openingHours: { ...prev.venue.openingHours, [day]: { ...current, ...patch } } as Required<typeof prev.venue>['openingHours'],
      },
    }));
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

  function saveStaff(updated: Staff) {
    getStore().staff.set(prev => prev.map(x => x.id === updated.id ? updated : x));
    getStore().log('staff.update', updated.name, me?.id);
    toast.success('Staff updated');
    setEditingStaff(null);
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

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

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

        <Section title="Business Hours">
          <Field label="Timezone">
            <select value={draft.venue.timezone ?? 'Asia/Bangkok'} onChange={e => updateVenue({ timezone: e.target.value })} className={inputCls}>
              <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
              <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
              <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (UTC+8)</option>
              <option value="Asia/Jakarta">Asia/Jakarta (UTC+7)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
              <option value="Asia/Seoul">Asia/Seoul (UTC+9)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
              <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
              <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
              <option value="Europe/London">Europe/London (UTC+0/+1)</option>
              <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
              <option value="Europe/Berlin">Europe/Berlin (UTC+1/+2)</option>
              <option value="Australia/Sydney">Australia/Sydney (UTC+10/+11)</option>
              <option value="America/New_York">America/New_York (UTC-5/-4)</option>
              <option value="America/Chicago">America/Chicago (UTC-6/-5)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <div className="rounded-xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
            {((['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as DayOfWeek[])).map(day => {
              const h = draft.venue.openingHours?.[day] ?? { open: '10:00', close: '23:30', closed: false };
              return (
                <div key={day} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-24 text-sm font-medium capitalize shrink-0">{day}</span>
                  <div className={`flex items-center gap-2 flex-1 transition-opacity ${h.closed ? 'opacity-40 pointer-events-none' : ''}`}>
                    <input
                      type="time"
                      value={h.open}
                      onChange={e => updateHours(day, { open: e.target.value })}
                      className="h-8 px-2 rounded-lg text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <input
                      type="time"
                      value={h.close}
                      onChange={e => updateHours(day, { close: e.target.value })}
                      className="h-8 px-2 rounded-lg text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateHours(day, { closed: !h.closed })}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                      h.closed
                        ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400'
                        : 'border-border bg-white/50 dark:bg-white/5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/8'
                    }`}
                  >
                    {h.closed ? 'Closed' : 'Open'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">These hours sync to the website and are shown in the footer, contact page, and map.</p>
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
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 overflow-hidden">
                  {s.image
                    ? <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                    : <span className="text-primary text-xs font-bold">{s.initials}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.name}{s.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground capitalize">{s.role}{s.contact?.phone && ` · ${s.contact.phone}`}</span>
                    {s.contact?.phone && (
                      <a href={`tel:${s.contact.phone}`} aria-label="Call" className="text-muted-foreground hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
                        <Phone size={11} />
                      </a>
                    )}
                    {s.contact?.email && (
                      <a href={`mailto:${s.contact.email}`} aria-label="Email" className="text-muted-foreground hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
                        <Mail size={11} />
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={() => setEditingStaff(s)} aria-label={`Edit ${s.name}`} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                  <Pencil size={13} />
                </button>
                <button onClick={() => resetPin(s)} className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
                  <KeyRound size={11} /> PIN
                </button>
                {s.id !== me?.id && (
                  <button onClick={() => archiveStaff(s)} aria-label={`Archive ${s.name}`} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editingStaff && (
            <StaffEditDialog
              staff={editingStaff}
              onClose={() => setEditingStaff(null)}
              onSave={saveStaff}
            />
          )}
        </Section>

        <ModifierGroupsSection />

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

/* ── Staff Edit Dialog ─────────────────────────────────────── */

interface StaffEditDialogProps {
  staff: Staff;
  onClose: () => void;
  onSave: (s: Staff) => void;
}

function StaffEditDialog({ staff, onClose, onSave }: StaffEditDialogProps) {
  const [form, setForm] = useState<Staff>(staff);
  const imgRef = useRef<HTMLInputElement>(null);

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { toast.error('Name required'); return; }
    const initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    onSave({ ...form, name, initials });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <h2 className="text-lg font-semibold">Edit staff</h2>

        {/* Photo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => imgRef.current?.click()}
            className="relative w-16 h-16 rounded-2xl bg-primary/10 overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border border-border"
          >
            {form.image
              ? <img src={form.image} alt={form.name} className="w-full h-full object-cover" />
              : <span className="text-primary text-lg font-bold">{form.initials}</span>
            }
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
              <ImageIcon size={16} className="text-white" />
            </div>
          </button>
          <input ref={imgRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
          <div className="flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Photo</p>
            <p className="text-xs text-muted-foreground">Click photo to upload</p>
            {form.image && (
              <button type="button" onClick={() => setForm(f => ({ ...f, image: undefined }))} className="text-xs text-rose-500 hover:text-rose-600 cursor-pointer">Remove</button>
            )}
          </div>
        </div>

        <Field label="Name">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus className={inputCls} />
        </Field>

        <Field label="Role">
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as StaffRole }))} className={inputCls}>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select>
        </Field>

        <Field label="Phone">
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="tel"
              value={form.contact?.phone ?? ''}
              onChange={e => setForm(f => ({ ...f, contact: { ...f.contact, phone: e.target.value } }))}
              placeholder="+66 81 234 5678"
              className={inputCls + ' pl-8'}
            />
          </div>
        </Field>

        <Field label="Email">
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="email"
              value={form.contact?.email ?? ''}
              onChange={e => setForm(f => ({ ...f, contact: { ...f.contact, email: e.target.value } }))}
              placeholder="name@example.com"
              className={inputCls + ' pl-8'}
            />
          </div>
        </Field>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">Save</button>
        </div>
      </form>
    </div>
  );
}

/* ── Modifier Groups CRUD ──────────────────────────────────── */

function ModifierGroupsSection() {
  const groups = useModifierGroups();
  const [editing, setEditing] = useState<ModifierGroup | null>(null);
  const me = useCurrentStaff();

  function startNew() {
    setEditing({
      id: newId('mg'),
      name: '',
      type: 'single',
      required: false,
      options: [{ id: newId('mo'), name: '', priceDelta: 0 }],
    });
  }

  async function archive(g: ModifierGroup) {
    const ok = await confirm({
      title: `Archive “${g.name}”?`,
      message: 'Existing tabs will keep their existing modifiers, but new orders will not show this group.',
      confirmLabel: 'Archive',
      danger: true,
    });
    if (!ok) return;
    getStore().modifierGroups.set(prev => prev.map(x => x.id === g.id ? { ...x, archived: true } : x));
    getStore().log('modifier.delete', g.name, me?.id);
    toast.success('Group archived');
  }

  function unarchive(g: ModifierGroup) {
    getStore().modifierGroups.set(prev => prev.map(x => x.id === g.id ? { ...x, archived: false } : x));
    toast.success('Group restored');
  }

  return (
    <Section
      title="Modifier groups"
      action={
        <button onClick={startNew} className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
          <Plus size={12} /> Add group
        </button>
      }
    >
      <p className="text-xs text-muted-foreground -mt-1">Shared option lists (size, milk, extras…) you can attach to any product in Menu.</p>
      <div className="rounded-xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
        {groups.length === 0 && <p className="text-xs text-muted-foreground px-3 py-3">No groups yet.</p>}
        {groups.map(g => (
          <div key={g.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {g.name || <span className="italic text-muted-foreground">Untitled</span>}
                {g.archived && <span className="ml-2 text-[10px] uppercase font-bold text-muted-foreground">archived</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {g.type === 'single' ? `single${g.required ? ' · required' : ''}` : 'multi · optional'} · {g.options.filter(o => !o.archived).length} option{g.options.length === 1 ? '' : 's'}
              </p>
            </div>
            <button onClick={() => setEditing(g)} aria-label={`Edit ${g.name}`} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
              <Pencil size={13} />
            </button>
            {g.archived ? (
              <button onClick={() => unarchive(g)} className="h-8 px-2.5 rounded-lg text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
                Restore
              </button>
            ) : (
              <button onClick={() => archive(g)} aria-label={`Archive ${g.name}`} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <ModifierGroupDialog
          group={editing}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            getStore().modifierGroups.set(prev => {
              const idx = prev.findIndex(x => x.id === g.id);
              if (idx === -1) return [...prev, g];
              const next = prev.slice();
              next[idx] = g;
              return next;
            });
            getStore().log(groups.some(x => x.id === g.id) ? 'modifier.update' : 'modifier.create', g.name, me?.id);
            toast.success('Group saved');
            setEditing(null);
          }}
        />
      )}
    </Section>
  );
}

interface ModifierGroupDialogProps {
  group: ModifierGroup;
  onClose: () => void;
  onSave: (g: ModifierGroup) => void;
}

function ModifierGroupDialog({ group, onClose, onSave }: ModifierGroupDialogProps) {
  const [form, setForm] = useState<ModifierGroup>(group);

  function patchOption(id: string, patch: Partial<ModifierOption>) {
    setForm(f => ({ ...f, options: f.options.map(o => o.id === id ? { ...o, ...patch } : o) }));
  }
  function addOption() {
    setForm(f => ({ ...f, options: [...f.options, { id: newId('mo'), name: '', priceDelta: 0 }] }));
  }
  function removeOption(id: string) {
    setForm(f => ({
      ...f,
      options: f.options.filter(o => o.id !== id),
      defaultOptionId: f.defaultOptionId === id ? undefined : f.defaultOptionId,
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    const opts = form.options
      .map(o => ({ ...o, name: o.name.trim() }))
      .filter(o => o.name.length > 0);
    if (opts.length === 0) { toast.error('At least one option required'); return; }
    if (form.type === 'single' && form.required && !opts.some(o => o.id === form.defaultOptionId)) {
      // Fall back to first option as default if none chosen
      onSave({ ...form, name: form.name.trim(), options: opts, defaultOptionId: opts[0].id });
      return;
    }
    onSave({ ...form, name: form.name.trim(), options: opts });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">Modifier group</h2>

        <Field label="Name">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as ModifierGroup['type'] })}
              className={inputCls}
            >
              <option value="single">Single (radio)</option>
              <option value="multi">Multi (checkbox)</option>
            </select>
          </Field>
          {form.type === 'single' && (
            <Field label="Required">
              <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-black/5 dark:bg-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.required}
                  onChange={e => setForm({ ...form, required: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm">Customer must pick one</span>
              </label>
            </Field>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Options</span>
            <button type="button" onClick={addOption} className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
              <Plus size={11} /> Add option
            </button>
          </div>
          <div className="space-y-1.5">
            {form.options.map(o => (
              <div key={o.id} className="flex items-center gap-2">
                {form.type === 'single' && (
                  <input
                    type="radio"
                    name="default-opt"
                    aria-label="Default"
                    checked={form.defaultOptionId === o.id}
                    onChange={() => setForm({ ...form, defaultOptionId: o.id })}
                    className="w-4 h-4 accent-primary"
                  />
                )}
                <input
                  value={o.name}
                  onChange={e => patchOption(o.id, { name: e.target.value })}
                  placeholder="Option name"
                  className="flex-1 h-9 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => removeOption(o.id)}
                  aria-label="Remove option"
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          {form.type === 'single' && (
            <p className="text-[11px] text-muted-foreground">Tip: select the radio next to an option to make it the default.</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">Save</button>
        </div>
      </form>
    </div>
  );
}


