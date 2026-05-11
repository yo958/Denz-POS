'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Topbar } from '@/components/shell/Topbar';
import { TabList } from '@/components/pos/TabList';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { Cart } from '@/components/pos/Cart';
import { NewTabDialog } from '@/components/pos/NewTabDialog';
import { PaymentDialog } from '@/components/pos/PaymentDialog';
import { SplitPaymentDialog } from '@/components/pos/SplitPaymentDialog';
import { DiscountDialog } from '@/components/pos/DiscountDialog';
import { LineDiscountDialog } from '@/components/pos/LineDiscountDialog';
import { ChargeToRoomDialog } from '@/components/pos/ChargeToRoomDialog';
import { RefundDialog } from '@/components/pos/RefundDialog';
import { VoidDialog } from '@/components/pos/VoidDialog';
import { ProductOptionsDialog } from '@/components/pos/ProductOptionsDialog';
import { useTabs, useStays, useCurrentStaff, useSettings, useCustomers, useSpaces } from '@/lib/hooks/useStore';
import { CheckInDialog, PERIOD_LABEL, PERIOD_DURATION_MS, BOOKING_TYPE_LABEL } from '@/components/coworking/CheckInDialog';
import { getStore } from '@/lib/store/store';
import {
  effectiveQty, lineKey, lineUnitPrice, modifiersStableKey,
  newId, tabGrandTotal, tabSubtotal, tabCardFee, CARD_FEE_RATE, lineEffectiveUnitPrice,
} from '@/lib/domain/tabs';
import { decrementForTab, restock } from '@/lib/domain/inventory';
import { fmtCur } from '@/lib/format';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import type { CoworkSpace, CoworkSpaceRate, Discount, KitchenTicket, PaymentMethod, Product, SelectedModifier, SplitPaymentLine, Stay, Tab, TabType } from '@/lib/types';

