'use client';

import type { ProductCategory } from '@/lib/types';

const CATEGORIES: Array<{ value: ProductCategory | 'all'; label: string }> = [
  { value: 'all',     label: 'All'      },
  { value: 'food',    label: 'Food'     },
  { value: 'drinks',  label: 'Drinks'   },
  { value: 'dessert', label: 'Desserts' },
  { value: 'desks',   label: 'Desks'    },
  { value: 'rooms',            label: 'Rooms'     },
  { value: 'equipment-rental', label: 'Equipment' },
];

interface CategoryChipsProps {
  active: ProductCategory | 'all';
  onChange: (cat: ProductCategory | 'all') => void;
}

export function CategoryChips({ active, onChange }: CategoryChipsProps) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
      role="group"
      aria-label="Product categories"
    >
      {CATEGORIES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          aria-pressed={active === value}
          className={`
            shrink-0 h-8 px-4 rounded-full text-sm font-medium
            transition-all duration-150 cursor-pointer
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            ${active === value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'glass text-foreground hover:bg-black/8 dark:hover:bg-white/8'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
