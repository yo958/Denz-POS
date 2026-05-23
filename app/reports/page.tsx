'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, ShoppingBag, Clock, DollarSign, Coffee, Monitor, BedDouble, RotateCcw, CreditCard, QrCode, Banknote, Layers, Receipt, Percent } from 'lucide-react';
import { useTabs, useShift, useSettings, useCurrentStaff, useBills, useBillTags, useProducts, useSpaces } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';
import { lineUnitPrice, lineEffectiveUnitPrice, tabGrandTotal, tabRefundedAmount, tabCardFee, tabPartialPaidAmount } from '@/lib/domain/tabs';
import { buildZReport } from '@/lib/domain/shift';
import type { BillCategory, PaymentMethod, TabType } from '@/lib/types';

const BILL_CAT_META: Record<BillCategory, { label: string; icon: typeof Coffee }> = {
  cafe:      { label: 'Cafe',       icon: Coffee },
  rooms:     { label: 'Rooms',      icon: BedDouble },
  coworking: { label: 'Co-Working', icon: Monitor },
  general:   { label: 'General',    icon: Layers },
};

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
  const tabs     = useTabs();
  const bills    = useBills();
  const shift    = useShift();
  const products = useProducts();
  const spaces   = useSpaces();
  const cur = useSettings().currency;
  const [range, setRange] = useState<Range>('30d');
  // Cost lookup: fall back to current product/space cost when line item snapshot predates cost being set
  const costByProductId = useMemo(() => {
    const map = new Map<string, number | null>(products.map(p => [p.id, p.cost ?? null]));
    for (const s of spaces) {
      for (const r of s.rates ?? []) {
        if (r.cost != null) map.set(`${s.id}-${r.period}`, r.cost);
      }
      for (const r of s.dedicatedRates ?? []) {
        if (r.cost != null) map.set(`${s.id}-${r.period}`, r.cost);
      }
    }
    return map;
  }, [products, spaces]);

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
    const pipeline         = open.reduce((s, t) => s + tabGrandTotal(t.items, t.discount), 0);
    const partialCollected = open.reduce((s, t) => s + tabPartialPaidAmount(t), 0);
    const netPipeline      = pipeline - partialCollected;
    const totalItems = inRange.reduce((s, t) => s + t.items.reduce((s2, li) => s2 + li.qty, 0), 0);

    const byType: Record<TabType, number> = { cafe: 0, desk: 0, room: 0 };
    const byTypeCogs: Record<TabType, number> = { cafe: 0, desk: 0, room: 0 };
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
        const liCost = li.product.cost ?? costByProductId.get(li.productId) ?? null;
        if (liCost != null) byTypeCogs[bucket] += liCost * qty;
      }
      if (t.paymentMethod) {
        const base = tabGrandTotal(t.items, t.discount);
        const fee  = t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount) : 0;
        byMethod[t.paymentMethod] += base + fee;
      }
    }

    const itemCounts: Record<string, { name: string; qty: number; revenue: number; cogs: number; hasCost: boolean }> = {};
    for (const t of inRange) {
      for (const li of t.items) {
        const qty = Math.max(0, li.qty - (li.refundedQty ?? 0));
        const cost = li.product.cost ?? costByProductId.get(li.productId) ?? null;
        if (!itemCounts[li.productId]) itemCounts[li.productId] = { name: li.product.name, qty: 0, revenue: 0, cogs: 0, hasCost: cost != null };
        itemCounts[li.productId].qty += li.qty;
        itemCounts[li.productId].revenue += lineEffectiveUnitPrice(li) * li.qty;
        if (cost != null && qty > 0) {
          itemCounts[li.productId].cogs += cost * qty;
          itemCounts[li.productId].hasCost = true;
        }
      }
    }
    const topItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const itemsWithCost = Object.values(itemCounts).filter(i => i.hasCost);
    const grossProfit = itemsWithCost.reduce((s, i) => s + (i.revenue - i.cogs), 0);
    const hasCostData = itemsWithCost.length > 0;
    const topByProfit = itemsWithCost
      .map(i => ({ ...i, profit: i.revenue - i.cogs, margin: i.revenue > 0 ? ((i.revenue - i.cogs) / i.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    return { revenue, refunds, net: revenue - refunds, pipeline, netPipeline, partialCollected, openTabs: open.length, paidTabs: paid.length, totalItems, byType, byTypeCogs, byMethod, topItems, grossProfit, hasCostData, topByProfit };
  }, [tabs, range, costByProductId]);

  const expenseStats = useMemo(() => {
    const since = startOf(range);
    const inRange = bills.filter(b => new Date(b.date) >= since);
    const byCategory: Record<BillCategory, number> = { cafe: 0, rooms: 0, coworking: 0, general: 0 };
    let grand = 0;
    for (const b of inRange) {
      byCategory[b.category] += b.amount;
      grand += b.amount;
    }
    return { byCategory, grand };
  }, [bills, range]);

  // ── Chart data ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const now = new Date();

    if (range === 'today') {
      // Hourly buckets 0–23
      const rev: number[] = Array(24).fill(0);
      const exp: number[] = Array(24).fill(0);
      for (const t of tabs) {
        if (t.status !== 'paid' && t.status !== 'refunded') continue;
        const d = t.paidAt ? new Date(t.paidAt) : null;
        if (!d) continue;
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        if (d < todayStart) continue;
        const h = d.getHours();
        rev[h] += tabGrandTotal(t.items, t.discount) + (t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount) : 0);
      }
      for (const b of bills) {
        const d = new Date(b.date);
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        if (d < todayStart) continue;
        // Bills are date-only; spread across the day by assigning to hour 0
        exp[0] += b.amount;
      }
      return Array.from({ length: 24 }, (_, h) => ({
        label: `${h.toString().padStart(2, '0')}:00`,
        revenue: Math.round(rev[h] * 100) / 100,
        expenses: Math.round(exp[h] * 100) / 100,
      }));
    }

    if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      const rev: number[] = Array(days).fill(0);
      const exp: number[] = Array(days).fill(0);
      const labels: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        labels.unshift(d.toLocaleDateString('en', { day: 'numeric', month: 'short' }));
      }
      for (const t of tabs) {
        if (t.status !== 'paid' && t.status !== 'refunded') continue;
        const d = t.paidAt ? new Date(t.paidAt) : null;
        if (!d) continue;
        const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((midnight.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
        const idx = days - 1 - diffDays;
        if (idx < 0 || idx >= days) continue;
        rev[idx] += tabGrandTotal(t.items, t.discount) + (t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount) : 0);
      }
      for (const b of bills) {
        const d = new Date(b.date);
        const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((midnight.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
        const idx = days - 1 - diffDays;
        if (idx < 0 || idx >= days) continue;
        exp[idx] += b.amount;
      }
      return labels.map((label, i) => ({
        label,
        revenue: Math.round(rev[i] * 100) / 100,
        expenses: Math.round(exp[i] * 100) / 100,
      }));
    }

    // 'all' — group by month
    const monthMap = new Map<string, { revenue: number; expenses: number }>();
    function monthKey(d: Date) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    function monthLabel(key: string) {
      const [y, m] = key.split('-');
      return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
    }
    for (const t of tabs) {
      if (t.status !== 'paid' && t.status !== 'refunded') continue;
      const d = t.paidAt ? new Date(t.paidAt) : null;
      if (!d) continue;
      const k = monthKey(d);
      const e = monthMap.get(k) ?? { revenue: 0, expenses: 0 };
      e.revenue += tabGrandTotal(t.items, t.discount) + (t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount) : 0);
      monthMap.set(k, e);
    }
    for (const b of bills) {
      const d = new Date(b.date);
      const k = monthKey(d);
      const e = monthMap.get(k) ?? { revenue: 0, expenses: 0 };
      e.expenses += b.amount;
      monthMap.set(k, e);
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { revenue, expenses }]) => ({
        label: monthLabel(key),
        revenue: Math.round(revenue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
      }));
  }, [tabs, bills, range]);

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

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Revenue vs Expenses chart ────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-white/60 dark:bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold">Revenue vs Expenses</p>
              <p className="text-xs text-muted-foreground">
                {range === 'today' ? 'By hour today' : range === '7d' ? 'Daily — last 7 days' : range === '30d' ? 'Daily — last 30 days' : 'By month'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-lime-500/80" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-500/70" />Expenses</span>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#84cc16" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#84cc16" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.30} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.45 }}
                  axisLine={false}
                  tickLine={false}
                  interval={range === '30d' ? 4 : range === 'today' ? 3 : 0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.45 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    `${cur}${fmtCur(Number(value))}`,
                    name === 'revenue' ? 'Revenue' : 'Expenses',
                  ]}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  cursor={{ stroke: 'currentColor', strokeOpacity: 0.1, strokeWidth: 20 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#84cc16"
                  strokeWidth={2}
                  fill="url(#gradRevenue)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#84cc16' }}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#gradExpenses)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#ef4444' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Revenue',    value: `${cur}${fmtCur(stats.revenue)}`,  sub: `${stats.paidTabs} paid tab${stats.paidTabs !== 1 ? 's' : ''}`, icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
            { label: 'Expenses',   value: `-${cur}${fmtCur(expenseStats.grand)}`, sub: 'bills logged',  icon: Receipt,    color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-100 dark:bg-red-900/20' },
            { label: 'Net Profit', value: `${cur}${fmtCur(stats.net - expenseStats.grand)}`, sub: 'revenue − refunds − expenses', icon: TrendingUp, color: (stats.net - expenseStats.grand) >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400', bg: (stats.net - expenseStats.grand) >= 0 ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-red-100 dark:bg-red-900/20' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="flex flex-row items-center gap-3 p-4 rounded-2xl border border-border bg-white/60 dark:bg-white/5">
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${card.bg}`}><Icon size={18} className={card.color} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-bold tabular-nums truncate">{card.value}</p>
                  <p className="text-xs font-medium text-foreground/80">{card.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{card.sub}</p>
                </div>
              </div>
            );
          })}
          {stats.hasCostData && (() => {
            const margin = stats.revenue > 0 ? (stats.grossProfit / stats.revenue) * 100 : 0;
            const positive = stats.grossProfit >= 0;
            return (
              <div className="flex flex-row items-center gap-3 p-4 rounded-2xl border border-border bg-white/60 dark:bg-white/5">
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${positive ? 'bg-teal-100 dark:bg-teal-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                  <Percent size={18} className={positive ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold tabular-nums truncate">{cur}{fmtCur(stats.grossProfit)}</p>
                  <p className="text-xs font-medium text-foreground/80">Gross Profit</p>
                  <p className="text-xs text-muted-foreground truncate">{Math.round(margin)}% margin</p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Net Sales',  value: `${cur}${fmtCur(stats.net)}`,      sub: `−${cur}${fmtCur(stats.refunds)} refunds`, icon: TrendingUp,   color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/20' },
            { label: 'Pipeline',   value: `${cur}${fmtCur(stats.netPipeline)}`, sub: `${stats.openTabs} open tab${stats.openTabs !== 1 ? 's' : ''}${stats.partialCollected > 0 ? ` · ${cur}${fmtCur(stats.partialCollected)} part-paid` : ''}`, icon: Clock, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/20' },
            { label: 'Items Sold', value: String(stats.totalItems),          sub: 'in range', icon: ShoppingBag, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/20' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="flex flex-row items-center gap-3 p-4 rounded-2xl border border-border bg-white/60 dark:bg-white/5">
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${card.bg}`}><Icon size={18} className={card.color} /></div>
                <div className="min-w-0">
                  <p className="text-sm font-bold tabular-nums truncate">{card.value}</p>
                  <p className="text-xs font-medium text-foreground/80">{card.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{card.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        <section>
          <h2 className="text-sm font-semibold mb-3">By Area (Revenue − Expenses)</h2>
          <div className="rounded-2xl border border-border overflow-hidden bg-white/50 dark:bg-white/3 divide-y divide-border">
            {(Object.entries(stats.byType) as [TabType, number][])
              .sort(([, a], [, b]) => b - a)
              .map(([type, revenue]) => {
                const { label, icon: Icon, color } = TYPE_META[type];
                // Map tab type → bill category
                const billCat: BillCategory = type === 'desk' ? 'coworking' : type === 'room' ? 'rooms' : 'cafe';
                const expenses = expenseStats.byCategory[billCat] ?? 0;
                const net = revenue - expenses;
                const pct = typeTotal > 0 ? (revenue / typeTotal) * 100 : 0;
                const isLoss = net < 0;
                return (
                  <div key={type} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-3">
                      <Icon size={16} className={color} />
                      <span className="text-sm font-medium flex-1">{label}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 rounded-full bg-black/8 dark:bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{Math.round(pct)}%</span>
                        <span className={`text-sm font-bold tabular-nums w-24 text-right ${isLoss ? 'text-red-600 dark:text-red-400' : ''}`}>
                          {isLoss ? '-' : ''}{cur}{fmtCur(Math.abs(net))}
                        </span>
                      </div>
                    </div>
                    {expenses > 0 && (
                      <div className="flex items-center justify-end gap-6 text-xs text-muted-foreground pl-7">
                        <span>Revenue <span className="tabular-nums text-foreground">{cur}{fmtCur(revenue)}</span></span>
                        <span>Expenses <span className="tabular-nums text-red-600 dark:text-red-400">−{cur}{fmtCur(expenses)}</span></span>
                      </div>
                    )}
                    {stats.byTypeCogs[type] > 0 && (
                      <div className="flex items-center justify-end gap-6 text-xs text-muted-foreground pl-7">
                        <span>COGS <span className="tabular-nums text-foreground">−{cur}{fmtCur(stats.byTypeCogs[type])}</span></span>
                        <span>Gross margin <span className="tabular-nums text-teal-600 dark:text-teal-400">{Math.round(((revenue - stats.byTypeCogs[type]) / revenue) * 100)}%</span></span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">By Payment Method</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(stats.byMethod) as [PaymentMethod, number][])
              .filter(([m]) => m !== 'room') // room is an internal charge transfer, not cash received
              .map(([m, v]) => {
                const { label, icon: Icon } = METHOD_META[m];
                return (
                  <div key={m} className="flex flex-row items-center gap-3 rounded-2xl border border-border p-4 bg-white/50 dark:bg-white/3">
                    <Icon size={16} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold tabular-nums truncate">{cur}{fmtCur(v)}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
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
            {stats.topItems.map((item, i) => {
              const margin = item.hasCost && item.revenue > 0 ? ((item.revenue - item.cogs) / item.revenue) * 100 : null;
              return (
                <div key={item.name} className="flex items-center gap-4 px-4 py-3">
                  <span className="text-xs font-bold text-muted-foreground tabular-nums w-4">{i + 1}</span>
                  <span className="text-sm font-medium flex-1">{item.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{item.qty}×</span>
                  {margin !== null && (
                    <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded-full ${margin >= 0 ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {Math.round(margin)}%
                    </span>
                  )}
                  <span className="text-sm font-semibold tabular-nums w-16 text-right">{cur}{fmtCur(item.revenue)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {stats.hasCostData && stats.topByProfit.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Percent size={14} className="text-teal-600 dark:text-teal-400" /> Top Items by Profit
            </h2>
            <div className="rounded-2xl border border-border overflow-hidden bg-white/50 dark:bg-white/3 divide-y divide-border">
              {stats.topByProfit.map((item, i) => {
                const pos = item.profit >= 0;
                return (
                  <div key={item.name} className="flex items-center gap-4 px-4 py-3">
                    <span className="text-xs font-bold text-muted-foreground tabular-nums w-4">{i + 1}</span>
                    <span className="text-sm font-medium flex-1">{item.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{item.qty}×</span>
                    <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded-full ${pos ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {Math.round(item.margin)}%
                    </span>
                    <span className={`text-sm font-semibold tabular-nums w-20 text-right ${pos ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}`}>
                      {pos ? '+' : ''}{cur}{fmtCur(item.profit)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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

        {/* ── Expenses by Category ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingDown size={14} className="text-red-600 dark:text-red-400" /> Expenses by Category
          </h2>
          <div className="rounded-2xl border border-border overflow-hidden bg-white/50 dark:bg-white/3 divide-y divide-border">
            {expenseStats.grand === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No bills logged in this period. <a href="/bills" className="text-primary hover:underline">Add bills →</a></p>
            ) : (
              (Object.entries(expenseStats.byCategory) as [BillCategory, number][])
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amount]) => {
                  const { label, icon: Icon } = BILL_CAT_META[cat];
                  const pct = expenseStats.grand > 0 ? (amount / expenseStats.grand) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-4 px-4 py-3">
                      <Icon size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium flex-1">{label}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 rounded-full bg-black/8 dark:bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full bg-red-400/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{Math.round(pct)}%</span>
                        <span className="text-sm font-semibold tabular-nums w-20 text-right text-red-600 dark:text-red-400">−{cur}{fmtCur(amount)}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
