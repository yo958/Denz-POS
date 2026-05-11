'use client';

import { useState, useEffect } from 'react';
import { X, BedDouble } from 'lucide-react';
import { useSettings } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { CustomerPicker } from '@/components/customers/CustomerPicker';
import type { Product } from '@/lib/types';

interface CheckInDialogProps {
  open: boolean;
  room: Product | null;
  onClose: () => void;
  onCheckIn: (data: {
    guestName: string;
    guestPhone?: string;
    nights: number;
    checkInAt: Date;
    checkOutAt: Date;
    notes?: string;
    customerId?: string;
  }) => void;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = startOfDay(checkOut).getTime() - startOfDay(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

export function CheckInDialog({ open, room, onClose, onCheckIn }: CheckInDialogProps) {
  const cur = useSettings().currency;
  const [name,       setName]       = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [phone,      setPhone]      = useState('');
  const [notes,      setNotes]      = useState('');

  // Dates — default: check-in today, check-out tomorrow
  const [checkInVal,  setCheckInVal]  = useState('');
  const [checkOutVal, setCheckOutVal] = useState('');

  useEffect(() => {
    if (open) {
      setName(''); setCustomerId(undefined); setPhone(''); setNotes('');
      const today    = new Date();
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      setCheckInVal(toDateInputValue(today));
      setCheckOutVal(toDateInputValue(tomorrow));
    }
  }, [open]);

  function handlePickerChange(n: string, id?: string) {
    setName(n);
    setCustomerId(id);
    if (id) {
      const c = getStore().customers.get().find(x => x.id === id);
      if (c?.phone && !phone) setPhone(c.phone);
    }
  }

  // When check-in date changes, push check-out forward if it would be <= check-in
  function handleCheckInChange(val: string) {
    setCheckInVal(val);
    if (checkOutVal && val >= checkOutVal) {
      const d = new Date(val + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      setCheckOutVal(toDateInputValue(d));
    }
  }

  const checkInDate  = checkInVal  ? new Date(checkInVal  + 'T00:00:00') : null;
  const checkOutDate = checkOutVal ? new Date(checkOutVal + 'T00:00:00') : null;
  const nights = checkInDate && checkOutDate ? nightsBetween(checkInDate, checkOutDate) : 0;
  const total  = room ? room.price * nights : 0;

  const canSubmit = name.trim().length > 0 && nights >= 1 && !!checkInDate && !!checkOutDate;

  if (!open || !room) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Check in guest">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={e => {
          e.preventDefault();
          if (!canSubmit || !checkInDate || !checkOutDate) return;
          onCheckIn({
            guestName: name.trim(),
            guestPhone: phone.trim() || undefined,
            nights,
            checkInAt: checkInDate,
            checkOutAt: checkOutDate,
            notes: notes.trim() || undefined,
            customerId,
          });
        }}
        className="relative w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
              <BedDouble size={16} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Check In</h2>
              <p className="text-xs text-muted-foreground">{room.name} · {cur}{room.price}/night</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Guest name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guest name</label>
          <CustomerPicker
            value={name}
            customerId={customerId}
            onChange={handlePickerChange}
            placeholder="Search or type a name…"
            autoFocus
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="optional"
            className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Check-in / Check-out dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-in</label>
            <input
              type="date"
              value={checkInVal}
              onChange={e => handleCheckInChange(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-out</label>
            <input
              type="date"
              value={checkOutVal}
              min={checkInVal}
              onChange={e => setCheckOutVal(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Nights summary */}
        {nights > 0 && (
          <p className="text-xs text-muted-foreground -mt-1 px-0.5">
            {nights} night{nights !== 1 ? 's' : ''}
          </p>
        )}

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="optional"
            className="w-full px-3 py-2 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Total */}
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">Pre-charged ({nights}n)</span>
          <span className="font-bold tabular-nums">{cur}{total.toFixed(2)}</span>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" disabled={!canSubmit} className="flex-1 h-10 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer">Check In</button>
        </div>
      </form>
    </div>
  );
}
