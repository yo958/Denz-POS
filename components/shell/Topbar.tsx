'use client';

import { useState } from 'react';
import { Plus, DoorOpen, DoorClosed } from 'lucide-react';
import { useShift, useTabs, useCurrentStaff, useSettings } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { buildZReport } from '@/lib/domain/shift';
import { newId } from '@/lib/domain/id';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { fmtCur } from '@/lib/format';

interface TopbarProps {
  onNewTab: () => void;
}

export function Topbar({ onNewTab }: TopbarProps) {
  const shift = useShift();
  const tabs = useTabs();
  const me = useCurrentStaff();
  const [showShiftDialog, setShowShiftDialog] = useState(false);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border glass-strong">
        <div className="flex items-center gap-3 ml-auto">
          <span className="hidden sm:block text-sm text-muted-foreground select-none">{dateStr}</span>

          <button
            onClick={() => setShowShiftDialog(true)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              shift
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400'
                : 'border-border bg-white/50 dark:bg-white/5 text-muted-foreground hover:text-foreground'
            }`}
            title={shift ? 'Shift open — click to close' : 'No shift open'}
          >
            {shift ? <DoorOpen size={13} /> : <DoorClosed size={13} />}
            <span className="hidden md:inline">{shift ? 'Shift open' : 'Open shift'}</span>
          </button>

          <button
            onClick={onNewTab}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Open new tab"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span className="hidden sm:inline">New Tab</span>
          </button>
        </div>
      </header>

      {showShiftDialog && (
        <ShiftDialog
          onClose={() => setShowShiftDialog(false)}
          tabs={tabs}
          meId={me?.id}
        />
      )}
    </>
  );
}

interface ShiftDialogProps {
  onClose: () => void;
  tabs: ReturnType<typeof useTabs>;
  meId?: string;
}

function ShiftDialog({ onClose, tabs, meId }: ShiftDialogProps) {
  const shift = useShift();
  const cur = useSettings().currency;
  const [openingFloat, setOpeningFloat] = useState(0);
  const [countedCash, setCountedCash] = useState(0);

  function openShift() {
    if (!meId) return;
    getStore().shift.set(() => ({
      id: newId('shift'),
      openedAt: new Date(),
      openedByStaffId: meId,
      openingFloat,
    }));
    getStore().log('shift.open', `Float ${cur}${fmtCur(openingFloat)}`, meId);
    toast.success('Shift opened');
    onClose();
  }

  async function closeShift() {
    if (!shift || !meId) return;
    const z = buildZReport({ ...shift, countedCash }, tabs);
    const variance = z.variance ?? 0;
    const ok = await confirm({
      title: 'Close shift?',
      message: `Counted ${cur}${fmtCur(countedCash)} · Expected ${cur}${fmtCur(z.expectedCash)} · Variance ${variance >= 0 ? '+' : ''}${cur}${fmtCur(variance)}`,
      confirmLabel: 'Close shift',
      requireManagerPin: Math.abs(variance) > 0.01,
      danger: Math.abs(variance) > 0.01,
    });
    if (!ok) return;
    getStore().shift.set(prev => prev ? ({ ...prev, closedAt: new Date(), closedByStaffId: meId, countedCash }) : prev);
    // Archive the closed shift by moving it to null after a brief delay so reports can capture
    setTimeout(() => getStore().shift.set(() => null), 0);
    getStore().log('shift.close', `Counted ${cur}${fmtCur(countedCash)} · variance ${cur}${fmtCur(variance)}`, meId);
    toast.success('Shift closed');
    onClose();
  }

  if (!shift) {
    return (
      <Modal title="Open shift" onClose={onClose}>
        <Field label="Opening cash float">
          <input type="number" min={0} step={0.01} value={openingFloat || ''} onChange={e => setOpeningFloat(parseFloat(e.target.value) || 0)} autoFocus className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums" />
        </Field>
        <button onClick={openShift} className="w-full h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">Open shift</button>
      </Modal>
    );
  }

  const z = buildZReport({ ...shift, countedCash }, tabs);

  return (
    <Modal title="Close shift" onClose={onClose}>
      <div className="rounded-2xl border border-border bg-black/3 dark:bg-white/3 p-3 grid grid-cols-2 gap-y-1 text-sm">
        <span className="text-muted-foreground">Opening float</span><span className="text-right tabular-nums">{cur}{fmtCur(shift.openingFloat)}</span>
        <span className="text-muted-foreground">Cash sales</span>   <span className="text-right tabular-nums">{cur}{fmtCur(z.totalsByMethod.cash)}</span>
        <span className="text-muted-foreground">Card sales</span>   <span className="text-right tabular-nums">{cur}{fmtCur(z.totalsByMethod.card)}</span>
        <span className="text-muted-foreground">Refunds</span>      <span className="text-right tabular-nums">−{cur}{fmtCur(z.refundsTotal)}</span>
        <span className="font-semibold">Expected cash</span>        <span className="text-right font-semibold tabular-nums">{cur}{fmtCur(z.expectedCash)}</span>
      </div>
      <Field label="Counted cash">
        <input type="number" min={0} step={0.01} value={countedCash || ''} onChange={e => setCountedCash(parseFloat(e.target.value) || 0)} autoFocus className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums" />
      </Field>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Variance</span>
        <span className={`font-bold tabular-nums ${(z.variance ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {(z.variance ?? 0) >= 0 ? '+' : ''}{cur}{fmtCur(z.variance ?? 0)}
        </span>
      </div>
      <button onClick={closeShift} className="w-full h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">Close shift</button>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
