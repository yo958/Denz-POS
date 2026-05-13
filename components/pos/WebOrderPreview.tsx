'use client';

import { Check, X, Coffee, Monitor, BedDouble, CalendarDays, Clock, MapPin, Mail, Phone, FileText, Package } from 'lucide-react';
import type { PendingWebOrder } from '@/app/page';
import type { CoworkSpace } from '@/lib/types';
import { useSettings } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';

const TYPE_ICON  = { cafe: Coffee, coworking: Monitor, 'room-enquiry': BedDouble } as const;
const TYPE_LABEL = { cafe: 'Café Order', coworking: 'Desk Booking', 'room-enquiry': 'Room Enquiry' } as const;
const TYPE_COLOR = {
  cafe:          'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  coworking:     'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'room-enquiry':'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
} as const;

const PERIOD_LABEL: Record<string, string> = {
  hourly: 'Per Hour', daily: 'Daily', weekly: 'Weekly',
  '2-weeks': '2 Weeks', monthly: 'Monthly', '3-months': '3 Months',
  '6-months': '6 Months', yearly: '1 Year',
};

interface WebOrderPreviewProps {
  order: PendingWebOrder;
  spaces: CoworkSpace[];
  onAccept?: () => void;
  onDecline?: () => void;
  readonly?: boolean;
}

export function WebOrderPreview({ order, spaces, onAccept, onDecline, readonly }: WebOrderPreviewProps) {
  const cur = useSettings().currency;
  const Icon = TYPE_ICON[order.type] ?? Coffee;
  const spaceName = order.tableOrSpace
    ? (spaces.find(s => s.id === order.tableOrSpace)?.name ?? order.tableOrSpace)
    : null;
  const periodLabel = order.period ? (PERIOD_LABEL[order.period] ?? order.period) : null;

  const itemsTotal = order.items?.reduce((sum, i) => sum + i.price * i.qty, 0) ?? 0;

  const dateStr = order.bookingDate
    ? new Date(order.bookingDate + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${TYPE_COLOR[order.type]}`}>
            <Icon size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight truncate">{order.customerName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{TYPE_LABEL[order.type]}</p>
          </div>
          {order.status === 'pending' && (
            <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Pending</span>
          )}
          {order.status === 'accepted' && (
            <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Accepted</span>
          )}
          {order.status === 'cancelled' && (
            <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400">Declined</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* Booking details */}
        <div className="space-y-2">
          {spaceName && (
            <div className="flex items-start gap-2.5">
              <MapPin size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Space / Table</p>
                <p className="text-sm font-medium">{spaceName}</p>
              </div>
            </div>
          )}
          {periodLabel && (
            <div className="flex items-start gap-2.5">
              <Package size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Period</p>
                <p className="text-sm font-medium">{periodLabel}</p>
              </div>
            </div>
          )}
          {dateStr && (
            <div className="flex items-start gap-2.5">
              <CalendarDays size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium">{dateStr}</p>
              </div>
            </div>
          )}
          {order.bookingTime && (
            <div className="flex items-start gap-2.5">
              <Clock size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-medium">{order.bookingTime}</p>
              </div>
            </div>
          )}
        </div>

        {/* Items (café orders) */}
        {order.items && order.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Items</p>
            <div className="space-y-1.5">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0">{item.qty}×</span>
                    <p className="text-sm truncate">{item.name}</p>
                  </div>
                  <p className="text-sm font-medium tabular-nums shrink-0">{cur}{fmtCur(item.price * item.qty)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Total</p>
              <p className="text-sm font-bold tabular-nums">{cur}{fmtCur(itemsTotal)}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="flex items-start gap-2.5">
            <FileText size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          </div>
        )}

        {/* Contact */}
        {(order.customerEmail || order.customerPhone) && (
          <div className="space-y-2 pt-1 border-t border-border">
            {order.customerEmail && (
              <div className="flex items-center gap-2.5">
                <Mail size={14} className="text-muted-foreground shrink-0" />
                <p className="text-sm truncate">{order.customerEmail}</p>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex items-center gap-2.5">
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <p className="text-sm">{order.customerPhone}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — actions for pending, status banner for completed */}
      {!readonly && order.status === 'pending' ? (
        <div className="px-4 py-3 border-t border-border space-y-2">
          <button
            onClick={onAccept}
            className="w-full h-10 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Check size={15} strokeWidth={2.5} /> Accept Booking
          </button>
          <button
            onClick={onDecline}
            className="w-full h-10 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <X size={15} /> Decline
          </button>
        </div>
      ) : readonly ? (
        <div className={`px-4 py-3 border-t border-border`}>
          <div className={`w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2
            ${order.status === 'accepted'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
            }`}>
            {order.status === 'accepted' ? <><Check size={15} /> Booking Accepted</> : <><X size={15} /> Booking Declined</>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
