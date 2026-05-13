'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, orderBy, query, limit, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Coffee, Monitor, BedDouble, Search, ArrowLeft, Globe } from 'lucide-react';
import { confirm } from '@/components/ui/confirm-dialog';
import { useCurrentStaff, useSettings, useSpaces } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { newId } from '@/lib/domain/id';
import { calcBookingEndsAt, PERIOD_LABEL } from '@/components/coworking/CheckInDialog';
import { WebOrderPreview } from '@/components/pos/WebOrderPreview';
import { toast } from '@/components/ui/toast';
import type { PendingWebOrder } from '@/app/page';
import type { CoworkSpaceRate, Product, Tab } from '@/lib/types';

/* ── helpers ────────────────────────────────────────────────────── */

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

/* ── constants ───────────────────────────────────────────────────── */

const TYPE_ICON  = { cafe: Coffee, coworking: Monitor, 'room-enquiry': BedDouble } as const;
const TYPE_LABEL = { cafe: 'Café Order', coworking: 'Desk Booking', 'room-enquiry': 'Room Enquiry' } as const;
const TYPE_COLOR = {
  cafe:           'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  coworking:      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'room-enquiry': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
} as const;

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  accepted:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', accepted: 'Accepted', cancelled: 'Declined',
};

const SHORT_PERIOD: Record<string, string> = {
  hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly',
  '2-weeks': '2 Wks', monthly: 'Monthly', '3-months': '3 Mo',
  '6-months': '6 Mo', yearly: '1 Year',
};

type StatusFilter = 'all' | 'pending' | 'accepted' | 'cancelled';
type TypeFilter   = 'all' | 'cafe' | 'coworking' | 'room-enquiry';

/* ── page ────────────────────────────────────────────────────────── */

