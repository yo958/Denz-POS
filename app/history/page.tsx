'use client';

import { useMemo, useState } from 'react';
import { Search, Receipt, Coffee, Monitor, BedDouble, RotateCcw, Trash2, X, Printer, Tag, CreditCard, QrCode, Banknote, Star, Check } from 'lucide-react';
import { useTabs, useSettings, useCurrentStaff, useCustomers } from '@/lib/hooks/useStore';
import {
  tabDiscountAmount, tabTax, tabGrandTotal, tabCardFee,
  tabRefundedAmount, lineUnitPrice, lineEffectiveUnitPrice, effectiveQty, modifiersSummary, CARD_FEE_RATE,
  formatTime, formatDate,
} from '@/lib/domain/tabs';
import { fmtCur } from '@/lib/format';
import { getStore } from '@/lib/store/store';
import { confirm } from '@/components/ui/confirm-dialog';
import type { Tab, TabType } from '@/lib/types';

const TYPE_ICON = { cafe: Coffee, desk: Monitor, room: BedDouble } as const;
const TYPE_COLOR: Record<TabType, string> = {
  cafe: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  desk: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  room: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};
const METHOD_ICON: Record<string, typeof CreditCard> = { card: CreditCard, qr: QrCode, cash: Banknote, room: BedDouble, split: CreditCard };
const METHOD_LABEL: Record<string, string> = { card: 'Card', qr: 'QR', cash: 'Cash', room: 'Room charge', split: 'Split (Cash + Card)' };

