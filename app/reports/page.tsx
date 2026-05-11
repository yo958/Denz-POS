'use client';

import { useMemo, useState } from 'react';
import { TrendingUp, ShoppingBag, Clock, DollarSign, Coffee, Monitor, BedDouble, RotateCcw, CreditCard, QrCode, Banknote } from 'lucide-react';
import { useTabs, useShift, useSettings, useCurrentStaff } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';
import { lineUnitPrice, lineEffectiveUnitPrice, tabGrandTotal, tabRefundedAmount, tabCardFee } from '@/lib/domain/tabs';
import { buildZReport } from '@/lib/domain/shift';
import type { PaymentMethod, TabType } from '@/lib/types';

type Range = 'today' | '7d' | '30d' | 'all';

function startOf(range: Range): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === 'today') return d;
  if (range === '7d')   { d.setDate(d.getDate() - 6);  return d; }
  if (range === '30d')  { d.setDate(d.getDate() - 29); return d; }
  return new Date(0);
}

const TYPE_META: Record<TabType, { label: string; icon: typeof Coffee; color: string }> = {
  cafe: { label: 'Cafe',      icon: Coffee,    color: 'text-sky-600 dark:text-sky-400' },
  desk: { label: 'CoWorking', icon: Monitor,   color: 'text-violet-600 dark:text-violet-400' },
  room: { label: 'Rooms',     icon: BedDouble, color: 'text-emerald-600 dark:text-emerald-400' },
};

const METHOD_META: Record<PaymentMethod, { label: string; icon: typeof CreditCard }> = {
  card:  { label: 'Card',       icon: CreditCard },
  qr:    { label: 'QR',        icon: QrCode },
  cash:  { label: 'Cash',      icon: Banknote },
  room:  { label: 'Room',      icon: BedDouble },
  split: { label: 'Split',     icon: CreditCard },
};

