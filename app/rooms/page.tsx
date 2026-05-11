'use client';

import { useState } from 'react';
import { BedDouble, User, CalendarDays, Receipt, LogOut, Plus, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useProducts, useStays, useTabs, useCurrentStaff, useSettings } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';
import { getStore } from '@/lib/store/store';
import { newId } from '@/lib/domain/id';
import { createStayAndFolio, findActiveStayByRoom } from '@/lib/domain/stays';
import { CheckInDialog } from '@/components/rooms/CheckInDialog';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import {
  formatDate, formatElapsed, lineKey, lineUnitPrice, lineEffectiveUnitPrice, modifiersSummary, tabGrandTotal,
} from '@/lib/domain/tabs';
import type { Product, Stay } from '@/lib/types';

export default function RoomsPage() {
  const products = useProducts();
  const stays = useStays();
  const tabs = useTabs();
  const me = useCurrentStaff();
  const cur = useSettings().currency;
  const store = getStore();

  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [checkInRoom, setCheckInRoom] = useState<Product | null>(null);
  const [folioStay, setFolioStay] = useState<Stay | null>(null);

  const rooms = products.filter(p => p.category === 'rooms' && (showArchived || !p.archived));
  const availableCount = products.filter(p => p.category === 'rooms' && !p.archived && !findActiveStayByRoom(stays, p.id)).length;

  function handleCheckIn(data: { guestName: string; guestPhone?: string; nights: number; checkInAt: Date; checkOutAt: Date; notes?: string; customerId?: string }) {
    if (!checkInRoom) return;
    const { stay, folio } = createStayAndFolio({ room: checkInRoom, ...data });
    store.tabs.set(prev => [folio, ...prev]);
    store.stays.set(prev => [stay, ...prev]);
    store.log('stay.checkin', `${stay.guestName} → ${stay.roomName} · ${stay.nights}n`, me?.id);
    setCheckInRoom(null);
    toast.success(`${stay.guestName} checked into ${stay.roomName}`);
  }

  async function handleCheckOut(stay: Stay) {
    const folio = tabs.find(t => t.id === stay.folioTabId);
    const total = folio ? tabGrandTotal(folio.items, folio.discount) : 0;
    const ok = await confirm({
      title: `Check out ${stay.guestName}?`,
      message: `Outstanding folio: ${cur}${fmtCur(total)}. The folio tab must already be paid before check-out.`,
      danger: false,
      confirmLabel: 'Check out',
    });
    if (!ok) return;

    if (folio && folio.status === 'open') {
      toast.error('Settle the folio first (Card / Cash).');
      return;
    }

    store.stays.set(prev => prev.map(s => s.id === stay.id ? { ...s, status: 'checked-out', checkOutAt: new Date() } : s));
    store.log('stay.checkout', `${stay.guestName} · ${stay.roomName}`, me?.id);
    toast.success(`${stay.guestName} checked out`);
  }

  async function handleDelete(room: Product) {
    const stay = findActiveStayByRoom(stays, room.id);
    if (stay) {
      toast.error('Check out the current guest before deleting.');
      return;
    }
    const ok = await confirm({
      title: `Permanently delete "${room.name}"?`,
      message: 'This cannot be undone. All room data will be removed.',
      danger: true,
      confirmLabel: 'Delete',
      requireManagerPin: true,
    });
    if (!ok) return;
    store.products.set(prev => prev.filter(p => p.id !== room.id));
    store.log('product.delete', `Deleted room ${room.name}`, me?.id);
    toast.success(`${room.name} deleted`);
  }

  function handleSave(form: Product) {
    const exists = products.some(p => p.id === form.id);
    if (exists) {
      store.products.set(prev => prev.map(p => p.id === form.id ? form : p));
      store.log('product.update', form.name, me?.id);
      toast.success('Room updated');
    } else {
      store.products.set(prev => [...prev, form]);
      store.log('product.create', form.name, me?.id);
      toast.success('Room added');
    }
    setEditing(null);
    setCreating(false);
  }

  async function handleArchive(room: Product) {
    const stay = findActiveStayByRoom(stays, room.id);
    if (!room.archived && stay) {
      toast.error('Check out the current guest first.');
      return;
    }
    const ok = await confirm({
      title: room.archived ? `Restore ${room.name}?` : `Archive ${room.name}?`,
      message: room.archived ? 'Room will appear again.' : 'Room will be hidden from this list.',
      confirmLabel: room.archived ? 'Restore' : 'Archive',
      requireManagerPin: !room.archived,
    });
    if (!ok) return;
    store.products.set(prev => prev.map(p => p.id === room.id ? { ...p, archived: !room.archived } : p));
    store.log(room.archived ? 'product.update' : 'product.delete', `${room.archived ? 'Restored' : 'Archived'} ${room.name}`, me?.id);
    toast.success(room.archived ? 'Restored' : 'Archived');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong">
        <div>
          <h1 className="text-lg font-semibold">Guestrooms</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.filter(p => p.category === 'rooms' && !p.archived).length} rooms · {availableCount} available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(s => !s)}
            className="h-9 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer"
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus size={15} strokeWidth={2.5} /> Add Room
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <BedDouble size={36} className="text-muted-foreground/30 mb-3" strokeWidth={1.2} />
            <p className="text-sm text-muted-foreground">No rooms yet. Click <strong>Add Room</strong> to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
            {rooms.map(room => {
              const stay = findActiveStayByRoom(stays, room.id);
              const folio = stay ? tabs.find(t => t.id === stay.folioTabId) : null;
              const folioTotal = folio ? tabGrandTotal(folio.items, folio.discount) : 0;
              return (
                <div key={room.id} className={`flex flex-col rounded-2xl border border-border bg-white/60 dark:bg-white/5 overflow-hidden ${room.archived ? 'opacity-50' : ''}`}>
                  <div className="h-32 bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-900 dark:to-stone-800 flex items-center justify-center overflow-hidden relative group">
                    {room.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={room.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BedDouble size={36} className="text-stone-400 dark:text-stone-600" strokeWidth={1.2} />
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing(room)}
                        aria-label={`Edit ${room.name}`}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/80 dark:bg-black/60 text-foreground hover:bg-white dark:hover:bg-black/80 transition-colors cursor-pointer shadow-sm"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleArchive(room)}
                        aria-label={room.archived ? `Restore ${room.name}` : `Archive ${room.name}`}
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/80 dark:bg-black/60 text-foreground hover:bg-white dark:hover:bg-black/80 transition-colors cursor-pointer shadow-sm"
                      >
                        {room.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                      </button>
                      {me?.role === 'manager' && (
                        <button
                          onClick={() => handleDelete(room)}
                          aria-label={`Delete ${room.name}`}
                          title="Permanently delete"
                          className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/80 dark:bg-black/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/60 transition-colors cursor-pointer shadow-sm"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm font-semibold leading-tight">{room.name}</h2>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        room.archived
                          ? 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                          : stay
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      }`}>
                        {room.archived ? 'Archived' : stay ? 'Occupied' : 'Available'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{room.description}</p>

                    {stay && (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User size={12} strokeWidth={2} />
                          <span>{stay.guestName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CalendarDays size={12} strokeWidth={2} />
                          <span>{formatDate(stay.checkInAt)} · {stay.nights}n · in {formatElapsed(stay.checkInAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Receipt size={12} strokeWidth={2} />
                          <span>Folio {cur}{fmtCur(folioTotal)} {folio?.status === 'paid' && '(paid)'}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                      <span className="text-sm font-bold">{cur}{room.price}<span className="text-xs font-normal text-muted-foreground">/night</span></span>
                      {!room.archived && (
                        !stay ? (
                          <button onClick={() => setCheckInRoom(room)} className="h-8 px-3 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                            Check In
                          </button>
                        ) : (
                          <div className="flex gap-1.5">
                            <button onClick={() => setFolioStay(stay)} className="h-8 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 transition-colors cursor-pointer">
                              View Folio
                            </button>
                            <button
                              onClick={() => handleCheckOut(stay)}
                              aria-label={`Check out ${stay.guestName}`}
                              className="flex items-center justify-center w-8 h-8 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              <LogOut size={13} />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(editing || creating) && (
        <RoomDialog
          room={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={handleSave}
        />
      )}

      <CheckInDialog
        open={!!checkInRoom}
        room={checkInRoom}
        onClose={() => setCheckInRoom(null)}
        onCheckIn={handleCheckIn}
      />

      <FolioPanel stay={folioStay} onClose={() => setFolioStay(null)} />
    </div>
  );
}

interface RoomDialogProps {
  room: Product | null;
  onClose: () => void;
  onSave: (p: Product) => void;
}

function RoomDialog({ room, onClose, onSave }: RoomDialogProps) {
  const [form, setForm] = useState<Product>(room ?? {
    id: newId('prod'),
    name: '',
    price: 0,
    category: 'rooms',
    description: '',
    stock: null,
    lowStockAt: null,
    cost: null,
    image: null,
    glyph: null,
    sendToKitchen: false,
  });

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Pick an image file'); return; }
    try {
      const dataUrl = await downscaleImage(file, 800, 0.85);
      setForm(f => ({ ...f, image: dataUrl }));
    } catch {
      toast.error('Could not read image');
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    if (form.price < 0) { toast.error('Price must be ≥ 0'); return; }
    onSave({ ...form, name: form.name.trim() });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <h2 className="text-lg font-semibold">{room ? 'Edit room' : 'Add room'}</h2>

        <Field label="Name">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus className={inputCls} />
        </Field>

        <Field label="Nightly rate">
          <input type="number" min={0} step={0.01} value={form.price || ''} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className={inputCls + ' tabular-nums'} />
        </Field>

        <Field label="Description">
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
        </Field>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Photo</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-20 h-16 rounded-xl border border-border bg-black/5 dark:bg-white/5 overflow-hidden shrink-0">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <BedDouble size={24} className="text-muted-foreground/40" strokeWidth={1.2} />
              )}
            </div>
            <div className="flex-1 flex gap-2">
              <label className="flex-1 h-9 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer flex items-center justify-center">
                {form.image ? 'Replace photo' : 'Upload photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }}
                />
              </label>
              {form.image && (
                <button type="button" onClick={() => setForm({ ...form, image: null })} className="h-9 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">{room ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </div>
  );
}

function FolioPanel({ stay, onClose }: { stay: Stay | null; onClose: () => void }) {
  const tabs = useTabs();
  const cur = useSettings().currency;
  if (!stay) return null;
  const folio = tabs.find(t => t.id === stay.folioTabId);
  const total = folio ? tabGrandTotal(folio.items, folio.discount) : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{stay.guestName} · Folio</h2>
          <p className="text-xs text-muted-foreground">{stay.roomName} · {stay.nights}n</p>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {folio?.items.length === 0 && <p className="text-sm text-muted-foreground">No charges yet.</p>}
          {folio?.items.map(li => {
            const mods = modifiersSummary(li.modifiers);
            return (
              <div key={lineKey(li)} className="flex justify-between text-sm border-b border-border py-1.5 last:border-0">
                <span className="min-w-0">
                  <span className="truncate block">{li.qty}× {li.product.name}</span>
                  {mods && <span className="block text-[11px] text-muted-foreground/80 truncate">{mods}</span>}
                </span>
                <span className="tabular-nums">{cur}{fmtCur(lineEffectiveUnitPrice(li) * li.qty)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
          <span>Total</span><span className="tabular-nums">{cur}{fmtCur(total)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer">Close</button>
          {folio && (
            <a href={`/receipt/${folio.id}`} target="_blank" rel="noopener noreferrer" className="flex-1 h-10 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center">
              Open in POS
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring';

function downscaleImage(file: File, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
        resolve(canvas.toDataURL(hasAlpha ? 'image/png' : 'image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