/* ── Desk rate picker (used when a POS tab is already active) ─────── */
function DeskRatePickerDialog({ space, cur, onClose, onConfirm }: {
  space: CoworkSpace; cur: string;
  onClose: () => void;
  onConfirm: (rate: CoworkSpaceRate, bookingEndsAt: Date | undefined, bookingType: 'hot' | 'dedicated') => void;
}) {
  const enabledHotRates       = space.rates?.filter(r => r.enabled) ?? [];
  const enabledDedicatedRates = (space.dedicatedRates ?? []).filter(r => r.enabled);
  const hasBothTypes          = enabledHotRates.length > 0 && enabledDedicatedRates.length > 0;

  const [bookingType, setBookingType] = useState<'hot' | 'dedicated'>('hot');
  const [rateIdx, setRateIdx]         = useState(0);

  const activeRates = (hasBothTypes && bookingType === 'dedicated') ? enabledDedicatedRates : enabledHotRates;
  const isDedicated = hasBothTypes && bookingType === 'dedicated';

  function switchBookingType(t: 'hot' | 'dedicated') {
    setBookingType(t);
    setRateIdx(0);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const rate = activeRates[rateIdx];
    if (!rate) { toast.error('No rates available — edit this space to add rates'); return; }
    // Set bookingEndsAt for all non-hourly periods so pre-paid reservations stay
    // visible on the Coworking page (dedicated always; hot desk when not pay-as-you-go).
    const effectiveBookingType: 'hot' | 'dedicated' = isDedicated ? 'dedicated' : 'hot';
    const needsExpiry = isDedicated || rate.period !== 'hourly';
    const bookingEndsAt = needsExpiry
      ? new Date(Date.now() + PERIOD_DURATION_MS[rate.period])
      : undefined;
    onConfirm(rate, bookingEndsAt, effectiveBookingType);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Desk to Tab</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">{space.name} — select a rate to add to the current tab</p>

        {/* Booking type toggle — only shown when the space has both hot-desk and dedicated rates */}
        {hasBothTypes && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booking Type</span>
            <div className="grid grid-cols-2 gap-2">
              {(['hot', 'dedicated'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchBookingType(t)}
                  className={`h-9 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                    bookingType === t
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-black/3 dark:bg-white/3 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {BOOKING_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeRates.length > 0 ? (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rate</span>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {activeRates.map((r, i) => (
                <label key={r.period} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${rateIdx === i ? 'border-primary bg-primary/5' : 'border-border bg-black/3 dark:bg-white/3 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="rate" checked={rateIdx === i} onChange={() => setRateIdx(i)} className="accent-primary" />
                    <span className="text-sm font-medium">{PERIOD_LABEL[r.period]}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{cur}{r.price.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-xl px-3 py-2.5">
            No rates enabled. Edit this space to add pricing.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-2xl text-sm font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 active:scale-95 transition-all cursor-pointer">Cancel</button>
          <button type="submit" disabled={activeRates.length === 0} className="flex-1 h-11 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40">Add to Tab</button>
        </div>
      </form>
    </div>
  );
}

export default function POSPage() {
  const tabs = useTabs();
  const stays = useStays();
  const me = useCurrentStaff();
  const cur = useSettings().currency;
  const customers = useCustomers();
  const spaces = useSpaces();
  const store = getStore();

  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'tabs' | 'menu' | 'cart'>('tabs');

  // Dialog state
  const [newTabOpen, setNewTabOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [lineDiscountOpen, setLineDiscountOpen] = useState(false);
  const [lineDiscountKey, setLineDiscountKey] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [chargeRoomOpen, setChargeRoomOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState(0);

  // Product modifiers picker
  const [optionsProduct, setOptionsProduct] = useState<Product | null>(null);

  // Coworking check-in triggered from the POS Desks chip
  const [checkingInSpace, setCheckingInSpace] = useState<CoworkSpace | null>(null);
  // Rate-only picker when a tab is already active (no new tab needed)
  const [deskRateSpace, setDeskRateSpace] = useState<CoworkSpace | null>(null);

  // Tracks cumulative add count per product to trigger card flash animations
  const [addedCounts, setAddedCounts] = useState<Record<string, number>>({});

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
  }, [tabs, newTabOpen, paymentOpen, discountOpen, voidOpen, refundOpen, chargeRoomOpen, mobileView]);

  /* ── Tab CRUD ──────────────────────────────────────── */
  function handleNewTab(name: string, type: TabType, label: string, customerId?: string) {
    const customerDiscount = customerId
      ? customers.find(c => c.id === customerId)?.discount
      : undefined;
    const tab: Tab = {
      id: newId('tab'),
      customerName: name,
      type,
      label,
      items: [],
      openedAt: new Date(),
      status: 'open',
      ...(customerId ? { customerId } : {}),
      ...(customerDiscount ? { discount: customerDiscount } : {}),
    };
    store.tabs.set(prev => [tab, ...prev]);
    store.log('tab.create', `${type} · ${name} · ${label}`, me?.id);
    setActiveTabId(tab.id);
    setNewTabOpen(false);
    setMobileView('menu');
    toast.success(`Tab opened for ${name}`);
  }

  function handleAddProduct(product: Product) {
    // Desk products are CoworkSpace cards. The product id equals the space id (set in ProductGrid).
    if (product.category === 'desks') {
      const space = spaces.find(s => s.id === product.id);
      if (space) {
        if (activeTab) {
          // Tab already open — just pick a rate and add as a line item; no second tab
          setDeskRateSpace(space);
        } else {
          // No tab yet — full check-in flow creates a dedicated desk tab
          setCheckingInSpace(space);
        }
        return;
      }
    }
    if (!activeTab) return;
    if (product.modifierGroupIds && product.modifierGroupIds.length > 0) {
      setOptionsProduct(product);
      return;
    }
    addLineWithModifiers(product, [], undefined);
  }

  function addLineWithModifiers(product: Product, mods: SelectedModifier[], note?: string) {
    if (!activeTab) return;
    const stable = modifiersStableKey(mods);
    store.tabs.set(prev => prev.map(t => {
      if (t.id !== activeTab.id) return t;
      // Stack onto an existing line if same product + identical modifiers + same note + not yet sent.
      const idx = t.items.findIndex(li =>
        li.productId === product.id &&
        modifiersStableKey(li.modifiers) === stable &&
        (li.note ?? '') === (note ?? '') &&
        (li.sentToKitchenQty ?? 0) === 0,
      );
      if (idx === -1) {
        const newLine = {
          id: newId('li'),
          productId: product.id,
          product,
          qty: 1,
          modifiers: mods.length ? mods : undefined,
          note,
        };
        return { ...t, items: [...t.items, newLine] };
      }
      const items = t.items.slice();
      items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
      return { ...t, items };
    }));
    setAddedCounts(prev => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + 1 }));
  }

  function handleQtyChange(key: string, qty: number) {
    if (!activeTab || qty < 1) return;
    store.tabs.set(prev => prev.map(t => t.id !== activeTab.id ? t : {
      ...t,
      items: t.items.map(li => lineKey(li) === key ? { ...li, qty } : li),
    }));
  }

  async function handleVoidLine(_key: string) {
    if (!activeTab) return;
    setVoidOpen(true);
  }

  async function handleVoidConfirm(key: string, qty: number, reason: string) {
    if (!activeTab) return;
    const ok = await confirm({
      title: 'Void item?',
      message: 'A manager PIN is required to void.',
      requireManagerPin: true,
      danger: true,
      confirmLabel: 'Void',
    });
    if (!ok) return;
    const li = activeTab.items.find(x => lineKey(x) === key);
    if (!li) return;
    store.tabs.set(prev => prev.map(t => {
      if (t.id !== activeTab.id) return t;
      const items = t.items
        .map(x => lineKey(x) === key ? { ...x, qty: Math.max(0, x.qty - qty) } : x)
        .filter(x => x.qty > 0);
      const voids = [...(t.voids ?? []), {
        id: newId('void'), productId: li.productId, productName: li.product.name, qty, reason,
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

  /* ── Per-line-item discount ────────────────────────── */
  function handleLineDiscount(key: string) {
    if (!activeTab) return;
    setLineDiscountKey(key);
    setLineDiscountOpen(true);
  }

  function handleApplyLineDiscount(d: Discount | null) {
    if (!activeTab || !lineDiscountKey) return;
    store.tabs.set(prev => prev.map(t => {
      if (t.id !== activeTab.id) return t;
      return {
        ...t,
        items: t.items.map(li =>
          lineKey(li) === lineDiscountKey
            ? { ...li, discount: d ?? undefined }
            : li,
        ),
      };
    }));
    const li = activeTab.items.find(x => lineKey(x) === lineDiscountKey);
    toast.success(d ? `Discount applied to ${li?.product.name ?? 'item'}` : 'Item discount removed');
    setLineDiscountOpen(false);
    setLineDiscountKey(null);
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

    store.log('tab.pay', `${activeTab.customerName} · ${activeTab.label} · ${method} · ${cur}${fmtCur(total)}`, me?.id);
    const methodName = method === 'card' ? 'card' : method === 'qr' ? 'QR' : 'cash';
    toast.success(`Paid ${cur}${fmtCur(total)} via ${methodName}`);
    setPaymentOpen(false);
    setPaymentMethod(null);
    setCashTendered(0);
  }

  function handleConfirmPayment() {
    if (!paymentMethod || !activeTab) return;
    settlePayment(paymentMethod, { tendered: cashTendered });
  }

  /* ── Split payment (cash + card) ───────────────────── */
  function handleSplit() {
    if (!activeTab) return;
    if (activeTab.items.length === 0) { toast.error('Cart is empty'); return; }
    setSplitOpen(true);
  }

  function settleSplitPayment(cashPortion: number, cashTendered: number) {
    if (!activeTab) return;
    const baseTotal   = tabGrandTotal(activeTab.items, activeTab.discount);
    const cardPortion = Math.max(0, baseTotal - cashPortion);
    const cardFee     = cardPortion * CARD_FEE_RATE;
    const totalDue    = baseTotal + cardFee;
    const change      = Math.max(0, cashTendered - cashPortion);

    store.products.set(prev => decrementForTab(prev, activeTab.items));

    const splitPayments: SplitPaymentLine[] = [
      { method: 'cash', amount: cashPortion, cashTendered, changeGiven: change },
      { method: 'card', amount: cardPortion },
    ];

    store.tabs.set(prev => prev.map(t => t.id !== activeTab.id ? t : {
      ...t,
      status: 'paid',
      paymentMethod: 'split',
      paidAt: new Date(),
      paidByStaffId: me?.id,
      splitPayments,
    }));

    store.log(
      'tab.pay',
      `${activeTab.customerName} · ${activeTab.label} · split · ${cur}${fmtCur(cashPortion)} cash + ${cur}${fmtCur(cardPortion + cardFee)} card`,
      me?.id,
    );
    toast.success(`Split: ${cur}${fmtCur(cashPortion)} cash + ${cur}${fmtCur(cardPortion + cardFee)} card`);
    setSplitOpen(false);
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
          const stable = modifiersStableKey(li.modifiers);
          const idx = items.findIndex(x =>
            x.productId === li.productId && modifiersStableKey(x.modifiers) === stable,
          );
          if (idx === -1) items.push({ ...li, id: li.id ?? newId('li') });
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
  async function handleRefundConfirm(lines: { lineKey: string; qty: number }[], reason: string) {
    if (!activeTab) return;
    const ok = await confirm({
      title: 'Issue refund?',
      message: 'A manager PIN is required to refund.',
      requireManagerPin: true,
      danger: true,
      confirmLabel: 'Refund',
    });
    if (!ok) return;

    // Resolve each refund line back to the underlying tab line.
    const resolved = lines
      .map(x => {
        const li = activeTab.items.find(l => lineKey(l) === x.lineKey);
        return li ? { li, qty: x.qty } : null;
      })
      .filter((x): x is { li: typeof activeTab.items[number]; qty: number } => !!x);

    // Compute refund amount proportionally using the effective (post-item-discount) unit price.
    const refundedSubtotal = resolved.reduce((s, x) => s + lineEffectiveUnitPrice(x.li) * x.qty, 0);
    const fullSubtotal = tabSubtotal(activeTab.items);
    const ratio = fullSubtotal > 0 ? refundedSubtotal / fullSubtotal : 0;
    const amount = tabGrandTotal(activeTab.items, activeTab.discount) * ratio;

    // Restock refunded items (by productId).
    store.products.set(prev => {
      let next = prev;
      for (const x of resolved) next = restock(next, x.li.productId, x.qty);
      return next;
    });

    store.tabs.set(prev => prev.map(t => {
      if (t.id !== activeTab.id) return t;
      const items = t.items.map(li => {
        const refundLine = resolved.find(x => lineKey(x.li) === lineKey(li));
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
          lines: resolved.map(x => ({ productId: x.li.productId, qty: x.qty })),
          amount,
          reason,
          method: t.paymentMethod ?? 'cash',
          staffId: me?.id ?? 'unknown',
          at: new Date(),
        }],
      };
    }));
    store.log('tab.refund', `${activeTab.customerName} · ${cur}${fmtCur(amount)} · ${reason}`, me?.id);
    toast.success(`Refunded ${cur}${fmtCur(amount)}`);
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
        modifiers: x.li.modifiers?.map(m => ({ groupName: m.groupName, name: m.name })),
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
      <Topbar onNewTab={() => setNewTabOpen(true)} />

      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* Mobile view switcher */}
        <div className="md:hidden fixed top-[57px] inset-x-0 z-10 flex border-b border-border bg-background/95 backdrop-blur">
          {([
            { id: 'tabs', label: `Tabs${tabs.filter(t => t.status === 'open').length ? ` (${tabs.filter(t => t.status === 'open').length})` : ''}` },
            { id: 'menu', label: 'Menu' },
            { id: 'cart', label: `Cart${activeTab && activeTab.items.length ? ` (${activeTab.items.length})` : ''}` },
          ] as const).map(v => (
            <button
              key={v.id}
              onClick={() => setMobileView(v.id)}
              className={`flex-1 h-11 text-sm font-medium touch-manipulation select-none transition-colors ${
                mobileView === v.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground border-b-2 border-transparent'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className={`${mobileView === 'tabs' ? 'flex' : 'hidden'} md:flex w-full md:w-auto pt-11 md:pt-0`}>
          <TabList
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={(id) => { setActiveTabId(id); setMobileView('cart'); }}
            onNewTab={() => setNewTabOpen(true)}
          />
        </div>

        <div className={`${mobileView === 'menu' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 overflow-hidden flex-col w-full pt-11 md:pt-0`}>
          <ProductGrid
            onAddProduct={handleAddProduct}
            hasActiveTab={!!activeTab && activeTab.status === 'open'}
            addedCounts={addedCounts}
          />
        </div>

        <aside className={`${mobileView === 'cart' ? 'flex' : 'hidden'} md:flex w-full md:w-[260px] lg:w-[340px] shrink-0 md:border-l border-border flex-col overflow-hidden pt-11 md:pt-0`}>
          <Cart
            tab={activeTab}
            onQtyChange={handleQtyChange}
            onVoidLine={handleVoidLine}
            onLineDiscount={handleLineDiscount}
            onPay={handlePay}
            onSplit={handleSplit}
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
      <SplitPaymentDialog
        open={splitOpen}
        tab={activeTab}
        onConfirm={settleSplitPayment}
        onClose={() => setSplitOpen(false)}
      />
      <DiscountDialog
        open={discountOpen}
        tab={activeTab}
        onApply={handleApplyDiscount}
        onClose={() => setDiscountOpen(false)}
      />
      <LineDiscountDialog
        open={lineDiscountOpen}
        lineItem={activeTab?.items.find(li => lineKey(li) === lineDiscountKey) ?? null}
        onApply={handleApplyLineDiscount}
        onClose={() => { setLineDiscountOpen(false); setLineDiscountKey(null); }}
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
      <ProductOptionsDialog
        product={optionsProduct}
        onClose={() => setOptionsProduct(null)}
        onConfirm={(mods, note) => {
          if (optionsProduct) addLineWithModifiers(optionsProduct, mods, note);
          setOptionsProduct(null);
        }}
      />

      {/* Desk rate picker — used when a tab is already active (no new tab created) */}
      {deskRateSpace && activeTab && (
        <DeskRatePickerDialog
          space={deskRateSpace}
          cur={cur}
          onClose={() => setDeskRateSpace(null)}
          onConfirm={(rate, bookingEndsAt, bookingType) => {
            const deskProduct: Product = {
              id: deskRateSpace.id,
              name: `${deskRateSpace.name} — ${PERIOD_LABEL[rate.period]}`,
              price: rate.price,
              category: 'desks',
              description: '',
              stock: null,
              lowStockAt: null,
              sendToKitchen: false,
            };
            addLineWithModifiers(deskProduct, []);
            // Patch the tab: fix the label if needed, store bookingEndsAt and bookingType.
            const labelMatchesSpace = spaces.some(s => s.name === activeTab.label);
            store.tabs.set(prev =>
              prev.map(t => t.id === activeTab.id ? {
                ...t,
                ...(!labelMatchesSpace ? { label: deskRateSpace.name } : {}),
                ...(bookingEndsAt ? { bookingEndsAt } : {}),
                bookingType,
              } : t),
            );
            store.log('tab.desk-added', `${activeTab.customerName} · ${deskRateSpace.name} (${PERIOD_LABEL[rate.period]})`, me?.id);
            toast.success(`${deskRateSpace.name} added to tab`);
            setDeskRateSpace(null);
          }}
        />
      )}

      {/* Coworking check-in triggered from the POS Desks chip (no active tab — creates a new desk tab) */}
      {checkingInSpace && (
        <CheckInDialog
          space={checkingInSpace}
          cur={cur}
          onClose={() => setCheckingInSpace(null)}
          onConfirm={(customerName, rate, bookingEndsAt, customerId, bookingType) => {
            const product: Product = {
              id: `${checkingInSpace.id}-${rate.period}`,
              name: `${checkingInSpace.name} — ${PERIOD_LABEL[rate.period]}`,
              price: rate.price,
              category: 'desks',
              description: '',
              stock: null,
              lowStockAt: null,
              sendToKitchen: false,
            };
            const tab: Tab = {
              id: newId('tab'),
              customerName,
              type: 'desk',
              label: checkingInSpace.name,
              items: [{ id: newId('li'), productId: product.id, product, qty: 1 }],
              openedAt: new Date(),
              status: 'open',
              bookingEndsAt,
              bookingType,
              ...(customerId ? { customerId } : {}),
            };
            store.tabs.set(prev => [tab, ...prev]);
            store.log('tab.create', `${customerName} checked in to ${checkingInSpace.name} (${PERIOD_LABEL[rate.period]})`, me?.id);
            toast.success(`${customerName} checked in to ${checkingInSpace.name}`);
            setCheckingInSpace(null);
            setActiveTabId(tab.id);
          }}
        />
      )}
    </div>
  );
}
