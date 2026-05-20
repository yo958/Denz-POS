'use client';

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Monitor, Lock, Clock, DollarSign, Plus, Pencil, Trash2, Star, UserPlus, X, Building2, Package, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import { useTabs, useSettings, useSpaces, useEquipment, useCurrentStaff, useCustomers } from '@/lib/hooks/useStore';
import { tabGrandTotal, formatElapsed } from '@/lib/domain/tabs';
import { fmtCur } from '@/lib/format';
import { getStore } from '@/lib/store/store';
import { newId } from '@/lib/domain/id';
import { toast } from '@/components/ui/toast';
import { confirm } from '@/components/ui/confirm-dialog';
import { CustomerPicker } from '@/components/customers/CustomerPicker';
import {
  CheckInDialog,
  PERIOD_LABEL, PERIOD_DURATION_MS, TYPE_LABEL, BOOKING_TYPE_LABEL, normalizeType, calcBookingEndsAt,
} from '@/components/coworking/CheckInDialog';
import type {
  CoworkSpace, CoworkSpaceType, CoworkSpaceRate, CoworkRatePeriod, Equipment, EquipmentTier, Product, Tab,
} from '@/lib/types';

/* ── Constants ──────────────────────────────────────────────────── */

const ALL_PERIODS: CoworkRatePeriod[] = [
  'hourly', 'daily', 'weekly', '2-weeks', 'monthly', '3-months', '6-months', 'yearly',
];

