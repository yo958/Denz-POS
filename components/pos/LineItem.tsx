'use client';

import { Minus, Plus, Trash2, StickyNote } from 'lucide-react';
import type { LineItem as LineItemType } from '@/lib/types';
import { effectiveQty, formatMoney, lineKey, lineUnitPrice, modifiersSummary } from '@/lib/domain/tabs';

interface LineItemProps {
  item: LineItemType;
  onQtyChange: (lineKey: string, qty: number) => void;
  onVoid?: (lineKey: string) => void;
  readonly?: boolean;
}

export function LineItem({ item, onQtyChange, onVoid, readonly }: LineItemProps) {
  const qty = effectiveQty(item);
  const unit = lineUnitPrice(item);
  const lineTotal = unit * qty;
  const refunded = item.refundedQty ?? 0;
  const sent = item.sentToKitchenQty ?? 0;
  const unsent = Math.max(0, item.qty - sent);
  const modSummary = modifiersSummary(item.modifiers);
  const key = lineKey(item);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{item.product.name}</p>
          {item.note && (
            <StickyNote size={11} strokeWidth={2} className="text-amber-600 dark:text-amber-400 shrink-0" />
          )}
        </div>
        {modSummary && (
          <p className="text-[11px] text-muted-foreground/80 truncate leading-snug mt-0.5">{modSummary}</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span>{formatMoney(unit)} each</span>
          {item.product.sendToKitchen && unsent > 0 && (
            <span className="text-amber-600 dark:text-amber-400">· {unsent} new</span>
          )}
          {refunded > 0 && (
            <span className="text-rose-600 dark:text-rose-400">· {refunded} refunded</span>
          )}
        </p>
      </div>

      {!readonly && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (item.qty <= 1 && onVoid) { onVoid(key); return; }
              onQtyChange(key, item.qty - 1);
            }}
            aria-label={item.qty === 1 ? `Remove ${item.product.name}` : `Decrease ${item.product.name} quantity`}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {item.qty === 1 ? <Trash2 size={13} strokeWidth={2} /> : <Minus size={13} strokeWidth={2} />}
          </button>

          <span className="w-5 text-center text-sm font-semibold tabular-nums select-none">{qty}</span>

          <button
            onClick={() => onQtyChange(key, item.qty + 1)}
            aria-label={`Increase ${item.product.name} quantity`}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>
      )}

      {readonly && <span className="text-xs text-muted-foreground">×{qty}</span>}

      <span className="text-sm font-semibold tabular-nums w-14 text-right">{formatMoney(lineTotal)}</span>
    </div>
  );
}
