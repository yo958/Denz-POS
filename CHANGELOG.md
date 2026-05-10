# Changelog

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
