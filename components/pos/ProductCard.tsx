'use client';

import { Plus } from 'lucide-react';
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
  return (
    <div
      className={`
        group relative flex flex-col rounded-2xl border border-border overflow-hidden
        bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/8
        transition-all duration-150
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
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
            onClick={() => onAdd(product)}
            aria-label={`Add ${product.name}`}
            className="
              flex items-center justify-center w-8 h-8 rounded-xl
              bg-primary text-primary-foreground
              hover:opacity-90 active:scale-95
              transition-all duration-150 cursor-pointer
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            "
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
