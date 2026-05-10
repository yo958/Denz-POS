# Changelog

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
