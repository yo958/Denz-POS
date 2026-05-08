'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Check } from 'lucide-react';
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
  disabled?: boolean;
  outOfStock?: boolean;
  lowStock?: boolean;
}

export function ProductCard({ product, onAdd, disabled, outOfStock, lowStock }: ProductCardProps) {
  const cur = useSettings().currency;
  const [addedAt, setAddedAt] = useState(0);
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleAdd() {
    onAdd(product);
    setCount(c => c + 1);
    setAddedAt(Date.now());
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setAddedAt(0); setCount(0); }, 1200);
  }

  const justAdded = addedAt !== 0;

  return (
    <div
      className={`
        group relative flex flex-col rounded-2xl border overflow-hidden
        bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/8
        transition-all duration-200
        ${justAdded ? 'border-primary ring-2 ring-primary/40 scale-[1.015]' : 'border-border'}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* "+N added" floater */}
      {justAdded && (
        <span
          key={addedAt}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow-md pointer-events-none"
          style={{ animation: 'addedPop 1.2s ease-out forwards' }}
        >
          +{count} added
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
          <button
            onClick={handleAdd}
            aria-label={`Add ${product.name}`}
            className={`
              flex items-center justify-center w-9 h-9 rounded-xl
              text-primary-foreground touch-manipulation select-none
              hover:opacity-90 active:scale-90
              transition-all duration-200 cursor-pointer
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
              ${justAdded ? 'bg-emerald-500' : 'bg-primary'}
            `}
          >
            {justAdded ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  );
}
