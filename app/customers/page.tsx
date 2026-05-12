'use client';

import { useMemo, useState } from 'react';
import {
  UserPlus, Pencil, Trash2, Phone, Mail, Globe, Briefcase,
  Star, Search, X, Coffee, Monitor, BedDouble, Clock, TrendingUp,
  ShoppingBag, DollarSign, Printer, CreditCard, QrCode, Banknote,
} from 'lucide-react';
import { useCustomers, useCurrentStaff, useTabs, useSettings } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { newId } from '@/lib/domain/id';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { CustomerEditDialog } from '@/components/customers/CustomerEditDialog';
import { countryLabel, countryFlag } from '@/lib/countries';
import {
  tabGrandTotal, tabCardFee, tabRefundedAmount, lineUnitPrice, effectiveQty, formatDate, formatTime,
} from '@/lib/domain/tabs';
import { fmtCur } from '@/lib/format';
import type { Customer, Tab, TabType } from '@/lib/types';

const TYPE_ICON = { cafe: Coffee, desk: Monitor, room: BedDouble } as const;
const TYPE_COLOR: Record<TabType, string> = {
  cafe:  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  desk:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  room:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};
const METHOD_ICON: Record<string, typeof CreditCard> = {
  card: CreditCard, qr: QrCode, cash: Banknote, room: BedDouble,
};
const METHOD_LABEL: Record<string, string> = {
  card: 'Card', qr: 'QR', cash: 'Cash', room: 'Room',
};

/* ── Customer Detail Panel ────────────────────────────────────────── */