const TYPE_COLOR: Record<CoworkSpaceType, string> = {
  'desk':           'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'private-office': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

const BOOKING_TYPE_COLOR = {
  hot:       'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  dedicated: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
} as const;

type SpaceFilter = 'all' | CoworkSpaceType;

function defaultRates(type: CoworkSpaceType): CoworkSpaceRate[] {
  const prices: Partial<Record<CoworkRatePeriod, number>> =
    type === 'private-office'
      ? { hourly: 500, daily: 1200, weekly: 5000, monthly: 15000 }
      : { hourly: 80, daily: 350, weekly: 1500, '2-weeks': 2600, monthly: 4500, '3-months': 12000, '6-months': 21000, yearly: 36000 };
  const defaultEnabled: CoworkRatePeriod[] =
    type === 'private-office' ? ['daily', 'weekly', 'monthly'] : ['hourly', 'daily', 'weekly', 'monthly'];
  return ALL_PERIODS.map(p => ({ period: p, price: prices[p] ?? 0, enabled: defaultEnabled.includes(p) }));
}

function defaultDedicatedRates(): CoworkSpaceRate[] {
  const prices: Partial<Record<CoworkRatePeriod, number>> =
    { daily: 600, weekly: 2500, '2-weeks': 4500, monthly: 8000, '3-months': 22000, '6-months': 40000, yearly: 72000 };
  return ALL_PERIODS.map(p => ({ period: p, price: prices[p] ?? 0, enabled: ['daily', 'weekly', 'monthly'].includes(p) }));
}

interface WebCoworkOrder {
  id: string;
  type?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  tableOrSpace?: string;
  period?: string;
  bookingDate?: string;
  bookingTime?: string;
  notes?: string;
  status: string;
  createdAt: string;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function CoWorkingPage() {
  const spaces    = useSpaces();
  const equipment = useEquipment();
  const tabs      = useTabs();
  const customers = useCustomers();
  const cur       = useSettings().currency;
  const me        = useCurrentStaff();
  const isManager = me?.role === 'manager';

  const [filter, setFilter]               = useState<SpaceFilter>('all');
  const [webOrders, setWebOrders]         = useState<WebCoworkOrder[]>([]);
  const [checkingIn, setCheckingIn]       = useState<CoworkSpace | null>(null);
  const [editingSpace, setEditingSpace]   = useState<CoworkSpace | null>(null);
  const [addingSpace, setAddingSpace]     = useState(false);
  const [rentingEquip, setRentingEquip]   = useState<Equipment | null>(null);
  const [editingEquip, setEditingEquip]   = useState<Equipment | null>(null);
  const [addingEquip, setAddingEquip]     = useState(false);

  // Spaces — track ALL active desk tabs per space name (supports multi-occupancy).
  // Two sources:
  //   1. Tabs of type 'desk' (created by the Coworking check-in or POS with no active tab)
  //   2. Regular POS tabs that have a desk line item added via the rate picker
  //
  // A tab counts as active on the coworking page when:
  //   - Its status is 'open' AND it hasn't expired by calendar day (daily) or bookingEndsAt (others), OR
  //   - It has been paid but has a future effective expiry
  const now = new Date();

  // Returns true if the tab has any desk item booked as a daily period.
  function hasDailyDeskItem(t: Tab): boolean {
    return t.items.some(i => i.product.category === 'desks' && i.product.name.endsWith(` — ${PERIOD_LABEL['daily']}`));
  }
  // True if both dates fall on the same calendar day.
  function sameCalendarDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  const activeTabsByLabel = new Map<string, Tab[]>();
  for (const t of tabs) {
    // A tab that was explicitly checked out early has bookingEndsAt set to epoch (new Date(0)).
    // Skip it immediately — it must not re-appear via the legacy inference below.
    const isExplicitlyExpired = !!t.bookingEndsAt &&
      new Date(t.bookingEndsAt as unknown as string).getTime() < 1000;
    if (isExplicitlyExpired) continue;

    // Open tabs: daily desk bookings expire at end of the calendar day they were opened.
    // Weekly/monthly/etc. open tabs are always shown (the customer holds the space).
    const isOpenAndActive = t.status === 'open' && (() => {
      if (t.bookingEndsAt && new Date(t.bookingEndsAt as unknown as string) > now) return true;
      if (hasDailyDeskItem(t)) return sameCalendarDay(new Date(t.openedAt as unknown as string), now);
      return true;
    })();

    // Paid tabs: daily bookings expire at end of the calendar day they were opened.
    // Other periods use bookingEndsAt or legacy paidAt+duration inference.
    const isPaidBookingStillActive = t.status === 'paid' && (() => {
      // Daily: calendar-day comparison regardless of stored bookingEndsAt (which may be paidAt+24h).
      if (hasDailyDeskItem(t)) return sameCalendarDay(new Date(t.openedAt as unknown as string), now);
      // Non-daily: use explicit bookingEndsAt first.
      if (!!t.bookingEndsAt && new Date(t.bookingEndsAt as unknown as string) > now) return true;
      // Legacy inference for weekly/monthly etc. (tabs created before bookingEndsAt tracking).
      return !!t.paidAt && t.items.some(item => {
        if (item.product.category !== 'desks') return false;
        const paidMs = new Date(t.paidAt as unknown as string).getTime();
        return (Object.entries(PERIOD_LABEL) as [CoworkRatePeriod, string][]).some(
          ([period, label]) =>
            period !== 'hourly' && period !== 'daily' &&
            item.product.name.endsWith(` — ${label}`) &&
            new Date(paidMs + PERIOD_DURATION_MS[period]).getTime() > now.getTime(),
        );
      });
    })();

    if (!isOpenAndActive && !isPaidBookingStillActive) continue;
    if (t.type === 'desk') {
      // Collect ALL space names this tab should be attributed to.
      // Primary: tab.label if it matches a known space.
      // Plus: every desk line item's space — handles multi-desk tabs (e.g. two people
      // on one tab, each at a different desk).
      const mappedKeys = new Set<string>();
      if (spaces.find(s => s.name === t.label)) mappedKeys.add(t.label!);
      for (const item of t.items) {
        if (item.product.category !== 'desks') continue;
        const s = spaces.find(x => item.productId.startsWith(x.id + '-') || x.id === item.productId);
        if (s) mappedKeys.add(s.name);
      }
      if (mappedKeys.size === 0) continue;
      for (const mk of mappedKeys) {
        const list = activeTabsByLabel.get(mk) ?? [];
        if (!list.find(x => x.id === t.id)) activeTabsByLabel.set(mk, [...list, t]);
      }
    } else {
      // Scan line items for desk-category products (added from POS rate picker)
      for (const item of t.items) {
        if (item.product.category === 'desks') {
          const space = spaces.find(s => s.id === item.productId || item.productId.startsWith(s.id + '-'));
          if (space) {
            const list = activeTabsByLabel.get(space.name) ?? [];
            if (!list.find(x => x.id === t.id)) {
              activeTabsByLabel.set(space.name, [...list, t]);
            }
          }
        }
      }
    }
  }
  const allSpaces = spaces.filter(s => !s.archived);
  // Spaces with at least one active booking
  const allActive = allSpaces.filter(s => (activeTabsByLabel.get(s.name)?.length ?? 0) > 0);
  const filtered  = allSpaces.filter(s => filter === 'all' || normalizeType(s.type) === filter);
  // Space is available while active count < capacity (default capacity = 1)
  const available = filtered.filter(s => {
    const count = activeTabsByLabel.get(s.name)?.length ?? 0;
    return count < (s.capacity ?? 1);
  });

  // Equipment — detect active by product.id prefix 'equip:'
  const activeEquipIds  = new Set<string>();
  const equipTabById    = new Map<string, Tab>();
  for (const t of tabs) {
    if (t.type === 'desk' && t.status === 'open') {
      for (const item of t.items) {
        if (item.product.id.startsWith('equip:')) {
          const equipId = item.product.id.slice(6);
          activeEquipIds.add(equipId);
          equipTabById.set(equipId, t);
        }
      }
    }
  }
  const visibleEquip   = equipment.filter(e => !e.archived);
  const availableEquip = visibleEquip.filter(e => !activeEquipIds.has(e.id));
  const activeEquip    = visibleEquip.filter(e =>  activeEquipIds.has(e.id));

  // Split active tabs: physically present (open) vs away with valid booking (paid hot desk)
  const presentCards: { space: CoworkSpace; tab: Tab }[] = [];
  const awayCards:    { space: CoworkSpace; tab: Tab }[] = [];
  for (const s of allActive) {
    for (const tab of activeTabsByLabel.get(s.name) ?? []) {
      if (tab.status === 'open') presentCards.push({ space: s, tab });
      else                       awayCards.push({ space: s, tab });
    }
  }
  const presentDeskCount = presentCards.length;
  const awayCount        = awayCards.length;
  const totalActive = presentDeskCount + activeEquip.length; // used for Active section visibility

  async function archiveSpace(s: CoworkSpace) {
    const ok = await confirm({ title: `Remove "${s.name}"?`, danger: true, confirmLabel: 'Remove' });
    if (!ok) return;
    getStore().spaces.set(prev => prev.map(x => x.id === s.id ? { ...x, archived: true } : x));
    toast.success('Space removed');
  }
  function saveSpace(updated: CoworkSpace) {
    const existing = spaces.find(s => s.id === updated.id);
    if (existing) {
      getStore().spaces.set(prev => prev.map(s => s.id === updated.id ? updated : s));
      toast.success('Space updated');
    } else {
      getStore().spaces.set(prev => [...prev, updated]);
      toast.success('Space added');
    }
    setEditingSpace(null);
    setAddingSpace(false);
  }

  // Real-time listener for pending website coworking booking requests
  useEffect(() => {
    // Single-field query avoids needing a composite Firestore index; filter + sort client-side
    const q = query(collection(db, 'website-orders'), where('status', '==', 'pending'));
    return onSnapshot(q, snap => {
      const orders = snap.docs
        .map(d => d.data() as WebCoworkOrder)
        .filter(o => o.type === 'coworking')
        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
      setWebOrders(orders);
    }, () => setWebOrders([]));
  }, []);

  async function acceptWebOrder(order: WebCoworkOrder) {
    const space = spaces.find(s =>
      s.id === order.tableOrSpace ||
      s.name.toLowerCase() === (order.tableOrSpace ?? '').toLowerCase().replace(/-/g, ' '),
    );
    const period = order.period as CoworkRatePeriod | undefined;
    const rate = space && period
      ? (space.dedicatedRates ?? space.rates).find(r => r.period === period && r.enabled)
        ?? space.rates.find(r => r.period === period && r.enabled)
      : undefined;
    if (!space || !rate) {
      toast.error(`Cannot find space or rate for "${order.tableOrSpace} / ${order.period}" — check the booking manually.`);
      return;
    }
    const startDateStr = order.bookingDate ?? toDateStr(new Date());
    const settings = getStore().settings.get();
    const dayName = new Date(startDateStr + 'T12:00:00')
      .toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = (settings.venue?.openingHours as Record<string, { close: string; closed: boolean }> | undefined)?.[dayName];
    const closeTime = dayHours && !dayHours.closed ? dayHours.close : '23:30';
    const bookingEndsAt = calcBookingEndsAt(startDateStr, period!, closeTime);
    const product: Product = {
      id: `${space.id}-${rate.period}`,
      name: `${space.name} — ${PERIOD_LABEL[rate.period]}`,
      price: rate.price,
      category: 'desks',
      description: '',
      stock: null,
      lowStockAt: null,
      sendToKitchen: false,
    };
    const tab: Tab = {
      id: newId('tab'),
      customerName: order.customerName,
      type: 'desk',
      label: space.name,
      items: [{ id: newId('li'), productId: product.id, product, qty: 1 }],
      openedAt: new Date(),
      status: 'open',
      bookingEndsAt,
      bookingType: 'dedicated',
    };
    getStore().tabs.set(prev => [tab, ...prev]);
    getStore().log('tab.web-booking-accepted', `${order.customerName} — ${space.name} (${PERIOD_LABEL[rate.period]})`, me?.id);
    await updateDoc(doc(db, 'website-orders', order.id), { status: 'accepted', updatedAt: new Date().toISOString() });
    toast.success(`Booking accepted — tab created for ${order.customerName}`);
  }

  async function declineWebOrder(order: WebCoworkOrder) {
    const ok = await confirm({ title: 'Decline booking?', message: `Decline ${order.customerName}'s request for ${order.tableOrSpace}?`, danger: true, confirmLabel: 'Decline' });
    if (!ok) return;
    await updateDoc(doc(db, 'website-orders', order.id), { status: 'cancelled', updatedAt: new Date().toISOString() });
    getStore().log('tab.web-booking-declined', `${order.customerName} — ${order.tableOrSpace}`, me?.id);
    toast.success('Booking declined');
  }

  function duplicateSpace(s: CoworkSpace) {
    const copy: CoworkSpace = {
      ...s,
      id: newId('space'),
      name: `${s.name} (copy)`,
    };
    getStore().spaces.set(prev => [...prev, copy]);
    // Open the editor immediately so the user can rename it
    setEditingSpace(copy);
    toast.success(`"${copy.name}" duplicated — rename it below`);
  }

  function duplicateEquipment(e: Equipment) {
    const copy: Equipment = {
      ...e,
      id: newId('equip'),
      name: `${e.name} (copy)`,
    };
    getStore().equipment.set(prev => [...prev, copy]);
    setEditingEquip(copy);
    toast.success(`"${copy.name}" duplicated — rename it below`);
  }

  async function archiveEquipment(e: Equipment) {
    const ok = await confirm({ title: `Remove "${e.name}"?`, danger: true, confirmLabel: 'Remove' });
    if (!ok) return;
    getStore().equipment.set(prev => prev.map(x => x.id === e.id ? { ...x, archived: true } : x));
    getStore().log('equipment.delete', e.name, me?.id);
    toast.success('Equipment removed');
  }
  function saveEquipment(updated: Equipment) {
    const isNew = !equipment.find(e => e.id === updated.id);
    if (isNew) {
      getStore().equipment.set(prev => [...prev, updated]);
      toast.success('Equipment added');
    } else {
      getStore().equipment.set(prev => prev.map(e => e.id === updated.id ? updated : e));
      toast.success('Equipment updated');
    }
    getStore().log(isNew ? 'equipment.create' : 'equipment.update', updated.name, me?.id);
    setEditingEquip(null);
    setAddingEquip(false);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-6 py-4 border-b border-border glass-strong">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">CoWorking</h1>
            <div className="flex items-center gap-4 mt-1 text-sm">
              <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-500" />{totalActive} active
              </span>
              {awayCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />{awayCount} away
                </span>
              )}
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />{available.length} available
              </span>
            </div>
          </div>
          {isManager && (
            <div className="flex gap-2">
              <button
                onClick={() => setAddingEquip(true)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer"
              >
                <Plus size={14} /> Add Equipment
              </button>
              <button
                onClick={() => setAddingSpace(true)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer"
              >
                <Plus size={14} /> Add Space
              </button>
            </div>
          )}
        </div>
        {/* Space type filter */}
        <div className="flex gap-2 mt-3">
          {(['all', 'desk', 'private-office'] as SpaceFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-primary/15 text-primary'
                  : 'bg-black/4 dark:bg-white/4 text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All' : TYPE_LABEL[f]}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── Pending website booking requests ── */}
        {webOrders.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {webOrders.length} pending web booking{webOrders.length !== 1 ? 's' : ''}
            </h2>
            <div className="space-y-2">
              {webOrders.map(order => (
                <div key={order.id} className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.tableOrSpace?.replace(/-/g, ' ')}
                      {order.period && ` · ${order.period}`}
                      {order.bookingDate && ` · ${new Date(order.bookingDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      {order.bookingTime && ` at ${order.bookingTime}`}
                    </p>
                    {order.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{order.notes}"</p>}
                    {(order.customerEmail || order.customerPhone) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.customerEmail}{order.customerEmail && order.customerPhone ? ' · ' : ''}{order.customerPhone}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => declineWebOrder(order)}
                      className="h-8 px-3 rounded-xl text-xs font-medium border border-border bg-white/60 dark:bg-white/5 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => acceptWebOrder(order)}
                      className="h-8 px-3 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-colors cursor-pointer"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Active — customers physically at a desk right now ── */}
        {totalActive > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-sky-700 dark:text-sky-400">Active</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeEquip.map(e => {
                const tab = equipTabById.get(e.id)!;
                return (
                  <ActiveEquipCard
                    key={e.id}
                    equip={e}
                    tab={tab}
                    cur={cur}
                    isManager={isManager}
                    onEdit={() => setEditingEquip(e)}
                    onReturn={async () => {
                      const ok = await confirm({ title: `Return ${e.name}?`, message: `End ${tab.customerName}'s rental.`, confirmLabel: 'Return' });
                      if (!ok) return;
                      getStore().tabs.set(prev => prev.map(t =>
                        t.id === tab.id
                          ? { ...t, status: 'paid', paidAt: new Date(), paidByStaffId: me?.id, paymentMethod: 'cash' }
                          : t,
                      ));
                      getStore().log('tab.pay', `${tab.customerName} returned ${e.name}`, me?.id);
                      toast.success(`${e.name} returned`);
                    }}
                  />
                );
              })}
              {presentCards.map(({ space: s, tab }) => (
                <ActiveCard
                  key={tab.id}
                  space={s}
                  tab={tab}
                  cur={cur}
                  isManager={isManager}
                  customer={customers.find(c => c.id === tab.customerId) ?? null}
                  onEdit={() => setEditingSpace(s)}
                  onCheckOut={(() => {
                    if (tab.type !== 'desk') return undefined;
                    return async () => {
                      const isOpenHotDesk = tab.bookingType === 'hot';
                      const ok = await confirm({
                        title: isOpenHotDesk
                          ? `${tab.customerName} is leaving for now?`
                          : `Check out ${tab.customerName}?`,
                        message: isOpenHotDesk
                          ? `Their hot desk booking continues — the desk is released for others.`
                          : undefined,
                        confirmLabel: isOpenHotDesk ? 'Release Desk' : 'Check Out',
                      });
                      if (!ok) return;
                      getStore().tabs.set(prev => prev.map(t =>
                        t.id === tab.id
                          ? { ...t, status: 'paid', paidAt: new Date(), paidByStaffId: me?.id, paymentMethod: 'cash' }
                          : t,
                      ));
                      getStore().log('tab.pay', `${tab.customerName} checked out of ${s.name}`, me?.id);
                      toast.success(isOpenHotDesk
                        ? `Desk released — ${tab.customerName}'s booking continues`
                        : `${tab.customerName} checked out`);
                    };
                  })()}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Away · May Return — valid booking, desk currently free ── */}
        {awayCount > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-amber-700 dark:text-amber-400">Away · May Return</h2>
            <p className="text-xs text-muted-foreground -mt-2 mb-3">
              These customers have a valid booking and may return — keep a desk free for each one.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {awayCards.map(({ space: s, tab }) => (
                <ActiveCard
                  key={tab.id}
                  space={s}
                  tab={tab}
                  cur={cur}
                  isManager={isManager}
                  customer={customers.find(c => c.id === tab.customerId) ?? null}
                  onEdit={() => setEditingSpace(s)}
                  onCheckOut={undefined}
                  isAway
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Equipment Rental ─────────────────────────────────── */}
        {visibleEquip.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-amber-700 dark:text-amber-400">Equipment Rental</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {availableEquip.map(e => (
                <EquipmentCard
                  key={e.id}
                  equip={e}
                  cur={cur}
                  isManager={isManager}
                  onRent={() => setRentingEquip(e)}
                  onEdit={() => setEditingEquip(e)}
                  onDuplicate={() => duplicateEquipment(e)}
                  onArchive={() => archiveEquipment(e)}
                />
              ))}
              {availableEquip.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full py-1">All equipment is currently in use.</p>
              )}
            </div>
          </section>
        )}

        {/* ── Available spaces ─────────────────────────────────── */}
        {available.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-emerald-700 dark:text-emerald-400">Available</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {available.map(s => (
                <AvailableCard
                  key={s.id}
                  space={s}
                  cur={cur}
                  isManager={isManager}
                  activeCount={activeTabsByLabel.get(s.name)?.length ?? 0}
                  onCheckIn={() => setCheckingIn(s)}
                  onEdit={() => setEditingSpace(s)}
                  onDuplicate={() => duplicateSpace(s)}
                  onArchive={() => archiveSpace(s)}
                />
              ))}
            </div>
          </section>
        )}

        {allSpaces.length === 0 && visibleEquip.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Monitor size={36} strokeWidth={1.2} />
            <p className="text-sm">No spaces yet.{isManager ? ' Add one above.' : ''}</p>
          </div>
        )}

      </div>

      {checkingIn && (
        <CheckInDialog
          space={checkingIn}
          cur={cur}
          onClose={() => setCheckingIn(null)}
          onConfirm={(customerName, rate, bookingEndsAt, customerId, bookingType) => {
            const product: Product = {
              id: `${checkingIn.id}-${rate.period}`,
              name: `${checkingIn.name} — ${PERIOD_LABEL[rate.period]}`,
              price: rate.price,
              category: 'desks',
              description: '',
              stock: null,
              lowStockAt: null,
              sendToKitchen: false,
            };
            const tab: Tab = {
              id: newId('tab'),
              customerName,
              type: 'desk',
              label: checkingIn.name,
              items: [{ id: newId('li'), productId: product.id, product, qty: 1 }],
              openedAt: new Date(),
              status: 'open',
              bookingEndsAt,
              bookingType,
              ...(customerId ? { customerId } : {}),
            };
            getStore().tabs.set(prev => [tab, ...prev]);
            getStore().log('tab.create', `${customerName} checked in to ${checkingIn.name} (${PERIOD_LABEL[rate.period]})`, me?.id);
            toast.success(`${customerName} checked in`);
            setCheckingIn(null);
          }}
        />
      )}

      {(addingSpace || editingSpace) && (
        <SpaceDialog
          space={editingSpace}
          cur={cur}
          isManager={isManager}
          onClose={() => { setAddingSpace(false); setEditingSpace(null); }}
          onSave={saveSpace}
        />
      )}

      {rentingEquip && (
        <RentDialog
          equip={rentingEquip}
          cur={cur}
          availableSpaces={spaces.filter(s => !s.archived && (activeTabsByLabel.get(s.name)?.length ?? 0) < (s.capacity ?? 1))}
          onClose={() => setRentingEquip(null)}
          onConfirm={(customerName, hours, equipTotal, space, deskTotal, bookingEndsAt, customerId) => {
            const equipProduct: Product = {
              id: `equip:${rentingEquip.id}`,
              name: `${rentingEquip.name} (${hours}hr)`,
              price: equipTotal,
              cost: rentingEquip.costPerHour != null ? rentingEquip.costPerHour * hours : null,
              category: 'equipment-rental',
              description: '',
              stock: null,
              lowStockAt: null,
              sendToKitchen: false,
            };
            const items: Tab['items'] = [
              { id: newId('li'), productId: equipProduct.id, product: equipProduct, qty: 1 },
            ];
            if (deskTotal > 0) {
              const deskPeriodLabel = bookingEndsAt
                ? (() => {
                    // find which period was used from the duration
                    const ms = bookingEndsAt.getTime() - Date.now();
                    const match = (Object.entries(PERIOD_DURATION_MS) as [CoworkRatePeriod, number][])
                      .sort((a, b) => Math.abs(a[1] - ms) - Math.abs(b[1] - ms))[0];
                    return PERIOD_LABEL[match[0]];
                  })()
                : `${hours}hr`;
              const deskProduct: Product = {
                id: `${space.id}-${bookingEndsAt ? 'dedicated' : 'hourly'}`,
                name: `${space.name} — ${deskPeriodLabel}`,
                price: deskTotal,
                category: 'desks',
                description: '',
                stock: null,
                lowStockAt: null,
                sendToKitchen: false,
              };
              items.push({ id: newId('li'), productId: deskProduct.id, product: deskProduct, qty: 1 });
            }
            const tab: Tab = {
              id: newId('tab'),
              customerName,
              type: 'desk',
              label: space.name,
              items,
              openedAt: new Date(),
              status: 'open',
              bookingEndsAt,
              ...(customerId ? { customerId } : {}),
            };
            getStore().tabs.set(prev => [tab, ...prev]);
            getStore().log('rental.create', `${customerName} rented ${rentingEquip.name} at ${space.name} for ${hours}hr`, me?.id);
            toast.success(`${rentingEquip.name} rented to ${customerName} at ${space.name}`);
            setRentingEquip(null);
          }}
        />
      )}

      {(addingEquip || editingEquip) && (
        <EquipmentDialog
          equip={editingEquip}
          cur={cur}
          isManager={isManager}
          onClose={() => { setAddingEquip(false); setEditingEquip(null); }}
          onSave={saveEquipment}
        />
      )}
    </div>
  );
}

