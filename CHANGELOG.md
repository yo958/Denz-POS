# Changelog

## [1.2.12] - 2026-05-13
### Fixed
- **Accepted booking always creates a tab** — the accept handler was silently returning without creating a tab if the space ID from the web order didn't exactly match a space in the POS store. Now a desk tab is always created using whatever info is available (space name falls back to the raw ID, price falls back to 0 for staff to adjust). Café orders without items also now correctly open an empty tab.

## [1.2.11] - 2026-05-13
### Added
- **Click pending booking to preview in cart panel** — clicking an online booking card in the Tabs sidebar now opens a full order preview in the right-hand cart area, showing customer details, booking date/time/period, space/table, itemised list with total (café orders), notes, and contact info. Accept and Decline buttons are at the bottom of the preview. The selected card is highlighted with an amber ring to show it's active.

## [1.2.10] - 2026-05-13
### Fixed
- **Accept/Decline buttons always visible** — switched from side-by-side `flex-1` buttons to stacked full-width buttons. The narrow sidebar (200px) was causing the Accept button to be invisible due to width constraints. Accept Booking appears first in primary colour, Decline below it.

## [1.2.9] - 2026-05-13
### Fixed
- **Accept desk booking now creates a real tab** — accepting a coworking online booking from the Tabs sidebar now creates a proper desk tab with the correct space, rate, and `bookingEndsAt` computed from the booking date. Previously it just showed a toast and did nothing.
- **Online booking card labels** — section header is now "Online Bookings", the amber badge reads "Pending" instead of "WEB", and the sub-label reads "Online Booking · Desk/Café/Room" to be clearer to staff.

## [1.2.8] - 2026-05-13
### Changed
- **Web order cards match regular tab style** — pending website orders in the Tabs sidebar now use the same `rounded-2xl` card layout as regular tabs, with matching type icon colours (sky for café, violet for desk, emerald for room). Cards have an amber tint and a small amber "WEB" pill badge so staff can immediately distinguish them from regular tabs.

## [1.2.7] - 2026-05-13
### Fixed
- **Firestore composite index error** — the website orders query was using a compound filter + orderBy that required a manually-created index. Simplified to a single-field filter with client-side filtering and sorting, which works without any index configuration.
### Added
- **Pending website orders in Tabs sidebar** — all pending website orders (café, desk, room) now appear at the top of the Tabs column with a globe icon. Staff can Accept or Decline directly from there. Accepting a café order immediately creates an open tab with the items. Coworking/room orders show a prompt to continue on the relevant page.

## [1.2.6] - 2026-05-13
### Added
- **Category breakdown on History rows** — when a tab spans multiple categories (e.g. a desk booking that also includes café items), the total now shows a secondary line breaking it down: "CoWork ฿450 · Café ฿200". Single-category tabs are unchanged.

## [1.2.5] - 2026-05-13
### Fixed
- **Payment received checkmarks now sync across devices** — the green checkmarks on the History page were previously stored only in localStorage (device-local). They are now stored as `paymentReceived` on the `Tab` record itself, so ticking a bill on one device is immediately reflected on all other devices and the live Firebase POS.

## [1.2.4] - 2026-05-13
### Fixed
- **Daily desk bookings now expire at end of calendar day** — daily bookings from a previous calendar day no longer appear in "Away · May Return". Both open and paid daily tabs use calendar-day comparison (`date(openedAt) == date(today)`) instead of a rolling 24-hour window. Weekly/monthly/longer periods continue to use the stored `bookingEndsAt`. This affects existing stale tabs immediately — no data migration required.

## [1.2.3] - 2026-05-13
### Fixed
- **Booking expiry now uses close-of-business, not midnight** — daily bookings made on the 12th now expire at 23:30 on the 12th instead of midnight of the 13th. Weekly bookings expire at 23:30 on the 7th day, monthly at 23:30 on the 30th day, etc. The close time is read from the venue's Business Hours settings and falls back to 23:30. This affects the coworking check-in dialog, web booking acceptance, and the equipment rental dialog.

