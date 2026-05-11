'use client';

// ─────────────────────────────────────────────────────────────────
// Picker shown when adding a product that has modifier groups.
// Single groups → radio (required). Multi groups → checkboxes.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useModifierGroups, useSettings } from '@/lib/hooks/useStore';
import { fmtCur } from '@/lib/format';
import type { ModifierGroup, Product, SelectedModifier } from '@/lib/types';

interface ProductOptionsDialogProps {
  product: Product | null;
  onClose: () => void;
  onConfirm: (modifiers: SelectedModifier[], note?: string) => void;
}

export function ProductOptionsDialog({ product, onClose, onConfirm }: ProductOptionsDialogProps) {
  const groups = useModifierGroups();
  const cur = useSettings().currency;

  // Resolve groups attached to this product (preserve order, drop archived/missing)
  const productGroups = useMemo<ModifierGroup[]>(() => {
    if (!product?.modifierGroupIds) return [];
    return product.modifierGroupIds
      .map(id => groups.find(g => g.id === id && !g.archived))
      .filter((g): g is ModifierGroup => !!g);
  }, [product, groups]);

  // single → string | undefined ; multi → Set<string>
  const [singles, setSingles] = useState<Record<string, string | undefined>>({});
  const [multis, setMultis] = useState<Record<string, Set<string>>>({});
  const [note, setNote] = useState('');

  // Initialise on open
  useEffect(() => {
    if (!product) return;
    const s: Record<string, string | undefined> = {};
    const m: Record<string, Set<string>> = {};
    for (const g of productGroups) {
      if (g.type === 'single') {
        s[g.id] = g.defaultOptionId
          ?? (g.required ? g.options.find(o => !o.archived)?.id : undefined);
      } else {
        m[g.id] = new Set();
      }
    }
    setSingles(s);
    setMultis(m);
    setNote('');
  }, [product, productGroups]);

  if (!product) return null;

  // Resolve effective priceDelta for an option, honouring per-product overrides.
  const deltaFor = (groupId: string, opt: { id: string; priceDelta: number }) =>
    product.modifierOptionPriceOverrides?.[groupId]?.[opt.id] ?? opt.priceDelta;

  const selected: SelectedModifier[] = [];
  for (const g of productGroups) {
    if (g.type === 'single') {
      const optId = singles[g.id];
      const opt = optId ? g.options.find(o => o.id === optId) : undefined;
      if (opt) selected.push({ groupId: g.id, groupName: g.name, optionId: opt.id, name: opt.name, priceDelta: deltaFor(g.id, opt) });
    } else {
      for (const optId of multis[g.id] ?? []) {
        const opt = g.options.find(o => o.id === optId);
        if (opt) selected.push({ groupId: g.id, groupName: g.name, optionId: opt.id, name: opt.name, priceDelta: deltaFor(g.id, opt) });
      }
    }
  }

  const unitPrice = Math.max(0, product.price + selected.reduce((s, m) => s + (m.priceDelta || 0), 0));
  const allRequiredMet = productGroups.every(g => g.type !== 'single' || !g.required || singles[g.id]);

  function confirm() {
    if (!allRequiredMet) return;
    onConfirm(selected, note.trim() || undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/*
        overflow-hidden is critical: it forces the browser to clip children at
        max-h, which gives the flex-1 scroll area a definite bounded height.
        Without it, max-h doesn't constrain the inner flex layout.
      */}
      <div
        className="relative w-full sm:max-w-xl glass-strong rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{product.name}</h2>
            <p className="text-xs text-muted-foreground truncate">{product.description}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer touch-manipulation shrink-0"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Groups — this area scrolls */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          {productGroups.map(g => {
            // Only show options enabled for this product; fall back to all if no config (legacy)
            const enabledIds = product.modifierEnabledOptions?.[g.id];
            const opts = g.options.filter(o => {
              if (o.archived) return false;
              if (!enabledIds) return true; // legacy: show all
              return enabledIds.includes(o.id);
            });
            // Use 2 columns when there are 3+ options and all names are short enough
            const twoCol = opts.length >= 3 && opts.every(o => o.name.length <= 22);
            return (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{g.name}</h3>
                  {g.type === 'single' && g.required && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">REQUIRED</span>
                  )}
                  {g.type === 'multi' && (
                    <span className="text-[10px] font-medium text-muted-foreground">optional · pick any</span>
                  )}
                </div>
                <div className={`grid gap-1.5 ${twoCol ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {opts.map(opt => {
                    const isChecked = g.type === 'single'
                      ? singles[g.id] === opt.id
                      : !!multis[g.id]?.has(opt.id);
                    const effDelta = deltaFor(g.id, opt);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer touch-manipulation select-none transition-colors ${
                          isChecked
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-border bg-white/60 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8'
                        }`}
                      >
                        <input
                          type={g.type === 'single' ? 'radio' : 'checkbox'}
                          name={`mg-${g.id}`}
                          checked={isChecked}
                          onChange={() => {
                            if (g.type === 'single') {
                              setSingles(prev => ({ ...prev, [g.id]: opt.id }));
                            } else {
                              setMultis(prev => {
                                const next = new Set(prev[g.id] ?? []);
                                if (next.has(opt.id)) next.delete(opt.id); else next.add(opt.id);
                                return { ...prev, [g.id]: next };
                              });
                            }
                          }}
                          className="w-4 h-4 accent-primary shrink-0"
                        />
                        <span className="flex-1 text-sm leading-tight">{opt.name}</span>
                        {effDelta !== 0 && (
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
                            {effDelta > 0 ? '+' : '−'}{cur}{fmtCur(Math.abs(effDelta))}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="space-y-1.5">
            <label htmlFor="line-note" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Note (optional)</label>
            <input
              id="line-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="eg no sugar"
              className="w-full h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-t border-border">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Unit price</span>
            <span className="text-base font-bold tabular-nums">{cur}{fmtCur(unitPrice)}</span>
          </div>
          <button
            onClick={confirm}
            disabled={!allRequiredMet}
            className="flex-1 h-12 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add to tab
          </button>
        </div>
      </div>
    </div>
  );
}
