'use client';

import { useState } from 'react';
import { useProducts } from '@/lib/hooks/useStore';
import { isOutOfStock, isLowStock } from '@/lib/domain/inventory';
import type { Product, ProductCategory } from '@/lib/types';
import { CategoryChips } from './CategoryChips';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  searchQuery: string;
  onAddProduct: (product: Product) => void;
  hasActiveTab: boolean;
}

export function ProductGrid({ searchQuery, onAddProduct, hasActiveTab }: ProductGridProps) {
  const products = useProducts();
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');

  const filtered = products.filter(p => {
    if (p.archived) return false;
    const matchCat = category === 'all' || p.category === category;
    const matchSearch = searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Category chips */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <CategoryChips active={category} onChange={setCategory} />
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No products found</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(product => {
              const out = isOutOfStock(product);
              const low = isLowStock(product);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={onAddProduct}
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
