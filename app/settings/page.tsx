'use client';

import { useEffect, useRef, useState } from 'react';
import { Save, Upload, Download, Trash2, KeyRound, UserPlus, AlertTriangle, Plus, Pencil, X, Phone, Mail, Image as ImageIcon, RefreshCw, Eye, EyeOff, Sparkles, Check, Sun, Moon, Monitor, Globe, EyeOff as SearchOff, Star, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSettings, useStaff, useCurrentStaff, useModifierGroups } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { downloadBackup, importBackupFromString } from '@/lib/store/backup';
import { hashPin, newSalt } from '@/lib/domain/auth';
import { createStaffAccount, sendPasswordReset } from '@/lib/firebase';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { newId } from '@/lib/domain/id';
import type { DayOfWeek, GoogleReview, GoogleReviewSettings, ModifierGroup, ModifierOption, ReviewTag, Settings, Staff, StaffRole } from '@/lib/types';

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

  const [addingStaff, setAddingStaff] = useState(false);

  async function addStaff() { setAddingStaff(true); }

  async function resetPassword(s: Staff) {
    const email = s.contact?.email;
    if (!email) { toast.error('No email on file for this staff member.'); return; }
    const ok = await confirm({ title: `Send password reset to ${s.name}?`, message: email, confirmLabel: 'Send' });
    if (!ok) return;
    try {
      await sendPasswordReset(email);
      toast.success('Password reset email sent');
    } catch {
      toast.error('Failed to send reset email');
    }
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

        <AppearanceSection />

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
                <button onClick={() => resetPin(s)} title="Reset PIN" className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
                  <KeyRound size={11} /> PIN
                </button>
                {s.contact?.email && (
                  <button onClick={() => resetPassword(s)} title="Send password reset email" className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                    <RefreshCw size={13} />
                  </button>
                )}
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
          {addingStaff && (
            <AddStaffDialog
              onClose={() => setAddingStaff(false)}
              onCreated={async (name, role, email, password, pin) => {
                const ok = await confirm({ title: 'Create staff member?', requireManagerPin: true, confirmLabel: 'Create' });
                if (!ok) return;
                let firebaseUid: string | undefined;
                try {
                  firebaseUid = await createStaffAccount(email, password);
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  if (msg.includes('email-already-in-use')) {
                    toast.error('A Firebase account with this email already exists.');
                  } else {
                    toast.error('Could not create Firebase account: ' + msg.replace('Firebase: ', '').split(' (auth/')[0]);
                  }
                  return;
                }
                const salt = newSalt();
                const hash = await hashPin(pin, salt);
                const initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
                const newStaff: Staff = {
                  id: newId('staff'), name, role, initials, pinHash: hash, pinSalt: salt,
                  contact: { email }, firebaseUid,
                };
                getStore().staff.set(prev => [...prev, newStaff]);
                getStore().log('staff.create', `${name} (${role})`, me?.id);
                toast.success(`${name} added`);
                setAddingStaff(false);
              }}
            />
          )}
        </Section>

        <ModifierGroupsSection />

        <WebsiteSection />

        <OpenAISection />

        <GoogleReviewsSection />

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

/* ── Add Staff Dialog ──────────────────────────────────────── */

interface AddStaffDialogProps {
  onClose: () => void;
  onCreated: (name: string, role: StaffRole, email: string, password: string, pin: string) => Promise<void>;
}

function AddStaffDialog({ onClose, onCreated }: AddStaffDialogProps) {
  const [name, setName]         = useState('');
  const [role, setRole]         = useState<StaffRole>('staff');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin]           = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [busy, setBusy]         = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())            { toast.error('Name required'); return; }
    if (!email.trim())           { toast.error('Email required'); return; }
    if (password.length < 6)     { toast.error('Password must be at least 6 characters'); return; }
    if (!/^\d{4}$/.test(pin))    { toast.error('PIN must be exactly 4 digits'); return; }
    setBusy(true);
    try {
      await onCreated(name.trim(), role, email.trim().toLowerCase(), password, pin);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <h2 className="text-lg font-semibold">Add staff member</h2>

        <Field label="Name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="Full name"
            className={inputCls}
          />
        </Field>

        <Field label="Role">
          <select value={role} onChange={e => setRole(e.target.value as StaffRole)} className={inputCls}>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </select>
        </Field>

        <Field label="Email (Firebase login)">
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={inputCls + ' pl-8'}
            />
          </div>
        </Field>

        <Field label="Initial password (min 6 chars)">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={inputCls + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <Field label="4-digit PIN (idle lock)">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            autoComplete="new-password"
            className={inputCls + ' tracking-widest'}
          />
        </Field>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy} className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-60">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Appearance ─────────────────────────────────────────────────── */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options = [
    { value: 'light',  icon: Sun,     label: 'Light'  },
    { value: 'dark',   icon: Moon,    label: 'Dark'   },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const;

  return (
    <Section title="Appearance">
      <div className="flex items-center justify-between px-3 py-3 rounded-xl border border-border bg-white/50 dark:bg-white/5">
        <span className="text-sm text-muted-foreground">Theme</span>
        {mounted ? (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/8">
            {options.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={label}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                  theme === value
                    ? 'bg-white dark:bg-white/15 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={13} strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="h-10 w-48 rounded-xl bg-black/5 dark:bg-white/8 animate-pulse" />
        )}
      </div>
    </Section>
  );
}

/* ── Website Settings ───────────────────────────────────────────── */

function WebsiteSection() {
  const [noindex, setNoindex] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    fetch('/api/settings/website')
      .then(r => r.json())
      .then((d: { noindex?: boolean }) => { setNoindex(d.noindex ?? false); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  async function toggle() {
    const next = !noindex;
    setBusy(true);
    try {
      await fetch('/api/settings/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noindex: next }),
      });
      setNoindex(next);
      toast.success(next ? 'Search engines discouraged from indexing' : 'Search engine indexing enabled');
    } catch {
      toast.error('Failed to save setting');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <Section title="Website">
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-white/50 dark:bg-white/3">
        <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${noindex ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-emerald-100 dark:bg-emerald-900/20'}`}>
          <Globe size={16} className={noindex ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-0.5">Search Engine Visibility</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {noindex
              ? 'Search engines are discouraged from indexing the website. Enable this while the site is in development or before switching the domain.'
              : 'Search engines are allowed to index the website. Disable this before going live if the site is not ready.'}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={`shrink-0 px-3 h-8 rounded-xl text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
            noindex
              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 hover:bg-amber-100'
              : 'border-border bg-white/50 dark:bg-white/5 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          {busy ? '...' : noindex ? 'Discouraged' : 'Visible'}
        </button>
      </div>
      {noindex && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          Robots meta tag set to noindex,nofollow across the entire website.
        </p>
      )}
    </Section>
  );
}

/* ── OpenAI Settings ────────────────────────────────────────────── */

const OPENAI_MODELS: { value: string; label: string; note: string }[] = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini',  note: 'Fast & affordable — recommended' },
  { value: 'gpt-4o-mini',  label: 'GPT-4o Mini',   note: 'Budget option' },
  { value: 'gpt-4.1',      label: 'GPT-4.1',        note: 'Best quality, higher cost' },
  { value: 'gpt-4o',       label: 'GPT-4o',          note: 'High quality (legacy)' },
];

function OpenAISection() {
  const [key, setKey]         = useState('');
  const [masked, setMasked]   = useState('');
  const [hasKey, setHasKey]   = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [model, setModel]     = useState('gpt-4.1-mini');
  const [busy, setBusy]       = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    fetch('/api/settings/openai')
      .then(r => r.json())
      .then((d: { hasKey?: boolean; masked?: string; model?: string }) => {
        setHasKey(d.hasKey ?? false);
        setMasked(d.masked ?? '');
        setModel(d.model ?? 'gpt-4.1-mini');
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function saveKey() {
    if (!key.trim()) { toast.error('Enter an API key'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/settings/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key.trim(), model }),
      });
      if (!res.ok) {
        const d = await res.json() as { message?: string };
        toast.error(d.message ?? 'Failed to save key'); return;
      }
      const m = key.length > 8 ? `${key.slice(0, 7)}...${key.slice(-4)}` : '****';
      setMasked(m);
      setHasKey(true);
      setKey('');
      setShowKey(false);
      toast.success('OpenAI key saved');
    } catch {
      toast.error('Failed to save key');
    } finally {
      setBusy(false);
    }
  }

  async function saveModel(newModel: string) {
    setModel(newModel);
    setModelBusy(true);
    try {
      await fetch('/api/settings/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModel }),
      });
      toast.success('Model updated');
    } catch {
      toast.error('Failed to save model');
    } finally {
      setModelBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Remove OpenAI API key?')) return;
    await fetch('/api/settings/openai', { method: 'DELETE' });
    setHasKey(false);
    setMasked('');
    setKey('');
    toast.success('Key removed');
  }

  if (!loaded) return null;

  return (
    <Section title="AI Settings">
      <p className="text-xs text-muted-foreground -mt-1">
        Used by the Google Ads page to generate keyword and copy recommendations.{' '}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">Get an API key →</a>
      </p>

      {/* API Key */}
      {hasKey ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-white/50 dark:bg-white/5">
          <Sparkles size={14} className="text-violet-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">OpenAI key configured</p>
            <p className="text-xs text-muted-foreground font-mono">{masked}</p>
          </div>
          <Check size={14} className="text-emerald-500 shrink-0" />
          <button onClick={() => void remove()} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer">
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              className={inputCls + ' pl-8 pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              tabIndex={-1}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={() => void saveKey()}
            disabled={busy || !key.trim()}
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {/* Model selector */}
      <Field label="Model">
        <div className="relative">
          <select
            value={model}
            disabled={modelBusy}
            onChange={e => void saveModel(e.target.value)}
            className={inputCls + ' pr-8 disabled:opacity-60'}
          >
            {OPENAI_MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label} — {m.note}</option>
            ))}
          </select>
          {modelBusy && (
            <RefreshCw size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground pointer-events-none" />
          )}
        </div>
      </Field>
    </Section>
  );
}

/* ── Google Reviews ─────────────────────────────────────────── */

const REVIEW_TAGS: { value: ReviewTag; label: string }[] = [
  { value: 'food',       label: 'Food & Café' },
  { value: 'coworking',  label: 'Coworking' },
  { value: 'rooms',      label: 'Rooms' },
  { value: 'general',    label: 'General' },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={11} className={i < rating ? 'fill-amber-400 text-amber-400' : 'text-border'} />
      ))}
    </div>
  );
}

function GoogleReviewsSection() {
  const [cfg, setCfg] = useState<Partial<GoogleReviewSettings>>({
    maxReviews: 50, mediaOnly: true, minRating: 4, cacheTtlHours: 720, checkIntervalHours: 24,
  });
  const [apiKey, setApiKey]     = useState('');
  const [showKey, setShowKey]   = useState(false);
  const [hasKey, setHasKey]     = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [loaded, setLoaded]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [fetching, setFetching] = useState(false);
  const [reviews, setReviews]   = useState<GoogleReview[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [tagPopover, setTagPopover]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reviews/settings')
      .then(r => r.json())
      .then((d: Partial<GoogleReviewSettings> & { hasKey?: boolean; maskedKey?: string }) => {
        setHasKey(d.hasKey ?? false);
        setMaskedKey(d.maskedKey ?? '');
        setCfg({
          placeId: d.placeId ?? '',
          maxReviews: d.maxReviews ?? 50,
          mediaOnly: d.mediaOnly ?? true,
          minRating: d.minRating ?? 4,
          cacheTtlHours: d.cacheTtlHours ?? 720,
          checkIntervalHours: d.checkIntervalHours ?? 24,
          fetchedAt: d.fetchedAt ?? undefined,
          nextCheckAt: d.nextCheckAt ?? undefined,
          totalFetched: d.totalFetched ?? 0,
        });
        setReviews(d.reviews ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch('/api/reviews/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          placeId: cfg.placeId,
          maxReviews: cfg.maxReviews,
          mediaOnly: cfg.mediaOnly,
          minRating: cfg.minRating,
          cacheTtlHours: cfg.cacheTtlHours,
          checkIntervalHours: cfg.checkIntervalHours,
        }),
      });
      if (apiKey.trim()) {
        const k = apiKey.trim();
        setMaskedKey(k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '****');
        setHasKey(true);
        setApiKey('');
      }
      toast.success('Reviews settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function fetchNow() {
    if (!hasKey && !apiKey.trim()) { toast.error('Save your API key first'); return; }
    if (!cfg.placeId?.trim()) { toast.error('Enter a Google Place ID first'); return; }
    if (!hasKey && apiKey.trim()) await saveSettings();
    setFetching(true);
    try {
      const res = await fetch('/api/reviews/fetch', { method: 'POST' });
      const d = await res.json() as { ok?: boolean; added?: number; total?: number; message?: string };
      if (!res.ok) { toast.error(d.message ?? 'Fetch failed'); return; }
      toast.success(`Fetched — ${d.added} new review${d.added !== 1 ? 's' : ''} added (${d.total} total)`);
      // Reload reviews
      const updated = await fetch('/api/reviews/settings').then(r => r.json()) as { reviews?: GoogleReview[] };
      setReviews(updated.reviews ?? []);
    } catch {
      toast.error('Fetch failed');
    } finally {
      setFetching(false);
    }
  }

  async function updateReview(reviewId: string, patch: { visible?: boolean; tags?: ReviewTag[]; approved?: boolean }) {
    await fetch('/api/reviews/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId, ...patch }),
    });
    setReviews(prev => prev.map(r => r.reviewId === reviewId ? { ...r, ...patch } : r));
  }

  if (!loaded) return null;

  return (
    <Section title="Google Reviews">
      <p className="text-xs text-muted-foreground -mt-1">
        Pull reviews from Google via Outcraper API, cache them in Firestore, and display them on the website.{' '}
        <a href="https://app.outscraper.com/api-key" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">Get an API key →</a>
      </p>

      {/* API Key */}
      <Field label="Outcraper API Key">
        {hasKey ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-white/50 dark:bg-white/5">
            <Star size={14} className="text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">API key configured</p>
              <p className="text-xs text-muted-foreground font-mono">{maskedKey}</p>
            </div>
            <Check size={14} className="text-emerald-500 shrink-0" />
            <button onClick={() => { setHasKey(false); setMaskedKey(''); }} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer">
              <Pencil size={13} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Paste Outcraper API key"
              autoComplete="off"
              className={inputCls + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        )}
      </Field>

      {/* Place ID */}
      <Field label="Google Place ID">
        <input
          value={cfg.placeId ?? ''}
          onChange={e => setCfg(p => ({ ...p, placeId: e.target.value }))}
          placeholder="ChIJ..."
          className={inputCls}
        />
        <p className="text-[11px] text-muted-foreground mt-1">Find your Place ID at <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="underline">Google's Place ID Finder →</a></p>
      </Field>

      {/* Fetch Rules */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Max Reviews to Fetch">
          <input
            type="number"
            min={1} max={100}
            value={cfg.maxReviews ?? 50}
            onChange={e => setCfg(p => ({ ...p, maxReviews: Number(e.target.value) }))}
            className={inputCls}
          />
        </Field>
        <Field label="Minimum Star Rating">
          <select
            value={cfg.minRating ?? 4}
            onChange={e => setCfg(p => ({ ...p, minRating: Number(e.target.value) }))}
            className={inputCls}
          >
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''} & above</option>)}
          </select>
        </Field>
        <Field label="Check for New Reviews (hours)">
          <input
            type="number"
            min={1}
            value={cfg.checkIntervalHours ?? 24}
            onChange={e => setCfg(p => ({ ...p, checkIntervalHours: Number(e.target.value) }))}
            className={inputCls}
          />
        </Field>
        <Field label="Full Re-fetch Cache (hours)">
          <input
            type="number"
            min={1}
            value={cfg.cacheTtlHours ?? 720}
            onChange={e => setCfg(p => ({ ...p, cacheTtlHours: Number(e.target.value) }))}
            className={inputCls}
          />
        </Field>
      </div>

      {/* Media Only toggle */}
      <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-white/50 dark:bg-white/5 cursor-pointer">
        <input
          type="checkbox"
          checked={cfg.mediaOnly ?? true}
          onChange={e => setCfg(p => ({ ...p, mediaOnly: e.target.checked }))}
          className="w-4 h-4 accent-primary"
        />
        <div>
          <p className="text-sm font-medium">Media only</p>
          <p className="text-xs text-muted-foreground">Only store reviews that include photos</p>
        </div>
      </label>

      {/* Status */}
      {cfg.fetchedAt && (
        <div className="text-xs text-muted-foreground px-1">
          Last fetched: {new Date(cfg.fetchedAt).toLocaleString()} · {cfg.totalFetched ?? 0} reviews stored
          {cfg.nextCheckAt && <> · Next check: {new Date(cfg.nextCheckAt).toLocaleString()}</>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => void saveSettings()}
          disabled={saving}
          className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          Save Settings
        </button>
        <button
          onClick={() => void fetchNow()}
          disabled={fetching}
          className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-50 transition-all cursor-pointer"
        >
          {fetching ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Fetch Now
        </button>
      </div>

      {/* Reviews Manager */}
      {reviews.length > 0 && (
        <div className="border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowManager(v => !v)}
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Tag size={14} className="text-muted-foreground" />
              Manage Reviews ({reviews.length})
            </span>
            {showManager ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showManager && (
            <div className="border-t border-border">
              {/* Bulk actions */}
              <div className="flex gap-2 px-4 py-2 border-b border-border bg-black/3 dark:bg-white/3">
                <button onClick={() => void Promise.all(reviews.map(r => updateReview(r.reviewId, { visible: true })))} className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">Show all</button>
                <button onClick={() => void Promise.all(reviews.map(r => updateReview(r.reviewId, { visible: false })))} className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">Hide all</button>
              </div>

              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {reviews.map(review => (
                  <div key={review.reviewId} className="flex items-start gap-3 px-4 py-3">
                    {/* Photo thumbnail */}
                    {review.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={review.photos[0]} alt="" className="w-14 h-10 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-14 h-10 rounded-lg bg-black/10 dark:bg-white/10 shrink-0 flex items-center justify-center">
                        <ImageIcon size={14} className="text-muted-foreground" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <StarRow rating={review.rating} />
                        <span className="text-xs font-medium truncate">{review.authorName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{review.text}</p>

                      {/* Tags */}
                      <div className="relative mt-1.5 flex flex-wrap gap-1">
                        {REVIEW_TAGS.map(t => (
                          <button
                            key={t.value}
                            onClick={() => {
                              const current = review.tags ?? [];
                              const next = current.includes(t.value)
                                ? current.filter(x => x !== t.value)
                                : [...current, t.value];
                              void updateReview(review.reviewId, { tags: next });
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md border transition-colors cursor-pointer ${
                              review.tags?.includes(t.value)
                                ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                : 'border-border text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                        {tagPopover === review.reviewId && (
                          <div className="hidden" onClick={() => setTagPopover(null)} />
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {/* Visible toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={review.visible}
                          onChange={e => void updateReview(review.reviewId, { visible: e.target.checked })}
                          className="w-3.5 h-3.5 accent-primary"
                        />
                        <span className="text-[11px] text-muted-foreground">Visible</span>
                      </label>
                      {/* Approved toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={review.approved}
                          onChange={e => void updateReview(review.reviewId, { approved: e.target.checked })}
                          className="w-3.5 h-3.5 accent-primary"
                        />
                        <span className="text-[11px] text-muted-foreground">Approved</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
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