## [1.2.2] - 2026-05-13
### Added
- **Timezone & Business Hours settings** — Settings page now has a "Business Hours" section where managers can set the venue timezone (IANA, e.g. Asia/Bangkok) and configure open/close times per day of the week with a closed toggle. Hours are stored alongside the existing venue settings and auto-sync to Firestore, which means they are immediately reflected on the Denz Website (footer, contact page, map section, and "Open today" card on the about section).

## [1.2.1] - 2026-05-13
### Added
- **Dessert category** — new `dessert` product category added alongside Food and Drinks. Products tagged as Dessert appear in their own section on the Menu page with a pink badge, and show under the Dessert tab on the website menu.

## [1.2.0] - 2026-05-12
### Added
- **Partial payments on open tabs** — managers can now log one or more partial payments against any open tab without closing it. In the POS cart, tap "Log partial payment", enter the amount, choose Cash / Card / QR / Bank transfer, add an optional note, and save. The totals area shows each payment logged, plus a bold amber "Remaining" line showing what's still owed.
- **Dashboard — partial payment indicators** — the Outstanding stat card now shows the true net remaining (full tab totals minus any partial payments collected), with a "£X part-paid" sub-note. Open tab rows with partial payments show an amber "£X paid · £Y left" line.
- **Reports — Pipeline reflects partial payments** — the Pipeline stat card shows net remaining (full pipeline minus partial payments collected) with a part-paid sub-note when applicable.

## [1.1.7] - 2026-05-12
### Added
- **History — payment received checkbox** — each tab row now has a small checkbox on the right. Managers can click it to mark that payment has physically arrived (bank transfer, cash from till, etc.). Checked rows turn green so outstanding payments are easy to spot at a glance. State is stored in `localStorage` under `denz.paymentReceived` and is completely isolated from the rest of the POS.

## [1.1.6] - 2026-05-12
### Changed
- **Customers — full-width layout** — removed the `max-w-3xl` cap from the customer list so the page fills the full width like all other pages.

## [1.1.5] - 2026-05-12
### Changed
- **Rooms — check-out date on occupied cards** — occupied room cards now show a dedicated "Check-out: DD Mon YYYY" line in amber beneath the check-in date, so staff can see at a glance when each guest is due to leave.

## [1.1.4] - 2026-05-12
### Changed
- **Full-width layout on all pages** — removed narrow `max-w-3xl` / `max-w-4xl` / `max-w-5xl` constraints from the Reports, History, Menu, Settings, and Rooms page content areas. All pages now use the same full-width `px-6` padding as the Dashboard and Bills pages. Rooms grid also gains a 4-column layout on XL screens.
- **Reports — defaults to 30-day view** — the Reports page now opens on the "30d" tab instead of "Today".

## [1.1.3] - 2026-05-12
### Added
- **Bills & Expenses page** — new manager-only page (`/bills`) for tracking business outgoings. Add bills with a description, amount, date, category (Cafe / Rooms / Co-Working / General), optional supplier name, notes, and custom colour-coded tags. Tags can be created inline inside the Add dialog. Bills are filterable by date range (Today / 7d / 30d / All time), category, and tag.
- **Edit bill** — pencil icon on each bill row opens the Edit Bill dialog, pre-filled with all existing values. Any field can be changed and saved without deleting and re-adding.
- **Bills sidebar nav** — "Bills" entry added to the sidebar between History and Reports (manager-only).
- **Reports — Revenue vs Expenses chart** — a lime/red area chart at the top of the Reports page shows revenue in and expenses out over the selected period. Today = by hour, 7d/30d = by day, All = by month. Hover any point for exact figures.
- **Reports — Net Profit card** — the top stat row now shows Revenue, Expenses, and Net Profit (revenue − refunds − expenses). Secondary row shows Net Sales, Pipeline, and Items Sold.
- **Reports — By Area now deducts expenses** — each area row (Cafe, CoWorking, Rooms) subtracts the matching bill-category spend from revenue to show true net per area. A "Revenue / Expenses" breakdown line appears under any area that has bills against it.
- **Reports — Expenses by Category section** — dedicated breakdown at the bottom of the Reports page showing spend per bill category with a red progress bar.
- **Dashboard — net profit today** — top stat row now shows Revenue today, Expenses today, Net Profit today, and Outstanding. An "Expenses today" card appears in the right column breakdown when bills exist for today.

