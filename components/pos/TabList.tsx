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
                const itemSummary = order.items?.length
                  ? order.items.map(i => `${i.qty}× ${i.name}`).join(', ')
                  : order.tableOrSpace ?? order.period ?? '';
                return (
                  <div key={order.id} className="rounded-xl border border-brand/30 bg-brand/5 p-2.5">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="w-6 h-6 rounded-lg bg-brand/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={12} className="text-brand" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate">{order.customerName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{typeLabel}</p>
                        {itemSummary && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{itemSummary}</p>
                        )}
                        {order.bookingDate && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(order.bookingDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {order.bookingTime && ` at ${order.bookingTime}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
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
