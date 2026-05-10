'use client';

import { Coffee, Monitor, BedDouble, Trash2, Star } from 'lucide-react';
import type { Customer, Tab } from '@/lib/types';
import { tabGrandTotal, formatElapsed } from '@/lib/mock-data';
import { useSettings } from '@/lib/hooks/useStore';

const TYPE_ICON = {
  cafe: Coffee,
  desk: Monitor,
  room: BedDouble,
} as const;

const TYPE_COLOR = {
  cafe:  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  desk:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  room:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
} as const;

interface TabListItemProps {
  tab: Tab;
  active: boolean;
  customer?: Customer | null;
  onClick: () => void;
  onDelete?: () => void;
}

export function TabListItem({ tab, active, customer, onClick, onDelete }: TabListItemProps) {
  const cur = useSettings().currency;
  const Icon = TYPE_ICON[tab.type];
  const total = tabGrandTotal(tab.items, tab.discount);
  const elapsed = tab.status === 'open' ? formatElapsed(tab.openedAt) : 'Paid';
  const stamp = tab.paidAt ?? tab.openedAt;
  const stampDate = stamp ? new Date(stamp) : null;
  const today = new Date();
  const isToday =
    !!stampDate &&
    stampDate.getFullYear() === today.getFullYear() &&
    stampDate.getMonth() === today.getMonth() &&
    stampDate.getDate() === today.getDate();
  const dateLabel = stampDate
    ? isToday
      ? stampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : stampDate.toLocaleDateString([], { day: '2-digit', month: 'short' })
    : '';

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`
        group relative w-full text-left px-4 py-3 rounded-2xl border transition-all duration-150
        cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
        ${active
          ? 'border-primary/40 bg-primary/8 dark:bg-primary/10 ring-1 ring-primary/30'
          : 'border-border bg-white/50 dark:bg-white/4 hover:bg-white/70 dark:hover:bg-white/6'
        }
        ${tab.status === 'paid' ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${TYPE_COLOR[tab.type]}`}>
            <Icon size={13} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1 min-w-0">
                <p className="text-sm font-medium truncate">{tab.customerName}</p>
                {customer?.vip && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
              </div>
            <p className="text-xs text-muted-foreground">{tab.label}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums">{cur}{total.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {dateLabel}
            {dateLabel && <span className="mx-1 opacity-50">·</span>}
            {elapsed}
          </p>
        </div>
      </div>
      {tab.items.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground truncate pl-9">
          {tab.items.map(li => li.product.name).join(', ')}
        </p>
      )}
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Delete tab for ${tab.customerName}`}
          title="Delete tab"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }
          }}
          className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
        >
          <Trash2 size={12} />
        </span>
      )}
    </button>
  );
}