export default function OnlineOrdersPage() {
  const me           = useCurrentStaff();
  const spaces       = useSpaces();
  const store        = getStore();
  const searchParams = useSearchParams();

  const [orders, setOrders]             = useState<PendingWebOrder[]>([]);
  const [statusFilter, setStatus]       = useState<StatusFilter>('all');
  const [typeFilter, setType]           = useState<TypeFilter>('all');
  const [search, setSearch]             = useState('');
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);

  /* Real-time listener — all orders, newest first */
  useEffect(() => {
    const q = query(collection(db, 'website-orders'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PendingWebOrder)));
    }, () => setOrders([]));
  }, []);

  /* Auto-select order when arriving from the calendar via ?id= */
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    setStatus('pending');
    selectOrder(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* Derived */
  const stats = useMemo(() => ({
    total:    orders.length,
    pending:  orders.filter(o => o.status === 'pending').length,
    accepted: orders.filter(o => o.status === 'accepted').length,
    declined: orders.filter(o => o.status === 'cancelled').length,
  }), [orders]);

  const filtered = useMemo(() => orders.filter(o =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    (typeFilter   === 'all' || o.type   === typeFilter) &&
    (!search || o.customerName.toLowerCase().includes(search.toLowerCase())),
  ), [orders, statusFilter, typeFilter, search]);

  /* Group by calendar day */
  const groups = useMemo(() => {
    const map = new Map<number, { date: Date; orders: PendingWebOrder[] }>();
    for (const o of filtered) {
      const d = new Date(o.createdAt);
      const k = startOfDayKey(d);
      if (!map.has(k)) map.set(k, { date: d, orders: [] });
      map.get(k)!.orders.push(o);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v);
  }, [filtered]);

  const selectedOrder = orders.find(o => o.id === selectedId) ?? null;

  function selectOrder(id: string) {
    setSelectedId(id);
    setMobileDetail(true);
  }

  /* ── Accept / Decline ─────────────────────────────────────────── */

  async function handleAccept(order: PendingWebOrder) {
    setSelectedId(null);
    setMobileDetail(false);
    await updateDoc(doc(db, 'website-orders', order.id), {
      status: 'accepted', updatedAt: new Date().toISOString(),
    });

    if (order.type === 'cafe') {
      const tab: Tab = {
        id: newId('tab'), customerName: order.customerName, type: 'cafe',
        label: order.tableOrSpace ?? 'Web order',
        items: (order.items ?? []).map(i => ({
          id: newId('li'), productId: i.productId,
          product: { id: i.productId, name: i.name, price: i.price, category: 'food' as const, archived: false, description: '', stock: null, lowStockAt: null, sendToKitchen: true },
          qty: i.qty, unitPrice: i.price, note: i.note ?? '', modifiers: [],
        })),
        openedAt: new Date(), status: 'open',
      };
      store.tabs.set(prev => [tab, ...prev]);
      store.log('tab.create', `cafe · ${order.customerName} · web`, me?.id);
      toast.success(`Tab created for ${order.customerName}`);

    } else if (order.type === 'coworking') {
      const space = spaces.find(s => s.id === order.tableOrSpace || s.name === order.tableOrSpace);
      const period = order.period as import('@/lib/types').CoworkRatePeriod | undefined;
      const rate: CoworkSpaceRate | undefined = period
        ? space?.rates?.find(r => r.period === period) ?? space?.rates?.[0]
        : space?.rates?.[0];
      const spaceName = space?.name ?? order.tableOrSpace ?? 'Desk';
      const startDateStr = order.bookingDate ?? new Date().toISOString().slice(0, 10);
      const bookingEndsAt = rate ? calcBookingEndsAt(startDateStr, rate.period) : undefined;
      const productId = rate ? `${spaceName}-${rate.period}` : `web-desk-${order.id}`;
      const product: Product = {
        id: productId,
        name: rate ? `${spaceName} — ${PERIOD_LABEL[rate.period]}` : spaceName,
        price: rate?.price ?? 0,
        category: 'desks', description: '', stock: null, lowStockAt: null, sendToKitchen: false,
      };
      const tab: Tab = {
        id: newId('tab'), customerName: order.customerName, type: 'desk', label: spaceName,
        items: [{ id: newId('li'), productId: product.id, product, qty: 1, modifiers: [] }],
        openedAt: new Date(), status: 'open',
        ...(bookingEndsAt ? { bookingEndsAt } : {}),
        bookingType: 'hot',
      };
      store.tabs.set(prev => [tab, ...prev]);
      store.log('tab.create', `${order.customerName} checked in to ${spaceName} via web`, me?.id);
      toast.success(`${order.customerName} checked in to ${spaceName}`);

    } else {
      toast.success(`Booking accepted for ${order.customerName} — complete check-in on Rooms page`);
    }
  }

  async function handleDecline(order: PendingWebOrder) {
    setSelectedId(null);
    setMobileDetail(false);
    await updateDoc(doc(db, 'website-orders', order.id), {
      status: 'cancelled', updatedAt: new Date().toISOString(),
    });
    toast.info(`Booking from ${order.customerName} declined`);
  }

  async function handleDelete(order: PendingWebOrder) {
    const ok = await confirm({
      title: 'Delete this order?',
      message: `${order.customerName} · ${TYPE_LABEL[order.type]}. This permanently removes the order record and cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setSelectedId(null);
    setMobileDetail(false);
    await deleteDoc(doc(db, 'website-orders', order.id));
    toast.success('Order deleted');
  }

  /* ── Manager guard ───────────────────────────────────────────── */
  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-center px-6">
        <Globe size={40} strokeWidth={1.5} className="text-muted-foreground mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Manager access required</p>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Online Orders</h1>
            <p className="text-xs text-muted-foreground mt-0.5">All orders placed through the Denz website</p>
          </div>
          {/* Stats pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Total',    value: stats.total,    color: 'bg-black/5 dark:bg-white/5 text-foreground' },
              { label: 'Pending',  value: stats.pending,  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
              { label: 'Accepted', value: stats.accepted, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
              { label: 'Declined', value: stats.declined, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
            ].map(s => (
              <span key={s.label} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.color}`}>
                {s.label} {s.value}
              </span>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search customer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Status filter */}
          <div className="flex rounded-xl border border-border overflow-hidden text-xs font-medium">
            {(['all','pending','accepted','cancelled'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`h-8 px-3 transition-colors cursor-pointer capitalize ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {s === 'cancelled' ? 'Declined' : s === 'all' ? 'All' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex rounded-xl border border-border overflow-hidden text-xs font-medium">
            {([
              { v: 'all',          l: 'All'  },
              { v: 'cafe',         l: 'Café' },
              { v: 'coworking',    l: 'Desk' },
              { v: 'room-enquiry', l: 'Room' },
            ] as { v: TypeFilter; l: string }[]).map(({ v, l }) => (
              <button
                key={v}
                onClick={() => setType(v)}
                className={`h-8 px-3 transition-colors cursor-pointer ${
                  typeFilter === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body — two-column on desktop */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Order list — hidden on mobile when detail is open */}
        <div className={`${mobileDetail ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-w-0 overflow-y-auto`}>
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-24 text-center px-6">
              <Globe size={36} strokeWidth={1.5} className="text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search || statusFilter !== 'all' || typeFilter !== 'all' ? 'No orders match your filters' : 'No online orders yet'}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {groups.map(group => (
                <div key={group.date.toISOString()}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    {dayLabel(group.date)}
                  </p>
                  <div className="space-y-1.5">
                    {group.orders.map(order => {
                      const Icon = TYPE_ICON[order.type] ?? Coffee;
                      const isSelected = order.id === selectedId;
                      const spaceName = order.tableOrSpace
                        ? (spaces.find(s => s.id === order.tableOrSpace)?.name ?? order.tableOrSpace)
                        : null;
                      const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <button
                          key={order.id}
                          onClick={() => selectOrder(order.id)}
                          className={`w-full text-left px-4 py-3 rounded-2xl border transition-all duration-150 cursor-pointer
                            ${isSelected
                              ? 'border-primary/40 bg-primary/8 dark:bg-primary/10 ring-1 ring-primary/20'
                              : 'border-border bg-white/50 dark:bg-white/4 hover:bg-white/70 dark:hover:bg-white/6'
                            }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${TYPE_COLOR[order.type]}`}>
                              <Icon size={14} strokeWidth={2} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="text-sm font-semibold truncate">{order.customerName}</p>
                                  <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full leading-none ${STATUS_BADGE[order.status] ?? STATUS_BADGE.pending}`}>
                                    {STATUS_LABEL[order.status] ?? order.status}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground tabular-nums shrink-0">{timeStr}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {TYPE_LABEL[order.type]}
                                {spaceName && ` · ${spaceName}`}
                                {order.period && ` · ${SHORT_PERIOD[order.period] ?? order.period}`}
                                {order.items?.length ? ` · ${order.items.length} item${order.items.length > 1 ? 's' : ''}` : ''}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <aside className={`
          ${mobileDetail ? 'flex' : 'hidden'} md:flex
          w-full md:w-[300px] lg:w-[360px] shrink-0
          border-l border-border flex-col overflow-hidden
        `}>
          {selectedOrder ? (
            <>
              {/* Mobile back button */}
              <div className="md:hidden px-4 py-2 border-b border-border">
                <button
                  onClick={() => { setMobileDetail(false); setSelectedId(null); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back to orders
                </button>
              </div>
              <WebOrderPreview
                order={selectedOrder}
                spaces={spaces}
                readonly={selectedOrder.status !== 'pending'}
                onAccept={() => handleAccept(selectedOrder)}
                onDecline={() => handleDecline(selectedOrder)}
                onDelete={() => handleDelete(selectedOrder)}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <Globe size={32} strokeWidth={1.5} className="text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Select an order to view details</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