### Fixed
- **Reports — "Room" removed from By Payment Method** — room charges are internal transfers, not cash received; they no longer appear in the payment method grid.

## [1.1.2] - 2026-05-11
### Changed
- **Global number formatting** — all monetary values across every page and component now display with thousands-separator commas (e.g. ฿14,000.00 instead of ฿14000.00). A shared `fmtCur()` utility in `lib/format.ts` powers consistent formatting using the `en` locale throughout: POS tabs, cart, payment dialogs, split payment, receipts, history, reports, coworking, rooms, dashboard, customers, settings, and the Z-report.

## [1.1.1] - 2026-05-11
### Changed
- **Room check-in — date picker instead of nights** — the Check In dialog now has a Check-in date and Check-out date picker instead of a "Nights" number field. The number of nights is calculated automatically from the two dates and shown as a live summary below the pickers. Defaults to today → tomorrow (1 night). Moving the check-in date past the check-out date automatically pushes check-out forward by one day. The calculated check-out date is now stored on the Stay record for use in dashboard check-out reminders.

## [1.1.0] - 2026-05-11
### Added
- **Coworking — Away · May Return section** — a new amber-coloured section on the Coworking page lists customers who have a valid hot-desk booking but have left the physical desk. Each card shows "Pre-paid · can return until [date]" with no checkout button; the section disappears automatically when all bookings expire. The header now shows separate "X active / Y away" counts.
- **Dashboard — Away · May Return panel** — the Coworking active-sessions card on the Manager Dashboard now includes an amber sub-section listing away customers with their booking expiry, so managers can see at a glance how many desks to keep reserved.
- **Hot desk booking tracking** — all non-hourly hot desk bookings (daily, weekly, monthly, etc.) now set `bookingEndsAt` so pre-paid reservations stay visible on the Coworking page until the period expires, even after the tab is paid.
- **Release Desk flow** — clicking the new "Release Desk" button on an open hot-desk card marks the customer as away (tab → paid, `bookingEndsAt` kept) and moves their card to the Away section. A "Check Out" on a dedicated desk still works as before.

### Fixed
- **Dedicated Desk label wrongly applied to hot desks** — tabs explicitly expired by Early Check Out (`bookingEndsAt` set to epoch) no longer trigger the backwards-compat "Dedicated Desk" fallback.
- **"Expired" red state on hot desks** — hot desk cards never show the red expired state; only dedicated desks whose booking period has ended turn red.
- **Checkout button persisting after early checkout** — tabs with `bookingEndsAt` at epoch are now skipped at the top of the active-tab query, preventing them from re-appearing via legacy inference.

## [1.0.9] - 2026-05-11
### Fixed
- **Dedicated desk stays active after POS cash payment** — paying a dedicated desk tab with cash on the POS page no longer removes the desk from the Coworking active list. The desk card remains visible until `bookingEndsAt` (e.g. all day for a daily booking). If staff need to release the desk early, the "Check Out" button on the active card now shows an "Early Check Out" confirmation dialog and expires the booking immediately rather than attempting to re-pay an already-paid tab.

## [1.0.8] - 2026-05-11
### Fixed
- **Desk rate picker on Tabs page now shows dedicated desk rates** — the "Add Desk to Tab" dialog now includes a Hot Desk / Dedicated Desk toggle when a space has both rate tables, matching the Coworking check-in flow. Selecting a dedicated rate also sets bookingEndsAt on the tab so the booking expiry is tracked correctly.

