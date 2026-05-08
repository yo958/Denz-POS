'use client';

import { Plus } from 'lucide-react';
import type { Tab } from '@/lib/types';
import { TabListItem } from './TabListItem';
import { getStore } from '@/lib/store/store';
import { confirm } from '@/components/ui/confirm-dialog';

interface TabListProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onNewTab: () => void;
}

export function TabList({ tabs, activeTabId, onSelectTab, onNewTab }: TabListProps) {
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
      flex flex-col w-full md:w-[280px] shrink-0 h-full
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
        {open.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No open tabs</p>
        )}
        {open.map(tab => (
          <TabListItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
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
