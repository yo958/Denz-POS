'use client';

import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/lib/hooks/useStore';
import type { Product } from '@/lib/types';

const CATEGORY_BG: Record<string, string> = {
  food:   'bg-orange-100 dark:bg-orange-900/20',
  drinks: 'bg-sky-100 dark:bg-sky-900/20',
  desks:  'bg-violet-100 dark:bg-violet-900/20',
  rooms:  'bg-emerald-100 dark:bg-emerald-900/20',
};

const CATEGORY_GLYPH: Record<string, string> = {
  food:   '🍽',
  drinks: '☕',
  desks:  '💻',
  rooms:  '🛏',
};

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  /** Cumulative add count from parent — increments each time this product is confirmed added. */
  addedCount?: number;
  disabled?: boolean;
  outOfStock?: boolean;
  lowStock?: boolean;
}

export function ProductCard({ product, onAdd, addedCount = 0, disabled, outOfStock, lowStock }: ProductCardProps) {
  const cur = useSettings().currency;
  const [justAdded, setJustAdded] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const prevCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Fire flash whenever the parent increments addedCount
  useEffect(() => {
    if (addedCount <= prevCount.current) return;
    prevCount.current = addedCount;
    setJustAdded(true);
    setFlashKey(k => k + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1200);
  }, [addedCount]);

  return (
    <button
      onClick={() => onAdd(product)}
      disabled={!!disabled}
      aria-label={`Add ${product.name}`}
      className={`
        group relative flex flex-col rounded-2xl border-2 overflow-hidden text-left w-full
        bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/8
        active:scale-[0.97] touch-manipulation select-none
        transition-all duration-200 cursor-pointer
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
        ${justAdded ? 'border-emerald-500' : 'border-background'}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* "+N added" floater */}
      {justAdded && (
        <span
          key={flashKey}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-md pointer-events-none"
          style={{ animation: 'addedPop 1.2s ease-out forwards' }}
        >
          +{addedCount} added
        </span>
      )}

      {/* Stock badge */}
      {(outOfStock || lowStock) && (
        <span className={`absolute top-2 right-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full ${
          outOfStock
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        }`}>
          {outOfStock ? 'OUT' : `LOW · ${product.stock}`}
        </span>
      )}

      {/* Image / glyph */}
      <div className={`flex items-center justify-center h-24 text-3xl select-none overflow-hidden ${CATEGORY_BG[product.category]}`}>
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt="" className="w-full h-full object-cover" />
        ) : (
          product.glyph || CATEGORY_GLYPH[product.category]
        )}
      </div>

      <div className="flex flex-col gap-1 p-3 flex-1">
        <p className="text-sm font-semibold leading-tight">{product.name}</p>
        <p className="text-xs text-muted-foreground leading-snug line-clamp-2 flex-1">
          {product.description}
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold tabular-nums">{cur}{product.price}</span>
        </div>
      </div>
    </button>
  );
}
