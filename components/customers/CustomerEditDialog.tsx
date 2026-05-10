'use client';

import { useRef, useState } from 'react';
import {
  X, Phone, Mail, Globe, Briefcase, Star, Image as ImageIcon, MapPin, CreditCard, ZoomIn,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import type { Customer, Discount } from '@/lib/types';
import { COUNTRIES, countryFlag } from '@/lib/countries';

export interface CustomerEditDialogProps {
  customer: Customer;
  onClose: () => void;
  onSave: (c: Customer) => void;
}

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring';

export function CustomerEditDialog({ customer, onClose, onSave }: CustomerEditDialogProps) {
  const [form, setForm] = useState<Customer>(customer);
  const [discountEnabled, setDiscountEnabled] = useState(!!customer.discount);
  const [discountType, setDiscountType] = useState<'pct' | 'fixed'>(customer.discount?.type ?? 'pct');
  const [discountValue, setDiscountValue] = useState<number>(customer.discount?.value ?? 10);
  const imgRef   = useRef<HTMLInputElement>(null);
  const idImgRef = useRef<HTMLInputElement>(null);
  const [idLightbox, setIdLightbox] = useState(false);

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function handleIdImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, idImage: reader.result as string }));
    reader.readAsDataURL(file);
    // reset so re-selecting the same file triggers onChange
    e.target.value = '';
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { toast.error('Name required'); return; }
    const discount: Discount | undefined = discountEnabled && discountValue > 0
      ? { type: discountType, value: discountValue }
      : undefined;
    onSave({ ...form, name, discount });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{customer.name ? `Edit ${customer.name}` : 'Add customer'}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
            <X size={15} />
          </button>
        </div>

        {/* Photo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => imgRef.current?.click()}
            className="relative w-16 h-16 rounded-2xl bg-primary/10 overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border border-border"
          >
            {form.image
              ? <img src={form.image} alt={form.name} className="w-full h-full object-cover" />
              : <span className="text-primary text-lg font-bold">
                  {form.name ? form.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?'}
                </span>
            }
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
              <ImageIcon size={16} className="text-white" />
            </div>
          </button>
          <input ref={imgRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
          <div className="flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Photo</p>
            <p className="text-xs text-muted-foreground">Click to upload</p>
            {form.image && (
              <button type="button" onClick={() => setForm(f => ({ ...f, image: undefined }))} className="text-xs text-rose-500 hover:text-rose-600 cursor-pointer">Remove</button>
            )}
          </div>
        </div>

        <Field label="Name">
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
            placeholder="Jane Smith"
            className={inputCls}
          />
        </Field>

        <Field label="Job role / what they do">
          <div className="relative">
            <Briefcase size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={form.jobRole ?? ''}
              onChange={e => setForm(f => ({ ...f, jobRole: e.target.value }))}
              placeholder="Designer, Developer, Founder…"
              className={inputCls + ' pl-8'}
            />
          </div>
        </Field>

        <Field label="Customer type">
          <select
            value={form.visitorType ?? ''}
            onChange={e => setForm(f => ({ ...f, visitorType: (e.target.value as typeof f.visitorType) || undefined }))}
            className={inputCls}
          >
            <option value="">— Select type —</option>
            <option value="local">Local</option>
            <option value="tourist">Tourist</option>
            <option value="expat">Expat</option>
            <option value="semi-expat">Semi-expat</option>
          </select>
        </Field>

        <Field label="Email">
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="email"
              value={form.email ?? ''}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jane@example.com"
              className={inputCls + ' pl-8'}
            />
          </div>
        </Field>

        <Field label="Phone">
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="tel"
              value={form.phone ?? ''}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+66 81 234 5678"
              className={inputCls + ' pl-8'}
            />
          </div>
        </Field>

        <Field label="Website">
          <div className="relative">
            <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="url"
              value={form.website ?? ''}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://example.com"
              className={inputCls + ' pl-8'}
            />
          </div>
        </Field>

        <Field label="Country">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-base leading-none">
              {form.country ? countryFlag(form.country) : <MapPin size={13} />}
            </span>
            <select
              value={form.country ?? ''}
              onChange={e => setForm(f => ({ ...f, country: e.target.value || undefined }))}
              className={inputCls + ' pl-9 appearance-none'}
            >
              <option value="">— Select country —</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>
                  {countryFlag(c.code)}  {c.name}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-white/50 dark:bg-white/5 cursor-pointer">
          <div className="flex items-center gap-2">
            <Star size={14} className={form.vip ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'} />
            <span className="text-sm font-medium">VIP customer</span>
          </div>
          <input
            type="checkbox"
            checked={!!form.vip}
            onChange={e => setForm(f => ({ ...f, vip: e.target.checked }))}
            className="w-4 h-4 accent-primary cursor-pointer"
          />
        </label>

        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-white/50 dark:bg-white/5 cursor-pointer">
            <span className="text-sm font-medium">Apply discount</span>
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={e => setDiscountEnabled(e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </label>
          {discountEnabled && (
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value as 'pct' | 'fixed')}
                className={inputCls + ' flex-1'}
              >
                <option value="pct">Percentage (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
              <input
                type="number"
                min={0}
                step={discountType === 'pct' ? 1 : 0.01}
                max={discountType === 'pct' ? 100 : undefined}
                value={discountValue}
                onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                placeholder={discountType === 'pct' ? '10' : '5.00'}
                className={inputCls + ' w-24 tabular-nums'}
              />
            </div>
          )}
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes ?? ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any extra info…"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        {/* ID / Passport */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CreditCard size={11} /> ID / Passport
            </span>
            {form.idImage && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIdLightbox(true)}
                  className="text-xs text-primary hover:opacity-80 cursor-pointer flex items-center gap-1"
                >
                  <ZoomIn size={11} /> View
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, idImage: undefined }))}
                  className="text-xs text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => idImgRef.current?.click()}
            className={`relative w-full rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-colors ${
              form.idImage
                ? 'border-transparent h-36'
                : 'border-border hover:border-primary/50 h-24 bg-black/3 dark:bg-white/3'
            }`}
          >
            {form.idImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.idImage} alt="ID document" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-medium flex items-center gap-1.5"><ImageIcon size={13} /> Replace</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground py-2">
                <CreditCard size={20} strokeWidth={1.5} />
                <span className="text-xs">Click to upload ID / passport photo</span>
                <span className="text-[10px] opacity-60">Stored locally on this device only</span>
              </div>
            )}
          </button>
          <input ref={idImgRef} type="file" accept="image/*" onChange={handleIdImageFile} className="hidden" />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            Save
          </button>
        </div>
      </form>

      {/* ID image lightbox */}
      {idLightbox && form.idImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setIdLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setIdLightbox(false)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={form.idImage}
            alt="ID document"
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