/* ── Available card ─────────────────────────────────────────────── */
function AvailableCard({ space, cur, isManager, activeCount, onCheckIn, onEdit, onDuplicate, onArchive }: {
  space: CoworkSpace; cur: string; isManager: boolean; activeCount: number;
  onCheckIn: () => void; onEdit: () => void; onDuplicate: () => void; onArchive: () => void;
}) {
  const enabledHotRates       = space.rates?.filter(r => r.enabled) ?? [];
  const enabledDedicatedRates = (space.dedicatedRates ?? []).filter(r => r.enabled);
  const hasBoth               = enabledHotRates.length > 0 && enabledDedicatedRates.length > 0;
  const spaceType             = normalizeType(space.type);
  const Icon                  = spaceType === 'private-office' ? Building2 : Monitor;
  const ratePillCls           = 'text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/70 dark:bg-white/10 border border-border text-muted-foreground';
  return (
    <div className="flex flex-col rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 p-4 gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
            <Icon size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{space.name}</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLOR[spaceType]}`}>
              {TYPE_LABEL[spaceType]}
            </span>
          </div>
        </div>
        {isManager && (
          <div className="flex gap-0.5">
            <button onClick={onEdit} aria-label="Edit space" className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
              <Pencil size={12} />
            </button>
            <button onClick={onDuplicate} aria-label="Duplicate space" title="Duplicate" className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer">
              <Copy size={12} />
            </button>
            <button onClick={onArchive} aria-label="Remove space" className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      {hasBoth ? (
        <div className="space-y-1.5">
          <div>
            <p className="text-[9px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide mb-1">Hot Desk</p>
            <div className="flex flex-wrap gap-1">
              {enabledHotRates.map(r => (
                <span key={r.period} className={ratePillCls}>{PERIOD_LABEL[r.period]} {cur}{fmtCur(r.price)}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Dedicated</p>
            <div className="flex flex-wrap gap-1">
              {enabledDedicatedRates.map(r => (
                <span key={r.period} className={ratePillCls}>{PERIOD_LABEL[r.period]} {cur}{fmtCur(r.price)}</span>
              ))}
            </div>
          </div>
        </div>
      ) : enabledHotRates.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {enabledHotRates.map(r => (
            <span key={r.period} className={ratePillCls}>{PERIOD_LABEL[r.period]} {cur}{fmtCur(r.price)}</span>
          ))}
        </div>
      ) : null}
      {(() => {
        const cap = space.capacity ?? 1;
        const free = cap - activeCount;
        if (cap > 1) {
          return (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {free} of {cap} free
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: cap }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-3 h-3 rounded-full ${i < activeCount ? 'bg-sky-400' : 'bg-emerald-400'}`}
                  />
                ))}
              </div>
            </div>
          );
        }
        return <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Available</span>;
      })()}
      <button
        onClick={onCheckIn}
        className="w-full h-9 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
      >
        <UserPlus size={13} /> Check In
      </button>
    </div>
  );
}

