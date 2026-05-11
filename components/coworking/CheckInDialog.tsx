'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { CustomerPicker } from '@/components/customers/CustomerPicker';
import { toast } from '@/components/ui/toast';
import type { CoworkSpace, CoworkSpaceRate, CoworkSpaceType, CoworkRatePeriod } from '@/lib/types';

/* ── Shared constants (re-exported so callers don't redefine them) ── */

export const PERIOD_LABEL: Record<CoworkRatePeriod, string> = {
  'hourly':    'Per Hour',
  'daily':     'Daily',
  'weekly':    'Weekly',
  '2-weeks':   '2 Weeks',
  'monthly':   'Monthly',
  '3-months':  '3 Months',
  '6-months':  '6 Months',
  'yearly':    '1 Year',
};

export const PERIOD_DURATION_MS: Record<CoworkRatePeriod, number> = {
  'hourly':   1 * 60 * 60 * 1000,
  'daily':    24 * 60 * 60 * 1000,
  'weekly':   7 * 24 * 60 * 60 * 1000,
  '2-weeks':  14 * 24 * 60 * 60 * 1000,
  'monthly':  30 * 24 * 60 * 60 * 1000,
  '3-months': 90 * 24 * 60 * 60 * 1000,
  '6-months': 180 * 24 * 60 * 60 * 1000,
  'yearly':   365 * 24 * 60 * 60 * 1000,
};

export const TYPE_LABEL: Record<CoworkSpaceType, string> = {
  'desk':           'Desk',
  'private-office': 'Private Office',
};

export const BOOKING_TYPE_LABEL = { hot: 'Hot Desk', dedicated: 'Dedicated Desk' } as const;

export function normalizeType(type: string): CoworkSpaceType {
  if (type === 'hot-desk' || type === 'dedicated-desk') return 'desk';
  return type as CoworkSpaceType;
}

/* ── CheckInDialog ──────────────────────────────────────────────── */

export function CheckInDialog({ space, cur, onClose, onConfirm }: {
  space: CoworkSpace; cur: string;
  onClose: () => void;
  onConfirm: (customerName: string, rate: CoworkSpaceRate, bookingEndsAt: Date | undefined, customerId: string | undefined, bookingType: 'hot' | 'dedicated') => void;
}) {
  const enabledHotRates       = space.rates?.filter(r => r.enabled) ?? [];
  const enabledDedicatedRates = (space.dedicatedRates ?? []).filter(r => r.enabled);
  const hasBothTypes          = enabledHotRates.length > 0 && enabledDedicatedRates.length > 0;

  const [name,        setName]        = useState('');
  const [customerId,  setCustomerId]  = useState<string | undefined>();
  const [bookingType, setBookingType] = useState<'hot' | 'dedicated'>('hot');
  const [rateIdx,     setRateIdx]     = useState(0);

  const activeRates = (hasBothTypes && bookingType === 'dedicated') ? enabledDedicatedRates : enabledHotRates;
  const isDedicated = hasBothTypes && bookingType === 'dedicated';

  function switchBookingType(t: 'hot' | 'dedicated') {
    setBookingType(t);
    setRateIdx(0);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Customer name required'); return; }
    const rate = activeRates[rateIdx];
    if (!rate) { toast.error('No rates available — edit this space to add rates'); return; }
    // Set bookingEndsAt for all non-hourly periods so the booking stays visible on the
    // Coworking page as a reservation (dedicated always; hot desk when not pay-as-you-go).
    const needsExpiry = isDedicated || rate.period !== 'hourly';
    const bookingEndsAt = needsExpiry
      ? new Date(Date.now() + PERIOD_DURATION_MS[rate.period])
      : undefined;
    const effectiveBookingType: 'hot' | 'dedicated' = isDedicated ? 'dedicated' : 'hot';
    onConfirm(name.trim(), rate, bookingEndsAt, customerId, effectiveBookingType);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Check In</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">{space.name} · {TYPE_LABEL[normalizeType(space.type)]}</p>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer name</span>
          <CustomerPicker
            value={name}
            customerId={customerId}
            onChange={(n, id) => { setName(n); setCustomerId(id); }}
            placeholder="Search or type a name…"
            autoFocus
          />
        </label>

        {/* Booking type toggle — only shown when desk has both rate tables */}
        {hasBothTypes && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booking Type</span>
            <div className="grid grid-cols-2 gap-2">
              {(['hot', 'dedicated'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchBookingType(t)}
                  className={`h-9 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                    bookingType === t
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-black/3 dark:bg-white/3 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {BOOKING_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeRates.length > 0 ? (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rate</span>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {activeRates.map((r, i) => (
                <label key={r.period} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${rateIdx === i ? 'border-primary bg-primary/5' : 'border-border bg-black/3 dark:bg-white/3 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="rate" checked={rateIdx === i} onChange={() => setRateIdx(i)} className="accent-primary" />
                    <span className="text-sm font-medium">{PERIOD_LABEL[r.period]}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{cur}{r.price.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-xl px-3 py-2.5">
            No rates enabled. Edit this space to add pricing.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" disabled={activeRates.length === 0} className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40">Check In</button>
        </div>
      </form>
    </div>
  );
}