export default function ReportsPage() {
  const me = useCurrentStaff();
  const tabs = useTabs();
  const shift = useShift();
  const cur = useSettings().currency;
  const [range, setRange] = useState<Range>('today');

  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">Manager access required.</p>
      </div>
    );
  }

  const stats = useMemo(() => {
    const since = startOf(range);
    const inRange = tabs.filter(t => (t.paidAt ? t.paidAt : t.openedAt) >= since);
    const paid = inRange.filter(t => t.status === 'paid' || t.status === 'refunded');
    const open = tabs.filter(t => t.status === 'open');
    const revenue   = paid.reduce((s, t) => {
      const base = tabGrandTotal(t.items, t.discount);
      const fee  = t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount) : 0;
      return s + base + fee;
    }, 0);
    const refunds   = paid.reduce((s, t) => s + tabRefundedAmount(t), 0);
    const pipeline  = open.reduce((s, t) => s + tabGrandTotal(t.items, t.discount), 0);
    const totalItems = inRange.reduce((s, t) => s + t.items.reduce((s2, li) => s2 + li.qty, 0), 0);

    const byType: Record<TabType, number> = { cafe: 0, desk: 0, room: 0 };
    const byMethod: Record<PaymentMethod, number> = { card: 0, qr: 0, cash: 0, room: 0, split: 0 };
    for (const t of paid) {
      // Bucket revenue by each line item's product category, not the tab type,
      // since one tab can mix cafe items with desk/room charges.
      for (const li of t.items) {
        const qty = Math.max(0, li.qty - (li.refundedQty ?? 0));
        if (qty <= 0) continue;
        // Use the effective (post-item-discount) unit price so per-item discounts
        // are reflected in the correct revenue bucket (e.g. a desk discount only
        // reduces coworking revenue, not food/drinks revenue).
        const lineRevenue = lineEffectiveUnitPrice(li) * qty;
        const bucket: TabType =
          li.product.category === 'desks' ? 'desk' :
          li.product.category === 'rooms' ? 'room' :
          'cafe'; // food + drinks
        byType[bucket] += lineRevenue;
      }
      if (t.paymentMethod) {
        const base = tabGrandTotal(t.items, t.discount);
        const fee  = t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount) : 0;
        byMethod[t.paymentMethod] += base + fee;
      }
    }

    const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const t of inRange) {
      for (const li of t.items) {
        if (!itemCounts[li.productId]) itemCounts[li.productId] = { name: li.product.name, qty: 0, revenue: 0 };
        itemCounts[li.productId].qty += li.qty;
        itemCounts[li.productId].revenue += lineEffectiveUnitPrice(li) * li.qty;
      }
    }
    const topItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 5);

    return { revenue, refunds, net: revenue - refunds, pipeline, openTabs: open.length, paidTabs: paid.length, totalItems, byType, byMethod, topItems };
  }, [tabs, range]);

  const typeTotal = Object.values(stats.byType).reduce((s, v) => s + v, 0);
  const z = shift ? buildZReport(shift, tabs) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong">
        <div>
          <h1 className="text-lg font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {range === 'today' ? 'Today' : range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'All time'}
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5">
          {(['today', '7d', '30d', 'all'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)} className={`h-7 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${range === r ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {r === '7d' ? '7d' : r === '30d' ? '30d' : r === 'all' ? 'All' : 'Today'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Revenue',   value: `${cur}${fmtCur(stats.revenue)}`, sub: `${stats.paidTabs} paid tab${stats.paidTabs !== 1 ? 's' : ''}`, icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
            { label: 'Net Sales', value: `${cur}${fmtCur(stats.net)}`,     sub: `−${cur}${fmtCur(stats.refunds)} refunds`, icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/20' },
            { label: 'Pipeline',  value: `${cur}${fmtCur(stats.pipeline)}`,sub: `${stats.openTabs} open tab${stats.openTabs !== 1 ? 's' : ''}`, icon: Clock, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/20' },
            { label: 'Items',     value: String(stats.totalItems),       sub: 'in range',          icon: ShoppingBag, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/20' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-white/60 dark:bg-white/5">
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${card.bg}`}><Icon size={18} className={card.color} /></div>
                <div>
                  <p className="text-xl font-bold tabular-nums">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        <section>
          <h2 className="text-sm font-semibold mb-3">By Area</h2>
          <div className="rounded-2xl border border-border overflow-hidden bg-white/50 dark:bg-white/3 divide-y divide-border">
            {(Object.entries(stats.byType) as [TabType, number][])
              .sort(([, a], [, b]) => b - a)
              .map(([type, amount]) => {
                const { label, icon: Icon, color } = TYPE_META[type];
                const pct = typeTotal > 0 ? (amount / typeTotal) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-4 px-4 py-3">
                    <Icon size={16} className={color} />
                    <span className="text-sm font-medium flex-1">{label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 rounded-full bg-black/8 dark:bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{Math.round(pct)}%</span>
                      <span className="text-sm font-semibold tabular-nums w-20 text-right">{cur}{fmtCur(amount)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">By Payment Method</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(stats.byMethod) as [PaymentMethod, number][]).map(([m, v]) => {
              const { label, icon: Icon } = METHOD_META[m];
              return (
                <div key={m} className="rounded-2xl border border-border p-4 bg-white/50 dark:bg-white/3">
                  <Icon size={16} className="text-muted-foreground mb-2" />
                  <p className="text-lg font-bold tabular-nums">{cur}{fmtCur(v)}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              );
            })}
          </div>
        </section>

        {z && (
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              Current Shift Z-Report
              <span className="text-xs font-normal text-muted-foreground">opened {z.shift.openedAt.toLocaleString()}</span>
            </h2>
            <div className="rounded-2xl border border-border bg-white/60 dark:bg-white/5 p-4 grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Opening float</span><span className="text-right tabular-nums">{cur}{fmtCur(z.shift.openingFloat)}</span>
              <span className="text-muted-foreground">Cash sales</span>   <span className="text-right tabular-nums">{cur}{fmtCur(z.totalsByMethod.cash)}</span>
              <span className="text-muted-foreground">Card sales</span>   <span className="text-right tabular-nums">{cur}{fmtCur(z.totalsByMethod.card)}</span>
              <span className="text-muted-foreground">QR sales</span>     <span className="text-right tabular-nums">{cur}{fmtCur(z.totalsByMethod.qr)}</span>
              <span className="text-muted-foreground">Room charges</span> <span className="text-right tabular-nums">{cur}{fmtCur(z.totalsByMethod.room)}</span>
              <span className="text-muted-foreground">Refunds</span>      <span className="text-right tabular-nums text-rose-600 dark:text-rose-400">−{cur}{fmtCur(z.refundsTotal)}</span>
              <span className="font-semibold">Net sales</span>            <span className="text-right font-semibold tabular-nums">{cur}{fmtCur(z.netSales)}</span>
              <span className="font-semibold">Expected cash</span>        <span className="text-right font-semibold tabular-nums">{cur}{fmtCur(z.expectedCash)}</span>
              <span className="text-muted-foreground">Voids · Refunds</span><span className="text-right tabular-nums">{z.voidsCount} · {z.refundsCount}</span>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold mb-3">Top Items</h2>
          <div className="rounded-2xl border border-border overflow-hidden bg-white/50 dark:bg-white/3 divide-y divide-border">
            {stats.topItems.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">No data.</p>}
            {stats.topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-4 px-4 py-3">
                <span className="text-xs font-bold text-muted-foreground tabular-nums w-4">{i + 1}</span>
                <span className="text-sm font-medium flex-1">{item.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{item.qty}×</span>
                <span className="text-sm font-semibold tabular-nums w-16 text-right">{cur}{fmtCur(item.revenue)}</span>
              </div>
            ))}
          </div>
        </section>

        {stats.refunds > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <RotateCcw size={14} className="text-rose-600 dark:text-rose-400" /> Refunds
            </h2>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
              {tabs.filter(t => (t.refunds?.length ?? 0) > 0).map(t => (
                <div key={t.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{t.customerName} · {t.label}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold tabular-nums">−{cur}{fmtCur(tabRefundedAmount(t))}</span>
                  </div>
                  {t.refunds!.map(r => (
                    <p key={r.id} className="text-xs text-muted-foreground">{r.reason}</p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
