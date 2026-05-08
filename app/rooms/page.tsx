'use client';

import { useState } from 'react';
import { BedDouble, User, CalendarDays, Receipt, LogOut } from 'lucide-react';
import { useProducts, useStays, useTabs, useCurrentStaff, useSettings } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { createStayAndFolio, findActiveStayByRoom } from '@/lib/domain/stays';
import { CheckInDialog } from '@/components/rooms/CheckInDialog';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import {
  formatDate, formatElapsed, tabGrandTotal,
} from '@/lib/domain/tabs';
import type { Product, Stay } from '@/lib/types';

export default function RoomsPage() {
  const products = useProducts();
  const stays = useStays();
  const tabs = useTabs();
  const me = useCurrentStaff();
  const cur = useSettings().currency;
  const store = getStore();

  const rooms = products.filter(p => p.category === 'rooms' && !p.archived);
  const [checkInRoom, setCheckInRoom] = useState<Product | null>(null);
  const [folioStay, setFolioStay] = useState<Stay | null>(null);

  function handleCheckIn(data: { guestName: string; guestPhone?: string; nights: number; notes?: string }) {
    if (!checkInRoom) return;
    const { stay, folio } = createStayAndFolio({ room: checkInRoom, ...data });
    store.tabs.set(prev => [folio, ...prev]);
    store.stays.set(prev => [stay, ...prev]);
    store.log('stay.checkin', `${stay.guestName} → ${stay.roomName} · ${stay.nights}n`, me?.id);
    setCheckInRoom(null);
    toast.success(`${stay.guestName} checked into ${stay.roomName}`);
  }

  async function handleCheckOut(stay: Stay) {
    const folio = tabs.find(t => t.id === stay.folioTabId);
    const total = folio ? tabGrandTotal(folio.items, folio.discount) : 0;
    const ok = await confirm({
      title: `Check out ${stay.guestName}?`,
      message: `Outstanding folio: ${cur}${total.toFixed(2)}. The folio tab must already be paid before check-out.`,
      danger: false,
      confirmLabel: 'Check out',
    });
    if (!ok) return;

    if (folio && folio.status === 'open') {
      toast.error('Settle the folio first (Card / Cash).');
      return;
    }

    store.stays.set(prev => prev.map(s => s.id === stay.id ? { ...s, status: 'checked-out', checkOutAt: new Date() } : s));
    store.log('stay.checkout', `${stay.guestName} · ${stay.roomName}`, me?.id);
    toast.success(`${stay.guestName} checked out`);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong">
        <div>
          <h1 className="text-lg font-semibold">Guestrooms</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rooms.length} rooms · {rooms.filter(r => !findActiveStayByRoom(stays, r.id)).length} available
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
          {rooms.map(room => {
            const stay = findActiveStayByRoom(stays, room.id);
            const folio = stay ? tabs.find(t => t.id === stay.folioTabId) : null;
            const folioTotal = folio ? tabGrandTotal(folio.items, folio.discount) : 0;
            return (
              <div key={room.id} className="flex flex-col rounded-2xl border border-border bg-white/60 dark:bg-white/5 overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-900 dark:to-stone-800 flex items-center justify-center overflow-hidden">
                  {room.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={room.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BedDouble size={36} className="text-stone-400 dark:text-stone-600" strokeWidth={1.2} />
                  )}
                </div>
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold leading-tight">{room.name}</h2>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${stay
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                      {stay ? 'Occupied' : 'Available'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{room.description}</p>

                  {stay && (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User size={12} strokeWidth={2} />
                        <span>{stay.guestName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarDays size={12} strokeWidth={2} />
                        <span>{formatDate(stay.checkInAt)} · {stay.nights}n · in {formatElapsed(stay.checkInAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Receipt size={12} strokeWidth={2} />
                        <span>Folio {cur}{folioTotal.toFixed(2)} {folio?.status === 'paid' && '(paid)'}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                    <span className="text-sm font-bold">{cur}{room.price}<span className="text-xs font-normal text-muted-foreground">/night</span></span>
                    {!stay ? (
                      <button onClick={() => setCheckInRoom(room)} className="h-8 px-3 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        Check In
                      </button>
                    ) : (
                      <div className="flex gap-1.5">
                        <button onClick={() => setFolioStay(stay)} className="h-8 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 transition-colors cursor-pointer">
                          View Folio
                        </button>
                        <button
                          onClick={() => handleCheckOut(stay)}
                          aria-label={`Check out ${stay.guestName}`}
                          className="flex items-center justify-center w-8 h-8 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <LogOut size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CheckInDialog
        open={!!checkInRoom}
        room={checkInRoom}
        onClose={() => setCheckInRoom(null)}
        onCheckIn={handleCheckIn}
      />

      <FolioPanel stay={folioStay} onClose={() => setFolioStay(null)} />
    </div>
  );
}

function FolioPanel({ stay, onClose }: { stay: Stay | null; onClose: () => void }) {
  const tabs = useTabs();
  const cur = useSettings().currency;
  if (!stay) return null;
  const folio = tabs.find(t => t.id === stay.folioTabId);
  const total = folio ? tabGrandTotal(folio.items, folio.discount) : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{stay.guestName} · Folio</h2>
          <p className="text-xs text-muted-foreground">{stay.roomName} · {stay.nights}n</p>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {folio?.items.length === 0 && <p className="text-sm text-muted-foreground">No charges yet.</p>}
          {folio?.items.map(li => (
            <div key={li.productId} className="flex justify-between text-sm border-b border-border py-1.5 last:border-0">
              <span>{li.qty}× {li.product.name}</span>
              <span className="tabular-nums">{cur}{(li.product.price * li.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
          <span>Total</span><span className="tabular-nums">{cur}{total.toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer">Close</button>
          {folio && (
            <a href={`/receipt/${folio.id}`} target="_blank" rel="noopener noreferrer" className="flex-1 h-10 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center">
              Open in POS
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
