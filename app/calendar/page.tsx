'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Monitor, BedDouble, CalendarDays } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentStaff, useSpaces, useStays, useProducts, useTabs, useSettings } from '@/lib/hooks/useStore';
import { PERIOD_DURATION_MS, PERIOD_LABEL } from '@/components/coworking/CheckInDialog';
import type { PendingWebOrder } from '@/app/page';
import type { Stay, Tab } from '@/lib/types';
import type { CoworkRatePeriod } from '@/lib/types';

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getMondayOfWeek(d: Date): Date {
  const day = new Date(d);
  const dow = day.getDay();
  day.setDate(day.getDate() - (dow === 0 ? 6 : dow - 1));
  day.setHours(0, 0, 0, 0);
  return day;
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

function dayLabel(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime()) return 'Today';
  if (t.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const DAY_NAMES_LONG = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Returns true if the coworking space is open on this calendar day
// (reads from settings.venue.openingHours — missing = open, closed:true = closed)
function isCoworkingOpen(day: Date, openingHours: Record<string, { closed?: boolean }> = {}): boolean {
  const name = DAY_NAMES_LONG[day.getDay()];
  return !(openingHours[name]?.closed === true);
}

// ─── Booking-on-day helpers ───────────────────────────────────────────────────

// Build a reverse map from PERIOD_LABEL values ("Weekly") → period key ("weekly")
const LABEL_TO_PERIOD: Record<string, CoworkRatePeriod> = Object.fromEntries(
  Object.entries(PERIOD_LABEL).map(([k, v]) => [v.toLowerCase(), k as CoworkRatePeriod]),
);

// Infer period from a desk line item product name e.g. "Hot Desk — Weekly" → 'weekly'
function inferPeriodFromItems(tab: Tab): CoworkRatePeriod | null {
  for (const item of tab.items) {
    if (item.product?.category !== 'desks') continue;
    const parts = item.product.name.split('—');
    if (parts.length >= 2) {
      const label = parts[parts.length - 1].trim().toLowerCase();
      if (LABEL_TO_PERIOD[label]) return LABEL_TO_PERIOD[label];
    }
  }
  return null;
}

// Get the effective booking end date for a tab (mirrors coworking page isPaidBookingStillActive)
function getEffectiveEndsAt(tab: Tab): Date | null {
  const bookingEndsAt = tab.bookingEndsAt as unknown as string | undefined;
  // Explicitly force-expired (early check-out sets epoch)
  if (bookingEndsAt && new Date(bookingEndsAt).getTime() < 1000) return null;
  // Explicit future bookingEndsAt
  if (bookingEndsAt) return new Date(bookingEndsAt);
  // Legacy paid tabs: infer from paidAt + period duration
  const paidAt = tab.paidAt as unknown as string | undefined;
  if (paidAt) {
    const period = inferPeriodFromItems(tab);
    if (period && period !== 'hourly') {
      return new Date(new Date(paidAt).getTime() + PERIOD_DURATION_MS[period]);
    }
  }
  return null;
}

// Web order: bookingDate + period determine the span
function webOrderCoversDay(order: PendingWebOrder, day: Date): boolean {
  if (!order.bookingDate) return false;
  const start = new Date(order.bookingDate + 'T00:00:00');
  const durationMs = order.period
    ? (PERIOD_DURATION_MS[order.period as CoworkRatePeriod] ?? 86_400_000)
    : 86_400_000;
  const end = new Date(start.getTime() + durationMs);
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end > dayStart;
}

// For weekly-period tabs, find the date of the Nth open day from a start date.
// This lets us display a "weekly" pass as exactly 5 open (working) days rather
// than 7 raw calendar days, which would bleed into the following Monday.
function getNthOpenDayEnd(
  start: Date,
  n: number,
  openingHours: Record<string, { closed?: boolean }>,
): Date {
  let openCount = 0;
  const d = new Date(start); d.setHours(0, 0, 0, 0);
  let lastOpen = new Date(d);
  for (let i = 0; i < 60; i++) { // scan up to 60 days (handles long stretches of closure)
    if (!(openingHours[DAY_NAMES_LONG[d.getDay()]]?.closed)) {
      openCount++;
      lastOpen = new Date(d);
      if (openCount >= n) break;
    }
    d.setDate(d.getDate() + 1);
  }
  lastOpen.setHours(23, 59, 59, 999);
  return lastOpen;
}

// Desk tab: openedAt → effectiveEndsAt (mirrors coworking page logic for paid tabs too)
// Pass openingHours so weekly tabs can be capped at 5 open days.
function tabCoversDay(
  tab: Tab,
  day: Date,
  openingHours: Record<string, { closed?: boolean }> = {},
): boolean {
  const openedAt = new Date(tab.openedAt as unknown as string);
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);
  const period = inferPeriodFromItems(tab);

  // Daily bookings: show only on the openedAt calendar day.
  // bookingEndsAt ≈ openedAt + 24h can bleed into the next day via raw span check.
  if (period === 'daily') {
    const openDay = new Date(openedAt); openDay.setHours(0, 0, 0, 0);
    return openDay.getTime() === dayStart.getTime();
  }

  // Weekly bookings: count 5 open days from openedAt so the booking doesn't bleed
  // into the following Monday (a 7-day raw window would include it).
  if (period === 'weekly') {
    const openDay = new Date(openedAt); openDay.setHours(0, 0, 0, 0);
    const displayEnd = getNthOpenDayEnd(openedAt, 5, openingHours);
    return dayStart >= openDay && dayStart <= displayEnd;
  }

  const endsAt = getEffectiveEndsAt(tab);
  if (!endsAt) {
    // No expiry info (hourly walk-ins) — show only on openedAt day
    return openedAt >= dayStart && openedAt <= dayEnd;
  }
  return openedAt <= dayEnd && endsAt >= dayStart;
}

// Room stay: checkInAt + nights nights
function stayCoversDay(stay: Stay, day: Date): boolean {
  const start = new Date(stay.checkInAt); start.setHours(0, 0, 0, 0);
  const end   = new Date(stay.checkInAt);
  end.setDate(end.getDate() + stay.nights);
  end.setHours(23, 59, 59, 999);
  const d = new Date(day); d.setHours(12, 0, 0, 0);
  return d >= start && d <= end;
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ─── Pills ────────────────────────────────────────────────────────────────────

function AcceptedPill({ name }: { name: string }) {
  return <span className="block w-full rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 truncate">{shortName(name)}</span>;
}
function PendingPill({ name, onClick }: { name: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="block w-full text-left rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 truncate hover:brightness-95 cursor-pointer"
      >
        {shortName(name)}
      </button>
    );
  }
  return <span className="block w-full rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 truncate">{shortName(name)}</span>;
}
function TabPill({ name, paid, onClick }: { name: string; paid: boolean; onClick?: () => void }) {
  const cls = paid
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  if (onClick) {
    return (
      <button onClick={onClick} className={`block w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate hover:brightness-95 cursor-pointer ${cls}`}>
        {shortName(name)}
      </button>
    );
  }
  return <span className={`block w-full rounded px-1.5 py-0.5 text-xs font-medium truncate ${cls}`}>{shortName(name)}</span>;
}
function StayPill({ name }: { name: string }) {
  return <span className="block w-full rounded px-1.5 py-0.5 text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 truncate">{shortName(name)}</span>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router      = useRouter();
  const me          = useCurrentStaff();
  const allSpaces   = useSpaces();
  const allStays    = useStays();
  const allProducts = useProducts();
  const allTabs     = useTabs();
  const settings    = useSettings();
  const openingHours = (settings?.venue?.openingHours ?? {}) as Record<string, { closed?: boolean }>;

  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [view, setView]           = useState<'grid' | 'list'>('grid');
  const [webOrders, setWebOrders] = useState<PendingWebOrder[]>([]);

  // Firestore: PENDING coworking/room-enquiry orders with a bookingDate
  // (accepted ones are already represented as tabs in the local store)
  useEffect(() => {
    const q = query(collection(db, 'website-orders'), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(q, snap => {
      setWebOrders(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as PendingWebOrder))
          .filter(o =>
            (o.type === 'coworking' || o.type === 'room-enquiry') &&
            (o.status === 'accepted' || o.status === 'pending') &&
            !!o.bookingDate,
          ),
      );
    }, () => setWebOrders([]));
  }, []);

  const spaces = useMemo(() => allSpaces.filter(s => !s.archived), [allSpaces]);
  const rooms  = useMemo(() => allProducts.filter(p => p.category === 'rooms' && !p.archived), [allProducts]);
  const stays  = useMemo(() => allStays.filter(s => s.status === 'active'), [allStays]);

  // All tabs that have a desk booking — open OR paid with a resolvable booking period.
  // We include expired paid tabs too so historical weeks show correctly when navigating back.
  // tabCoversDay() handles the actual date-range check for each cell/day.
  const deskTabs = useMemo(() => {
    return allTabs.filter(t => {
      const hasDeskContent = t.type === 'desk' || t.items.some(i => i.product?.category === 'desks');
      if (!hasDeskContent) return false;
      if (t.status === 'open') return true;
      if (t.status === 'paid') {
        // Include if we can determine which day(s) it covers (daily = openedAt day always works;
        // weekly/monthly = need an endsAt; no period info = skip, can't place it on the grid)
        const period = inferPeriodFromItems(t);
        if (period === 'daily') return true; // openedAt day is always known
        return getEffectiveEndsAt(t) !== null; // weekly/monthly need an end date
      }
      return false;
    });
  }, [allTabs]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
    }),
    [weekStart],
  );

  if (me?.role !== 'manager') {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <CalendarDays className="mx-auto mb-3 opacity-30" size={40} />
        <p>Manager access required.</p>
      </div>
    );
  }

  // ─── Grid cell helpers ────────────────────────────────────────────────────

  function coworkCellItems(spaceId: string, spaceName: string, day: Date) {
    // Match by tab label OR by a desk line item whose product name starts with the space name
    const tabs = deskTabs.filter(t =>
      tabCoversDay(t, day, openingHours) && (
        t.label === spaceName ||
        t.items.some(i => i.product.category === 'desks' && i.product.name.startsWith(spaceName))
      ),
    );
    // Web orders for this space (pending shown amber; accepted shown green — only if no tab yet)
    const orders = webOrders.filter(o =>
      o.type === 'coworking' &&
      (o.tableOrSpace === spaceId || o.tableOrSpace === spaceName) &&
      webOrderCoversDay(o, day),
    );
    // Deduplicate: suppress accepted web orders if a tab already covers this day for this space
    const filteredOrders = orders.filter(o => {
      if (o.status === 'accepted') {
        return tabs.length === 0; // tab already represents this booking
      }
      return true; // always show pending
    });
    return { tabs, orders: filteredOrders };
  }

  function roomCellItems(roomId: string, roomName: string, day: Date) {
    const fromStays  = stays.filter(s =>
      (s.roomId === roomId || s.roomName === roomName) && stayCoversDay(s, day),
    );
    const fromOrders = webOrders.filter(o =>
      o.type === 'room-enquiry' &&
      (o.tableOrSpace === roomId || o.tableOrSpace === roomName) &&
      webOrderCoversDay(o, day),
    );
    return { fromStays, fromOrders };
  }

  // ─── List helpers ─────────────────────────────────────────────────────────

  function allBookingsForDay(day: Date) {
    const open = isCoworkingOpen(day, openingHours);
    // Desk bookings only shown on days the coworking space is open
    const tabs = open ? deskTabs.filter(t => tabCoversDay(t, day, openingHours)) : [];
    const coworkOrders = open ? webOrders.filter(o =>
      o.type === 'coworking' && webOrderCoversDay(o, day) &&
      !(o.status === 'accepted' && deskTabs.some(t =>
        tabCoversDay(t, day, openingHours) && (
          t.label === (o.tableOrSpace ?? '') ||
          t.items.some(i => i.product?.category === 'desks' && i.product.name.startsWith(o.tableOrSpace ?? ''))
        ),
      )),
    ) : [];
    // Rooms are 24/7 — always shown
    const roomOrders = webOrders.filter(o => o.type === 'room-enquiry' && webOrderCoversDay(o, day));
    const roomStays  = stays.filter(s => stayCoversDay(s, day));
    return { tabs, coworkOrders, roomOrders, roomStays };
  }

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="flex flex-col h-full min-h-screen pb-20 md:pb-0">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            Calendar
          </h1>
          <div className="flex items-center rounded-xl border border-border overflow-hidden text-xs font-medium">
            <button onClick={() => setView('grid')} className={`px-3 py-1.5 transition-colors ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Grid</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>List</button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ChevronLeft size={16} /></button>
          <span className="flex-1 text-center text-sm font-medium">{formatWeekRange(weekStart)}</span>
          <button onClick={() => setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"><ChevronRight size={16} /></button>
          <button onClick={() => setWeekStart(getMondayOfWeek(new Date()))} className="px-3 h-8 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">Today</button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />Pending payment</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />Paid booking</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" />Accepted online</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Pending online</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-400 inline-block" />Room stay</span>
        </div>
      </div>

      {/* ── Views ── */}
      {view === 'grid' ? (

        /* ────────── GRID VIEW ────────── */
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-[640px] w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-[140px] min-w-[100px] border-b border-r border-border bg-muted/40 px-3 py-2 text-left text-xs font-semibold text-muted-foreground" />
                {weekDays.map((d, i) => {
                  const open = isCoworkingOpen(d, openingHours);
                  return (
                    <th key={i} className={`border-b border-r border-border px-2 py-2 text-center text-xs font-semibold ${
                      isToday(d) ? 'bg-primary/10 text-primary' : open ? 'bg-muted/40 text-muted-foreground' : 'bg-muted/70 text-muted-foreground/50'
                    }`}>
                      <div>{DAY_NAMES[i]}</div>
                      <div className={`text-base font-bold ${isToday(d) ? 'text-primary' : open ? 'text-foreground' : 'text-muted-foreground/40'}`}>{d.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* Coworking section */}
              {spaces.length > 0 && (
                <>
                  <tr>
                    <td colSpan={8} className="bg-muted/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <Monitor size={11} className="inline mr-1.5 -mt-0.5" />Coworking Spaces
                    </td>
                  </tr>
                  {spaces.map(space => (
                    <tr key={space.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="border-r border-border px-3 py-2 text-xs font-medium text-foreground truncate max-w-[140px]">{space.name}</td>
                      {weekDays.map((day, i) => {
                        const open = isCoworkingOpen(day, openingHours);
                        const { tabs, orders } = open ? coworkCellItems(space.id, space.name, day) : { tabs: [], orders: [] };
                        return (
                          <td key={i} className={`border-r border-border px-1 py-1 align-top min-w-[80px] ${
                            !open ? 'bg-muted/50' : isToday(day) ? 'bg-primary/5' : ''
                          }`}>
                            {!open ? (
                              <span className="text-[10px] text-muted-foreground/50 px-1">Closed</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {tabs.map(t => <TabPill key={t.id} name={t.customerName} paid={t.status === 'paid'} onClick={() => router.push(t.status === 'paid' ? `/history?tabId=${t.id}` : `/?tabId=${t.id}`)} />)}
                                {orders.map(o => o.status === 'accepted'
                                  ? <AcceptedPill key={o.id} name={o.customerName} />
                                  : <PendingPill  key={o.id} name={o.customerName} onClick={() => router.push(`/online-orders?id=${o.id}`)} />)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              )}

              {/* Rooms section */}
              {rooms.length > 0 && (
                <>
                  <tr>
                    <td colSpan={8} className="bg-muted/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <BedDouble size={11} className="inline mr-1.5 -mt-0.5" />Rooms
                    </td>
                  </tr>
                  {rooms.map(room => (
                    <tr key={room.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="border-r border-border px-3 py-2 text-xs font-medium text-foreground truncate max-w-[140px]">{room.name}</td>
                      {weekDays.map((day, i) => {
                        const { fromStays, fromOrders } = roomCellItems(room.id, room.name, day);
                        return (
                          <td key={i} className={`border-r border-border px-1 py-1 align-top min-w-[80px] ${isToday(day) ? 'bg-primary/5' : ''}`}>
                            <div className="flex flex-col gap-0.5">
                              {fromStays.map(s  => <StayPill    key={s.id}  name={s.guestName} />)}
                              {fromOrders.map(o => o.status === 'accepted'
                                ? <AcceptedPill key={o.id} name={o.customerName} />
                                : <PendingPill  key={o.id} name={o.customerName} onClick={() => router.push(`/online-orders?id=${o.id}`)} />)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              )}

              {spaces.length === 0 && rooms.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">No spaces or rooms configured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      ) : (

        /* ────────── LIST VIEW ────────── */
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {weekDays.map((day, idx) => {
            const open = isCoworkingOpen(day, openingHours);
            const { tabs, coworkOrders, roomOrders, roomStays } = allBookingsForDay(day);
            const total = tabs.length + coworkOrders.length + roomOrders.length + roomStays.length;
            return (
              <div key={idx} className={!open ? 'opacity-60' : isToday(day) ? 'bg-primary/5' : ''}>
                <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isToday(day) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    {day.getDate()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{dayLabel(day)}{!open && <span className="ml-2 text-xs font-normal text-muted-foreground">(Coworking closed)</span>}</p>
                    <p className="text-xs text-muted-foreground">{day.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', year: 'numeric' })}</p>
                  </div>
                  {total > 0 && (
                    <span className="ml-auto text-xs font-semibold text-muted-foreground tabular-nums">{total} booking{total !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {total === 0 ? (
                  <p className="px-4 pb-4 text-xs text-muted-foreground italic">No bookings</p>
                ) : (
                  <div className="px-4 pb-4 space-y-2">

                    {/* POS desk tabs */}
                    {tabs.map(t => {
                      const endsAt = t.bookingEndsAt ? new Date(t.bookingEndsAt) : null;
                      const endStr = endsAt ? endsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
                      const startStr = new Date(t.openedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      // Find period label from the first desk line item
                      const deskItem = t.items.find(i => i.product.category === 'desks');
                      const itemName = deskItem?.product.name ?? t.label;
                      const isPaid = t.status === 'paid';
                      const dest = isPaid ? `/history?tabId=${t.id}` : `/?tabId=${t.id}`;
                      return (
                        <div
                          key={t.id}
                          onClick={() => router.push(dest)}
                          className={`flex items-start gap-3 rounded-xl border bg-card p-3 cursor-pointer transition-colors ${
                            isPaid
                              ? 'border-border hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-900/10'
                              : 'border-orange-200 bg-orange-50/40 dark:border-orange-800/40 dark:bg-orange-900/10 hover:border-orange-400'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isPaid
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}>
                            <Monitor size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{t.customerName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {t.label}{itemName !== t.label ? ` · ${itemName}` : ''}
                              {endStr ? ` · until ${endStr}` : startStr ? ` · from ${startStr}` : ''}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                            isPaid
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                          }`}>
                            {isPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Coworking web orders */}
                    {coworkOrders.map(o => {
                      const space = spaces.find(s => s.id === o.tableOrSpace || s.name === o.tableOrSpace);
                      const periodLabel = o.period ? (PERIOD_LABEL[o.period as CoworkRatePeriod] ?? o.period) : null;
                      const startDate = o.bookingDate ? new Date(o.bookingDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
                      const isPending = o.status === 'pending';
                      return (
                        <div
                          key={o.id}
                          onClick={isPending ? () => router.push(`/online-orders?id=${o.id}`) : undefined}
                          className={`flex items-start gap-3 rounded-xl border border-border bg-card p-3 ${isPending ? 'cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 flex items-center justify-center shrink-0">
                            <Monitor size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{o.customerName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {space?.name ?? o.tableOrSpace ?? 'Coworking'}{periodLabel && ` · ${periodLabel}`}{startDate && ` · from ${startDate}`}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${o.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                            {o.status === 'accepted' ? 'Accepted' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Room web orders */}
                    {roomOrders.map(o => {
                      const periodLabel = o.period ? (PERIOD_LABEL[o.period as CoworkRatePeriod] ?? o.period) : null;
                      const startDate = o.bookingDate ? new Date(o.bookingDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
                      const isPending = o.status === 'pending';
                      return (
                        <div
                          key={o.id}
                          onClick={isPending ? () => router.push(`/online-orders?id=${o.id}`) : undefined}
                          className={`flex items-start gap-3 rounded-xl border border-border bg-card p-3 ${isPending ? 'cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <BedDouble size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{o.customerName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {o.tableOrSpace ?? 'Room enquiry'}{periodLabel && ` · ${periodLabel}`}{startDate && ` · from ${startDate}`}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${o.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                            {o.status === 'accepted' ? 'Accepted' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Room stays */}
                    {roomStays.map(s => {
                      const checkIn = new Date(s.checkInAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      return (
                        <div key={s.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                          <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center shrink-0">
                            <BedDouble size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{s.guestName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.roomName} · {s.nights} night{s.nights !== 1 ? 's' : ''} · from {checkIn}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                            Checked In
                          </span>
                        </div>
                      );
                    })}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
