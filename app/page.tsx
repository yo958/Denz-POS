'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/shell/Topbar';
import { TabList } from '@/components/pos/TabList';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { NewTabDialog } from '@/components/pos/NewTabDialog';
import { PaymentDialog } from '@/components/pos/PaymentDialog';
import { DiscountDialog } from '@/components/pos/DiscountDialog';
import { ChargeToRoomDialog } from '@/components/pos/ChargeToRoomDialog';
import { RefundDialog } from '@/components/pos/RefundDialog';
import { VoidDialog } from '@/components/pos/VoidDialog';
import { useTabs, useStays, useCurrentStaff, useSettings } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import {
  effectiveQty, newId, tabGrandTotal, tabSubtotal, tabCardFee,
} from '@/lib/domain/tabs';
import { decrementForTab, restock } from '@/lib/domain/inventory';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import type { Discount, KitchenTicket, PaymentMethod, Product, Stay, Tab, TabType } from '@/lib/types';

export default function POSPage() {
  const tabs = useTabs();
  const stays = useStays();
  const me = useCurrentStaff();
  const cur = useSettings().currency;
  const store = getStore();

  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [newTabOpen, setNewTabOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [chargeRoomOpen, setChargeRoomOpen] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState(0);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

  /* ── Keyboard shortcuts ────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      // '/' focuses search even from non-field
      if (e.key === '/' && !inField) {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');
        search?.focus();
        return;
      }
      if (inField) return;
      if (newTabOpen || paymentOpen || discountOpen || voidOpen || refundOpen || chargeRoomOpen) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setNewTabOpen(true); return; }
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const open = tabs.filter(x => x.status === 'open');
        if (open[idx]) { e.preventDefault(); setActiveTabId(open[idx].id); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs, newTabOpen, paymentOpen, discountOpen, voidOpen, refundOpen, chargeRoomOpen]);

  /* ── Tab CRUD ──────────────────────────────────────── */
  function handleNewTab(name: string, type: TabType, label: string) {
    const tab: Tab = {
      id: newId('tab'),
      customerName: name,
      type,
      label,
      items: [],
      openedAt: new Date(),
      status: 'open',
    };
    store.tabs.set(prev => [tab, ...prev]);
    store.log('tab.create', `${type} · ${name} · ${label}`, me?.id);
    setActiveTabId(tab.id);
    setNewTabOpen(false);
    toast.success(`Tab opened for ${name}`);
  }

  function handleAddProduct(product: Product) {
    if (!activeTab) return;
    store.tabs.set(prev => prev.map(t => {
      if (t.id !== activeTab.id) return t;
      const idx = t.items.findIndex(li => li.productId === product.id);
      if (idx === -1) {
        return { ...t, items: [...t.items, { productId: product.id, product, qty: 1 }] };
      }
      const items = t.items.slice();
      items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
      return { ...t, items };
    }));
  }

  function handleQtyChange(productId: string, qty: number) {
    if (!activeTab || qty < 1) return;
    store.tabs.set(prev => prev.map(t => t.id !== activeTab.id ? t : {
      ...t,
      items: t.items.map(li => li.productId === productId ? { ...li, qty } : li),
    }));
  }

  async function handleVoidLine(productId: string) {
    if (!activeTab) return;
    const li = activeTab.items.find(x => x.productId === productId);
    if (!li) return;
    // Single-item void shortcut → still requires reason via VoidDialog flow.
    setVoidOpen(true);
  }

  async function handleVoidConfirm(productId: string, qty: number, reason: string) {
    if (!activeTab) return;
    const ok = await confirm({
      title: 'Void item?',
      message: 'A manager PIN is required to void.',
      requireManagerPin: true,
      danger: true,
      confirmLabel: 'Void',
    });
    if (!ok) return;
    const li = activeTab.items.find(x => x.productId === productId);
    if (!li) return;
    store.tabs.set(prev => prev.map(t => {
      if (t.id !== activeTab.id) return t;
      const items = t.items
        .map(x => x.productId === productId ? { ...x, qty: Math.max(0, x.qty - qty) } : x)
        .filter(x => x.qty > 0);
      const voids = [...(t.voids ?? []), {
        id: newId('void'), productId, productName: li.product.name, qty, reason,
        staffId: me?.id ?? 'unknown', at: new Date(),
      }];
      return { ...t, items, voids };
    }));
    store.log('tab.void', `${li.product.name} ×${qty} · ${reason}`, me?.id);
    toast.success('Item voided');
  }

  /* ── Discount ──────────────────────────────────────── */
  function handleApplyDiscount(d: Discount | null) {
    if (!activeTab) return;
    store.tabs.set(prev => prev.map(t => t.id !== activeTab.id ? t : { ...t, discount: d ?? undefined }));
    toast.success(d ? 'Discount applied' : 'Discount removed');
  }

  /* ── Pay ───────────────────────────────────────────── */
  function handlePay(method: PaymentMethod) {
    if (!activeTab) return;
    if (activeTab.items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (method === 'room') {
      setChargeRoomOpen(true);
      return;
    }
    setPaymentMethod(method);
    setCashTendered(method === 'cash' ? 0 : 0);
    setPaymentOpen(true);
  }

  function settlePayment(method: PaymentMethod, opts?: { tendered?: number }) {
    if (!activeTab) return;
    const base = tabGrandTotal(activeTab.items, activeTab.discount);
    const fee = method === 'card' ? tabCardFee(activeTab.items, activeTab.discount) : 0;
    const total = base + fee;
    const tendered = opts?.tendered ?? total;
    const change = method === 'cash' ? Math.max(0, tendered - total) : 0;

    // Decrement stock (for stocked items only).
    store.products.set(prev => decrementForTab(prev, activeTab.items));

    store.tabs.set(prev => prev.map(t => t.id !== activeTab.id ? t : {
      ...t,
      status: 'paid',
      paymentMethod: method,
      paidAt: new Date(),
      paidByStaffId: me?.id,
      cashTendered: method === 'cash' ? tendered : undefined,
      changeGiven: method === 'cash' ? change : undefined,
    }));

    store.log('tab.pay', `${activeTab.customerName} · ${activeTab.label} · ${method} · ${cur}${total.toFixed(2)}`, me?.id);
    toast.success(`Paid ${cur}${total.toFixed(2)} via ${method === 'card' ? 'card' : 'cash'}`);
    setPaymentOpen(false);
    setPaymentMethod(null);
    setCashTendered(0);
  }

  function handleConfirmPayment() {
    if (!paymentMethod || !activeTab) return;
    settlePayment(paymentMethod, { tendered: cashTendered });
  }

  /* ── Charge to room ────────────────────────────────── */
  function handleChooseStay(stay: Stay) {
    if (!activeTab) return;
    // Move all items into the folio tab; close source tab as paid (room).
    const sourceItems = activeTab.items;

    // Decrement stock now (folio is treated as a sale).
    store.products.set(prev => decrementForTab(prev, sourceItems));

    store.tabs.set(prev => prev.map(t => {
      if (t.id === stay.folioTabId) {
        const items = [...t.items];
        for (const li of sourceItems) {
          const idx = items.findIndex(x => x.productId === li.productId);
          if (idx === -1) items.push({ ...li });
          else items[idx] = { ...items[idx], qty: items[idx].qty + li.qty };
        }
        return { ...t, items };
      }
      if (t.id === activeTab.id) {
        return {
          ...t,
          status: 'paid',
          paymentMethod: 'room',
          paidAt: new Date(),
          paidByStaffId: me?.id,
          stayId: stay.id,
        };
      }
      return t;
    }));
    store.log('stay.charge', `${activeTab.customerName} → ${stay.guestName} (${stay.roomName})`, me?.id);
    toast.success(`Charged to ${stay.roomName}`);
    setChargeRoomOpen(false);
  }

  /* ── Refund ────────────────────────────────────────── */
  async function handleRefundConfirm(lines: { productId: string; qty: number }[], reason: string) {
    if (!activeTab) return;
    const ok = await confirm({
      title: 'Issue refund?',
      message: 'A manager PIN is required to refund.',
      requireManagerPin: true,
      danger: true,
      confirmLabel: 'Refund',
    });
    if (!ok) return;

    // Compute refund amount proportionally.
    const refundedSubtotal = lines.reduce((s, x) => {
      const li = activeTab.items.find(li => li.productId === x.productId);
      return s + (li ? li.product.price * x.qty : 0);
    }, 0);
    const fullSubtotal = tabSubtotal(activeTab.items);
    const ratio = fullSubtotal > 0 ? refundedSubtotal / fullSubtotal : 0;
    const amount = tabGrandTotal(activeTab.items, activeTab.discount) * ratio;

    // Restock refunded items.
    store.products.set(prev => {
      let next = prev;
      for (const x of lines) next = restock(next, x.productId, x.qty);
      return next;
    });

    store.tabs.set(prev => prev.map(t => {
      if (t.id !== activeTab.id) return t;
      const items = t.items.map(li => {
        const refundLine = lines.find(x => x.productId === li.productId);
        if (!refundLine) return li;
        return { ...li, refundedQty: (li.refundedQty ?? 0) + refundLine.qty };
      });
      const fullyRefunded = items.every(li => effectiveQty(li) === 0);
      return {
        ...t,
        items,
        status: fullyRefunded ? 'refunded' : t.status,
        refunds: [...(t.refunds ?? []), {
          id: newId('ref'),
          tabId: t.id,
          lines,
          amount,
          reason,
          method: t.paymentMethod ?? 'cash',
          staffId: me?.id ?? 'unknown',
          at: new Date(),
        }],
      };
    }));
    store.log('tab.refund', `${activeTab.customerName} · ${cur}${amount.toFixed(2)} · ${reason}`, me?.id);
    toast.success(`Refunded ${cur}${amount.toFixed(2)}`);
    setRefundOpen(false);
  }

  /* ── Send to kitchen ──────────────────────────────── */
  function handleSendKitchen() {
    if (!activeTab) return;
    const newItems = activeTab.items
      .filter(li => li.product.sendToKitchen)
      .map(li => ({ li, diff: li.qty - (li.sentToKitchenQty ?? 0) }))
      .filter(x => x.diff > 0);

    if (newItems.length === 0) { toast.info('Nothing new to send'); return; }

    const ticket: KitchenTicket = {
      id: newId('tk'),
      tabId: activeTab.id,
      tabLabel: activeTab.label,
      customerName: activeTab.customerName,
      items: newItems.map(x => ({
        productId: x.li.productId,
        productName: x.li.product.name,
        qty: x.diff,
        note: x.li.note,
      })),
      createdAt: new Date(),
      status: 'new',
    };

    store.tickets.set(prev => [ticket, ...prev]);
    store.tabs.set(prev => prev.map(t => t.id !== activeTab.id ? t : {
      ...t,
      kitchenSentAt: new Date(),
      items: t.items.map(li => li.product.sendToKitchen
        ? { ...li, sentToKitchenQty: li.qty }
        : li),
    }));
    store.log('tab.kitchen-send', `${activeTab.label} · ${newItems.length} item(s)`, me?.id);
    toast.success(`Sent ${newItems.length} item${newItems.length === 1 ? '' : 's'} to kitchen`);
  }

  function handlePrintReceipt() {
    if (!activeTab) return;
    if (typeof window !== 'undefined') {
      window.open(`/receipt/${activeTab.id}`, '_blank', 'noopener,noreferrer');
    }
  }

  const hasActiveStays = stays.some(s => s.status === 'active');
  const isFolio = !!activeTab?.stayId; // hide "Charge to Room" when on the folio itself

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewTab={() => setNewTabOpen(true)}
      />

      <main className="flex flex-1 min-h-0 overflow-hidden">
        <TabList
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onNewTab={() => setNewTabOpen(true)}
        />

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          <ProductGrid
            searchQuery={searchQuery}
            onAddProduct={handleAddProduct}
            hasActiveTab={!!activeTab && activeTab.status === 'open'}
          />
        </div>

        <aside className="w-[360px] shrink-0 border-l border-border flex flex-col overflow-hidden">
          <Cart
            tab={activeTab}
            onQtyChange={handleQtyChange}
            onVoidLine={handleVoidLine}
            onPay={handlePay}
            onDiscount={() => setDiscountOpen(true)}
            onSendKitchen={handleSendKitchen}
            onPrint={handlePrintReceipt}
            onRefund={() => setRefundOpen(true)}
            hideCharge={isFolio || !hasActiveStays}
          />
        </aside>
      </main>

      <NewTabDialog
        open={newTabOpen}
        onClose={() => setNewTabOpen(false)}
        onCreate={handleNewTab}
      />
      <PaymentDialog
        open={paymentOpen}
        tab={activeTab}
        method={paymentMethod}
        cashTendered={cashTendered}
        onCashTenderedChange={setCashTendered}
        onConfirm={handleConfirmPayment}
        onClose={() => { setPaymentOpen(false); setPaymentMethod(null); }}
      />
      <DiscountDialog
        open={discountOpen}
        tab={activeTab}
        onApply={handleApplyDiscount}
        onClose={() => setDiscountOpen(false)}
      />
      <VoidDialog
        open={voidOpen}
        tab={activeTab}
        onConfirm={handleVoidConfirm}
        onClose={() => setVoidOpen(false)}
      />
      <RefundDialog
        open={refundOpen}
        tab={activeTab}
        onConfirm={handleRefundConfirm}
        onClose={() => setRefundOpen(false)}
      />
      <ChargeToRoomDialog
        open={chargeRoomOpen}
        amount={activeTab ? tabGrandTotal(activeTab.items, activeTab.discount) : 0}
        onChoose={handleChooseStay}
        onClose={() => setChargeRoomOpen(false)}
      />
    </div>
  );
}
