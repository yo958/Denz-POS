'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Upload } from 'lucide-react';
import { useProducts, useCurrentStaff, useSettings, useModifierGroups } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';
import { getStore } from '@/lib/store/store';
import { newId } from '@/lib/domain/id';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { CsvImportDialog } from '@/components/menu/CsvImportDialog';
import { Switch } from '@/components/ui/switch';
import type { Product, ProductCategory } from '@/lib/types';

const CATEGORY_LABEL: Partial<Record<ProductCategory, string>> = {
  food: 'Food', drinks: 'Drinks', dessert: 'Dessert',
};
const CATEGORY_ORDER: ProductCategory[] = ['food', 'drinks', 'dessert'];
const CATEGORY_COLOR: Partial<Record<ProductCategory, string>> = {
  food:    'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  drinks:  'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
  dessert: 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
};

export default function MenuPage() {
  const products = useProducts();
  const me = useCurrentStaff();
  const cur = useSettings().currency;
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const visible = products.filter(p => showArchived || !p.archived);
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    products: visible.filter(p => p.category === cat),
  }));

  async function handleArchive(p: Product) {
    const ok = await confirm({
      title: p.archived ? `Restore ${p.name}?` : `Archive ${p.name}?`,
      message: p.archived ? 'Item will be sellable again.' : 'Item is hidden from the POS grid but kept for history.',
      confirmLabel: p.archived ? 'Restore' : 'Archive',
      requireManagerPin: !p.archived,
    });
    if (!ok) return;
    getStore().products.set(prev => prev.map(x => x.id === p.id ? { ...x, archived: !p.archived } : x));
    getStore().log(p.archived ? 'product.update' : 'product.delete', `${p.archived ? 'Restored' : 'Archived'} ${p.name}`, me?.id);
    toast.success(p.archived ? 'Restored' : 'Archived');
  }

  async function handleDelete(p: Product) {
    const ok = await confirm({
      title: `Permanently delete "${p.name}"?`,
      message: 'This cannot be undone. The item will be removed from the menu and all modifier group links will be lost.',
      confirmLabel: 'Delete permanently',
      requireManagerPin: true,
      danger: true,
    });
    if (!ok) return;
    getStore().products.set(prev => prev.filter(x => x.id !== p.id));
    getStore().log('product.delete', `Deleted ${p.name}`, me?.id);
    toast.success(`"${p.name}" deleted`);
  }

  function handleImport(imported: Product[]) {
    const store = getStore();
    store.products.set(prev => [...prev, ...imported]);
    store.log('product.create', `Bulk import: ${imported.length} items`, me?.id);
    toast.success(`Imported ${imported.length} item${imported.length !== 1 ? 's' : ''}`);
  }

  function handleSave(form: Product) {
    const exists = products.some(p => p.id === form.id);
    if (exists) {
      getStore().products.set(prev => prev.map(p => p.id === form.id ? form : p));
      getStore().log('product.update', form.name, me?.id);
      toast.success('Updated');
    } else {
      getStore().products.set(prev => [...prev, form]);
      getStore().log('product.create', form.name, me?.id);
      toast.success('Added');
    }
    setEditing(null);
    setCreating(false);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong">
        <div>
          <h1 className="text-lg font-semibold">Menu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{visible.length} items · {products.filter(p => p.archived).length} archived</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowArchived(s => !s)} className="h-9 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Upload size={14} strokeWidth={2} /> Import CSV
          </button>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Plus size={15} strokeWidth={2.5} /> Add Item
          </button>
        </div>
      </header>

      {/* Category quick-jump bar */}
      {grouped.some(g => g.products.length > 0) && (
        <div className="flex items-center gap-2 px-6 py-2 border-b border-border bg-background/60">
          {grouped.map(({ category, products: list }) => (
            <button
              key={category}
              onClick={() => document.getElementById(`cat-${category}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-opacity cursor-pointer ${CATEGORY_COLOR[category] ?? ''} hover:opacity-80`}
            >
              {CATEGORY_LABEL[category]}
              <span className="opacity-70">{list.length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {grouped.map(({ category, products: list }) => (
          <section key={category} id={`cat-${category}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLOR[category] ?? ''}`}>{CATEGORY_LABEL[category]}</span>
              <span className="text-xs text-muted-foreground">{list.length}</span>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">None.</p>
            ) : (
              <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
                {list.map(p => {
                  const out = p.stock !== null && p.stock <= 0;
                  const low = p.stock !== null && p.lowStockAt !== null && p.stock > 0 && p.stock <= p.lowStockAt;
                  return (
                    <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${p.archived ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          {p.sendToKitchen && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">KDS</span>}
                          {out && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">OUT</span>}
                          {low && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">LOW · {p.stock}</span>}
                          {p.archived && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300">ARCHIVED</span>}
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                      </div>
                      <span className="text-sm font-semibold tabular-nums w-20 text-right">{cur}{fmtCur(p.price)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{p.stock ?? '—'}</span>
                      <button onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleArchive(p)} aria-label={p.archived ? `Restore ${p.name}` : `Archive ${p.name}`} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                        {p.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                      </button>
                      <button onClick={() => handleDelete(p)} aria-label={`Delete ${p.name}`} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      {(editing || creating) && (
        <ProductDialog
          product={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={handleSave}
        />
      )}
      {importOpen && (
        <CsvImportDialog
          onClose={() => setImportOpen(false)}
          onImport={handleImport}
        />
      )}
    </div>
  );
}

interface ProductDialogProps {
  product: Product | null;
  onClose: () => void;
  onSave: (p: Product) => void;
}

function ProductDialog({ product, onClose, onSave }: ProductDialogProps) {
  const isManager = useCurrentStaff()?.role === 'manager';
  const groups = useModifierGroups();
  const [form, setForm] = useState<Product>(product ?? {
    id: newId('prod'),
    name: '',
    price: 0,
    category: 'food',
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
      const dataUrl = await downscaleImage(file, 480, 0.85);
      setForm(f => ({ ...f, image: dataUrl }));
    } catch {
      toast.error('Could not read image');
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    if (form.price < 0) { toast.error('Price must be ≥ 0'); return; }
    if (form.cost != null && form.cost < 0) { toast.error('Cost must be ≥ 0'); return; }
    onSave({ ...form, name: form.name.trim() });
  }

  const canTrackStock = form.category === 'food' || form.category === 'drinks' || form.category === 'dessert';
  const tracksStock = canTrackStock && form.stock !== null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md glass-strong rounded-3xl shadow-2xl flex flex-col max-h-[90dvh]">
        {/* Sticky header */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold">{product ? 'Edit item' : 'Add item'}</h2>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-4">

        <Field label="Name">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price">
            <input type="number" min={0} step={0.01} value={form.price || ''} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className={inputCls + ' tabular-nums'} />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={e => {
              const cat = e.target.value as ProductCategory;
              setForm({ ...form, category: cat });
            }} className={inputCls}>
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
        </Field>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Image / icon</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-16 h-16 rounded-xl border border-border bg-black/5 dark:bg-white/5 overflow-hidden text-2xl select-none shrink-0">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="" className="w-full h-full object-cover" />
              ) : (
                form.glyph || '✨'
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <label className="flex-1 h-9 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer flex items-center justify-center">
                  {form.image ? 'Replace image' : 'Upload image'}
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
              <input
                value={form.glyph ?? ''}
                onChange={e => setForm({ ...form, glyph: e.target.value || null })}
                placeholder="Emoji icon (eg 🍕) — used when no image"
                maxLength={4}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {isManager && (
          <>
            <Switch
              checked={form.cost != null}
              onChange={on => setForm({ ...form, cost: on ? (form.cost ?? 0) : null })}
              label="Track cost price"
            />
            {form.cost != null && (
              <Field label="Cost price">
                <input type="number" min={0} step={0.01} value={form.cost} onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} className={inputCls + ' tabular-nums'} />
              </Field>
            )}
          </>
        )}

        {canTrackStock && (
          <>
            <Switch
              checked={tracksStock}
              onChange={on => setForm({
                ...form,
                stock: on ? (form.stock ?? 0) : null,
                lowStockAt: on ? form.lowStockAt : null,
              })}
              label="Manage stock for this item"
            />

            {tracksStock && (
              <div className={`grid gap-3 ${isManager ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Field label="Stock">
                  <input type="number" min={0} step={1} value={form.stock ?? 0} onChange={e => setForm({ ...form, stock: parseInt(e.target.value, 10) || 0 })} className={inputCls + ' tabular-nums'} />
                </Field>
                {isManager && (
                  <Field label="Low-stock alert at">
                    <input type="number" min={0} step={1} value={form.lowStockAt ?? ''} placeholder="off" onChange={e => setForm({ ...form, lowStockAt: e.target.value === '' ? null : parseInt(e.target.value, 10) })} className={inputCls + ' tabular-nums'} />
                  </Field>
                )}
              </div>
            )}
          </>
        )}

        <Switch
          checked={form.sendToKitchen}
          onChange={on => setForm({ ...form, sendToKitchen: on })}
          label="Send to kitchen (KDS)"
        />

        {groups.filter(g => !g.archived).length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modifier groups</span>
            <div className="flex flex-wrap gap-1.5">
              {groups.filter(g => !g.archived).map(g => {
                const ids = form.modifierGroupIds ?? [];
                const on = ids.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setForm(f => {
                      const cur = f.modifierGroupIds ?? [];
                      const nextIds = on ? cur.filter(id => id !== g.id) : [...cur, g.id];
                      const overrides = { ...(f.modifierOptionPriceOverrides ?? {}) };
                      const enabled = { ...(f.modifierEnabledOptions ?? {}) };
                      if (on) {
                        delete overrides[g.id];
                        delete enabled[g.id];
                      } else {
                        // Auto-enable all non-archived options when group is first attached
                        enabled[g.id] = g.options.filter(o => !o.archived).map(o => o.id);
                      }
                      return { ...f, modifierGroupIds: nextIds, modifierOptionPriceOverrides: overrides, modifierEnabledOptions: enabled };
                    })}
                    className={`px-2.5 h-8 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      on
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white/50 dark:bg-white/5 border-border hover:bg-black/5 dark:hover:bg-white/8'
                    }`}
                  >
                    {g.name}
                    <span className="ml-1 opacity-70">({g.type === 'single' ? '1' : 'n'})</span>
                  </button>
                );
              })}
            </div>

            {/* Per-product option visibility + prices for each enabled group */}
            {(form.modifierGroupIds ?? []).map(gid => {
              const g = groups.find(x => x.id === gid && !x.archived);
              if (!g) return null;
              const allOpts = g.options.filter(o => !o.archived);
              // Fall back to all enabled if no config yet (legacy products)
              const enabledIds: string[] = form.modifierEnabledOptions?.[gid] ?? allOpts.map(o => o.id);
              const groupPrices = form.modifierOptionPriceOverrides?.[gid] ?? {};

              const setEnabled = (optId: string, on: boolean) => {
                setForm(f => {
                  const cur: string[] = f.modifierEnabledOptions?.[gid] ?? allOpts.map(o => o.id);
                  const next = on ? [...new Set([...cur, optId])] : cur.filter(id => id !== optId);
                  return { ...f, modifierEnabledOptions: { ...(f.modifierEnabledOptions ?? {}), [gid]: next } };
                });
              };

              const setPrice = (optId: string, value: number) => {
                setForm(f => {
                  const all = { ...(f.modifierOptionPriceOverrides ?? {}) };
                  all[gid] = { ...(all[gid] ?? {}), [optId]: value };
                  return { ...f, modifierOptionPriceOverrides: all };
                });
              };

              return (
                <div key={gid} className="rounded-2xl border border-border bg-black/3 dark:bg-white/3 p-3 space-y-2">
                  <span className="text-xs font-semibold">{g.name}</span>
                  <div className="space-y-1.5">
                    {allOpts.map(o => {
                      const isEnabled = enabledIds.includes(o.id);
                      const price = groupPrices[o.id] ?? 0;
                      return (
                        <div key={o.id} className="flex items-center gap-2">
                          <Switch
                            size="sm"
                            checked={isEnabled}
                            onChange={on => setEnabled(o.id, on)}
                          />
                          <span className={`flex-1 text-sm truncate transition-opacity ${!isEnabled ? 'opacity-40' : ''}`}>{o.name}</span>
                          <input
                            type="number"
                            step={0.01}
                            value={price || ''}
                            disabled={!isEnabled}
                            onChange={e => setPrice(o.id, parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-20 h-9 px-2 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tick to show an option in the POS. Price = amount added to base price (0 = free).
                  </p>
                </div>
              );
            })}
          </div>
        )}

        </div>{/* end scrollable body */}

        {/* Sticky footer */}
        <div className="shrink-0 flex gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">{product ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring';

/** Read an image file, downscale to fit within `maxEdge`, return JPEG/PNG data URL. */
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
