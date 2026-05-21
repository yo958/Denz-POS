// ─────────────────────────────────────────────────────────────────
// Stay / folio operations.
// A Stay owns a long-running Tab (the "folio"). Cafe and desk charges
// can be added to that tab from anywhere via "Charge to Room".
// ─────────────────────────────────────────────────────────────────

import type { Product, Stay, Tab, LineItem } from '../types';
import { newId } from './id';

// ─── Seasonal pricing helpers ─────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addNightStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function getEffectiveRoomPrice(room: Product, dateStr: string): number {
  if (!room.seasons?.length) return room.price;
  const d = new Date(dateStr + 'T12:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const cur = m * 100 + day;
  for (const s of room.seasons) {
    const start = s.startMonth * 100 + s.startDay;
    const end   = s.endMonth   * 100 + s.endDay;
    const inRange = start <= end
      ? cur >= start && cur <= end
      : cur >= start || cur <= end;
    if (inRange) return s.price;
  }
  return room.price;
}

function getSeasonName(room: Product, dateStr: string): string | undefined {
  if (!room.seasons?.length) return undefined;
  const d = new Date(dateStr + 'T12:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const cur = m * 100 + day;
  for (const s of room.seasons) {
    const start = s.startMonth * 100 + s.startDay;
    const end   = s.endMonth   * 100 + s.endDay;
    const inRange = start <= end
      ? cur >= start && cur <= end
      : cur >= start || cur <= end;
    if (inRange) return s.name;
  }
  return undefined;
}

export interface PriceSegment { nights: number; price: number; seasonName?: string; }

/** Group consecutive nights sharing the same seasonal rate. */
export function getRoomPriceSegments(room: Product, checkInStr: string, nights: number): PriceSegment[] {
  const segments: PriceSegment[] = [];
  for (let i = 0; i < nights; i++) {
    const nightStr = addNightStr(checkInStr, i);
    const price = getEffectiveRoomPrice(room, nightStr);
    const seasonName = getSeasonName(room, nightStr);
    const last = segments[segments.length - 1];
    if (last && last.price === price) {
      last.nights++;
    } else {
      segments.push({ nights: 1, price, seasonName });
    }
  }
  return segments;
}

export interface CheckInInput {
  guestName: string;
  guestPhone?: string;
  room: Product;     // must be category 'rooms'
  nights: number;
  checkInAt?: Date;
  checkOutAt?: Date;
  notes?: string;
  customerId?: string;
}

export function createStayAndFolio(input: CheckInInput): { stay: Stay; folio: Tab } {
  const stayId = newId('stay');
  const folioId = newId('tab');
  const checkInAt = input.checkInAt ?? new Date();
  const checkInStr = toDateStr(checkInAt);

  // Build per-season line items so the folio shows the accurate charge per segment.
  const segments = getRoomPriceSegments(input.room, checkInStr, input.nights);
  const multiSeason = segments.length > 1;

  const items: LineItem[] = segments.map(seg => ({
    id: newId('li'),
    productId: input.room.id,
    product: {
      ...input.room,
      price: seg.price,
      // Label each line with the season name when there are multiple segments.
      ...(multiSeason && seg.seasonName ? { name: `${input.room.name} · ${seg.seasonName}` } : {}),
    },
    qty: seg.nights,
  }));

  const folio: Tab = {
    id: folioId,
    customerName: input.guestName,
    type: 'room',
    label: input.room.name,
    items,
    openedAt: checkInAt,
    status: 'open',
    stayId,
    ...(input.customerId ? { customerId: input.customerId } : {}),
  };

  const stay: Stay = {
    id: stayId,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    roomId: input.room.id,
    roomName: input.room.name,
    nightlyRate: getEffectiveRoomPrice(input.room, checkInStr),
    nights: input.nights,
    checkInAt,
    checkOutAt: input.checkOutAt,
    folioTabId: folioId,
    status: 'active',
    notes: input.notes,
    ...(input.customerId ? { customerId: input.customerId } : {}),
  };

  return { stay, folio };
}

function toDate(d: unknown): Date {
  if (d instanceof Date) return d;
  if (d && typeof (d as { toDate?: unknown }).toDate === 'function') return (d as { toDate: () => Date }).toDate();
  return new Date(d as string);
}

// Returns a stay only if the guest has already checked in (checkInAt ≤ end of today).
export function findActiveStayByRoom(stays: Stay[], roomId: string): Stay | undefined {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return stays.find(s => s.status === 'active' && s.roomId === roomId && toDate(s.checkInAt) <= endOfToday);
}

// Returns the soonest future reservation for a room (checkInAt is tomorrow or later).
export function findUpcomingStayByRoom(stays: Stay[], roomId: string): Stay | undefined {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return stays
    .filter(s => s.status === 'active' && s.roomId === roomId && toDate(s.checkInAt) > endOfToday)
    .sort((a, b) => toDate(a.checkInAt).getTime() - toDate(b.checkInAt).getTime())[0];
}
