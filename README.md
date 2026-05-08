# Denz POS

Single-device point-of-sale for Denz Coworking Cafe — cafe orders, coworking desk tabs, guestroom folios, kitchen display, receipts, and end-of-day reports. All data lives in `localStorage` on the device; no server, no cloud.

Built on Next.js 16 (App Router) + React 19 + Tailwind v4. Ships in a Docker container on port **3001**.

## Run

### Docker (recommended)

```sh
docker compose up -d --build
```

App is at `http://localhost:3001`.

### Local dev

```sh
npm install
npm run dev          # http://localhost:3000
```

## First login

Default PINs (change immediately in **Settings → Staff**):

| Role    | PIN  |
| ------- | ---- |
| Manager | 1234 |
| Staff   | 0000 |

## What's included

- **POS** — cafe / coworking / room tabs, line discounts, manual Card / Cash / Charge-to-Room.
- **Guestrooms** — real Stay model with folio tabs; charges from anywhere route into the folio.
- **Kitchen Display** at `/kds` — auto-syncs across browser tabs/windows via `BroadcastChannel`.
- **Receipts** at `/receipt/[tabId]` — auto-prints, 80mm thermal-friendly CSS.
- **Inventory** — per-product stock, low-stock badges, auto-decrement on payment, restock on refund.
- **Voids & refunds** — both gated by manager PIN, fully audited.
- **Shifts** — open with a cash float, close with counted cash → Z-report with variance.
- **Reports** — today / 7d / 30d / all, by area, by payment method, top items, refunds.
- **Settings** — venue, tax, currency, receipt header/footer, staff CRUD, idle auto-lock, KDS sound.

## Backup & recovery

Everything is in `localStorage`. **Export a backup before clearing browser data, switching browsers, or migrating devices.**

- **Export**: Settings → Data → **Export Backup** (downloads a timestamped `.json`).
- **Restore**: Settings → Data → **Restore Backup** → pick the `.json` (manager PIN required, overwrites everything).
- **Factory reset**: Settings → Data → **Factory Reset** (manager PIN required, reseeds with demo data).

A daily export to a USB stick or cloud folder is the supported disaster-recovery flow.

## Project layout

```
app/                    routes (POS at /, /kds, /rooms, /coworking, /menu, /reports, /settings, /receipt/[tabId])
components/
  pos/                  cart, payment, void/refund/discount dialogs, product grid
  rooms/                check-in dialog
  shell/                sidebar, topbar (with shift open/close), theme toggle
  auth/                 PIN pad, auth shell, idle-lock
  ui/                   shadcn-style primitives + toast + confirm dialog
lib/
  types.ts              domain types
  store/                storage wrapper, slices, broadcast sync, seed, backup
  domain/               pure helpers (tabs, stays, inventory, shift, auth, ids)
  hooks/                useStore + per-slice hooks
```

## Notes

- This is **not** the Next.js you might know — pinned to 16.2.4 with Turbopack. See `AGENTS.md`.
- Single-device by design. Two browser tabs on the same machine sync (BroadcastChannel); two devices do not.
- No real payment processor. Card / Cash are manual mark-paid; the `PaymentMethod` enum is the seam for v2.
