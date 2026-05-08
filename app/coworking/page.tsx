'use client';

import { Monitor, Users, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import { useTabs, useSettings } from '@/lib/hooks/useStore';
import { tabGrandTotal, formatElapsed } from '@/lib/domain/tabs';
import type { Tab } from '@/lib/types';

function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

export default function CoWorkingPage() {
  const tabs = useTabs();
  const cur = useSettings().currency;
  const now = new Date();
  const deskTabs = tabs.filter(t => t.type === 'desk');
  const open = deskTabs.filter(t => t.status === 'open');
  // Paid desks remain "active" for the rest of the day they were paid (eg day pass).
  const paidToday = deskTabs.filter(t => t.status === 'paid' && t.paidAt && isSameLocalDay(new Date(t.paidAt), now));
  const settledEarlier = deskTabs.filter(t => t.status === 'paid' && (!t.paidAt || !isSameLocalDay(new Date(t.paidAt), now)));

  // Active = open + paid-today, sorted by openedAt
  const active: Tab[] = [...open, ...paidToday].sort((a, b) => +new Date(a.openedAt) - +new Date(b.openedAt));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-6 py-4 border-b border-border glass-strong">
        <h1 className="text-lg font-semibold">CoWorking</h1>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            {active.length} active
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            {settledEarlier.length} settled earlier
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold mb-3">Active</h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active desk tabs.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-5xl">
              {active.map(tab => {
                const isPaid = tab.status === 'paid';
                return (
                  <div key={tab.id} className={`flex flex-col rounded-2xl border border-border bg-white/60 dark:bg-white/5 p-4 gap-3 ring-1 ${isPaid ? 'ring-emerald-200 dark:ring-emerald-800' : 'ring-sky-200 dark:ring-sky-800'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary">
                          {tab.label.toLowerCase().includes('meeting') ? <Users size={15} /> : <Monitor size={15} />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight">{tab.label}</p>
                          <p className="text-xs text-muted-foreground">{tab.customerName}</p>
                        </div>
                      </div>
                      {isPaid ? (
                        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                          <CheckCircle2 size={11} /> Paid
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400">Active</span>
                      )}
                    </div>
                    <div className="border-t border-border pt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-muted-foreground"><Clock size={11} /> Open</span>
                        <span className="font-medium">{formatElapsed(tab.openedAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-muted-foreground"><DollarSign size={11} /> Tab</span>
                        <span className="font-semibold tabular-nums">{cur}{tabGrandTotal(tab.items, tab.discount).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
