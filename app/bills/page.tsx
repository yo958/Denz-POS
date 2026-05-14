'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Receipt, Plus, X, Tag, Trash2, Pencil, Coffee, BedDouble, Monitor, Layers, Filter,
  TrendingDown, Check,
} from 'lucide-react';
import { useBills, useBillTags, useSettings, useCurrentStaff } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { newId } from '@/lib/domain/id';
import { fmtCur } from '@/lib/format';
import type { Bill, BillCategory, BillTag, BillPayer } from '@/lib/types';

const PAYERS: BillPayer[] = ['JD', 'Sasinee'];

const PAYER_COLORS: Record<BillPayer, string> = {
  JD:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Sasinee: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

/* ── Constants ────────────────────────────────────────────────── */

const CATEGORIES: { value: BillCategory; label: string; icon: typeof Coffee; accent: string }[] = [
  { value: 'cafe',      label: 'Cafe',       icon: Coffee,    accent: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  { value: 'rooms',     label: 'Rooms',      icon: BedDouble, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'coworking', label: 'Co-Working', icon: Monitor,   accent: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  { value: 'general',   label: 'General',    icon: Layers,    accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300' },
];

const TAG_COLORS = [
  { name: 'gray',   bg: 'bg-slate-200 dark:bg-slate-700',      text: 'text-slate-700 dark:text-slate-300' },
  { name: 'red',    bg: 'bg-red-100 dark:bg-red-900/40',        text: 'text-red-700 dark:text-red-400' },
  { name: 'orange', bg: 'bg-orange-100 dark:bg-orange-900/40',  text: 'text-orange-700 dark:text-orange-400' },
  { name: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/40',  text: 'text-yellow-700 dark:text-yellow-400' },
  { name: 'green',  bg: 'bg-green-100 dark:bg-green-900/40',    text: 'text-green-700 dark:text-green-400' },
  { name: 'blue',   bg: 'bg-blue-100 dark:bg-blue-900/40',      text: 'text-blue-700 dark:text-blue-400' },
  { name: 'purple', bg: 'bg-purple-100 dark:bg-purple-900/40',  text: 'text-purple-700 dark:text-purple-400' },
  { name: 'pink',   bg: 'bg-pink-100 dark:bg-pink-900/40',      text: 'text-pink-700 dark:text-pink-400' },
];

function tagColorClasses(color?: string) {
  return TAG_COLORS.find(c => c.name === color) ?? TAG_COLORS[0];
}

function catMeta(category: BillCategory) {
  return CATEGORIES.find(c => c.value === category) ?? CATEGORIES[3];
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Range = 'today' | '7d' | '30d' | 'all';

function startOf(range: Range): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (range === 'today') return d;
  if (range === '7d')    { d.setDate(d.getDate() - 6);  return d; }
  if (range === '30d')   { d.setDate(d.getDate() - 29); return d; }
  return new Date(0);
}

/* ── Tag Pill ─────────────────────────────────────────────────── */
function TagPill({ tag, onRemove }: { tag: BillTag; onRemove?: () => void }) {
  const cls = tagColorClasses(tag.color);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls.bg} ${cls.text}`}>
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:opacity-60 cursor-pointer">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

/* ── Bill Dialog (add + edit) ─────────────────────────────────── */
interface BillDialogProps {
  open: boolean;
  editBill?: Bill | null;   // null/undefined = add mode, Bill = edit mode
  onClose: () => void;
  tags: BillTag[];
  cur: string;
}

function BillDialog({ open, editBill, onClose, tags, cur }: BillDialogProps) {
  const me = useCurrentStaff();
  const isEdit = !!editBill;

  const [description, setDescription] = useState('');
  const [amount,      setAmount]      = useState('');
  const [category,   setCategory]   = useState<BillCategory>('general');
  const [paidBy,     setPaidBy]     = useState<BillPayer | undefined>(undefined);
  const [supplier,   setSupplier]   = useState('');
  const [notes,      setNotes]      = useState('');
  const [dateVal,    setDateVal]    = useState('');
  const [selTagIds,  setSelTagIds]  = useState<string[]>([]);

  const [newTagName,  setNewTagName]  = useState('');
  const [newTagColor, setNewTagColor] = useState('gray');
  const [showTagForm, setShowTagForm] = useState(false);

  useEffect(() => {
    if (open) {
      if (editBill) {
        // Pre-fill for edit
        setDescription(editBill.description);
        setAmount(String(editBill.amount));
        setCategory(editBill.category);
        setPaidBy(editBill.paidBy);
        setSupplier(editBill.supplier ?? '');
        setNotes(editBill.notes ?? '');
        setDateVal(toDateInputValue(new Date(editBill.date)));
        setSelTagIds(editBill.tagIds ?? []);
      } else {
        setDescription(''); setAmount(''); setCategory('general');
        setPaidBy(undefined); setSupplier(''); setNotes(''); setSelTagIds([]);
        setDateVal(toDateInputValue(new Date()));
      }
      setNewTagName(''); setNewTagColor('gray'); setShowTagForm(false);
    }
  }, [open, editBill]);

  if (!open) return null;

  const canSubmit = description.trim().length > 0 && parseFloat(amount) > 0 && dateVal.length > 0;

  function handleAddTag() {
    if (!newTagName.trim()) return;
    const tag: BillTag = { id: newId('btag'), name: newTagName.trim(), color: newTagColor };
    getStore().billTags.set(prev => [...prev, tag]);
    setSelTagIds(prev => [...prev, tag.id]);
    setNewTagName(''); setNewTagColor('gray'); setShowTagForm(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (isEdit && editBill) {
      // Update existing bill
      getStore().bills.set(prev => prev.map(b => b.id === editBill.id ? {
        ...b,
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        paidBy: paidBy ?? undefined,
        tagIds: selTagIds,
        date: new Date(dateVal + 'T00:00:00'),
        supplier: supplier.trim() || undefined,
        notes: notes.trim() || undefined,
      } : b));
    } else {
      // Create new bill
      const bill: Bill = {
        id: newId('bill'),
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        paidBy: paidBy ?? undefined,
        tagIds: selTagIds,
        date: new Date(dateVal + 'T00:00:00'),
        supplier: supplier.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: new Date(),
        createdByStaffId: me?.id,
      };
      getStore().bills.set(prev => [bill, ...prev]);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit bill' : 'Add bill'}>
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg glass-strong rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              {isEdit ? <Pencil size={16} strokeWidth={2} /> : <Receipt size={16} strokeWidth={2} />}
            </div>
            <h2 className="text-lg font-semibold">{isEdit ? 'Edit Bill' : 'Add Bill / Expense'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description *</label>
          <input
            autoFocus
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Coffee beans, Electricity bill…"
            className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount ({cur}) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date *</label>
            <input
              type="date"
              value={dateVal}
              onChange={e => setDateVal(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const active = category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    active
                      ? `${cat.accent} ring-2 ring-current ring-offset-1`
                      : 'bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon size={14} strokeWidth={2} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Paid by */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paid By</label>
          <div className="flex gap-2">
            {PAYERS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPaidBy(prev => prev === p ? undefined : p)}
                className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-all cursor-pointer ring-offset-1 ${
                  paidBy === p
                    ? `${PAYER_COLORS[p]} ring-2 ring-current`
                    : 'bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Supplier */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier / Payee</label>
          <input
            value={supplier}
            onChange={e => setSupplier(e.target.value)}
            placeholder="optional"
            className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</label>
            <button
              type="button"
              onClick={() => setShowTagForm(v => !v)}
              className="text-xs text-primary font-medium hover:opacity-80 cursor-pointer flex items-center gap-1"
            >
              <Plus size={12} />New tag
            </button>
          </div>

          {showTagForm && (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                placeholder="Tag name…"
                className="flex-1 h-9 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={newTagColor}
                onChange={e => setNewTagColor(e.target.value)}
                className="h-9 px-2 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                {TAG_COLORS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <button type="button" onClick={handleAddTag} className="h-9 px-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition cursor-pointer">
                Add
              </button>
            </div>
          )}

          {tags.filter(t => !t.archived).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.filter(t => !t.archived).map(tag => {
                const selected = selTagIds.includes(tag.id);
                const cls = tagColorClasses(tag.color);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelTagIds(prev => selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all cursor-pointer ring-offset-1 ${cls.bg} ${cls.text} ${selected ? 'ring-2 ring-current' : 'opacity-60 hover:opacity-100'}`}
                  >
                    {selected && <Check size={10} strokeWidth={3} />}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="optional"
            className="w-full px-3 py-2 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 h-10 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isEdit ? 'Save Changes' : 'Save Bill'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Bill Row ─────────────────────────────────────────────────── */
function BillRow({ bill, tags, cur, onEdit, onDelete }: {
  bill: Bill; tags: BillTag[]; cur: string; onEdit: () => void; onDelete: () => void;
}) {
  const meta = catMeta(bill.category);
  const Icon = meta.icon;
  const billTags = tags.filter(t => bill.tagIds.includes(t.id));
  const dateStr = new Date(bill.date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${meta.accent}`}>
        <Icon size={14} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium truncate">{bill.description}</p>
              {bill.paidBy && (
                <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${PAYER_COLORS[bill.paidBy]}`}>
                  {bill.paidBy}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {dateStr}{bill.supplier ? ` · ${bill.supplier}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400 mr-1">
              -{cur}{fmtCur(bill.amount)}
            </span>
            <button
              onClick={onEdit}
              aria-label="Edit bill"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Pencil size={13} strokeWidth={2} />
            </button>
            <button
              onClick={onDelete}
              aria-label="Delete bill"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
        {(billTags.length > 0 || bill.notes) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {billTags.map(t => <TagPill key={t.id} tag={t} />)}
            {bill.notes && <span className="text-xs text-muted-foreground italic">{bill.notes}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function BillsPage() {
  const me = useCurrentStaff();
  const bills   = useBills();
  const tags    = useBillTags();
  const cur     = useSettings().currency;

  const [range,          setRange]          = useState<Range>('30d');
  const [filterCat,      setFilterCat]      = useState<BillCategory | 'all'>('all');
  const [filterTagId,    setFilterTagId]    = useState<string | 'all'>('all');
  const [filterPaidBy,   setFilterPaidBy]   = useState<BillPayer | 'all'>('all');
  const [showDialog,     setShowDialog]     = useState(false);
  const [editingBill,    setEditingBill]    = useState<Bill | null>(null);

  function openAdd()          { setEditingBill(null); setShowDialog(true); }
  function openEdit(b: Bill)  { setEditingBill(b);    setShowDialog(true); }
  function closeDialog()      { setShowDialog(false); setEditingBill(null); }

  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">Manager access required.</p>
      </div>
    );
  }

  /* ── Filtered list ──────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const since = startOf(range);
    return bills
      .filter(b => {
        const d = new Date(b.date);
        if (d < since) return false;
        if (filterCat !== 'all' && b.category !== filterCat) return false;
        if (filterTagId !== 'all' && !b.tagIds.includes(filterTagId)) return false;
        if (filterPaidBy !== 'all' && b.paidBy !== filterPaidBy) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, range, filterCat, filterTagId, filterPaidBy]);

  /* ── Totals ─────────────────────────────────────────────────── */
  const totals = useMemo(() => {
    const byCategory: Record<BillCategory, number> = { cafe: 0, rooms: 0, coworking: 0, general: 0 };
    const byPayer: Record<BillPayer, number> = { JD: 0, Sasinee: 0 };
    let grand = 0;
    for (const b of filtered) {
      byCategory[b.category] += b.amount;
      grand += b.amount;
      if (b.paidBy) byPayer[b.paidBy] += b.amount;
    }
    return { byCategory, byPayer, grand };
  }, [filtered]);

  function handleDelete(id: string) {
    getStore().bills.set(prev => prev.filter(b => b.id !== id));
  }

  const activeTags = tags.filter(t => !t.archived);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            <Receipt size={18} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Bills &amp; Expenses</h1>
            <p className="text-xs text-muted-foreground">Track business costs by category</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 h-9 px-4 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add Bill
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.value} className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${cat.accent}`}>
                    <Icon size={13} strokeWidth={2} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{cat.label}</span>
                </div>
                <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                  -{cur}{fmtCur(totals.byCategory[cat.value])}
                </p>
              </div>
            );
          })}
        </div>

        {/* Per-payer totals + grand total */}
        <div className="glass rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingDown size={16} strokeWidth={2} />
              Total expenses ({range === 'today' ? 'today' : range === '7d' ? 'last 7 days' : range === '30d' ? 'last 30 days' : 'all time'})
            </div>
            <span className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
              -{cur}{fmtCur(totals.grand)}
            </span>
          </div>
          <div className="flex gap-3 border-t border-border pt-3">
            {PAYERS.map(p => (
              <div key={p} className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl ${PAYER_COLORS[p]}`}>
                <span className="text-xs font-semibold">{p}</span>
                <span className="text-sm font-bold tabular-nums">-{cur}{fmtCur(totals.byPayer[p])}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-muted-foreground shrink-0" />

          {/* Date range */}
          {(['today', '7d', '30d', 'all'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`h-8 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                range === r ? 'bg-primary text-primary-foreground' : 'bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'today' ? 'Today' : r === '7d' ? '7 days' : r === '30d' ? '30 days' : 'All time'}
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Category filter */}
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value as BillCategory | 'all')}
            className="h-8 px-2.5 rounded-xl text-xs font-medium bg-black/5 dark:bg-white/5 border border-border focus:outline-none cursor-pointer"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          {/* Paid-by filter */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterPaidBy('all')}
              className={`h-8 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                filterPaidBy === 'all' ? 'bg-primary text-primary-foreground' : 'bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            {PAYERS.map(p => (
              <button
                key={p}
                onClick={() => setFilterPaidBy(prev => prev === p ? 'all' : p)}
                className={`h-8 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filterPaidBy === p ? `${PAYER_COLORS[p]} ring-2 ring-current ring-offset-1` : 'bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Tag filter */}
          {activeTags.length > 0 && (
            <select
              value={filterTagId}
              onChange={e => setFilterTagId(e.target.value)}
              className="h-8 px-2.5 rounded-xl text-xs font-medium bg-black/5 dark:bg-white/5 border border-border focus:outline-none cursor-pointer"
            >
              <option value="all">All tags</option>
              {activeTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>

        {/* Bill list */}
        <div className="glass rounded-2xl px-4 py-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Receipt size={32} strokeWidth={1.2} />
              <p className="text-sm">No bills in this period</p>
              <button
                onClick={openAdd}
                className="text-xs text-primary font-medium hover:opacity-80 cursor-pointer"
              >
                + Add first bill
              </button>
            </div>
          ) : (
            filtered.map(bill => (
              <BillRow
                key={bill.id}
                bill={bill}
                tags={tags}
                cur={cur}
                onEdit={() => openEdit(bill)}
                onDelete={() => handleDelete(bill.id)}
              />
            ))
          )}
        </div>

        {/* Tag management section */}
        {activeTags.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={14} strokeWidth={2} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTags.map(tag => (
                <div key={tag.id} className="flex items-center gap-1">
                  <TagPill tag={tag} />
                  <button
                    onClick={() => getStore().billTags.set(prev => prev.map(t => t.id === tag.id ? { ...t, archived: true } : t))}
                    aria-label={`Remove tag ${tag.name}`}
                    className="text-muted-foreground hover:text-red-500 cursor-pointer transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BillDialog open={showDialog} editBill={editingBill} onClose={closeDialog} tags={tags} cur={cur} />
    </div>
  );
}
