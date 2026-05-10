'use client';

import { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useProducts, useSpaces } from '@/lib/hooks/useStore';
import { isOutOfStock, isLowStock } from '@/lib/domain/inventory';
import type { Product, ProductCategory } from '@/lib/types';
import { CategoryChips } from './CategoryChips';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  onAddProduct: (product: Product) => void;
  hasActiveTab: boolean;
  addedCounts: Record<string, number>;
}

export function ProductGrid({ onAddProduct, hasActiveTab, addedCounts }: ProductGridProps) {
  const products = useProducts();
  const spaces = useSpaces();
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Synthesise Product-shaped objects from CoworkSpaces so the POS grid can
  // render them without touching the product store. Price = enabled hourly rate
  // (or the first enabled rate of any period, or 0 if nothing is enabled).
  const deskProducts: Product[] = spaces
    .filter(s => !s.archived)
    .map(s => {
      const hourly = s.rates.find(r => r.period === 'hourly' && r.enabled);
      const anyRate = s.rates.find(r => r.enabled);
      const price = hourly?.price ?? anyRate?.price ?? 0;
      return {
        id: s.id,
        name: s.name,
        price,
        category: 'desks' as ProductCategory,
        description: s.description ?? (s.type === 'private-office' ? 'Private Office' : 'Desk'),
        stock: null,
        lowStockAt: null,
        sendToKitchen: false,
        glyph: s.type === 'private-office' ? '🏢' : '🪑',
      };
    });

  const filtered = (() => {
    if (category === 'desks') {
      // Desks come from CoworkSpaces, not the product store
      const q = searchQuery.toLowerCase();
      return deskProducts.filter(p =>
        q === '' || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      );
    }

    return products.filter(p => {
      if (p.archived) return false;
      // Legacy desk products in the product store are never shown — desks are
      // now managed as CoworkSpaces and shown above.
      if (p.category === 'desks') return false;
      const matchCat = category === 'all' || p.category === category;
      const matchSearch = searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  })();

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Search + category chips */}
      <div className="px-4 pt-3 pb-3 border-b border-border space-y-2.5">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items… (press / to focus)"
            aria-label="Search products"
            className="w-full h-10 pl-9 pr-9 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <CategoryChips active={category} onChange={cat => { setCategory(cat); setSearchQuery(''); }} />
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Search size={28} strokeWidth={1.5} />
            <p className="text-sm">{searchQuery ? `No results for "${searchQuery}"` : 'No products found'}</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs text-primary hover:opacity-80 cursor-pointer underline mt-1">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {filtered.map(product => {
              const out = isOutOfStock(product);
              const low = isLowStock(product);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={onAddProduct}
                  addedCount={addedCounts[product.id] ?? 0}
                  disabled={!hasActiveTab || out}
                  outOfStock={out}
                  lowStock={low}
                />
              );
            })}
          </div>
        )}

        {!hasActiveTab && filtered.length > 0 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Select or open a tab to add items
          </p>
        )}
      </div>
    </div>
  );
}