function CustomerDetailPanel({ customer, onClose, onEdit, cur }: {
  customer: Customer;
  onClose: () => void;
  onEdit: () => void;
  cur: string;
}) {
  const settings  = useSettings();
  const taxRate   = settings.taxEnabled === false ? 0 : settings.taxRate;
  const allTabs   = useTabs();
  const initials  = customer.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';

  const { openTabs, pastTabs, stats } = useMemo(() => {
    const mine = allTabs.filter(t => t.customerId === customer.id);
    const open = mine.filter(t => t.status === 'open').sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt));
    const past = mine.filter(t => t.status === 'paid' || t.status === 'refunded').sort((a, b) => +new Date(b.paidAt!) - +new Date(a.paidAt!));

    const totalSpent = past.reduce((s, t) => {
      const base = tabGrandTotal(t.items, t.discount, taxRate);
      const fee  = t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount, taxRate) : 0;
      return s + base + fee - tabRefundedAmount(t);
    }, 0);
    const openValue  = open.reduce((s, t) => s + tabGrandTotal(t.items, t.discount, taxRate), 0);
    const visits     = past.length;
    const avgOrder   = visits > 0 ? totalSpent / visits : 0;
    const firstVisit = past.length > 0 ? new Date(past[past.length - 1].paidAt!) : null;
    const lastVisit  = past.length > 0 ? new Date(past[0].paidAt!) : null;

    // Most-ordered item across all tabs
    const itemTotals: Record<string, { name: string; qty: number }> = {};
    for (const t of mine) {
      for (const li of t.items) {
        const q = effectiveQty(li);
        if (!itemTotals[li.productId]) itemTotals[li.productId] = { name: li.product.name, qty: 0 };
        itemTotals[li.productId].qty += q;
      }
    }
    const topItem = Object.values(itemTotals).sort((a, b) => b.qty - a.qty)[0] ?? null;

    return { openTabs: open, pastTabs: past, stats: { totalSpent, openValue, visits, avgOrder, firstVisit, lastVisit, topItem } };
  }, [allTabs, customer.id, taxRate]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4 border-b border-border shrink-0">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
            {customer.image
              ? <img src={customer.image} alt={customer.name} className="w-full h-full object-cover" />
              : <span className="text-primary text-lg font-bold">{initials}</span>
            }
            {customer.vip && (
              <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                <Star size={10} className="text-white fill-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{customer.name}</h2>
              {customer.vip && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  <Star size={8} className="fill-current" /> VIP
                </span>
              )}
              {customer.discount && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  {customer.discount.type === 'pct' ? `${customer.discount.value}% off` : `${cur}${customer.discount.value} off`}
                </span>
              )}
              {customer.visitorType && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 capitalize">
                  {customer.visitorType.replace('-', '‑')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {customer.jobRole && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Briefcase size={10}/>{customer.jobRole}</span>}
              {customer.country && <span className="text-xs text-muted-foreground">{countryFlag(customer.country)} {countryLabel(customer.country).replace(/^\S+\s/, '')}</span>}
              {customer.phone && <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"><Phone size={10}/>{customer.phone}</a>}
              {customer.email && <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"><Mail size={10}/>{customer.email}</a>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" title="Edit customer"><Pencil size={14}/></button>
            <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"><X size={16}/></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: DollarSign,  label: 'Total spent',  value: `${cur}${fmtCur(stats.totalSpent)}`,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
              { icon: TrendingUp,  label: 'Avg order',    value: `${cur}${fmtCur(stats.avgOrder)}`,    color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/20' },
              { icon: ShoppingBag, label: 'Visits',       value: String(stats.visits),                   color: 'text-sky-600 dark:text-sky-400',       bg: 'bg-sky-100 dark:bg-sky-900/20' },
              { icon: Clock,       label: 'Open value',   value: `${cur}${fmtCur(stats.openValue)}`,   color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/20' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="flex flex-col gap-2 p-3 rounded-2xl border border-border bg-white/60 dark:bg-white/5">
                <div className={`flex items-center justify-center w-8 h-8 rounded-xl ${bg}`}><Icon size={15} className={color}/></div>
                <div>
                  <p className="text-base font-bold tabular-nums">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Extra meta */}
          <div className="rounded-2xl border border-border divide-y divide-border text-sm overflow-hidden">
            {stats.firstVisit && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">First visit</span>
                <span>{formatDate(stats.firstVisit)}</span>
              </div>
            )}
            {stats.lastVisit && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Last visit</span>
                <span>{formatDate(stats.lastVisit)}</span>
              </div>
            )}
            {stats.topItem && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Favourite item</span>
                <span className="font-medium">{stats.topItem.name} <span className="text-muted-foreground font-normal">×{stats.topItem.qty}</span></span>
              </div>
            )}
            {customer.notes && (
              <div className="flex justify-between gap-6 px-4 py-2.5">
                <span className="text-muted-foreground shrink-0">Notes</span>
                <span className="text-right">{customer.notes}</span>
              </div>
            )}
          </div>

          {/* Open tabs */}
          {openTabs.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Open tabs ({openTabs.length})</h3>
              <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {openTabs.map(tab => {
                  const Icon  = TYPE_ICON[tab.type];
                  const total = tabGrandTotal(tab.items, tab.discount, taxRate);
                  return (
                    <div key={tab.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${TYPE_COLOR[tab.type]}`}><Icon size={12} strokeWidth={2}/></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{tab.label}</p>
                        <p className="text-xs text-muted-foreground">{tab.items.reduce((s, li) => s + li.qty, 0)} items · opened {formatTime(tab.openedAt)}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{cur}{fmtCur(total)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Past orders */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Order history {pastTabs.length > 0 && `(${pastTabs.length})`}
            </h3>
            {pastTabs.length === 0
              ? <p className="text-sm text-muted-foreground px-1">No completed orders yet.</p>
              : (
                <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                  {pastTabs.map(tab => {
                    const Icon     = TYPE_ICON[tab.type];
                    const base     = tabGrandTotal(tab.items, tab.discount, taxRate);
                    const fee      = tab.paymentMethod === 'card' ? tabCardFee(tab.items, tab.discount, taxRate) : 0;
                    const total    = base + fee;
                    const refunded = tabRefundedAmount(tab);
                    const MethodIcon = tab.paymentMethod ? (METHOD_ICON[tab.paymentMethod] ?? Banknote) : null;
                    return (
                      <div key={tab.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${TYPE_COLOR[tab.type]}`}><Icon size={12} strokeWidth={2}/></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{tab.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground">{tab.paidAt ? formatDate(tab.paidAt) : '—'}</p>
                            {MethodIcon && tab.paymentMethod && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <MethodIcon size={10}/> {METHOD_LABEL[tab.paymentMethod]}
                              </span>
                            )}
                            {tab.status === 'refunded' && (
                              <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">REFUNDED</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold tabular-nums">{cur}{fmtCur(total)}</p>
                          {refunded > 0 && <p className="text-xs text-rose-500 tabular-nums">−{cur}{fmtCur(refunded)}</p>}
                        </div>
                        <a
                          href={`/receipt/${tab.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                          title="Print receipt"
                        >
                          <Printer size={12}/>
                        </a>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Customer Row ─────────────────────────────────────────────────── */

interface CustomerRowProps {
  customer: Customer;
  isManager: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

function CustomerRow({ customer: c, isManager, onSelect, onEdit, onArchive }: CustomerRowProps) {
  const initials = c.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-white/50 dark:bg-white/3 hover:bg-black/3 dark:hover:bg-white/5 transition-colors cursor-pointer"
    >
      {/* Avatar */}
      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
        {c.image
          ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
          : <span className="text-primary text-sm font-bold">{initials}</span>
        }
        {c.vip && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
            <Star size={9} className="text-white fill-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{c.name}</span>
          {c.vip && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <Star size={8} className="fill-current" /> VIP
            </span>
          )}
          {c.discount && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              {c.discount.type === 'pct' ? `${c.discount.value}% off` : `${c.discount.value} off`}
            </span>
          )}
          {c.visitorType && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 capitalize">
              {c.visitorType.replace('-', '‑')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {c.jobRole && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Briefcase size={10}/> {c.jobRole}</span>}
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
              <Phone size={10}/> {c.phone}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
              <Mail size={10}/> {c.email}
            </a>
          )}
          {c.website && (
            <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
              <Globe size={10}/> {c.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {c.country && <span className="text-xs text-muted-foreground">{countryLabel(c.country)}</span>}
        </div>
      </div>

      {/* Actions */}
      {isManager && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            aria-label={`Edit ${c.name}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <Pencil size={13}/>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onArchive(); }}
            aria-label={`Archive ${c.name}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
          >
            <Trash2 size={13}/>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function CustomersPage() {
  const customers  = useCustomers();
  const me         = useCurrentStaff();
  const cur        = useSettings().currency;
  const isManager  = me?.role === 'manager';

  const [search,          setSearch]          = useState('');
  const [selected,        setSelected]        = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [typeFilter,      setTypeFilter]      = useState<'all' | 'local' | 'tourist' | 'expat' | 'semi-expat'>('all');
  const [countryFilter,   setCountryFilter]   = useState('');
  const [vipOnly,         setVipOnly]         = useState(false);
  const [discountOnly,    setDiscountOnly]    = useState(false);

  // Countries that actually appear in the customer list (for the dropdown)
  const usedCountries = useMemo(() => {
    const codes = [...new Set(customers.filter(c => !c.archived && c.country).map(c => c.country!))];
    return codes.sort((a, b) => countryLabel(a).localeCompare(countryLabel(b)));
  }, [customers]);

  const visible = customers
    .filter(c => !c.archived)
    .filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.jobRole?.toLowerCase().includes(search.toLowerCase()) ||
      (c.country ? countryLabel(c.country).toLowerCase().includes(search.toLowerCase()) : false),
    )
    .filter(c => typeFilter === 'all' || c.visitorType === typeFilter)
    .filter(c => !countryFilter || c.country === countryFilter)
    .filter(c => !vipOnly || !!c.vip)
    .filter(c => !discountOnly || !!c.discount)
    .sort((a, b) => {
      if (a.vip && !b.vip) return -1;
      if (!a.vip && b.vip) return 1;
      return a.name.localeCompare(b.name);
    });

  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (countryFilter ? 1 : 0) + (vipOnly ? 1 : 0) + (discountOnly ? 1 : 0);

  function clearFilters() {
    setTypeFilter('all'); setCountryFilter(''); setVipOnly(false); setDiscountOnly(false);
  }

  function startNew() {
    setEditingCustomer({ id: newId('cust'), name: '', createdAt: new Date() });
  }

  async function archiveCustomer(c: Customer) {
    const ok = await confirm({
      title: `Archive ${c.name}?`,
      message: 'The customer will be hidden. You can restore them from data.',
      danger: true,
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    getStore().customers.set(prev => prev.map(x => x.id === c.id ? { ...x, archived: true } : x));
    getStore().log('customer.delete', c.name, me?.id);
    toast.success('Customer archived');
    if (selected?.id === c.id) setSelected(null);
  }

  function saveCustomer(c: Customer) {
    getStore().customers.set(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx === -1) return [...prev, c];
      const next = prev.slice(); next[idx] = c; return next;
    });
    const isNew = !customers.some(x => x.id === c.id);
    getStore().log(isNew ? 'customer.create' : 'customer.update', c.name, me?.id);
    toast.success(isNew ? `${c.name} added` : 'Customer updated');
    setEditingCustomer(null);
    // Keep detail panel in sync if we just edited the selected customer
    if (selected?.id === c.id) setSelected(c);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong">
        <div>
          <h1 className="text-lg font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.filter(c => !c.archived).length} active</p>
        </div>
        {isManager && (
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus size={14}/> Add customer
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, role, country…"
              className="w-full max-w-md h-10 pl-9 pr-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 pb-3 flex flex-wrap items-center gap-2">
          {/* Visitor type pills */}
          {(['all', 'local', 'tourist', 'expat', 'semi-expat'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                typeFilter === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-black/5 dark:bg-white/8 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1).replace('-', '‑')}
            </button>
          ))}

          {/* VIP toggle */}
          <button
            onClick={() => setVipOnly(v => !v)}
            className={`h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              vipOnly
                ? 'bg-amber-400 text-white'
                : 'bg-black/5 dark:bg-white/8 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star size={10} className={vipOnly ? 'fill-white' : ''}/> VIP
          </button>

          {/* Discount toggle */}
          <button
            onClick={() => setDiscountOnly(v => !v)}
            className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              discountOnly
                ? 'bg-emerald-500 text-white'
                : 'bg-black/5 dark:bg-white/8 text-muted-foreground hover:text-foreground'
            }`}
          >
            Has discount
          </button>

          {/* Country dropdown (only shown when customers have countries) */}
          {usedCountries.length > 0 && (
            <select
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              className={`h-7 px-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer appearance-none ${
                countryFilter
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-black/5 dark:bg-white/8 text-muted-foreground'
              }`}
            >
              <option value="">All countries</option>
              {usedCountries.map(code => (
                <option key={code} value={code}>{countryLabel(code)}</option>
              ))}
            </select>
          )}

          {/* Clear button */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="h-7 px-3 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors cursor-pointer flex items-center gap-1"
            >
              <X size={10}/> Clear ({activeFilterCount})
            </button>
          )}
        </div>

        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <p className="text-sm">{search || activeFilterCount > 0 ? 'No customers match your filters.' : 'No customers yet.'}</p>
            {isManager && !search && (
              <button onClick={startNew} className="text-sm text-primary hover:underline cursor-pointer">Add the first one</button>
            )}
          </div>
        )}

        <div className="px-6 pb-6 pt-2 space-y-2">
          {visible.map(c => (
            <CustomerRow
              key={c.id}
              customer={c}
              isManager={isManager}
              onSelect={() => setSelected(c)}
              onEdit={() => setEditingCustomer(c)}
              onArchive={() => archiveCustomer(c)}
            />
          ))}
        </div>
      </div>

      {selected && (
        <CustomerDetailPanel
          customer={selected}
          cur={cur}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditingCustomer(selected); setSelected(null); }}
        />
      )}

      {editingCustomer && (
        <CustomerEditDialog
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSave={saveCustomer}
        />
      )}
    </div>
  );
}