## [1.0.7] - 2026-05-11
### Added
- **Per-line-item discounts** — each line item in a tab now has its own discount button (Tag icon). Tap it to apply a percentage or fixed-amount discount to that item only. The discounted unit price is shown with a strikethrough of the original, and a colour pill labels the saving. Item discounts stack correctly with the existing tab-level discount: the tab discount applies to the already-discounted subtotal. Payment screens (cart, payment dialog, split dialog), receipts, and history detail panels all show an "Item discounts" row so the breakdown is transparent.
- **Reports & revenue bucketing** — per-item discounts are correctly reflected in revenue by area (Cafe / CoWorking / Rooms). Discounting a desk product reduces only coworking revenue; food and drink revenue is unaffected. Top Items revenue also uses the discounted price.

### Fixed
- **Coworking active desk cards not showing for tabs-page-created desk tabs** — creating a new tab with type "Desk" from the POS page now presents a space picker (dropdown of real CoworkSpaces) instead of a free-text label, so the tab label always matches a real space and the Coworking page correctly renders the active desk card.
- **Split payment confirm button greyed out** — cash tendered now defaults to the exact cash portion when you enter or quick-select the cash amount, avoiding the confusing state where card amount was accidentally entered into the cash-tendered field.

### Added (previous session, included in this release)
- **Split payment (Cash + Card)** — new Split button on the payment bar lets staff split a tab between cash and any card amount. The 5% card fee applies only to the card portion. Receipts show the full split breakdown with cash tendered, change due, card subtotal, and card fee.

