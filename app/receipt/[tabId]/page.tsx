'use client';

import { use, useEffect, useRef } from 'react';
import { useTabs, useSettings } from '@/lib/hooks/useStore';
import {
  effectiveQty, formatDate, formatTime, tabSubtotal, tabDiscountAmount,
  tabTax, tabGrandTotal, tabRefundedAmount, tabCardFee, CARD_FEE_RATE,
} from '@/lib/domain/tabs';

export default function ReceiptPage({ params }: { params: Promise<{ tabId: string }> }) {
  const { tabId } = use(params);
  const tabs = useTabs();
  const settings = useSettings();
  const tab = tabs.find(t => t.id === tabId);
  const printedRef = useRef(false);

  useEffect(() => {
    if (!tab || printedRef.current) return;
    printedRef.current = true;
    const id = setTimeout(() => window.print(), 250);
    return () => clearTimeout(id);
  }, [tab]);

  if (!tab) {
    return <div className="p-8 text-sm">Tab not found.</div>;
  }

  const subtotal  = tabSubtotal(tab.items);
  const discount  = tabDiscountAmount(tab.items, tab.discount);
  const tax       = tabTax(tab.items, tab.discount, settings.taxEnabled === false ? 0 : settings.taxRate);
  const baseTotal = tabGrandTotal(tab.items, tab.discount, settings.taxEnabled === false ? 0 : settings.taxRate);
  const isCard    = tab.paymentMethod === 'card';
  const cardFee   = isCard ? tabCardFee(tab.items, tab.discount, settings.taxEnabled === false ? 0 : settings.taxRate) : 0;
  const total     = baseTotal + cardFee;
  const refunded  = tabRefundedAmount(tab);
  const cur = settings.currency;

  return (
    <div className="receipt mx-auto bg-white text-black font-mono text-[12px] leading-[1.35] p-4">
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .receipt { width: 80mm; padding: 4mm; }
        }
        .receipt { width: 80mm; }
        .receipt hr { border: 0; border-top: 1px dashed #999; margin: 6px 0; }
        .receipt .row { display: flex; justify-content: space-between; gap: 6px; }
        .receipt .center { text-align: center; }
        .receipt .bold { font-weight: 700; }
        .receipt .item { margin-bottom: 2px; }
      `}</style>

      <div className="center bold" style={{ fontSize: 14 }}>{settings.venue.name}</div>
      {settings.venue.address && <div className="center">{settings.venue.address}</div>}
      {settings.venue.phone && <div className="center">{settings.venue.phone}</div>}
      {settings.venue.abn && <div className="center">ABN {settings.venue.abn}</div>}
      <hr />

      <div>{settings.receipt.header}</div>
      <hr />

      <div className="row"><span>Tab</span><span>{tab.label}</span></div>
      <div className="row"><span>Customer</span><span>{tab.customerName}</span></div>
      <div className="row"><span>Date</span><span>{formatDate(tab.openedAt)} {formatTime(tab.openedAt)}</span></div>
      {tab.paidAt && <div className="row"><span>Paid</span><span>{formatTime(tab.paidAt)} ({tab.paymentMethod})</span></div>}
      <hr />

      {tab.items.map(li => {
        const q = effectiveQty(li);
        const line = li.product.price * q;
        return (
          <div key={li.productId} className="item">
            <div className="row"><span>{q} × {li.product.name}</span><span>{cur}{line.toFixed(2)}</span></div>
            {li.note && <div style={{ paddingLeft: 8, fontStyle: 'italic' }}>{li.note}</div>}
            {(li.refundedQty ?? 0) > 0 && <div style={{ paddingLeft: 8 }}>refunded ×{li.refundedQty}</div>}
          </div>
        );
      })}

      <hr />
      <div className="row"><span>Subtotal</span><span>{cur}{subtotal.toFixed(2)}</span></div>
      {discount > 0 && (
        <div className="row"><span>Discount</span><span>-{cur}{discount.toFixed(2)}</span></div>
      )}
      {settings.taxEnabled !== false && (
        <div className="row"><span>{settings.taxLabel} ({Math.round(settings.taxRate * 100)}%)</span><span>{cur}{tax.toFixed(2)}</span></div>
      )}
      {isCard && (
        <div className="row"><span>Card fee ({Math.round(CARD_FEE_RATE * 100)}%)</span><span>+{cur}{cardFee.toFixed(2)}</span></div>
      )}
      <div className="row bold" style={{ fontSize: 14 }}><span>TOTAL</span><span>{cur}{total.toFixed(2)}</span></div>

      {tab.paymentMethod === 'cash' && tab.cashTendered != null && (
        <>
          <div className="row"><span>Cash tendered</span><span>{cur}{tab.cashTendered.toFixed(2)}</span></div>
          <div className="row"><span>Change</span><span>{cur}{(tab.changeGiven ?? 0).toFixed(2)}</span></div>
        </>
      )}

      {refunded > 0 && (
        <>
          <hr />
          <div className="row bold"><span>Refunded</span><span>-{cur}{refunded.toFixed(2)}</span></div>
        </>
      )}

      <hr />
      <div className="center">{settings.receipt.footer}</div>
      <div className="center" style={{ marginTop: 6, fontSize: 10 }}>{tab.id}</div>

      <div className="no-print mt-6 flex gap-2 justify-center">
        <button onClick={() => window.print()} className="px-4 py-2 rounded bg-black text-white text-sm">Print</button>
        <button onClick={() => window.close()} className="px-4 py-2 rounded border text-sm">Close</button>
      </div>
    </div>
  );
}