function startOfDayKey(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime();
}
function isToday(d: Date) { return startOfDayKey(d) === startOfDayKey(new Date()); }
function isYesterday(d: Date) {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return startOfDayKey(d) === startOfDayKey(y);
}
function dayLabel(d: Date) {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function OrderDetailPanel({ tab, onClose, onDelete, cur }: {
  tab: Tab; onClose: () => void; onDelete: (tab: Tab) => void; cur: string;
}) {
  const settings = useSettings();
  const customers = useCustomers();
  const taxRate    = settings.taxEnabled === false ? 0 : settings.taxRate;
  const subtotal   = tab.items.reduce((s, li) => s + lineUnitPrice(li) * Math.max(0, li.qty - (li.refundedQty ?? 0)), 0);
  const lineDiscountTotal = tab.items.reduce((s, li) => {
    const saving = lineUnitPrice(li) - lineEffectiveUnitPrice(li);
    return s + saving * Math.max(0, li.qty - (li.refundedQty ?? 0));
  }, 0);
  const discount   = tabDiscountAmount(tab.items, tab.discount);
  const tax        = tabTax(tab.items, tab.discount, taxRate);
  const baseTotal  = tabGrandTotal(tab.items, tab.discount, taxRate);
  const isCard     = tab.paymentMethod === 'card';
  const cardFee    = isCard ? tabCardFee(tab.items, tab.discount, taxRate) : 0;
  const total      = baseTotal + cardFee;
  const refunded   = tabRefundedAmount(tab);
  const customer   = customers.find(c => c.id === tab.customerId);
  const TypeIcon   = TYPE_ICON[tab.type];
  const MethodIcon = tab.paymentMethod ? (METHOD_ICON[tab.paymentMethod] ?? Receipt) : Receipt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <span className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${TYPE_COLOR[tab.type]}`}>
              <TypeIcon size={18} strokeWidth={2} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-semibold">{tab.customerName}</h2>
                {customer?.vip && <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />}
              </div>
              <p className="text-sm text-muted-foreground">{tab.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Customer info */}
          {customer && (
            <section className="rounded-2xl border border-border bg-black/2 dark:bg-white/3 p-4 space-y-1.5 text-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
              <div className="flex items-center gap-2">
                <span className="font-medium">{customer.name}</span>
                {customer.vip && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">VIP</span>}
              </div>
              {customer.email && <p className="text-muted-foreground">{customer.email}</p>}
              {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
              {customer.jobRole && <p className="text-muted-foreground">{customer.jobRole}</p>}
            </section>
          )}

          {/* Order meta */}
          <section className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{tab.paidAt ? formatDate(tab.paidAt) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span>{tab.paidAt ? formatTime(tab.paidAt) : '—'}</span>
            </div>
            {tab.paymentMethod && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment</span>
                <span className="flex items-center gap-1.5">
                  <MethodIcon size={13} className="text-muted-foreground" />
                  {METHOD_LABEL[tab.paymentMethod] ?? tab.paymentMethod}
                </span>
              </div>
            )}
            {tab.status === 'refunded' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1"><RotateCcw size={12} /> Refunded</span>
              </div>
            )}
          </section>

          {/* Line items */}
          <section>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Items</p>
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {tab.items.map((li, i) => {
                const qty  = effectiveQty(li);
                const unit = lineEffectiveUnitPrice(li);
                const mods = modifiersSummary(li.modifiers);
                return (
                  <div key={li.id ?? i} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-sm text-muted-foreground tabular-nums w-5 shrink-0">{qty}×</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{li.product.name}</p>
                      {mods && <p className="text-xs text-muted-foreground">{mods}</p>}
                      {li.note && <p className="text-xs text-muted-foreground italic">{li.note}</p>}
                      {(li.refundedQty ?? 0) > 0 && (
                        <p className="text-xs text-rose-500">refunded ×{li.refundedQty}</p>
                      )}
                    </div>
                    <span className="text-sm tabular-nums shrink-0">{cur}{fmtCur(unit * qty)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Totals */}
          <section className="space-y-1.5 text-sm border-t border-border pt-4">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{cur}{fmtCur(subtotal)}</span>
            </div>
            {lineDiscountTotal > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1">
                  <Tag size={11} strokeWidth={2} />
                  Item discounts
                </span>
                <span className="tabular-nums">−{cur}{fmtCur(lineDiscountTotal)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1">
                  <Tag size={11} strokeWidth={2} />
                  {tab.discount!.type === 'pct' ? `Discount (${tab.discount!.value}%)` : 'Discount'}
                </span>
                <span className="tabular-nums">−{cur}{fmtCur(discount)}</span>
              </div>
            )}
            {settings.taxEnabled !== false && (
              <div className="flex justify-between text-muted-foreground">
                <span>{settings.taxLabel} ({Math.round(settings.taxRate * 100)}%)</span>
                <span className="tabular-nums">{cur}{fmtCur(tax)}</span>
              </div>
            )}
            {isCard && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Card fee ({Math.round(CARD_FEE_RATE * 100)}%)</span>
                <span className="tabular-nums">+{cur}{fmtCur(cardFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Total</span>
              <span className="tabular-nums">{cur}{fmtCur(total)}</span>
            </div>
            {refunded > 0 && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>Refunded</span>
                <span className="tabular-nums">−{cur}{fmtCur(refunded)}</span>
              </div>
            )}
          </section>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border flex gap-2 shrink-0">
          <button
            onClick={() => onDelete(tab)}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-border text-muted-foreground hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer shrink-0"
            title="Delete order"
          >
            <Trash2 size={15} />
          </button>
          <a
            href={`/receipt/${tab.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-10 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Printer size={15} strokeWidth={2} />
            Print Receipt
          </a>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const me = useCurrentStaff();
  const tabs = useTabs();
  const cur = useSettings().currency;
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TabType>('all');
  const [selected, setSelected] = useState<Tab | null>(null);
  const [received, setReceived] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('denz.paymentReceived');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  function toggleReceived(tabId: string) {
    setReceived(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId); else next.add(tabId);
      try { localStorage.setItem('denz.paymentReceived', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">Manager access required.</p>
      </div>
    );
  }

  async function deleteTab(tab: Tab) {
    const ok = await confirm({
      title: 'Delete this order?',
      message: `${tab.customerName} · ${tab.label}. This permanently removes the tab and its receipt. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    getStore().tabs.set(prev => prev.filter(t => t.id !== tab.id));
    if (selected?.id === tab.id) setSelected(null);
  }

  const { groups, totals } = useMemo(() => {
    const past = tabs
      .filter(t => (t.status === 'paid' || t.status === 'refunded') && t.paidAt)
      .filter(t => typeFilter === 'all' || t.type === typeFilter)
      .filter(t => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return t.customerName.toLowerCase().includes(q)
            || t.label.toLowerCase().includes(q)
            || t.items.some(li => li.product.name.toLowerCase().includes(q));
      })
      .sort((a, b) => +new Date(b.paidAt!) - +new Date(a.paidAt!));

    const map = new Map<number, Tab[]>();
    let revenue = 0; let refunds = 0;
    for (const t of past) {
      revenue += tabGrandTotal(t.items, t.discount);
      refunds += tabRefundedAmount(t);
      const key = startOfDayKey(new Date(t.paidAt!));
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    const groups = Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([key, items]) => ({ key, date: new Date(key), items }));

    return { groups, totals: { count: past.length, revenue, refunds } };
  }, [tabs, query, typeFilter]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border glass-strong">
        <div>
          <h1 className="text-lg font-semibold">Order History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totals.count} order{totals.count === 1 ? '' : 's'} · {cur}{fmtCur(totals.revenue - totals.refunds)} net
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, label or item"
              className="h-9 pl-8 pr-3 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring w-64"
            />
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5">
            {(['all', 'cafe', 'desk', 'room'] as const).map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`h-7 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer capitalize ${typeFilter === f ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'desk' ? 'CoWorking' : f === 'room' ? 'Rooms' : f === 'cafe' ? 'Cafe' : 'All'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 mb-3">
              <Receipt size={24} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No past orders</p>
            <p className="text-xs text-muted-foreground mt-1">Settled tabs will appear here.</p>
          </div>
        ) : groups.map(group => {
          const dayTotal = group.items.reduce((s, t) => s + tabGrandTotal(t.items, t.discount), 0);
          const dayRefunds = group.items.reduce((s, t) => s + tabRefundedAmount(t), 0);
          return (
            <section key={group.key}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">{dayLabel(group.date)}</h2>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {group.items.length} · {cur}{fmtCur(dayTotal - dayRefunds)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border overflow-hidden">
                {group.items.map(tab => {
                  const Icon    = TYPE_ICON[tab.type];
                  const total   = tabGrandTotal(tab.items, tab.discount);
                  const refunded = tabRefundedAmount(tab);
                  const time    = new Date(tab.paidAt!).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                  const itemCount = tab.items.reduce((s, li) => s + li.qty, 0);
                  return (
                    <div
                      key={tab.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        received.has(tab.id)
                          ? 'bg-emerald-50 dark:bg-emerald-900/15'
                          : 'hover:bg-black/3 dark:hover:bg-white/5'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(tab)}
                        className="flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0"
                      >
                        <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${TYPE_COLOR[tab.type]}`}>
                          <Icon size={14} strokeWidth={2} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{tab.customerName}</p>
                            <span className="text-xs text-muted-foreground">· {tab.label}</span>
                            {tab.status === 'refunded' && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                <RotateCcw size={9} /> REFUNDED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {time} · {itemCount} item{itemCount === 1 ? '' : 's'}
                            {tab.paymentMethod && ` · ${METHOD_LABEL[tab.paymentMethod] ?? tab.paymentMethod}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0 mr-3">
                          <p className="text-sm font-semibold tabular-nums">{cur}{fmtCur(total)}</p>
                          {refunded > 0 && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 tabular-nums">−{cur}{fmtCur(refunded)}</p>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleReceived(tab.id)}
                        title={received.has(tab.id) ? 'Payment received' : 'Mark payment received'}
                        className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
                          received.has(tab.id)
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-border text-transparent hover:border-emerald-400'
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <OrderDetailPanel
          tab={selected}
          cur={cur}
          onClose={() => setSelected(null)}
          onDelete={async (tab) => { await deleteTab(tab); }}
        />
      )}
    </div>
  );
}