/* ── Active card ────────────────────────────────────────────────── */
function ActiveCard({ space, tab, cur, isManager, customer, onEdit, onCheckOut, isAway }: {
  space: CoworkSpace; tab: Tab; cur: string; isManager: boolean;
  customer?: import('@/lib/types').Customer | null;
  onEdit: () => void; onCheckOut?: () => void;
  isAway?: boolean;
}) {
  const total = tabGrandTotal(tab.items, tab.discount);
  // Find the desk line item specifically (tab may also contain food/drink items)
  const deskItem = tab.items.find(li => li.product.category === 'desks');
  const rateName = deskItem?.product.name.replace(`${space.name} — `, '') ?? tab.items[0]?.product.name.replace(`${space.name} — `, '') ?? '';
  const spaceType = normalizeType(space.type);
  const Icon = spaceType === 'private-office' ? Building2 : Monitor;
  // endsAt: null if no bookingEndsAt OR if explicitly expired (near-epoch set by Early Check Out).
  const endsAt = tab.bookingEndsAt &&
    new Date(tab.bookingEndsAt as unknown as string).getTime() > 1000
      ? new Date(tab.bookingEndsAt as unknown as string) : null;
  const hasBookingEnd = !!endsAt;
  // isDedicated: explicit bookingType takes priority; fallback for old tabs that predate bookingType
  // (only those with a valid future bookingEndsAt — old dedicated-only behaviour).
  const isDedicated = tab.bookingType === 'dedicated' || (!tab.bookingType && hasBookingEnd);
  // isExpired only applies to dedicated desks — hot desks auto-vanish from the active list;
  // they never need to show a red "Expired" state.
  const isExpired = isDedicated && endsAt !== null && endsAt < new Date();
  const bookingLabel = spaceType === 'desk' ? BOOKING_TYPE_LABEL[isDedicated ? 'dedicated' : 'hot'] : TYPE_LABEL[spaceType];
  const bookingColor = spaceType === 'desk' ? BOOKING_TYPE_COLOR[isDedicated ? 'dedicated' : 'hot'] : TYPE_COLOR[spaceType];
  const discountPill = customer?.discount
    ? customer.discount.type === 'pct'
      ? `${customer.discount.value}% off`
      : `${cur}${customer.discount.value} off`
    : null;

  function fmtEnd(d: Date) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const cardBorder = isAway
    ? 'border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10'
    : isExpired
      ? 'border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/10'
      : 'border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-900/10';
  const iconBg = isAway
    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
    : isExpired
      ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
      : 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400';

  return (
    <div className={`flex flex-col rounded-2xl border p-4 gap-3 ${cardBorder}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${iconBg}`}>
            <Icon size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{space.name}</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${bookingColor}`}>
              {bookingLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isAway
            ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Away</span>
            : isExpired
              ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">Expired</span>
              : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">Active</span>
          }
          {isManager && (
            <button onClick={onEdit} className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">{tab.customerName}</p>
          {customer?.vip && <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {rateName && <p className="text-xs text-muted-foreground">{rateName}</p>}
          {discountPill && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
              {discountPill}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {hasBookingEnd && endsAt ? (
            <span className={`flex items-center gap-1 ${isExpired ? 'text-rose-600 dark:text-rose-400 font-medium' : ''}`}>
              <Clock size={11} />
              {isExpired ? `Expired ${fmtEnd(endsAt)}` : `Until ${fmtEnd(endsAt)}`}
            </span>
          ) : (
            <span className="flex items-center gap-1"><Clock size={11} /> {formatElapsed(tab.openedAt)}</span>
          )}
          <span className="flex items-center gap-1"><DollarSign size={11} /> {cur}{fmtCur(total)}</span>
        </div>
      </div>
      {onCheckOut ? (
        <button
          onClick={onCheckOut}
          className={`w-full h-9 rounded-xl text-xs font-semibold text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            isExpired ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'
          }`}
        >
          <Lock size={13} />
          {/* Button label: hot desk open = "Release Desk"; dedicated already paid = "Early Check Out"; default = "Check Out" */}
          {!isDedicated && tab.status === 'open' ? 'Release Desk'
            : isDedicated && tab.status === 'paid' ? 'Early Check Out'
            : 'Check Out'}
        </button>
      ) : tab.type === 'desk' && !isDedicated && tab.status === 'paid' && hasBookingEnd ? (
        // Hot desk pre-paid reservation — no action needed, auto-expires at bookingEndsAt
        <p className="text-xs text-muted-foreground text-center py-1 border border-dashed border-border rounded-xl">
          Pre-paid · can return until {fmtEnd(endsAt!)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1 border border-dashed border-border rounded-xl">
          Manage on the POS tab
        </p>
      )}
    </div>
  );
}

/* ── Space add/edit dialog ──────────────────────────────────────── */
function SpaceDialog({ space, cur, isManager, onClose, onSave }: {
  space: CoworkSpace | null; cur: string; isManager: boolean;
  onClose: () => void;
  onSave: (s: CoworkSpace) => void;
}) {
  const isNew = !space;
  const [name,             setName]             = useState(space?.name ?? '');
  const [type,             setType]             = useState<CoworkSpaceType>(space ? normalizeType(space.type) : 'desk');
  const [desc,             setDesc]             = useState(space?.description ?? '');
  const [longDesc,         setLongDesc]         = useState(space?.longDescription ?? '');
  const [rates,            setRates]            = useState<CoworkSpaceRate[]>(space?.rates ?? defaultRates('desk'));
  const [dedicatedEnabled, setDedicatedEnabled] = useState<boolean>((space?.dedicatedRates?.filter(r => r.enabled).length ?? 0) > 0);
  const [dedicatedRates,   setDedicatedRates]   = useState<CoworkSpaceRate[]>(space?.dedicatedRates ?? defaultDedicatedRates());
  const [multiOccupancy,   setMultiOccupancy]   = useState<boolean>((space?.capacity ?? 1) > 1);
  const [capacity,         setCapacity]         = useState<number>(space?.capacity && space.capacity > 1 ? space.capacity : 3);

  function handleTypeChange(t: CoworkSpaceType) {
    setType(t);
    if (isNew) { setRates(defaultRates(t)); setDedicatedRates(defaultDedicatedRates()); }
  }

  function patchRate(period: CoworkRatePeriod, patch: Partial<CoworkSpaceRate>) {
    setRates(prev => prev.map(r => r.period === period ? { ...r, ...patch } : r));
  }
  function patchDedicatedRate(period: CoworkRatePeriod, patch: Partial<CoworkSpaceRate>) {
    setDedicatedRates(prev => prev.map(r => r.period === period ? { ...r, ...patch } : r));
  }

  // Hourly tier helpers (only the hourly rate supports tiers)
  const hourlyRate = rates.find(r => r.period === 'hourly');
  const hourlyTiers: EquipmentTier[] = hourlyRate?.tiers ?? [];
  const hasHourlyTiers = hourlyTiers.length > 0;

  function addHourlyTier() {
    const last = hourlyTiers[hourlyTiers.length - 1]?.price ?? hourlyRate?.price ?? 0;
    patchRate('hourly', { tiers: [...hourlyTiers, { price: last }] });
  }
  function removeHourlyTier(idx: number) {
    if (hourlyTiers.length <= 1) return;
    const next = hourlyTiers.filter((_, i) => i !== idx);
    patchRate('hourly', { tiers: next, price: next[0]?.price ?? 0 });
  }
  function patchHourlyTier(idx: number, price: number) {
    const next = hourlyTiers.map((t, i) => i === idx ? { price } : t);
    patchRate('hourly', { tiers: next, price: next[0]?.price ?? 0 });
  }
  function enableHourlyTiers() {
    // Seed with current flat price as hour 1
    patchRate('hourly', { tiers: [{ price: hourlyRate?.price ?? 0 }, { price: hourlyRate?.price ?? 0 }] });
  }
  function disableHourlyTiers() {
    patchRate('hourly', { tiers: [] });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name required'); return; }
    onSave({
      id: space?.id ?? newId('sp'),
      name: name.trim(),
      type,
      description: desc.trim() || undefined,
      longDescription: longDesc.trim() || undefined,
      rates,
      dedicatedRates: (type === 'desk' && dedicatedEnabled) ? dedicatedRates : undefined,
      capacity: multiOccupancy ? Math.max(2, capacity) : undefined,
      archived: space?.archived,
    });
  }

  const inputCls = 'w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg glass-strong rounded-3xl shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold">{isNew ? 'Add Space' : `Edit ${space.name}`}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Name + type */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Desk 9" className={inputCls} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</span>
              <select value={type} onChange={e => handleTypeChange(e.target.value as CoworkSpaceType)} className={inputCls}>
                <option value="desk">Desk</option>
                <option value="private-office">Private Office</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description (optional)</span>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Window seat, standing desk" className={inputCls} />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full page description (optional)</span>
            <RichTextEditor value={longDesc} onChange={setLongDesc} />
          </div>

          {/* Multiple occupancy */}
          <div className="rounded-xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Multiple occupancy</p>
                <p className="text-xs text-muted-foreground mt-0.5">Allow several bookings at once (e.g. 3 identical hot desks)</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={multiOccupancy}
                onClick={() => setMultiOccupancy(v => !v)}
                className={`inline-flex items-center w-10 h-[22px] rounded-full border-2 border-transparent transition-colors duration-200 shrink-0 cursor-pointer ${multiOccupancy ? 'bg-primary' : 'bg-black/15 dark:bg-white/20'}`}
              >
                <span className={`w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${multiOccupancy ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {multiOccupancy && (
              <div className="px-4 pb-3 border-t border-border">
                <label className="block space-y-1.5 mt-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total slots (e.g. 3 desks)</span>
                  <input
                    type="number"
                    min={2}
                    max={99}
                    value={capacity}
                    onChange={e => setCapacity(Math.max(2, parseInt(e.target.value) || 2))}
                    className={inputCls}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Hot Desk Rates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {type === 'desk' ? 'Hot Desk Rates' : 'Rates'}
              </span>
              <span className="text-[10px] text-muted-foreground">Toggle to enable · set price per period</span>
            </div>
            <div className="rounded-xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
              {rates.map(r => {
                const isHourly = r.period === 'hourly';
                return (
                  <div key={r.period} className={`transition-opacity ${r.enabled ? '' : 'opacity-50'}`}>
                    {/* Period row */}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.enabled}
                        onClick={() => patchRate(r.period, { enabled: !r.enabled })}
                        className={`inline-flex items-center w-10 h-[22px] rounded-full border-2 border-transparent transition-colors duration-200 shrink-0 cursor-pointer ${r.enabled ? 'bg-primary' : 'bg-black/15 dark:bg-white/20'}`}
                      >
                        <span className={`w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${r.enabled ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-sm font-medium w-24 shrink-0">{PERIOD_LABEL[r.period]}</span>
                      {/* For hourly with tiers: show summary; otherwise show flat price input */}
                      {isHourly && hasHourlyTiers ? (
                        <span className="flex-1 text-xs text-muted-foreground">
                          {hourlyTiers.length} tier{hourlyTiers.length !== 1 ? 's' : ''} · hr 1 = {cur}{hourlyTiers[0]?.price ?? 0}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-sm text-muted-foreground shrink-0">{cur}</span>
                          <input
                            type="number" min={0} step={1} value={r.price || ''}
                            onChange={e => patchRate(r.period, { price: parseFloat(e.target.value) || 0 })}
                            disabled={!r.enabled} placeholder="0"
                            className="flex-1 h-9 px-3 rounded-xl text-sm tabular-nums bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
                          />
                          {isManager && (
                            <>
                              <span className="text-[10px] text-muted-foreground shrink-0 ml-1">cost</span>
                              <input
                                type="number" min={0} step={1} value={r.cost ?? ''}
                                onChange={e => patchRate(r.period, { cost: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })}
                                disabled={!r.enabled} placeholder="—"
                                className="w-16 h-9 px-2 rounded-xl text-sm tabular-nums bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed text-teal-600 dark:text-teal-400"
                              />
                            </>
                          )}
                        </div>
                      )}
                      {/* Toggle tiers button for hourly only */}
                      {isHourly && r.enabled && (
                        <button
                          type="button"
                          onClick={hasHourlyTiers ? disableHourlyTiers : enableHourlyTiers}
                          className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          {hasHourlyTiers ? 'Flat rate' : 'Per-hr tiers'}
                        </button>
                      )}
                    </div>

                    {/* Hourly tier sub-rows */}
                    {isHourly && hasHourlyTiers && r.enabled && (
                      <div className="border-t border-border bg-black/2 dark:bg-white/2 px-3 pb-2.5 pt-2 space-y-1.5">
                        {hourlyTiers.map((t, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">
                              {hourlyTiers.length === 1 ? 'Per hour' : i === hourlyTiers.length - 1 ? `Hr ${i + 1}+` : `Hour ${i + 1}`}
                            </span>
                            <div className="flex items-center gap-1 flex-1">
                              <span className="text-sm text-muted-foreground shrink-0">{cur}</span>
                              <input
                                type="number" min={0} step={0.5} value={t.price || ''}
                                onChange={e => patchHourlyTier(i, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="flex-1 h-8 px-2 rounded-lg text-sm tabular-nums bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                            {hourlyTiers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeHourlyTier(i)}
                                className="flex items-center justify-center w-6 h-6 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer shrink-0"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addHourlyTier}
                          className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-black/3 dark:hover:bg-white/3 cursor-pointer w-full justify-center transition-colors"
                        >
                          <Plus size={11} /> Add hour tier
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dedicated Desk Rates — desks only */}
          {type === 'desk' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dedicatedEnabled}
                    onClick={() => setDedicatedEnabled(v => !v)}
                    className={`inline-flex items-center w-10 h-[22px] rounded-full border-2 border-transparent transition-colors duration-200 shrink-0 cursor-pointer ${dedicatedEnabled ? 'bg-indigo-500' : 'bg-black/15 dark:bg-white/20'}`}
                  >
                    <span className={`w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${dedicatedEnabled ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dedicated Desk Rates</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Block-booking, higher price</span>
              </div>
              {dedicatedEnabled && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10 divide-y divide-indigo-100 dark:divide-indigo-900">
                  {dedicatedRates.map(r => (
                    <div key={r.period} className={`flex items-center gap-3 px-3 py-2.5 transition-opacity ${r.enabled ? '' : 'opacity-50'}`}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.enabled}
                        onClick={() => patchDedicatedRate(r.period, { enabled: !r.enabled })}
                        className={`inline-flex items-center w-10 h-[22px] rounded-full border-2 border-transparent transition-colors duration-200 shrink-0 cursor-pointer ${r.enabled ? 'bg-indigo-500' : 'bg-black/15 dark:bg-white/20'}`}
                      >
                        <span className={`w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${r.enabled ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-sm font-medium w-24 shrink-0">{PERIOD_LABEL[r.period]}</span>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-sm text-muted-foreground shrink-0">{cur}</span>
                        <input
                          type="number" min={0} step={1} value={r.price || ''}
                          onChange={e => patchDedicatedRate(r.period, { price: parseFloat(e.target.value) || 0 })}
                          disabled={!r.enabled} placeholder="0"
                          className="flex-1 h-9 px-3 rounded-xl text-sm tabular-nums bg-white/60 dark:bg-white/5 border border-indigo-200 dark:border-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed"
                        />
                        {isManager && (
                          <>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">cost</span>
                            <input
                              type="number" min={0} step={1} value={r.cost ?? ''}
                              onChange={e => patchDedicatedRate(r.period, { cost: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })}
                              disabled={!r.enabled} placeholder="—"
                              className="w-16 h-9 px-2 rounded-xl text-sm tabular-nums bg-white/60 dark:bg-white/5 border border-indigo-200 dark:border-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed text-teal-600 dark:text-teal-400"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">Save</button>
        </div>
      </form>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function calcRentalTotal(tiers: EquipmentTier[], hours: number): number {
  let total = 0;
  for (let h = 1; h <= hours; h++) {
    total += tiers[Math.min(h - 1, tiers.length - 1)]?.price ?? 0;
  }
  return total;
}

/* ── Equipment card (available) ─────────────────────────────────── */
function EquipmentCard({ equip: e, cur, isManager, onRent, onEdit, onDuplicate, onArchive }: {
  equip: Equipment; cur: string; isManager: boolean;
  onRent: () => void; onEdit: () => void; onDuplicate: () => void; onArchive: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 p-4 gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
            <Package size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{e.name}</p>
            {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
          </div>
        </div>
        {isManager && (
          <div className="flex gap-0.5">
            <button onClick={onEdit} aria-label="Edit equipment" className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
              <Pencil size={12} />
            </button>
            <button onClick={onDuplicate} aria-label="Duplicate equipment" title="Duplicate" className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer">
              <Copy size={12} />
            </button>
            <button onClick={onArchive} aria-label="Remove equipment" className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {e.tiers.map((t, i) => (
          <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/70 dark:bg-white/10 border border-border text-muted-foreground">
            {e.tiers.length === 1 ? 'Per hr' : i === e.tiers.length - 1 ? `Hr ${i + 1}+` : `Hr ${i + 1}`}: {cur}{t.price}
          </span>
        ))}
      </div>
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Available</span>
      <button
        onClick={onRent}
        className="w-full h-9 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
      >
        <Package size={13} /> Rent
      </button>
    </div>
  );
}

/* ── Equipment card (active rental) ─────────────────────────────── */
function ActiveEquipCard({ equip: e, tab, cur, isManager, onEdit, onReturn }: {
  equip: Equipment; tab: Tab; cur: string; isManager: boolean;
  onEdit: () => void; onReturn: () => void;
}) {
  const total = tabGrandTotal(tab.items, tab.discount);
  return (
    <div className="flex flex-col rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-900/10 p-4 gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">
            <Package size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{e.name}</p>
            {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">Active</span>
          {isManager && (
            <button onClick={onEdit} className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">{tab.customerName}</p>
        <p className="text-xs text-muted-foreground">at {tab.label}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock size={11} /> {formatElapsed(tab.openedAt)}</span>
          <span className="flex items-center gap-1"><DollarSign size={11} /> {cur}{fmtCur(total)}</span>
        </div>
      </div>
      <button
        onClick={onReturn}
        className="w-full h-9 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
      >
        <Lock size={13} /> Return
      </button>
    </div>
  );
}

/* ── Rent dialog ─────────────────────────────────────────────────── */
function RentDialog({ equip: e, cur, availableSpaces, onClose, onConfirm }: {
  equip: Equipment; cur: string; availableSpaces: CoworkSpace[];
  onClose: () => void;
  onConfirm: (customerName: string, hours: number, equipTotal: number, space: CoworkSpace, deskTotal: number, bookingEndsAt?: Date, customerId?: string) => void;
}) {
  const [name,             setName]             = useState('');
  const [customerId,       setCustomerId]       = useState<string | undefined>();
  const [hours,            setHours]            = useState(1);
  const [spaceId,          setSpaceId]          = useState(availableSpaces[0]?.id ?? '');
  const [deskBookingType,  setDeskBookingType]  = useState<'hot' | 'dedicated'>('hot');
  const [dedicatedRateIdx, setDedicatedRateIdx] = useState(0);

  const selectedSpace         = availableSpaces.find(s => s.id === spaceId) ?? availableSpaces[0];
  const enabledDedicatedRates = (selectedSpace?.dedicatedRates ?? []).filter(r => r.enabled);
  const hasDedicatedOption    = enabledDedicatedRates.length > 0;
  const isDedicatedDesk       = hasDedicatedOption && deskBookingType === 'dedicated';
  const hourlyRateObj         = selectedSpace?.rates?.find(r => r.period === 'hourly' && r.enabled);
  const hourlyTiersForCalc    = (hourlyRateObj?.tiers && hourlyRateObj.tiers.length > 0)
                                  ? hourlyRateObj.tiers
                                  : [{ price: hourlyRateObj?.price ?? 0 }];
  const equipTotal            = calcRentalTotal(e.tiers, hours);
  const selectedDedicatedRate = enabledDedicatedRates[dedicatedRateIdx];
  const deskTotal             = isDedicatedDesk
                                  ? (selectedDedicatedRate?.price ?? 0)
                                  : calcRentalTotal(hourlyTiersForCalc, hours);
  const grandTotal            = equipTotal + deskTotal;
  const noSpaces              = availableSpaces.length === 0;
  const canSubmit             = name.trim().length > 0 && hours >= 1 && !noSpaces;

  function handleSpaceChange(id: string) {
    setSpaceId(id);
    setDeskBookingType('hot');
    setDedicatedRateIdx(0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={ev => {
          ev.preventDefault();
          if (!canSubmit || !selectedSpace) return;
          const todayStr = toDateStr(new Date());
          const settings = getStore().settings.get();
          const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const todayHours = (settings.venue?.openingHours as Record<string, { close: string; closed: boolean }> | undefined)?.[todayName];
          const closeTime = todayHours && !todayHours.closed ? todayHours.close : '23:30';
          const bookingEndsAt = isDedicatedDesk && selectedDedicatedRate
            ? calcBookingEndsAt(todayStr, selectedDedicatedRate.period, closeTime)
            : undefined;
          onConfirm(name.trim(), hours, equipTotal, selectedSpace, deskTotal, bookingEndsAt, customerId);
        }}
        className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
              <Package size={16} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Rent Equipment</h2>
              <p className="text-xs text-muted-foreground">{e.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {noSpaces ? (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-xl px-3 py-2.5">
            No desks or offices available right now. Equipment rental requires a space.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer name</label>
              <CustomerPicker
                value={name}
                customerId={customerId}
                onChange={(n, id) => { setName(n); setCustomerId(id); }}
                placeholder="Search or type a name…"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Desk / Office</label>
                <select
                  value={spaceId}
                  onChange={ev => handleSpaceChange(ev.target.value)}
                  className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {availableSpaces.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Equipment Hours</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setHours(h => Math.max(1, h - 1))}
                    className="flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-white/50 dark:bg-white/5 text-foreground hover:bg-black/5 transition-colors cursor-pointer shrink-0"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <span className="flex-1 text-center text-base font-bold tabular-nums">{hours}</span>
                  <button
                    type="button"
                    onClick={() => setHours(h => h + 1)}
                    className="flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-white/50 dark:bg-white/5 text-foreground hover:bg-black/5 transition-colors cursor-pointer shrink-0"
                  >
                    <ChevronUp size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Desk booking type — only shown when space has dedicated rates */}
            {hasDedicatedOption && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Desk Booking Type</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['hot', 'dedicated'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setDeskBookingType(t); setDedicatedRateIdx(0); }}
                      className={`h-9 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                        deskBookingType === t
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border bg-black/3 dark:bg-white/3 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {BOOKING_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
                {isDedicatedDesk && (
                  <div className="space-y-1 pt-1">
                    {enabledDedicatedRates.map((r, i) => (
                      <label key={r.period} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${dedicatedRateIdx === i ? 'border-primary bg-primary/5' : 'border-border bg-black/3 dark:bg-white/3 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                        <div className="flex items-center gap-2">
                          <input type="radio" name="ded-rate" checked={dedicatedRateIdx === i} onChange={() => setDedicatedRateIdx(i)} className="accent-primary" />
                          <span className="text-sm font-medium">{PERIOD_LABEL[r.period]}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums shrink-0">{cur}{fmtCur(r.price)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Price breakdown */}
            <div className="rounded-xl border border-border bg-white/40 dark:bg-white/3 divide-y divide-border text-sm">
              {Array.from({ length: hours }, (_, i) => {
                const price = e.tiers[Math.min(i, e.tiers.length - 1)]?.price ?? 0;
                return (
                  <div key={`eq-${i}`} className="flex justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">{e.name} — hr {i + 1}</span>
                    <span className="font-medium tabular-nums">{cur}{fmtCur(price)}</span>
                  </div>
                );
              })}
              {deskTotal > 0 && (
                <div className="flex justify-between px-3 py-1.5">
                  <span className="text-muted-foreground">
                    {selectedSpace?.name} — {isDedicatedDesk ? `${PERIOD_LABEL[selectedDedicatedRate!.period]} (Dedicated)` : `${hours}hr`}
                  </span>
                  <span className="font-medium tabular-nums">{cur}{fmtCur(deskTotal)}</span>
                </div>
              )}
              <div className="flex justify-between px-3 py-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{cur}{fmtCur(grandTotal)}</span>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" disabled={!canSubmit} className="flex-1 h-10 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer">Rent</button>
        </div>
      </form>
    </div>
  );
}

/* ── Equipment add/edit dialog ──────────────────────────────────── */
function EquipmentDialog({ equip, cur, isManager, onClose, onSave }: {
  equip: Equipment | null; cur: string; isManager: boolean;
  onClose: () => void;
  onSave: (e: Equipment) => void;
}) {
  const isNew = !equip;
  const [name, setName]         = useState(equip?.name ?? '');
  const [desc, setDesc]         = useState(equip?.description ?? '');
  const [tiers, setTiers]       = useState<EquipmentTier[]>(equip?.tiers ?? [{ price: 10 }]);
  const [costPerHour, setCostPerHour] = useState<number | null>(equip?.costPerHour ?? null);

  function addTier() {
    setTiers(prev => [...prev, { price: prev[prev.length - 1]?.price ?? 0 }]);
  }
  function removeTier(idx: number) {
    if (tiers.length <= 1) return;
    setTiers(prev => prev.filter((_, i) => i !== idx));
  }
  function patchTier(idx: number, price: number) {
    setTiers(prev => prev.map((t, i) => i === idx ? { price } : t));
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { toast.error('Name required'); return; }
    if (tiers.some(t => t.price < 0)) { toast.error('Prices must be 0 or more'); return; }
    onSave({ id: equip?.id ?? newId('eq'), name: name.trim(), description: desc.trim() || undefined, tiers, costPerHour: costPerHour ?? undefined, archived: equip?.archived });
  }

  const inputCls = 'w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md glass-strong rounded-3xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold">{isNew ? 'Add Equipment' : `Edit ${equip.name}`}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MacBook Pro" className={inputCls} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description (optional)</span>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. 16-inch, M3 Pro" className={inputCls} />
          </label>

          {isManager && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost per hour (optional)</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground shrink-0">{cur}</span>
                <input
                  type="number" min={0} step={0.5} value={costPerHour ?? ''}
                  onChange={e => setCostPerHour(e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                  placeholder="—"
                  className={inputCls + ' tabular-nums'}
                />
              </div>
            </label>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hourly pricing</span>
              <span className="text-[10px] text-muted-foreground">Last tier repeats for additional hours</span>
            </div>
            <div className="rounded-xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-sm font-medium w-20 shrink-0 text-muted-foreground">
                    {tiers.length === 1 ? 'Per hour' : i === tiers.length - 1 ? `Hr ${i + 1}+` : `Hour ${i + 1}`}
                  </span>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-sm text-muted-foreground shrink-0">{cur}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={t.price || ''}
                      onChange={e => patchTier(i, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="flex-1 h-9 px-3 rounded-xl text-sm tabular-nums bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer shrink-0"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTier}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border hover:bg-black/3 dark:hover:bg-white/3 cursor-pointer w-full justify-center transition-colors"
            >
              <Plus size={12} /> Add pricing tier
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">Save</button>
        </div>
      </form>
    </div>
  );
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 h-7 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-white/50 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
    }`;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-white/30 dark:bg-black/20 flex-wrap">
        <button type="button" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button type="button" className={`${btn(editor.isActive('bold'))} font-bold`} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button type="button" className={`${btn(editor.isActive('italic'))} italic`} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
      </div>
      <EditorContent
        editor={editor}
        className={[
          'min-h-[160px] px-3 py-2.5 text-sm bg-black/3 dark:bg-white/3',
          '[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[140px]',
          '[&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:mb-1',
          '[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:mb-0.5',
          '[&_.ProseMirror_p]:my-1',
          '[&_.ProseMirror_strong]:font-bold',
          '[&_.ProseMirror_em]:italic',
          '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5',
          '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5',
          '[&_.ProseMirror_li]:my-0.5',
        ].join(' ')}
      />
    </div>
  );
}
