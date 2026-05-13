'use client';

import { Plus, Globe, Check, X, Coffee, Monitor, BedDouble } from 'lucide-react';
import type { Tab } from '@/lib/types';
import type { PendingWebOrder } from '@/app/page';
import { TabListItem } from './TabListItem';
import { getStore } from '@/lib/store/store';
import { useCustomers } from '@/lib/hooks/useStore';
import { confirm } from '@/components/ui/confirm-dialog';

const WEB_ORDER_TYPE_ICON = { cafe: Coffee, coworking: Monitor, 'room-enquiry': BedDouble } as const;
const WEB_ORDER_TYPE_LABEL = { cafe: 'Café', coworking: 'Desk', 'room-enquiry': 'Room' } as const;

interface TabListProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onNewTab: () => void;
  webOrders?: PendingWebOrder[];
  onAcceptWebOrder?: (order: PendingWebOrder) => void;
  onDeclineWebOrder?: (order: PendingWebOrder) => void;
}

export function TabList({ tabs, activeTabId, onSelectTab, onNewTab, webOrders = [], onAcceptWebOrder, onDeclineWebOrder }: TabListProps) {
  const customers = useCustomers();
  const open = tabs.filter(t => t.status === 'open');
  // Only show settled tabs from today; older tabs live on the History page.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const paid = tabs.filter(t => {
    if (t.status !== 'paid' && t.status !== 'refunded') return false;
    const settledAt = t.paidAt ?? t.openedAt;
    if (!settledAt) return false;
    return new Date(settledAt) >= startOfToday;
  });

  async function handleDelete(tab: Tab) {
    const isOpen = tab.status === 'open';
    const ok = await confirm({
      title: isOpen ? 'Delete this open tab?' : 'Delete this order?',
      message: `${tab.customerName} · ${tab.label}. ${
        isOpen
          ? 'Any unsent items on this tab will be discarded.'
          : 'This permanently removes the tab and its receipt.'
      } This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    getStore().tabs.set(prev => prev.filter(t => t.id !== tab.id));
  }

  return (
    <aside className="
      flex flex-col w-full md:w-[200px] lg:w-[260px] shrink-0 h-full
      md:border-r border-border overflow-hidden
    ">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">Open Tabs</span>
        <button
          onClick={onNewTab}
          aria-label="New tab"
          className="
            flex items-center justify-center w-7 h-7 rounded-lg
            bg-primary/10 text-primary hover:bg-primary/20
            transition-colors duration-150 cursor-pointer
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
          "
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2">

        {/* Pending web orders */}
        {webOrders.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center gap-1.5 px-1 pb-1.5">
              <Globe size={11} className="text-brand shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                From website · {webOrders.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {webOrders.map(order => {
                const Icon = WEB_ORDER_TYPE_ICON[order.type] ?? Globe;
                const typeLabel = WEB_ORDER_TYPE_LABEL[order.type] ?? order.type;
                // Icon colour matches TabListItem TYPE_COLOR: cafe→sky, coworking(desk)→violet, room-enquiry→emerald
                const iconColor =
                  order.type === 'cafe' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                  : order.type === 'coworking' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
                const itemSummary = order.items?.length
                  ? order.items.map(i => `${i.qty}× ${i.name}`).join(', ')
                  : order.tableOrSpace ?? order.period ?? '';
                const dateStr = order.bookingDate
                  ? new Date(order.bookingDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  + (order.bookingTime ? ` at ${order.bookingTime}` : '')
                  : null;
                return (
                  <div
                    key={order.id}
                    className="relative w-full text-left px-3 py-2.5 rounded-2xl border border-amber-200/70 bg-amber-50/80 dark:border-amber-700/30 dark:bg-amber-900/10"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5 ${iconColor}`}>
                        <Icon size={13} strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {/* Name + WEB badge */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{order.customerName}</p>
                          <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 leading-none">
                            WEB
                          </span>
                        </div>
                        {/* Type · date sub-line */}
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">{typeLabel}</p>
                          {dateStr && <p className="text-xs text-muted-foreground tabular-nums shrink-0">{dateStr}</p>}
                        </div>
                        {/* Items / space */}
                        {itemSummary && (
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">{itemSummary}</p>
                        )}
                      </div>
                    </div>
                    {/* Accept / Decline */}
                    <div className="flex gap-1.5 mt-2.5">
                      <button
                        onClick={() => onDeclineWebOrder?.(order)}
                        className="flex-1 h-7 rounded-lg text-[11px] font-medium border border-border text-muted-foreground hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <X size={11} /> Decline
                      </button>
                      <button
                        onClick={() => onAcceptWebOrder?.(order)}
                        className="flex-1 h-7 rounded-lg text-[11px] font-semibold bg-brand text-white hover:bg-brand/90 transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Check size={11} /> Accept
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {open.length === 0 && webOrders.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No open tabs</p>
        )}
        {open.length === 0 && webOrders.length > 0 && null}
        {open.map(tab => (
          <TabListItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            customer={customers.find(c => c.id === tab.customerId) ?? null}
            onClick={() => onSelectTab(tab.id)}
            onDelete={() => handleDelete(tab)}
          />
        ))}

        {paid.length > 0 && (
          <>
            <p className="pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              Paid
            </p>
            {paid.map(tab => (
              <TabListItem
                key={tab.id}
                tab={tab}
                active={tab.id === activeTabId}
                onClick={() => onSelectTab(tab.id)}
                onDelete={() => handleDelete(tab)}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
