'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Receipt, Coffee, Monitor, BedDouble, RotateCcw, Trash2 } from 'lucide-react';
import { useTabs, useSettings } from '@/lib/hooks/useStore';
import { tabGrandTotal, tabRefundedAmount } from '@/lib/domain/tabs';
import { getStore } from '@/lib/store/store';
import { confirm } from '@/components/ui/confirm-dialog';
import type { Tab, TabType } from '@/lib/types';

const TYPE_ICON = { cafe: Coffee, desk: Monitor, room: BedDouble } as const;
const TYPE_COLOR: Record<TabType, string> = {
  cafe: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  desk: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  room: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

function startOfDayKey(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
function isToday(d: Date) {
  return startOfDayKey(d) === startOfDayKey(new Date());
}
function isYesterday(d: Date) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return startOfDayKey(d) === startOfDayKey(y);
}
function dayLabel(d: Date) {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HistoryPage() {
  const tabs = useTabs();
  const cur = useSettings().currency;
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TabType>('all');

  async function deleteTab(tab: Tab) {
    const ok = await confirm({
      title: 'Delete this order?',
      message: `${tab.customerName} · ${tab.label}. This permanently removes the tab and its receipt. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    getStore().tabs.set(prev => prev.filter(t => t.id !== tab.id));
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
    let revenue = 0;
    let refunds = 0;
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
            {totals.count} order{totals.count === 1 ? '' : 's'} · {cur}{(totals.revenue - totals.refunds).toFixed(2)} net
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

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
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
                  {group.items.length} · {cur}{(dayTotal - dayRefunds).toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border overflow-hidden">
                {group.items.map(tab => {
                  const Icon = TYPE_ICON[tab.type];
                  const total = tabGrandTotal(tab.items, tab.discount);
                  const refunded = tabRefundedAmount(tab);
                  const time = new Date(tab.paidAt!).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                  return (
                    <Link
                      key={tab.id}
                      href={`/receipt/${tab.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-black/3 dark:hover:bg-white/5 transition-colors cursor-pointer"
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
                          {time} · {tab.items.reduce((s, li) => s + li.qty, 0)} item{tab.items.reduce((s, li) => s + li.qty, 0) === 1 ? '' : 's'}
                          {tab.paymentMethod && ` · ${tab.paymentMethod}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{cur}{total.toFixed(2)}</p>
                        {refunded > 0 && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 tabular-nums">−{cur}{refunded.toFixed(2)}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteTab(tab); }}
                        title="Delete order"
                        aria-label={`Delete order for ${tab.customerName}`}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
