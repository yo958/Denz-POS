'use client';

import { useEffect, useRef, useState } from 'react';
import { Receipt, Pencil, Check, X } from 'lucide-react';
import { LineItem } from './LineItem';
import { PaymentBar } from './PaymentBar';
import { getStore } from '@/lib/store/store';
import { useCurrentStaff } from '@/lib/hooks/useStore';
import { lineKey } from '@/lib/domain/tabs';
import { toast } from '@/components/ui/toast';
import type { PaymentMethod, Tab } from '@/lib/types';

interface CartProps {
  tab: Tab | null;
  onQtyChange: (lineKey: string, qty: number) => void;
  onVoidLine: (lineKey: string) => void;
  onPay: (method: PaymentMethod) => void;
  onDiscount: () => void;
  onSendKitchen: () => void;
  onPrint: () => void;
  onRefund: () => void;
  hideCharge?: boolean;
}

export function Cart({
  tab, onQtyChange, onVoidLine, onPay, onDiscount, onSendKitchen, onPrint, onRefund, hideCharge,
}: CartProps) {
  if (!tab) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-black/5 dark:bg-white/5 mb-3">
          <Receipt size={24} strokeWidth={1.5} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No tab selected</p>
        <p className="text-xs text-muted-foreground mt-1">Pick or open a tab to add items</p>
      </div>
    );
  }

  const isClosed = tab.status !== 'open';
  const unsentItemsCount = tab.items.reduce((sum, li) => {
    if (!li.product.sendToKitchen) return sum;
    const sent = li.sentToKitchenQty ?? 0;
    return sum + Math.max(0, li.qty - sent);
  }, 0);

  return (
    <div className="flex flex-col h-full">
      <CartHeader tab={tab} readonly={isClosed} />

      <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
        {tab.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <p className="text-sm text-muted-foreground">Empty cart</p>
            <p className="text-xs text-muted-foreground mt-1">Tap a product to add it</p>
          </div>
        ) : (
          tab.items.map(item => (
            <LineItem
              key={lineKey(item)}
              item={item}
              onQtyChange={onQtyChange}
              onVoid={onVoidLine}
              readonly={isClosed}
            />
          ))
        )}
      </div>

      <div className="px-4 pb-4 shrink-0">
        <PaymentBar
          tab={tab}
          onPay={onPay}
          onDiscount={onDiscount}
          onSendKitchen={onSendKitchen}
          onPrint={onPrint}
          onRefund={onRefund}
          hideCharge={hideCharge}
          unsentItemsCount={unsentItemsCount}
        />
      </div>
    </div>
  );
}

interface CartHeaderProps { tab: Tab; readonly: boolean }

function CartHeader({ tab, readonly }: CartHeaderProps) {
  const me = useCurrentStaff();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tab.customerName);
  const [label, setLabel] = useState(tab.label);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(tab.customerName); setLabel(tab.label); setEditing(false); }, [tab.id, tab.customerName, tab.label]);
  useEffect(() => { if (editing) nameRef.current?.focus(); }, [editing]);

  function save() {
    const n = name.trim();
    const l = label.trim();
    if (!n) { toast.error('Customer name required'); return; }
    if (!l) { toast.error('Label required'); return; }
    if (n === tab.customerName && l === tab.label) { setEditing(false); return; }
    getStore().tabs.set(prev => prev.map(t => t.id === tab.id ? { ...t, customerName: n, label: l } : t));
    getStore().log('tab.update', `${tab.id} → ${n} · ${l}`, me?.id);
    toast.success('Tab updated');
    setEditing(false);
  }
  function cancel() {
    setName(tab.customerName); setLabel(tab.label); setEditing(false);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  }

  const statusBadge = tab.status === 'open'
    ? null
    : <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
        tab.status === 'paid'     ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
        tab.status === 'refunded' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                                    'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
      }`}>{tab.status}</span>;

  if (editing) {
    return (
      <div className="px-4 pt-4 pb-3 border-b border-border space-y-2">
        <input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={onKey}
          placeholder="Customer name"
          aria-label="Customer name"
          className="w-full h-9 px-3 rounded-xl text-sm font-semibold bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={onKey}
            placeholder="Table 4 / Desk 7 / …"
            aria-label="Tab label"
            className="flex-1 h-8 px-3 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={save} aria-label="Save" className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer">
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button onClick={cancel} aria-label="Cancel" className="flex items-center justify-center w-8 h-8 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-3 border-b border-border">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold leading-tight truncate">{tab.customerName}</h2>
            {statusBadge}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            <span className="capitalize">{tab.type}</span> · {tab.label}
          </p>
        </div>
        {!readonly && (
          <button
            onClick={() => setEditing(true)}
            aria-label="Edit tab name"
            className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

