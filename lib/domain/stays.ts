// ─────────────────────────────────────────────────────────────────
// Stay / folio operations.
// A Stay owns a long-running Tab (the "folio"). Cafe and desk charges
// can be added to that tab from anywhere via "Charge to Room".
// ─────────────────────────────────────────────────────────────────

import type { Product, Stay, Tab } from '../types';
import { newId } from './id';

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

  const folio: Tab = {
    id: folioId,
    customerName: input.guestName,
    type: 'room',
    label: input.room.name,
    items: [
      // Pre-charge the room nights.
      {
        productId: input.room.id,
        product: input.room,
        qty: input.nights,
      },
    ],
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
    nightlyRate: input.room.price,
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

export function findActiveStayByRoom(stays: Stay[], roomId: string): Stay | undefined {
  return stays.find(s => s.status === 'active' && s.roomId === roomId);
}
