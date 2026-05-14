'use client';

import { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Clock, Users, CreditCard, Banknote, QrCode, BedDouble,
  Coffee, Monitor, AlertCircle, CheckCircle2, Star, Percent,
  ChefHat, Flame, Bell, CircleCheck, Laptop, Package,
  CalendarClock, LogIn, Receipt,
} from 'lucide-react';
import {
  useTabs, useStays, useCustomers, useSettings, useCurrentStaff,
  useTickets, useProducts, useSpaces, useEquipment, useShift, useStaff,
  useBills,
} from '@/lib/hooks/useStore';
import { tabGrandTotal, tabCardFee, tabPartialPaidAmount } from '@/lib/domain/tabs';
import { fmtCur } from '@/lib/format';
import { findActiveStayByRoom } from '@/lib/domain/stays';
import type { BillCategory, PaymentMethod, TabType } from '@/lib/types';

const BILL_CAT_LABELS: Record<BillCategory, string> = {
  cafe: 'Cafe', rooms: 'Rooms', coworking: 'Co-Working', general: 'General',
};

/* ── helpers ─────────────────────────────────────────────── */

function isToday(d: Date | undefined): boolean {
  if (!d) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function startOfToday(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

function elapsed(from: Date): string {
  const m = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function shiftElapsed(from: Date): string {
  const m = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

const TYPE_COLOR: Record<TabType, string> = {
  cafe: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  desk: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  room: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};
const TYPE_ICON: Record<TabType, typeof Coffee> = { cafe: Coffee, desk: Monitor, room: BedDouble };
const METHOD_ICON: Record<PaymentMethod, typeof CreditCard> = {
  card: CreditCard, cash: Banknote, qr: QrCode, room: BedDouble, split: CreditCard,
};

/* ── small reusable blocks ───────────────────────────────── */

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: typeof TrendingUp; accent: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex items-start gap-3">
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${accent}`}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function KitchenBadge({ count, label, icon: Icon, accent }: {
  count: number; label: string; icon: typeof ChefHat; accent: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl p-4 gap-1 ${accent}`}>
      <Icon size={20} strokeWidth={1.8} />
      <span className="text-2xl font-bold tabular-nums leading-tight">{count}</span>
      <span className="text-xs font-medium opacity-80">{label}</span>
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
      {title}{count !== undefined ? ` (${count})` : ''}
    </h2>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-5 justify-center text-muted-foreground text-sm">
      <CheckCircle2 size={15} />
      {label}
    </div>
  );
}

/* ── page ────────────────────────────────────────────────── */

export default function DashboardPage() {
  const me        = useCurrentStaff();
  const allStaff  = useStaff();
  const tabs      = useTabs();
  const stays     = useStays();
  const customers = useCustomers();
  const tickets   = useTickets();
  const products  = useProducts();
  const spaces    = useSpaces();
  const equipment = useEquipment();
  const bills     = useBills();
  const shift     = useShift();
  const cur       = useSettings().currency;

  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <AlertCircle size={32} strokeWidth={1.5} />
        <p className="text-sm">Manager access required.</p>
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const d = useMemo(() => {
    /* ── Tabs ──────────────────────────── */
    const openTabs   = tabs.filter(t => t.status === 'open');
    const paidToday  = tabs.filter(t => t.status === 'paid' && isToday(t.paidAt));
    const openSorted = [...openTabs].sort((a, b) => tabGrandTotal(b.items, b.discount) - tabGrandTotal(a.items, a.discount));
    const recentPaid = [...paidToday].sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0)).slice(0, 8);

    const revenueToday = paidToday.reduce((s, t) => {
      return s + tabGrandTotal(t.items, t.discount) + (t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount) : 0);
    }, 0);
    const outstanding        = openTabs.reduce((s, t) => s + tabGrandTotal(t.items, t.discount), 0);
    const partialCollected   = openTabs.reduce((s, t) => s + tabPartialPaidAmount(t), 0);
    const netOutstanding     = outstanding - partialCollected;

    /* ── Payment + category breakdown ─── */
    const methodTotals: Partial<Record<PaymentMethod, { count: number; total: number }>> = {};
    const typeTotals: Partial<Record<TabType, number>> = {};
    for (const t of paidToday) {
      if (t.paymentMethod) {
        const e = methodTotals[t.paymentMethod] ?? { count: 0, total: 0 };
        const fee = t.paymentMethod === 'card' ? tabCardFee(t.items, t.discount) : 0;
        methodTotals[t.paymentMethod] = { count: e.count + 1, total: e.total + tabGrandTotal(t.items, t.discount) + fee };
      }
      typeTotals[t.type] = (typeTotals[t.type] ?? 0) + tabGrandTotal(t.items, t.discount);
    }

    /* ── Kitchen tickets ───────────────── */
    const kitNew       = tickets.filter(t => t.status === 'new');
    const kitPreparing = tickets.filter(t => t.status === 'preparing');
    const kitReady     = tickets.filter(t => t.status === 'ready');
    const kitDoneToday = tickets.filter(t => t.status === 'done' && isToday(t.createdAt));

    /* ── Rooms ─────────────────────────── */
    const roomProducts    = products.filter(p => p.category === 'rooms' && !p.archived);
    const activeStays     = stays.filter(s => s.status === 'active');
    const occupiedRoomIds = new Set(activeStays.map(s => s.roomId));
    const availableRooms  = roomProducts.filter(p => !occupiedRoomIds.has(p.id));
    const checkOutsToday  = activeStays.filter(s => s.checkOutAt && isToday(new Date(s.checkOutAt)));

    /* ── Coworking desks ───────────────── */
    const now = new Date();
    // Mirror the coworking page's active-tab logic: open tabs + paid tabs with valid booking.
    const activeTabsByLabel = new Map<string, (typeof tabs)[0][]>();
    for (const t of tabs) {
      // Skip explicitly early-checked-out tabs (bookingEndsAt set to epoch)
      if (t.bookingEndsAt && new Date(t.bookingEndsAt as unknown as string).getTime() < 1000) continue;

      const isPaidBookingStillActive =
        t.status === 'paid' && (
          (!!t.bookingEndsAt && new Date(t.bookingEndsAt as unknown as string) > now) ||
          (!!t.paidAt && t.items.some(item => {
            if (item.product.category !== 'desks') return false;
            const paidMs = new Date(t.paidAt as unknown as string).getTime();
            const PERIOD_DURATION_MS: Record<string, number> = {
              daily: 86400000, weekly: 604800000, '2-weeks': 1209600000,
              monthly: 2592000000, '3-months': 7776000000, '6-months': 15552000000, yearly: 31536000000,
            };
            const PERIOD_LABEL: Record<string, string> = {
              daily: 'Daily', weekly: 'Weekly', '2-weeks': '2 Weeks',
              monthly: 'Monthly', '3-months': '3 Months', '6-months': '6 Months', yearly: '1 Year',
            };
            return Object.entries(PERIOD_LABEL).some(([period, label]) =>
              item.product.name.endsWith(` — ${label}`) &&
              new Date(paidMs + PERIOD_DURATION_MS[period]).getTime() > now.getTime(),
            );
          }))
        );
      if (t.status !== 'open' && !isPaidBookingStillActive) continue;

      // Resolve the space key (same logic as coworking page)
      const allSpacesAll = spaces.filter(s => !s.archived);
      let key = t.label;
      if (t.type === 'desk') {
        if (!allSpacesAll.find(s => s.name === key)) {
          const deskItem = t.items.find(li => li.product.category === 'desks');
          if (deskItem) {
            const s = allSpacesAll.find(x => deskItem.productId.startsWith(x.id + '-') || x.id === deskItem.productId);
            if (s) key = s.name;
          }
        }
        if (!allSpacesAll.find(s => s.name === key)) continue;
        const list = activeTabsByLabel.get(key) ?? [];
        if (!list.find(x => x.id === t.id)) activeTabsByLabel.set(key, [...list, t]);
      } else {
        // POS tab with desk line items
        for (const item of t.items) {
          if (item.product.category === 'desks') {
            const sp = allSpacesAll.find(s => s.id === item.productId || item.productId.startsWith(s.id + '-'));
            if (sp) {
              const list = activeTabsByLabel.get(sp.name) ?? [];
              if (!list.find(x => x.id === t.id)) activeTabsByLabel.set(sp.name, [...list, t]);
            }
          }
        }
      }
    }
    const allSpaces = spaces.filter(s => !s.archived);

    // Split into present (open) and away (paid with valid booking)
    const presentByLabel = new Map<string, (typeof tabs)[0]>();
    const awayTabs: { spaceName: string; tab: (typeof tabs)[0] }[] = [];
    for (const [spaceName, tabList] of activeTabsByLabel.entries()) {
      for (const t of tabList) {
        if (t.status === 'open') presentByLabel.set(spaceName, t);
        else awayTabs.push({ spaceName, tab: t });
      }
    }

    // Legacy simple map for backward-compatible "active" display
    const activeByLabel = presentByLabel;
    const occupiedSpaces = allSpaces.filter(s => activeTabsByLabel.has(s.name));
    const availSpaces    = allSpaces.filter(s => !activeTabsByLabel.has(s.name));

    /* ── Equipment rentals ─────────────── */
    const activeEquipIds = new Set<string>();
    const equipTabMap    = new Map<string, (typeof tabs)[0]>();
    for (const t of tabs) {
      if (t.type === 'desk' && t.status === 'open') {
        for (const item of t.items) {
          if (item.product.id.startsWith('equip:')) {
            const eid = item.product.id.slice(6);
            activeEquipIds.add(eid);
            equipTabMap.set(eid, t);
          }
        }
      }
    }
    const allEquip      = equipment.filter(e => !e.archived);
    const activeEquip   = allEquip.filter(e => activeEquipIds.has(e.id));
    const availEquip    = allEquip.filter(e => !activeEquipIds.has(e.id));

    /* ── COGS today ────────────────────── */
    const costByProductId = new Map<string, number | null>(products.map(p => [p.id, p.cost ?? null]));
    for (const s of spaces) {
      for (const r of s.rates) {
        if (r.cost != null) costByProductId.set(`${s.id}-${r.period}`, r.cost);
      }
      for (const r of s.dedicatedRates ?? []) {
        if (r.cost != null) costByProductId.set(`${s.id}-${r.period}`, r.cost);
      }
    }
    let cogsToday = 0;
    let hasCostDataToday = false;
    for (const t of paidToday) {
      for (const li of t.items) {
        const qty = Math.max(0, li.qty - (li.refundedQty ?? 0));
        const cost = li.product.cost ?? costByProductId.get(li.productId) ?? null;
        if (cost != null && qty > 0) {
          cogsToday += cost * qty;
          hasCostDataToday = true;
        }
      }
    }
    const grossProfitToday = revenueToday - cogsToday;
    const grossMarginToday = revenueToday > 0 ? (grossProfitToday / revenueToday) * 100 : 0;

    /* ── Bills / Expenses today ─────────── */
    const billsToday = bills.filter(b => isToday(new Date(b.date)));
    const expensesToday = billsToday.reduce((s, b) => s + b.amount, 0);
    const expensesByCategory: Record<BillCategory, number> = { cafe: 0, rooms: 0, coworking: 0, general: 0 };
    for (const b of billsToday) expensesByCategory[b.category] += b.amount;

    /* ── Customers ─────────────────────── */
    const weekStart          = new Date(startOfToday().getTime() - 6 * 86400000);
    const newCustomersToday  = customers.filter(c => isToday(c.createdAt) && !c.archived).length;
    const newCustomersWeek   = customers.filter(c => c.createdAt >= weekStart && !c.archived).length;
    const vipCount           = customers.filter(c => c.vip && !c.archived).length;
    const discountCount      = customers.filter(c => c.discount && !c.archived).length;
    const newThisWeek        = [...customers]
      .filter(c => !c.archived && c.createdAt >= weekStart)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    return {
      openTabs, openSorted, paidToday, recentPaid,
      revenueToday, outstanding, partialCollected, netOutstanding,
      grossProfitToday, grossMarginToday, hasCostDataToday,
      expensesToday, expensesByCategory, billsToday,
      methodTotals, typeTotals,
      kitNew, kitPreparing, kitReady, kitDoneToday,
      roomProducts, activeStays, availableRooms, checkOutsToday, occupiedRoomIds,
      allSpaces, occupiedSpaces, availSpaces, activeByLabel, awayTabs,
      allEquip, activeEquip, availEquip, equipTabMap,
      newCustomersToday, newCustomersWeek, vipCount, discountCount, newThisWeek,
    };
  }, [tabs, stays, customers, tickets, products, spaces, equipment, bills]);

  const shiftOpener = shift ? allStaff.find(s => s.id === shift.openedByStaffId) : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain">
      <div className="max-w-6xl w-full mx-auto px-4 py-6 space-y-6 pb-10">

        {/* ── Header ──────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {shift ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass text-sm">
              <LogIn size={14} strokeWidth={2} className="text-emerald-600 dark:text-emerald-400" />
              <span>Shift open · {shiftElapsed(shift.openedAt)}</span>
              {shiftOpener && <span className="text-muted-foreground">· {shiftOpener.name}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle size={14} strokeWidth={2} />
              No shift open
            </div>
          )}
        </div>

        {/* ── Top stat row ────────────────────────────── */}
        <div className={`grid gap-3 ${me?.role === 'manager' && d.hasCostDataToday ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
          <StatCard
            label="Revenue today"
            value={`${cur}${fmtCur(d.revenueToday)}`}
            sub={`${d.paidToday.length} tab${d.paidToday.length !== 1 ? 's' : ''} closed`}
            icon={TrendingUp}
            accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
          <StatCard
            label="Expenses today"
            value={`-${cur}${fmtCur(d.expensesToday)}`}
            sub={`${d.billsToday.length} bill${d.billsToday.length !== 1 ? 's' : ''} logged`}
            icon={Receipt}
            accent="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          />
          <StatCard
            label="Net Profit today"
            value={`${cur}${fmtCur(d.revenueToday - d.expensesToday)}`}
            sub="revenue − expenses"
            icon={d.revenueToday - d.expensesToday >= 0 ? TrendingUp : TrendingDown}
            accent={d.revenueToday - d.expensesToday >= 0
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}
          />
          {me?.role === 'manager' && d.hasCostDataToday && (
            <StatCard
              label="Gross Profit today"
              value={`${cur}${fmtCur(d.grossProfitToday)}`}
              sub={`${Math.round(d.grossMarginToday)}% margin · costed items`}
              icon={Percent}
              accent={d.grossProfitToday >= 0
                ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}
            />
          )}
          <StatCard
            label="Outstanding"
            value={`${cur}${fmtCur(d.netOutstanding)}`}
            sub={`${d.openTabs.length} open tab${d.openTabs.length !== 1 ? 's' : ''}${d.partialCollected > 0 ? ` · ${cur}${fmtCur(d.partialCollected)} part-paid` : ''}`}
            icon={Clock}
            accent="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
          />
        </div>

        {/* ── Second stat row ──────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
          <StatCard
            label="Desks"
            value={`${d.availSpaces.length} / ${d.allSpaces.length}`}
            sub={`${d.occupiedSpaces.length} occupied · ${d.activeEquip.length} equipment out`}
            icon={Laptop}
            accent="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
          />
          <StatCard
            label="Rooms"
            value={`${d.availableRooms.length} / ${d.roomProducts.length}`}
            sub={`${d.activeStays.length} occupied${d.checkOutsToday.length ? ` · ${d.checkOutsToday.length} checking out` : ''}`}
            icon={BedDouble}
            accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
        </div>

        {/* ── Kitchen status ───────────────────────────── */}
        <div className="glass rounded-2xl p-4">
          <SectionTitle title="Kitchen" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KitchenBadge
              count={d.kitNew.length}
              label="Waiting"
              icon={ChefHat}
              accent={d.kitNew.length > 0
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                : 'bg-muted/60 text-muted-foreground'}
            />
            <KitchenBadge
              count={d.kitPreparing.length}
              label="Preparing"
              icon={Flame}
              accent={d.kitPreparing.length > 0
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-muted/60 text-muted-foreground'}
            />
            <KitchenBadge
              count={d.kitReady.length}
              label="Ready"
              icon={Bell}
              accent={d.kitReady.length > 0
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                : 'bg-muted/60 text-muted-foreground'}
            />
            <KitchenBadge
              count={d.kitDoneToday.length}
              label="Done today"
              icon={CircleCheck}
              accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            />
          </div>
          {/* Waiting tickets detail */}
          {d.kitNew.length > 0 && (
            <div className="mt-3 space-y-1">
              {d.kitNew.map(tk => (
                <div key={tk.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/10 text-sm">
                  <span className="font-medium truncate flex-1">{tk.customerName} — {tk.tabLabel}</span>
                  <span className="text-muted-foreground shrink-0">{tk.items.map(i => `${i.qty}× ${i.productName}`).join(', ')}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{elapsed(tk.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Open tabs + right column ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Open tabs */}
          <div className="lg:col-span-2 glass rounded-2xl p-4">
            <SectionTitle title="Open tabs" count={d.openTabs.length} />
            {d.openTabs.length === 0 ? <EmptyRow label="No open tabs" /> : (
              <div className="space-y-1.5">
                {d.openSorted.map(tab => {
                  const Icon    = TYPE_ICON[tab.type];
                  const total   = tabGrandTotal(tab.items, tab.discount);
                  const partial = tabPartialPaidAmount(tab);
                  return (
                    <div key={tab.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-black/3 dark:bg-white/4">
                      <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${TYPE_COLOR[tab.type]}`}>
                        <Icon size={13} strokeWidth={2} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{tab.customerName}</span>
                        {partial > 0 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                            {cur}{fmtCur(partial)} paid · {cur}{fmtCur(total - partial)} left
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate hidden sm:block max-w-[100px]">{tab.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{tab.items.length} item{tab.items.length !== 1 ? 's' : ''}</span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{elapsed(tab.openedAt)}</span>
                      <span className="text-sm font-semibold tabular-nums shrink-0">{cur}{fmtCur(total)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: payments + category */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-4">
              <SectionTitle title="Today by payment" />
              {Object.keys(d.methodTotals).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No payments yet</p>
              ) : (
                <div className="space-y-2.5">
                  {(Object.entries(d.methodTotals) as [PaymentMethod, { count: number; total: number }][])
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([method, { count, total }]) => {
                      const Icon = METHOD_ICON[method];
                      return (
                        <div key={method} className="flex items-center gap-2.5">
                          <Icon size={14} strokeWidth={2} className="text-muted-foreground shrink-0" />
                          <span className="text-sm capitalize flex-1">{method}</span>
                          <span className="text-xs text-muted-foreground">{count}×</span>
                          <span className="text-sm font-semibold tabular-nums">{cur}{fmtCur(total)}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-4">
              <SectionTitle title="Today by category" />
              {Object.keys(d.typeTotals).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No revenue yet</p>
              ) : (
                <div className="space-y-2.5">
                  {(Object.entries(d.typeTotals) as [TabType, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, total]) => {
                      const Icon = TYPE_ICON[type];
                      const label = type === 'cafe' ? 'Cafe' : type === 'desk' ? 'CoWorking' : 'Rooms';
                      return (
                        <div key={type} className="flex items-center gap-2.5">
                          <span className={`flex items-center justify-center w-6 h-6 rounded-md shrink-0 ${TYPE_COLOR[type]}`}>
                            <Icon size={12} strokeWidth={2} />
                          </span>
                          <span className="text-sm flex-1">{label}</span>
                          <span className="text-sm font-semibold tabular-nums">{cur}{fmtCur(total)}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Expenses today breakdown */}
            {d.expensesToday > 0 && (
              <div className="glass rounded-2xl p-4">
                <SectionTitle title="Expenses today" />
                <div className="space-y-2.5">
                  {(Object.entries(d.expensesByCategory) as [BillCategory, number][])
                    .filter(([, v]) => v > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amount]) => (
                      <div key={cat} className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                          <Receipt size={12} strokeWidth={2} />
                        </span>
                        <span className="text-sm flex-1">{BILL_CAT_LABELS[cat]}</span>
                        <span className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">-{cur}{fmtCur(amount)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Coworking ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Active desk sessions */}
          <div className="glass rounded-2xl p-4">
            <SectionTitle title="Coworking — active sessions" count={d.occupiedSpaces.length} />
            {d.occupiedSpaces.length === 0 ? <EmptyRow label="No active desk sessions" /> : (
              <div className="space-y-1.5">
                {d.occupiedSpaces.map(space => {
                  const tab = d.activeByLabel.get(space.name);
                  return (
                    <div key={space.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-black/3 dark:bg-white/4">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        <Monitor size={13} strokeWidth={2} />
                      </span>
                      <span className="text-sm font-medium flex-1 truncate">{space.name}</span>
                      {tab && <span className="text-xs text-muted-foreground truncate hidden sm:block">{tab.customerName}</span>}
                      {tab && <span className="text-xs text-muted-foreground tabular-nums shrink-0">{elapsed(tab.openedAt)}</span>}
                      {tab && <span className="text-sm font-semibold tabular-nums shrink-0">{cur}{fmtCur(tabGrandTotal(tab.items, tab.discount))}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Away · May Return */}
            {d.awayTabs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                  <CalendarClock size={12} /> Away · May Return ({d.awayTabs.length})
                </p>
                <div className="space-y-1.5">
                  {d.awayTabs.map(({ spaceName, tab }) => {
                    const endsAt = tab.bookingEndsAt && new Date(tab.bookingEndsAt as unknown as string).getTime() > 1000
                      ? new Date(tab.bookingEndsAt as unknown as string) : null;
                    const endsLabel = endsAt
                      ? `until ${endsAt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`
                      : tab.paidAt ? `paid ${elapsed(tab.paidAt)} ago` : '';
                    return (
                      <div key={tab.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Monitor size={13} strokeWidth={2} />
                        </span>
                        <span className="text-sm font-medium flex-1 truncate">{spaceName}</span>
                        <span className="text-xs text-muted-foreground truncate hidden sm:block">{tab.customerName}</span>
                        <span className="text-xs text-amber-700 dark:text-amber-400 shrink-0 tabular-nums">{endsLabel}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 px-1">Keep a desk free for each customer above.</p>
              </div>
            )}

            {d.availSpaces.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 px-1">
                Available: {d.availSpaces.map(s => s.name).join(', ')}
              </p>
            )}
          </div>

          {/* Equipment rentals */}
          <div className="glass rounded-2xl p-4">
            <SectionTitle title="Equipment rentals" />
            {d.activeEquip.length === 0 && d.availEquip.length === 0 ? (
              <EmptyRow label="No equipment configured" />
            ) : (
              <>
                {d.activeEquip.length === 0 ? (
                  <EmptyRow label="No equipment currently rented" />
                ) : (
                  <div className="space-y-1.5">
                    {d.activeEquip.map(equip => {
                      const tab = d.equipTabMap.get(equip.id);
                      return (
                        <div key={equip.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-black/3 dark:bg-white/4">
                          <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            <Package size={13} strokeWidth={2} />
                          </span>
                          <span className="text-sm font-medium flex-1 truncate">{equip.name}</span>
                          {tab && <span className="text-xs text-muted-foreground truncate hidden sm:block">{tab.customerName}</span>}
                          {tab && <span className="text-xs text-muted-foreground shrink-0">{elapsed(tab.openedAt)}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3 px-1">
                  {d.availEquip.length} of {d.allEquip.length} available: {d.availEquip.map(e => e.name).join(', ')}
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Room stays ───────────────────────────────── */}
        <div className="glass rounded-2xl p-4">
          <SectionTitle title="Room occupancy" />
          {d.roomProducts.length === 0 ? <EmptyRow label="No rooms configured" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {d.roomProducts.map(room => {
                const stay = findActiveStayByRoom(stays, room.id);
                const occupied = !!stay;
                const checkingOut = stay?.checkOutAt ? isToday(new Date(stay.checkOutAt)) : false;
                return (
                  <div
                    key={room.id}
                    className={`rounded-xl px-3 py-2.5 border flex flex-col gap-0.5 ${
                      occupied
                        ? checkingOut
                          ? 'border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/10'
                          : 'border-rose-200 bg-rose-50 dark:border-rose-700/50 dark:bg-rose-900/10'
                        : 'border-emerald-200 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-900/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BedDouble size={13} strokeWidth={2} className={occupied ? checkingOut ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} />
                      <span className="text-sm font-semibold truncate flex-1">{room.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        occupied
                          ? checkingOut ? 'bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-200' : 'bg-rose-200 text-rose-800 dark:bg-rose-800/40 dark:text-rose-200'
                          : 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-200'
                      }`}>
                        {occupied ? checkingOut ? 'CHECK OUT' : 'OCCUPIED' : 'FREE'}
                      </span>
                    </div>
                    {stay && (
                      <p className="text-xs text-muted-foreground truncate pl-5">{stay.guestName} · {stay.nights}n</p>
                    )}
                    {stay?.checkOutAt && (
                      <p className="text-xs text-muted-foreground truncate pl-5 flex items-center gap-1">
                        <CalendarClock size={10} />
                        {new Date(stay.checkOutAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recently paid ────────────────────────────── */}
        {d.recentPaid.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <SectionTitle title="Paid today" count={d.paidToday.length} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
              {d.recentPaid.map(tab => {
                const Icon = TYPE_ICON[tab.type];
                const total = tabGrandTotal(tab.items, tab.discount);
                const fee   = tab.paymentMethod === 'card' ? tabCardFee(tab.items, tab.discount) : 0;
                const MethodIcon = tab.paymentMethod ? METHOD_ICON[tab.paymentMethod] : null;
                return (
                  <div key={tab.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/3 dark:bg-white/4">
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${TYPE_COLOR[tab.type]}`}>
                      <Icon size={13} strokeWidth={2} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tab.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{tab.label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{cur}{fmtCur(total + fee)}</p>
                      {MethodIcon && <MethodIcon size={11} strokeWidth={2} className="text-muted-foreground ml-auto" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Customers ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* New this week */}
          <div className="lg:col-span-2 glass rounded-2xl p-4">
            <SectionTitle title="New customers this week" count={d.newCustomersWeek} />
            {d.newThisWeek.length === 0 ? <EmptyRow label="No new customers this week" /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {d.newThisWeek.map(c => (
                  <div key={c.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/3 dark:bg-white/4">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {c.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.vip && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {isToday(c.createdAt) ? 'Today' : new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {c.discount && (
                          <span className="inline-flex items-center gap-0.5">
                            <Percent size={9} />
                            {c.discount.type === 'pct' ? `${c.discount.value}%` : `${cur}${c.discount.value}`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer stats */}
          <div className="glass rounded-2xl p-4">
            <SectionTitle title="Customer overview" />
            <div className="space-y-3">
              {[
                { label: 'Total active', value: customers.filter(c => !c.archived).length.toString() },
                { label: 'New today', value: d.newCustomersToday.toString() },
                { label: 'New this week', value: d.newCustomersWeek.toString() },
                { label: 'VIP members', value: d.vipCount.toString() },
                { label: 'Have discounts', value: d.discountCount.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
