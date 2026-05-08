'use client';

import { useState, useEffect } from 'react';
import { X, BedDouble } from 'lucide-react';
import type { Stay } from '@/lib/types';
import { useStays } from '@/lib/hooks/useStore';
import { formatMoney } from '@/lib/domain/tabs';

interface ChargeToRoomDialogProps {
  open: boolean;
  amount: number;
  onClose: () => void;
  onChoose: (stay: Stay) => void;
}

export function ChargeToRoomDialog({ open, amount, onClose, onChoose }: ChargeToRoomDialogProps) {
  const stays = useStays().filter(s => s.status === 'active');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { if (open) setSelectedId(stays[0]?.id ?? null); }, [open, stays]);
  if (!open) return null;

  const selected = stays.find(s => s.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Charge to room">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Charge to Room</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{formatMoney(amount)} will be added to the guest&apos;s folio</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {stays.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No active stays. Check a guest in from the Rooms page first.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {stays.map(s => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'border-primary/40 bg-primary/8 ring-1 ring-primary/30'
                      : 'border-border bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/8'
                  }`}
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                    <BedDouble size={16} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.guestName}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.roomName} · {s.nights}n</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onChoose(selected)}
            className="flex-1 h-10 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Charge
          </button>
        </div>
      </div>
    </div>
  );
}
