'use client';

import { Minus, Plus, Trash2, StickyNote, Tag } from 'lucide-react';
import type { LineItem as LineItemType } from '@/lib/types';
import { effectiveQty, formatMoney, lineKey, lineUnitPrice, lineEffectiveUnitPrice, modifiersSummary } from '@/lib/domain/tabs';

interface LineItemProps {
  item: LineItemType;
  onQtyChange: (lineKey: string, qty: number) => void;
  onVoid?: (lineKey: string) => void;
  onLineDiscount?: (lineKey: string) => void;
  readonly?: boolean;
}

export function LineItem({ item, onQtyChange, onVoid, onLineDiscount, readonly }: LineItemProps) {
  const qty = effectiveQty(item);
  const baseUnit = lineUnitPrice(item);
  const effectiveUnit = lineEffectiveUnitPrice(item);
  const lineTotal = effectiveUnit * qty;
  const hasItemDiscount = !!item.discount && item.discount.value > 0;
  const refunded = item.refundedQty ?? 0;
  const sent = item.sentToKitchenQty ?? 0;
  const unsent = Math.max(0, item.qty - sent);
  const modSummary = modifiersSummary(item.modifiers);
  const key = lineKey(item);

  const discountLabel = hasItemDiscount
    ? item.discount!.type === 'pct'
      ? `${item.discount!.value}% off`
      : `−${formatMoney(item.discount!.value)}`
    : null;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{item.product.name}</p>
          {item.note && (
            <StickyNote size={11} strokeWidth={2} className="text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          {hasItemDiscount && (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              {discountLabel}
            </span>
          )}
        </div>
        {modSummary && (
          <p className="text-[11px] text-muted-foreground/80 truncate leading-snug mt-0.5">{modSummary}</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          {hasItemDiscount ? (
            <>
              <span className="line-through opacity-50">{formatMoney(baseUnit)}</span>
              <span>{formatMoney(effectiveUnit)} each</span>
            </>
          ) : (
            <span>{formatMoney(baseUnit)} each</span>
          )}
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
          {/* Per-item discount button */}
          {onLineDiscount && (
            <button
              onClick={() => onLineDiscount(key)}
              aria-label={`Discount ${item.product.name}`}
              title="Item discount"
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                hasItemDiscount
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20 hover:bg-emerald-200 dark:hover:bg-emerald-900/30'
                  : 'text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'
              }`}
            >
              <Tag size={12} strokeWidth={2} />
            </button>
          )}

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
