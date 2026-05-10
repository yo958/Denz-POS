'use client';

import { useEffect, useRef } from 'react';
import { ChefHat, Check, Clock, Volume2, VolumeX } from 'lucide-react';
import { useTickets, useSettings, useCurrentStaff } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { formatElapsed } from '@/lib/domain/tabs';
import type { KitchenTicket, TicketStatus } from '@/lib/types';
import { toast } from '@/components/ui/toast';

const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  done: 'Done',
};

const NEXT: Record<TicketStatus, TicketStatus | null> = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'done',
  done: null,
};

export default function KDSPage() {
  const tickets = useTickets();
  const settings = useSettings();
  const me = useCurrentStaff();
  const lastCountRef = useRef(0);

  // Sound on new ticket arrival
  useEffect(() => {
    const newCount = tickets.filter(t => t.status === 'new').length;
    if (settings.device.kdsSound && newCount > lastCountRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } catch {}
    }
    lastCountRef.current = newCount;
  }, [tickets, settings.device.kdsSound]);

  function bump(t: KitchenTicket) {
    const next = NEXT[t.status];
    if (!next) return;
    getStore().tickets.set(prev => prev.map(x =>
      x.id === t.id ? { ...x, status: next, bumpedAt: new Date() } : x,
    ));
    if (next === 'done') {
      // Hide done after a short while
      setTimeout(() => {
        getStore().tickets.set(prev => prev.filter(x => x.id !== t.id));
      }, 4000);
    }
    getStore().log('tab.kitchen-send', `${t.tabLabel} → ${next}`, me?.id);
  }

  function toggleSound() {
    getStore().settings.set(prev => ({ ...prev, device: { ...prev.device, kdsSound: !prev.device.kdsSound } }));
    toast.info(`Sound ${!settings.device.kdsSound ? 'on' : 'off'}`);
  }

  const cols: { status: TicketStatus; tickets: KitchenTicket[] }[] = (['new', 'preparing', 'ready'] as TicketStatus[])
    .map(s => ({ status: s, tickets: tickets.filter(t => t.status === s) }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong">
        <div className="flex items-center gap-3">
          <ChefHat size={20} strokeWidth={2} className="text-amber-600 dark:text-amber-400" />
          <div>
            <h1 className="text-lg font-semibold">Kitchen Display</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{tickets.length} active ticket{tickets.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <button
          onClick={toggleSound}
          aria-label="Toggle sound"
          className="flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 transition-colors cursor-pointer"
        >
          {settings.device.kdsSound ? <Volume2 size={14} /> : <VolumeX size={14} />}
          {settings.device.kdsSound ? 'Sound on' : 'Muted'}
        </button>
      </header>

      <div className="flex-1 overflow-hidden grid grid-cols-3 gap-4 p-4">
        {cols.map(col => (
          <div key={col.status} className="flex flex-col rounded-2xl border border-border bg-white/40 dark:bg-white/3 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wider">{STATUS_LABEL[col.status]}</span>
              <span className="text-xs text-muted-foreground">{col.tickets.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {col.tickets.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-12">No tickets</p>
              )}
              {col.tickets.map(t => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-3 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{t.tabLabel}</p>
                      <p className="text-xs text-muted-foreground">{t.customerName}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={11} /> {formatElapsed(t.createdAt)}
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {t.items.map((it, i) => (
                      <li key={i} className="space-y-0.5">
                        <span className="font-bold">{it.qty}× {it.productName}</span>
                        {it.modifiers && it.modifiers.length > 0 && (
                          <ul className="pl-3 space-y-0.5">
                            {it.modifiers.map((m, j) => (
                              <li key={j} className="text-xs text-muted-foreground">
                                <span className="font-medium">{m.groupName}:</span> {m.name}
                              </li>
                            ))}
                          </ul>
                        )}
                        {it.note && (
                          <p className="pl-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            ✎ {it.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  {NEXT[t.status] && (
                    <button
                      onClick={() => bump(t)}
                      className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check size={13} strokeWidth={2.5} />
                      {col.status === 'new' ? 'Start' : col.status === 'preparing' ? 'Mark Ready' : 'Bump'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
