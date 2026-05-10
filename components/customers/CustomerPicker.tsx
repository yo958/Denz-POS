'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Star, UserPlus } from 'lucide-react';
import { useCustomers, useSettings } from '@/lib/hooks/useStore';
import type { Customer } from '@/lib/types';

export interface CustomerPickerProps {
  value: string;
  customerId?: string;
  onChange: (name: string, customerId?: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputClassName?: string;
}

function Avatar({ customer }: { customer: Customer }) {
  const initials = customer.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
      {customer.image
        ? <img src={customer.image} alt={customer.name} className="w-full h-full object-cover" />
        : <span className="text-primary text-[10px] font-bold">{initials}</span>
      }
      {customer.vip && (
        <div className="absolute -top-px -right-px w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center">
          <Star size={6} className="text-white fill-white" />
        </div>
      )}
    </div>
  );
}

function discountLabel(customer: Customer, cur: string): string | null {
  if (!customer.discount) return null;
  return customer.discount.type === 'pct'
    ? `${customer.discount.value}% off`
    : `${cur}${customer.discount.value} off`;
}

export function CustomerPicker({
  value,
  customerId,
  onChange,
  placeholder = 'Search customers…',
  autoFocus = false,
  inputClassName,
}: CustomerPickerProps) {
  const customers = useCustomers();
  const cur = useSettings().currency;
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = customers
    .filter(c => !c.archived)
    .filter(c => {
      if (!value.trim()) return true;
      const q = value.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      );
    })
    .sort((a, b) => {
      if (a.vip && !b.vip) return -1;
      if (!a.vip && b.vip) return 1;
      return a.name.localeCompare(b.name);
    });

  // "New" row shown when typed text doesn't exactly match any customer name
  const exactMatch = customers.some(
    c => !c.archived && c.name.toLowerCase() === value.trim().toLowerCase()
  );
  const showNewRow = value.trim().length > 0 && !exactMatch;
  const totalItems = filtered.length + (showNewRow ? 1 : 0);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setHighlighted(-1);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open, closeDropdown]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value, undefined);
    setOpen(true);
    setHighlighted(-1);
  }

  function selectCustomer(c: Customer) {
    onChange(c.name, c.id);
    closeDropdown();
  }

  function selectNew() {
    onChange(value.trim(), undefined);
    closeDropdown();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { setOpen(true); return; }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < filtered.length) {
        selectCustomer(filtered[highlighted]);
      } else if (highlighted === filtered.length && showNewRow) {
        selectNew();
      } else if (filtered.length === 1) {
        selectCustomer(filtered[0]);
      } else if (filtered.length === 0 && showNewRow) {
        selectNew();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted < 0 || !listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const isLinked = !!customerId;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={inputClassName ?? `
          w-full h-10 px-3 rounded-xl text-sm
          bg-black/5 dark:bg-white/5 border border-border
          placeholder:text-muted-foreground text-foreground
          focus:outline-none focus:ring-2 focus:ring-ring
          transition-all duration-150
          ${isLinked ? 'ring-1 ring-primary/40 border-primary/40' : ''}
        `}
      />

      {open && (filtered.length > 0 || showNewRow) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[60] bg-background rounded-2xl border border-border shadow-2xl overflow-hidden">
          <div ref={listRef} className="max-h-52 overflow-y-auto overscroll-contain py-1">
            {filtered.map((c, i) => {
              const disc = discountLabel(c, cur);
              const active = i === highlighted;
              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectCustomer(c); }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer
                    ${active ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/5 text-foreground'}
                  `}
                >
                  <Avatar customer={c} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      {c.vip && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                    </div>
                    {(c.jobRole || disc) && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {c.jobRole && <span className="text-[11px] text-muted-foreground truncate">{c.jobRole}</span>}
                        {disc && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                            {disc}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            {showNewRow && (
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); selectNew(); }}
                onMouseEnter={() => setHighlighted(filtered.length)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer border-t border-border
                  ${highlighted === filtered.length ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground'}
                `}
              >
                <div className="w-7 h-7 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0">
                  <UserPlus size={12} strokeWidth={1.8} />
                </div>
                <span className="text-sm">New — <span className="font-medium">{value.trim()}</span></span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