## [1.0.6] - 2026-05-10
### Fixed
- **POS Desks chip — adds desk to existing tab instead of creating a second tab** — when a tab is already open, tapping a desk card now shows a compact rate-picker dialog (no customer name field — it's already known from the tab) and adds the desk as a line item to the current tab. No duplicate tab is created. The Coworking page now detects these desk line items on regular POS tabs and shows them as active sessions; the active card displays "Manage on the POS tab" instead of a checkout button, since the full tab lives on the POS page.

## [1.0.5] - 2026-05-10
### Fixed
- **POS Desks chip — now triggers proper coworking check-in** — tapping a desk card on the Tabs page now opens the full Check In dialog (customer name, rate, booking type) instead of adding a line item to the current tab. This creates a `type: desk` tab with the correct space label, so the booking appears immediately on the Coworking tab as an active session. `CheckInDialog` extracted to `components/coworking/CheckInDialog.tsx` and shared between both pages.

## [1.0.4] - 2026-05-10
### Added
- **Customer editor — ID / passport upload** — a dashed document-upload area appears below the Notes field when editing a customer; click to upload a photo of their ID or passport (stored as a data URL, never leaves the device). Once uploaded a thumbnail preview fills the area, hovering shows a "Replace" overlay, and "View" opens a full-screen lightbox for easy reading. "Remove" clears it. The `idImage` field is added to the `Customer` type.

## [1.0.3] - 2026-05-10
### Added
- **Rooms — permanent delete** — hovering a room card now shows a red trash icon (manager-only) alongside the existing edit and archive buttons; requires manager PIN confirmation and is blocked if the room has an active guest checked in

## [1.0.2] - 2026-05-10
### Added
- **Coworking — space capacity / multiple occupancy** — each space can now have a slot count set in the editor ("Multiple occupancy" toggle → "Total slots" number). When enabled, the available card shows a dot-bar (blue = occupied, green = free) and "X of Y free"; check-in stays open until all slots are taken. Each booking gets its own active card and independent check-out. Spaces without the toggle stay single-occupancy. Equipment rental's available-space picker also respects remaining capacity.

## [1.0.1] - 2026-05-10
### Added
- **Coworking — duplicate equipment** — equipment rental cards now have the same Copy button (pencil → copy → trash); clones the item with all its hour tiers and opens the editor to rename it

## [1.0.0] - 2026-05-10
### Added
- **Coworking — duplicate space** — each available space card now has a Copy button (pencil → copy → trash) that instantly clones the space with all its rates, tiers, and dedicated desk settings; the duplicate is named "Space Name (copy)" and opens in the editor so you can rename it straight away

## [0.9.9] - 2026-05-10
### Fixed
- **POS product grid — Desks tab now pulls from Coworking spaces** — the "Desks" category chip in the POS product grid now shows cards generated live from your Coworking spaces (via `useSpaces()`) instead of old static product-store records; price shown is the enabled hourly rate for that space. Legacy product-store items with category `desks` are hidden everywhere so deleted demo desks no longer appear. Rooms still come from the product store (managed on the Rooms tab) and are unaffected.


## [0.9.8] - 2026-05-10
### Fixed
- **Coworking space editor — toggle rendering** — replaced all four custom `absolute`-positioned toggle buttons with the same `inline-flex items-center` approach used by the Switch component; fixes the stretched/broken appearance on disabled rate rows and the dedicated desk toggle

## [0.9.7] - 2026-05-10
### Added
- **Coworking — per-hour pricing tiers** — the "Per Hour" rate row in the space editor now has a "Per-hr tiers" button (appears when hourly is enabled). Click it to expand into individual hour slots (Hour 1, Hour 2, Hour 3+, etc.) with add/remove tier controls — identical to the equipment rental system. Click "Flat rate" to collapse back to a single price. Billing automatically uses the tiers when set.
### Fixed
- **Coworking space editor — rate row layout** — hourly row now cleanly expands into tier sub-rows below it rather than inline, keeping all other period rows in the same flat layout

## [0.9.6] - 2026-05-10
### Added
- **New tab — "Save as new customer" toggle** — when you type a free-text name in the New Tab dialog (not picked from the existing customer list), a small toggle appears: "Save as new customer". Turning it on creates a Customer record and links it to the tab in one step, without needing to navigate to the Customers page
- **Open tab — "Save to customers" button** — a `UserPlus` icon button now appears next to the pencil in the cart header for any tab that isn't yet linked to a customer. One click creates the customer from the tab name and links them instantly; the button disappears once linked

## [0.9.5] - 2026-05-10
### Fixed
- **Menu item editor — scrollable dialog** — dialog now caps at 90% of the viewport height with a scrollable body; title stays pinned at the top and Cancel/Save buttons stay pinned at the bottom so they're always reachable regardless of how many modifier groups are attached

## [0.9.4] - 2026-05-10
### Changed
- **Menu item editor — toggle switches** — replaced all checkboxes in the product edit dialog with modern pill-style toggle switches: Track cost price, Manage stock, Send to kitchen (KDS), and per-modifier-option visibility toggles all use the new `Switch` component

## [0.9.3] - 2026-05-10
### Fixed
- **Menu page — category jump bar** — added Food / Drinks pill buttons below the header that instantly scroll to the right section; useful when the menu has many items and drinks are hidden below a long food list
- **CSV import — KDS default for drinks** — drinks imported without a `send_to_kitchen` column now correctly default to `false` (not sent to kitchen), matching the manual product behaviour; food still defaults to `true`

## [0.9.2] - 2026-05-10
### Changed
- **Modifier groups — names only in Settings** — removed the global price field from modifier group options; prices are now set per product, not per group
- **Product modifier options — visibility + price at product level** — checkboxes in the product editor now control which options from a group are shown in the POS (tick = show, untick = hide); each visible option has its own price field (amount added to the base price, 0 = included free)
- When a modifier group is first attached to a product, all its options are auto-enabled
- **POS picker respects per-product visibility** — only options enabled for the product are shown when staff add it to a tab; existing products without the new config continue to show all options (backwards compatible)

## [0.9.1] - 2026-05-10
### Added
- **Permanent delete for menu items** — Trash icon on each menu item row lets managers permanently remove a product; requires manager PIN confirmation and shows a danger warning that the action cannot be undone

## [0.9.0] - 2026-05-10
### Added
- **Product search in menu grid** — full-width search bar now lives directly above the category chips in the POS product area, making it immediately obvious and easy to reach; replaces the small tucked-away search in the top bar
  - Clear (×) button appears when text is entered
  - Switching category tabs auto-clears the search to avoid double-filtering confusion
  - Empty state shows a search icon and the query ("No results for 'latte'") with a one-tap "Clear search" link
  - Press `/` keyboard shortcut still focuses the input from anywhere on the page
- **Bulk CSV import for menu items** — "Import CSV" button on the Menu page lets managers upload a spreadsheet to add food and drink items in bulk
  - Drag-and-drop or click-to-browse file picker
  - Column reference table explains all supported fields inline
  - Downloadable template (`menu-import-template.csv`) with example rows
  - Live preview table after upload: valid rows shown in green, invalid rows highlighted in red with the specific error
  - Only valid rows are imported; invalid rows are skipped with a count shown
  - Supported columns: `name`, `price`, `category` (required) · `description`, `stock`, `low_stock_at`, `cost`, `glyph`, `send_to_kitchen` (optional)

### Changed
- Search removed from the top bar; the bar now contains only date, shift toggle, theme switcher, and New Tab button

## [0.8.0] - 2026-05-10
### Added
- **Manager Dashboard** — new `/dashboard` page (manager-only, first in sidebar) with a full live overview of everything across the system:
  - Revenue today, outstanding amount, open/paid tab counts
  - Desk availability (X of Y available) and equipment rentals in/out
  - Room occupancy grid — each room shown as FREE / OCCUPIED / CHECK OUT TODAY with guest name and dates
  - Kitchen queue status tiles: Waiting · Preparing · Ready · Done today, plus a live list of waiting tickets with customer, items, and queue time
  - Active coworking sessions — who is at which desk, duration, running tab total
  - Equipment rentals — what is out, who has it, and what is available
  - Payment method breakdown (cash/card/QR/room) with transaction counts and totals
  - Revenue by category (cafe/coworking/rooms)
  - Paid today grid — recently closed tabs
  - New customers this week with VIP and discount indicators
  - Customer overview stats panel (total active, VIP count, discount holders, new today/week)
  - Shift status header — open duration and opener's name, or a warning if no shift is open
- **Modifier dialog scroll fix** — `overflow-hidden` on dialog container ensures `max-h` properly constrains the flex layout; scroll area now works regardless of how many modifier groups a product has
- **Wider modifier dialog** — increased to `sm:max-w-xl`; options with 3+ short names render in a two-column grid to reduce vertical height
- **Product card flash redesign** — flash border is always reserved as `border-2` (invisible by default, `border-background` colour) so it switches to green on add without any layout shift; ring and scale effects removed; flash colour changed from red to emerald green; green tick icon removed
- **Tablet layout optimisation** — sidebar collapses to icon-only (56 px) at `md`, full width at `lg`; TabList and Cart narrowed to fit 768 px viewports without overflow
- **Tab list item layout** — customer name on its own full-width row to prevent truncation; label + price on second row; elapsed time + item list below

### Fixed
- Modifier product cards now correctly flash green after the options dialog is confirmed (add-count state lifted to parent; `addedCounts` prop threaded through `ProductGrid` → `ProductCard`)

## [0.7.0] - 2026-05-10
### Added
- **QR payment method** — split from Card; QR carries 0% fee, Card retains 5% fee; QR button shown in payment bar with violet styling
- **Customer detail panel** — click any customer to see total spent, avg order, visit count, open tab value, first/last visit, favourite item, all open tabs, and full order history with receipt print links
- **Customer country field** — ISO country dropdown on customer profiles with live flag emoji preview; flag shown in Cart header with hover tooltip showing country name
- **Customer visitor type** — Local / Tourist / Expat / Semi-expat label on customer profiles, shown as a badge in the customer list and detail panel
- **Customer filter bar** — filter by visitor type (All / Local / Tourist / Expat / Semi-expat), VIP only, has discount, and by country (dropdown auto-populates from countries in your data); active filter count badge with one-click clear
- **Discount auto-apply** — selecting an existing customer at tab creation or re-linking via Cart header edit now automatically applies their saved discount to the tab
- **History order detail panel** — clicking an order in History now opens a full detail panel (customer info, line items, totals, payment method) instead of jumping straight to the receipt; receipt print link inside the panel
- **Kitchen ticket modifiers & notes** — modifier options (e.g. Size: Large, Milk: Oat) and per-line notes are now included in kitchen tickets and displayed on the KDS; modifiers shown in sky-blue, notes in amber

### Fixed
- Receipt pages no longer require re-entering the PIN — opening a receipt in a new browser tab bypasses the PIN lock (sessionStorage is tab-scoped by design)
- CustomerPicker dropdown now uses a solid background to prevent transparency bleed-through over tab type buttons
- QR and Card payment totals now tracked separately in shift reports and Z-report

## [0.6.0] - 2026-05-09
### Added
- **Customer picker** in all check-in and tab-creation flows — search existing customers by name, email, or phone; VIP and discount info shown inline in the dropdown
- Selecting an existing customer links their `customerId` to the tab or stay
- **VIP gold star badge** shown on active tab headers (Cart), tab list items, coworking active cards
- **Discount pill** shown on active tab headers and coworking active cards when customer has a discount
- Rooms check-in auto-fills the phone field when an existing customer with a phone number is selected
- Cart header edit mode uses `CustomerPicker` to re-link a different customer after tab creation

## [0.5.0] - 2026-05-09
### Changed
- Each desk now supports **both Hot Desk and Dedicated Desk bookings** — no need to create the space twice
- Dedicated Desk rates are an optional second rate table per space, toggled on in the Edit Space dialog
- At check-in, if both rate tables are set, staff picks **Hot Desk** or **Dedicated Desk** booking type; rates update accordingly
- Hot desk bookings show elapsed time on the active card; dedicated bookings show "Until [date]" (booking end date calculated from the period)
- Dedicated desk booking active cards turn rose/red once the booked period expires
- Space type is now simply **Desk** or **Private Office** (old hot-desk / dedicated-desk space types migrate automatically)
- Filter pills simplified to All / Desk / Private Office
- Removed Spaces / Equipment Rental tab switcher — unified into a single scrollable page: Active → Equipment Rental → Available
- Menu tab now shows Food and Drinks only (Desks and Rooms removed)
- Rooms tab: inline Add / Edit / Archive room management (pencil + archive icons on card hover)
- Fixed stale `setSavedToDb` reference in NewTabDialog

## [0.4.1] - 2026-05-09
### Changed
- Menu tab now shows only Food and Drinks — Desks and Rooms removed (managed on their own tabs)
- Rooms tab: add "+ Add Room" button and inline edit/archive per room card (pencil + archive icons appear on hover over the card photo)
- Fixed stale `setSavedToDb` reference in NewTabDialog

## [0.4.0] - 2026-05-09
### Added
- Customers tab: store customer profiles with name, email, phone, website, job role, and photo
- Per-customer discount (percentage or fixed amount) applied at a customer level
- VIP flag with gold star badge to highlight priority customers
- Search/filter customers by name, email, phone, or role
- Full CRUD — add, edit, and archive customers (manager only for edits; all staff can view)
- Customers slice synced to Firestore alongside all other data slices

## [0.3.1] - 2026-05-09
### Added
- Phone and email contact icons on staff rows in Settings — only shown when contact info exists, click-to-call / click-to-email

## [0.3.0] - 2026-05-09
### Added
- Role-based access control: staff role hides History, Reports, and Settings from navigation
- Manager-only pages show an access-denied message when accessed by staff
- Staff profiles: optional photo (click to upload), phone, and email contact fields
- Staff edit dialog in Settings — managers can update name, role, photo, and contact info
- Staff rows now display profile photo (falls back to initials) and phone number

## [0.2.0] - 2026-05-07
### Added
- Full Denz POS application (initial working release)
- POS tabs, CoWorking desks, Rooms / stay folios
- Kitchen Display System (KDS)
- Menu management with modifier groups
- Reports and shift management
- Settings — venue, tax, staff, devices, backup/restore
- Firebase App Hosting deployment (auto-deploy from GitHub main)
- Firestore real-time sync with offline-first localStorage fallback
- Anonymous Firebase Auth for Firestore security
- Cross-tab sync via BroadcastChannel
- PIN-based staff authentication with idle auto-lock
