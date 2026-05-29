# Changelog

## [1.12.2] - 2026-05-29
### Added
- Blog editor: Image toolbar button — pick a file, inserts inline into article content as base64

## [1.12.1] - 2026-05-29
### Fixed
- Blog categories/tags POST: omit `description` field when undefined — Firestore Admin SDK rejects `undefined` values causing silent failure
- TaxonomyManager and TaxonomyPicker: wrap `onAdd`/`onCreate` in try/finally so `saving` state always resets even on API errors (button was stuck greyed out)

## [1.12.0] - 2026-05-29
### Added
- **Blog management page** (`/blog`) — create, edit, publish, and delete articles with a rich TipTap editor
- **SEO fields** per article: meta title (60-char counter), meta description (160-char counter), and focus keyword
- **Feature image** upload with preview on all article cards
- **Categories & Tags** manager — create/delete taxonomies inline; multi-select on each article
- Blog API routes: `GET/POST /api/blog/posts`, `GET/PUT/DELETE /api/blog/posts/[id]`, `GET/POST/DELETE /api/blog/categories`, `GET/POST/DELETE /api/blog/tags` — all backed by Firebase Admin + Firestore
- `BlogPost` and `BlogTaxonomy` types added to `lib/types.ts`; `blog.*` AuditActions added
- Blog nav item in Sidebar (manager-only, after Inbox)

## [1.11.8] - 2026-05-27
### Fixed
- **Partial payments**: tabs fully covered by partial payments now show a green "Close Tab — Fully Paid" button instead of remaining open indefinitely. Clicking it marks the tab as `paid` (method: split) and removes it from the active list.

## [1.11.7] - 2026-05-26
### Fixed
- **Calendar**: customer appearing 3× in calendar grid when their desk was swapped (voided + replaced). The matching logic used `tab.label` to assign a tab to a space row, but the label is set at tab creation and never updated when desk items change. A tab with label "Desk + 24\"" that had its desk voided and replaced with two different desks would appear in all three space rows. Fix: when a tab has desk items, match exclusively by item name — label matching is now only used as a fallback for tabs with no desk items at all.

## [1.11.6] - 2026-05-25
### Fixed
- **next.config.ts**: skip TypeScript and ESLint checks during Firebase App Hosting build — Cloud Build runner runs out of memory (~2 GB heap limit) during `tsc`. Type safety is enforced locally via `tsc --noEmit` before every push.

## [1.11.5] - 2026-05-25
### Fixed
- **apphosting.yaml**: set `availability: RUNTIME` on all secrets — prevents Firebase App Hosting from trying to resolve secrets at Cloud Build time (which caused FAILED_PRECONDITION build failures).

## [1.11.4] - 2026-05-25
### Fixed
- **Gmail OAuth callback**: redirect URL now derived from `GMAIL_REDIRECT_URI` env var instead of `request.nextUrl.origin` — prevents Docker's internal `0.0.0.0:3000` address being used in production redirects. Added error logging for failed OAuth exchanges.
- **docker-compose.yml**: renamed service from `app` to `denz-pos` for clarity.

## [1.11.3] - 2026-05-23
### Changed
- **Theme switcher moved to Settings**: removed the Light/Dark/System toggle from the Tabs page topbar. It now lives as an "Appearance" section at the top of Settings, with a styled Light / Dark / System pill selector.

## [1.11.2] - 2026-05-23
### Changed
- **Sidebar — Google submenu collapses**: Google Ads, Analytics, and Search Console sub-items now only expand when the current page is /google, /ads, /analytics, or /gsc. Hidden on all other pages.

## [1.11.1] - 2026-05-23
### Changed
- **Sidebar — Google submenu**: Google Ads, Analytics, and Search Console are now nested sub-items under Google Overview. In wide mode they appear indented with a left-border connector line; in icon-only mode they stack below the parent icon. The parent "Google Overview" stays highlighted whenever you're on any sub-page.

## [1.11.0] - 2026-05-23
### Added
- **Google Overview page** (`/google`): new manager-only dashboard combining Google Ads, Analytics, and Search Console in a single view. Shows three headline numbers (Ad Spend, Sessions, Organic Clicks), three service cards each with key metrics + sparkline trend chart, a Top Campaigns vs Top Queries side-by-side table, and a Traffic Sources breakdown. Each service loads independently — if one isn't connected it shows gracefully without breaking the others. "Refresh All" re-fetches all three in parallel.
- **Sidebar entry**: "Google Overview" added above Google Ads using the Layers icon.

## [1.10.9] - 2026-05-23
### Changed
- **Analytics page**: applied compact horizontal stat card layout (was missing from previous update); grid changed to `sm:grid-cols-3` (2 rows of 3).
- **All Google pages (Ads, Analytics, Search Console)**: stat card icons now use individual tinted colour backgrounds matching the Reports page style — sky/blue for impressions, violet for CTR/new users, emerald for conversions/page views, amber for CPC/position, teal for duration. Accent card (primary metric) retains its pink highlight.

## [1.10.8] - 2026-05-23
### Changed
- **Google Ads & Search Console — compact card layout**: stat cards on both pages now use the same horizontal `flex-row` layout as the Reports page (icon in a tinted circle on the left, value + label on the right). Accent card (Total Spend / Total Clicks) retains its primary colour highlight.
- **Google Ads grid**: changed from `lg:grid-cols-6` to `sm:grid-cols-3` so the 6 horizontal cards display cleanly in two rows of three.

## [1.10.7] - 2026-05-23
### Changed
- **Reports page — compact card layout**: all stat cards (primary, secondary, payment method) now use a horizontal `flex-row` layout with the icon on the left and value/label/sub on the right. More compact and visually cleaner.
- **Reports page — grid fixes**: primary stats grid changed to `grid-cols-2 sm:grid-cols-4` so all 4 cards always sit on one row on tablet+; secondary stats (Net Sales, Pipeline, Items Sold) changed to `grid-cols-3` so they always stay on one row.

## [1.10.6] - 2026-05-23
### Changed
- **AI Insights formatting**: replaced flat prose rendering with a structured card layout. Each section heading gets a tinted strip with a violet accent bar; list items use a `›` chevron bullet at `text-sm` (up from `text-xs`); bold key phrases stand out clearly against muted body copy. Extracted into a shared `InsightsPanel` component used by both Google Ads and Search Console pages.

## [1.10.5] - 2026-05-23
### Added
- **Search Console AI Insights**: "Generate Insights" button at the bottom of the `/gsc` page calls GPT with 28-day Search Console data and returns structured SEO recommendations — Quick Wins, Striking Distance Keywords (positions 4–10), Low CTR Opportunities, Device & Audience Insights, Content & Growth Opportunities.
- **New API route**: `app/api/gsc/insights` (GET returns stored insights, POST calls OpenAI and merges result into GSC cache doc). Uses the same model chosen in Settings → AI Settings.

## [1.10.4] - 2026-05-23
### Added
- **AI Settings — model selector**: dropdown in Settings → AI Settings lets managers choose the OpenAI model used for Google Ads insights (GPT-4.1 Mini, GPT-4o Mini, GPT-4.1, GPT-4o). Selection saves immediately and persists in Firestore.
### Changed
- Model is now read from Firestore at request time; no longer hardcoded in the insights route.

## [1.10.3] - 2026-05-23
### Changed
- **AI Insights model**: switched from `gpt-4o` to `gpt-4.1-mini` to reduce OpenAI API costs.

## [1.10.2] - 2026-05-23
### Added
- **Google Ads 30-Day Trend chart**: dual-axis `AreaChart` (Recharts) placed between the summary cards and the Campaigns/Keywords tables. Amber line + gradient for daily spend (฿, left Y-axis); blue line + gradient for daily clicks (right Y-axis) — independently scaled so both metrics are always visible.
- **New daily GAQL query** in `/api/ads/stats`: fetches `segments.date`, `metrics.impressions`, `metrics.clicks`, `metrics.cost_micros` from `customer` for `LAST_30_DAYS`, ordered by date ascending. Result stored in the `dailyTrend` field of the cached `AdsStats` document.
- **`AdsDailyPoint` type** added to `lib/google-ads.ts`; `AdsStats` extended with `dailyTrend: AdsDailyPoint[]`.

## [1.10.1] - 2026-05-23
### Changed
- **Analytics & Search Console**: replaced CSS spark-bar charts with Recharts `AreaChart` (gradient fill, axes, hover tooltip) matching the Reports page style.
- **Search Console daily trend**: dual Y-axis so impressions (left, sky blue) and clicks (right, rose) are independently scaled and both clearly visible.

## [1.10.0] - 2026-05-23
### Added
- **Google Search Console dashboard** (`/gsc`, manager-only): live 28-day search performance data pulled from GSC via the same GA4 service account — no additional credentials or OAuth flow required.
  - Summary cards: Total Clicks, Impressions, Avg CTR, Avg Position (colour-coded green/blue/amber/red).
  - Dual-bar daily trend chart — muted bars for impressions, primary bars for clicks on the same timeline.
  - Top Queries table: query text, clicks, impressions, CTR, colour-coded position badge.
  - Top Pages table: clean path display (origin stripped), clicks, impressions, CTR, position.
  - Devices panel (mobile/desktop/tablet) with click counts and percentage bars.
  - Top Countries with correct flag emojis and full country names (ISO 3166-1 alpha-3 → alpha-2 mapping for 50+ countries).
  - 24-hour Firestore cache (`venue-settings/gsc-stats-*`). Manual Refresh button forces live fetch.
  - Date range calculated at request time (real YYYY-MM-DD, not GA4-style relative strings; accounts for GSC's 2-day data lag).
- **New API route**: `/api/gsc/stats` — runs 6 GSC `searchAnalytics/query` calls in parallel via `Promise.all`.
- **New lib**: `lib/google-search-console.ts` — reuses `GA4_CLIENT_EMAIL` + `GA4_PRIVATE_KEY` with `webmasters.readonly` scope, REST query helper, all TypeScript types.
- **Sidebar**: "Search Console" entry (Search icon, manager-only) between Analytics and Calendar.
- **New env var** (add to `.env.local` and `apphosting.yaml` secrets): `GSC_SITE_URL=https://denzphuket.com/`.
- **AuditAction** union extended: `gsc.refresh`.

## [1.9.0] - 2026-05-23
### Added
- **Google Analytics dashboard** (`/analytics`, manager-only): live 30-day stats pulled from GA4 via service account — no OAuth consent flow required.
  - Summary cards: Sessions, Users, New Users, Page Views, Bounce Rate, Avg. Session Duration.
  - CSS spark bar chart showing daily sessions over the 30-day window.
  - Top Pages table (path, title, views, sessions, avg time on page).
  - Traffic Sources breakdown with colour-coded horizontal bars (Organic Search, Direct, Social, Paid, etc.).
  - Devices panel with icons (mobile, desktop, tablet) and percentage bars.
  - Top Countries list with flag emoji and session counts.
  - 24-hour Firestore cache (`venue-settings/ga4-stats-*`). Manual Refresh button forces a live fetch.
  - Auto-detects unconfigured state and shows exact env var names needed.
- **New API route**: `/api/analytics/stats` — runs 6 GA4 `runReport` calls in parallel via `Promise.all`.
- **New lib**: `lib/google-analytics.ts` — GA4 service account JWT auth, REST `runReport` helper, all TypeScript types (`GaStats`, `GaSummary`, `GaPageStat`, etc.).
- **Sidebar**: "Analytics" entry (LineChart icon, manager-only) between Google Ads and Calendar.
- **New env vars** (add to `.env.local` and `apphosting.yaml` secrets): `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY`, `GA4_PROPERTY_ID`.
- **AuditAction** union extended: `analytics.refresh`.

## [1.8.0] - 2026-05-23
### Added
- **Google Ads dashboard** (`/ads`, manager-only): view 30-day campaign performance, keyword stats, and AI-powered recommendations from within the POS.
  - OAuth2 connect flow (same Google Cloud app as Gmail, separate `adwords` scope and redirect URI).
  - Summary metric cards: Impressions, Clicks, CTR, Total Spend, Avg. CPC, Conversions, ROAS.
  - Campaign performance table with status badges.
  - Top keywords by spend with match-type chips.
  - Underperforming keywords panel (high spend + below-average CTR) highlighted in amber.
  - **AI Insights** powered by OpenAI `gpt-4o`: analyses campaign + keyword data and produces actionable Markdown recommendations (quick wins, keywords to pause, ad copy suggestions, bid adjustments, growth opportunities). Rendered with `react-markdown`.
  - 24-hour Firestore cache (`venue-settings/ads-stats-*`). Manual Refresh button forces a live fetch.
  - Customer auto-select for single-account users; picker UI for multi-account users.
  - Disconnect button to revoke stored tokens.
- **Settings → AI Settings section**: password-input for OpenAI API key, stored server-side in Firestore (`venue-settings/openai`). Displays masked key when configured.
- **New API routes**: `/api/ads/auth`, `/api/ads/callback`, `/api/ads/customers`, `/api/ads/select-customer`, `/api/ads/stats`, `/api/ads/insights`, `/api/ads/disconnect`, `/api/settings/openai`.
- **Sidebar**: "Google Ads" entry (TrendingUp icon, manager-only) between Inbox and Calendar.
- **New packages**: `google-ads-api` v23, `openai`, `react-markdown`.
- **New env vars** (add to `.env.local` and `apphosting.yaml` secrets): `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REDIRECT_URI`.
- **AuditAction** union extended: `ads.connect`, `ads.disconnect`, `ads.refresh`, `settings.openai`.

## [1.7.0] - 2026-05-23
### Added
- **Gmail Inbox page** (`/inbox`, manager-only): view and reply to the business Gmail account from within the POS. Uses Google OAuth2 + Gmail API with server-side Next.js API routes. OAuth refresh tokens are stored in Firestore (`venue-settings/gmail`). Email HTML bodies are sanitised with DOMPurify before rendering to prevent XSS. Requires Google Cloud setup and `.env.local` credentials — see implementation notes.

## [1.6.2] - 2026-05-21
### Fixed
- **Rooms page — future reservations showing as "Occupied"**: A room with a check-in date in the future was incorrectly shown as "Occupied" (amber badge). The page now shows three states: **Occupied** (guest has checked in today or earlier), **Reserved** (blue badge, future check-in), and **Available**. Reserved rooms display the guest name and check-in date with a "View Folio" button but no checkout button.

## [1.6.1] - 2026-05-20
### Fixed
- **Coworking board — multi-desk tabs**: Tabs with two or more desk line items (e.g. two people on one tab, each at a different space) now correctly mark all booked spaces as occupied. Previously only the first desk item was used, so the second space remained showing as available.

## [1.6.0] - 2026-05-20
### Added
- **Coworking space long description**: `SpaceDialog` in the Coworking tab now includes a rich-text (TipTap) "Full page description" field, stored as `longDescription` on `CoworkSpace`. This content is rendered on individual desk detail pages on the website.
- **`CoworkSpace.longDescription`**: Added optional `longDescription` field to the `CoworkSpace` type in `lib/types.ts`.

## [1.5.58] - 2026-05-20
### Fixed
- **App icon**: Replace default Next.js favicon.ico with Denz brand icon using app/icon.png convention.

## [1.5.57] - 2026-05-20
### Changed
- **App icon**: POS now uses the Denz brand icon matching the website favicon.

## [1.5.56] - 2026-05-20
### Added
- **Auto-create POS customers from web bookings**: When a new desk or room enquiry arrives from the website, the customer is automatically upserted into the POS customer database (deduped by email). This happens regardless of whether the booking is accepted or declined, so the customer's name, email, and phone are always available for marketing. Uses Firestore `docChanges()` to only act on genuinely new orders, not on every listener re-fire.

## [1.5.55] - 2026-05-20
### Added
- **New Tab dialog — auto-generated customer name**: A wand button next to the "Customer Name" label shows the next suggested name (e.g. "Customer 47"). Clicking it fills the name field without creating a customer record. Each use increments the counter (stored in localStorage) so subsequent tabs get unique names ("Customer 48", "Customer 49", etc.). The counter is based on total customers in the database plus a session offset, and "Save as new customer" is suppressed for auto-generated names.

## [1.5.54] - 2026-05-20
### Fixed
- **Dashboard — Away · May Return count inflated by yesterday's day passes**: Daily desk passes opened yesterday were still appearing in the "Away · May Return" list because the dashboard compared `bookingEndsAt > now` — under the old 24h logic, yesterday's pass still had a future expiry timestamp. The dashboard now mirrors the coworking page's logic exactly: a daily pass is active only if it was opened **today** (same calendar day). Passes from previous days are excluded regardless of their stored `bookingEndsAt`. Weekly/monthly/longer passes continue to use `bookingEndsAt` for expiry.

## [1.5.53] - 2026-05-20
### Fixed
- **Coworking — day pass expiry**: Daily desk passes now expire at the venue's configured closing time (e.g. 23:30) on the day of purchase, rather than 24 hours after purchase. A pass bought at 22:00 now expires at 23:30 the same day. The venue close time is read from Settings → Opening Hours for the relevant day of the week. Weekly, 2-week, monthly, and longer passes also snap to close-of-business on their final day. All booking paths are fixed: POS "Add Desk to Tab" dialog, Check-In dialog (already correct), web-order accept in POS, and Online Orders page.

## [1.5.52] - 2026-05-20
### Fixed
- **Dashboard — Away · May Return count inflated**: Expired desk bookings (those with a past `bookingEndsAt`) were still showing as "Away" because the legacy `paidAt + duration` fallback could override an already-expired `bookingEndsAt`. Fixed: if `bookingEndsAt` is present, it is now the authoritative source — the legacy fallback is only used for old tabs that never stored a `bookingEndsAt`.
- **Dashboard — Room 2 showing OCCUPIED with a July check-in**: Future room bookings (check-in date in the future) were counted as currently occupied. Added a distinction between `currentStays` (guest physically present, checkIn ≤ today) and `upcomingStays` (future bookings). Rooms with future bookings now show an **UPCOMING** badge (blue) with the check-in date, rather than OCCUPIED. The rooms stat card sub-text now reads "1 occupied · 1 upcoming" where applicable.

## [1.5.51] - 2026-05-20
### Changed
- **Calendar — room stay detail panel**: Clicking a room stay pill on the calendar no longer navigates to the Rooms page. Instead a slide-in detail panel opens (matching the coworking tab panel) showing guest name, room, check-in/check-out dates, nights, and folio line items. An "Open in Rooms" button is available at the bottom for cases where full room management is needed.

## [1.5.50] - 2026-05-20
### Fixed
- **POS — room booking missing from calendar**: Adding a room via the POS night picker (tap room card → set check-in date + nights) now creates a Stay record in addition to adding line items to the tab. Previously only the tab line items were saved, so the booking never appeared on the Calendar or Rooms page. The Stay links back to the same POS tab as its folio.

## [1.5.49] - 2026-05-20
### Fixed
- **Online Orders — delete blocked by Firestore rules**: The `website-orders` security rule only permitted `create`, `read`, and `update`. `delete` was missing, so the "Delete order" button was silently rejected by Firestore. Added `delete` to the authenticated staff permission so managers can permanently remove test or junk orders.

## [1.5.48] - 2026-05-20
### Fixed
- **Calendar — hourly bookings on wrong day**: A tab opened on Day 1 but paid on Day 2 (e.g. a long session that ran past midnight, or a running tab that accumulated items over multiple days) now shows its hourly desk booking on the payment day (`paidAt`) rather than the tab open day (`openedAt`). This matches when the session was actually used and charged.

## [1.5.47] - 2026-05-20
### Fixed
- **Calendar — coworking grid**: Creating a tab with type "Desk" (used to identify where a customer is sitting) no longer registers a desk booking on the calendar grid. A desk booking only appears on the calendar when a desk *product* is explicitly added as a line item — the tab type alone is not sufficient.

## [1.5.46] - 2026-05-20
### Fixed
- **Calendar — coworking grid dedup**: Improved deduplication to handle the case where a customer has two *paid* tabs covering the same space+day (e.g. a weekly desk pass and a separately-paid food/café tab). The previous fix only removed *open* tabs. Now the best tab per customer is kept by score: `type==='desk'` wins first (it is the actual desk booking), then paid beats open.

## [1.5.45] - 2026-05-20
### Changed
- **POS — room night picker**: Replaced native date input with a full month-grid calendar (matching the website's picker style). Check-in date label updates live as days are selected. Dialog widened to `max-w-md` to comfortably fit the calendar.

## [1.5.44] - 2026-05-20
### Added
- **POS — room night picker**: Tapping a room product card in the POS grid (with an active tab) now opens a night picker modal instead of adding qty:1 directly. Staff can set a check-in date and number of nights; the modal shows a live seasonal price breakdown. On confirm, per-season line items are added to the active tab (e.g. "Room 3 · Low Season × 1 night" + "Room 3 · High Season × 8 nights").

## [1.5.43] - 2026-05-19
### Added
- **Rooms — seasonal pricing in check-in dialog**: The check-in dialog now shows a live per-night seasonal price breakdown as dates are selected. Stays crossing a season boundary (e.g. Oct 31 → Nov 9) show each rate segment with its season name and sub-total. The folio pre-charge is split into separate line items per segment (e.g. "Room 3 · Low Season × 1 night" + "Room 3 · High Season × 8 nights") so the folio accurately reflects the seasonal charges.

## [1.5.42] - 2026-05-19
### Fixed
- **Calendar — coworking grid**: A customer with a paid weekly desk pass no longer appears twice on the same day when they also have an open tab for food/other purchases. Added deduplication in `coworkCellItems` — if a paid desk tab covers a space+day for a given customer name, any additional open tabs for the same customer are suppressed from that cell.

## [1.5.41] - 2026-05-19
### Added
- **Rooms — Gallery**: Room products now support up to 6 gallery images. Upload multiple photos at once via the new "Add photos" section in the room edit dialog. Thumbnails are shown in a 3-column grid with a remove button on hover. Images are downscaled to 600px / 0.75 quality and stored with the product in Firestore.

## [1.5.40] - 2026-05-18
### Changed
- **Rooms — Full page description** now uses a TipTap WYSIWYG editor. Text renders visually (bold looks bold, headings look like headings), Enter creates real line breaks, and the toolbar buttons show an active/highlighted state. Stores HTML output for direct rendering on the website.

## [1.5.39] - 2026-05-18
### Changed
- **Rooms — Full page description** now uses a markdown editor with a formatting toolbar. Buttons for H2, H3, Bold, Italic, and Bullet list wrap or prefix selected text with markdown syntax.

## [1.5.38] - 2026-05-18
### Added
- **Rooms** — "Full page description" textarea in the room edit dialog. Supports multi-paragraph text. Displayed on the room's individual page on the website.

## [1.5.37] - 2026-05-18
### Added
- **Rooms — Seasonal Pricing**: Room edit dialog now includes a Seasonal Pricing section. Add up to 4 named seasons (e.g. High Season, Low Season), each with a nightly price and a start/end date (month + day). Year-crossing seasons (e.g. Nov–Apr) are supported. The base `price` field remains as a year-round fallback when no season matches.
- **Rooms — Block website bookings**: New checkbox in the room edit dialog. When enabled, the room shows as "Unavailable" on the website with no Enquire button (e.g. during renovation). Independent of the occupied/stay status.

## [1.5.36] - 2026-05-18
### Changed
- **Firestore rules** — Added `stays` to the public-readable slices so the website Rooms page can read live occupancy from the POS (a room shows as Occupied whenever there is an active check-in).

## [1.5.35] - 2026-05-18
### Fixed
- **Firestore rules** — Added `products` to the public-readable slices, fixing missing menu items on the website Menu and Rooms pages (both read from the `products` slice which previously required auth).

## [1.5.34] - 2026-05-18
### Fixed
- **Firestore rules** — Allow public reads on `spaces`, `equipment`, and `tabs` slices so the Denz Website coworking page can load live pricing and availability. Previously all `/stores/` reads required auth, causing the page to silently fall back to only the two hardcoded fallback spaces (Hot Desk + Private Office).

## [1.5.33] - 2026-05-18
### Fixed
- **Firestore rules** — `website-orders` now allows public reads (`allow create, read: if true`) so the order status tracker on the website receives real-time updates when staff accept/decline a booking. Previously, unauthenticated readers got `permission-denied` on the `onSnapshot` listener, leaving the tracker stuck at "Order received · updating…".

## [1.5.32] - 2026-05-18
### Fixed
- **Firebase** — Added `firebase.json` so Firestore security rules can be deployed via CLI. Fixes website booking form returning "Something went wrong" because the `allow create: if true` rule for `website-orders` was never deployed after the v1.5.28 auth migration.

## [1.5.31] - 2026-05-15
### Changed
- **Cart header** — Country flag is now hidden by default and fades in only when hovering over the customer name row. Tooltip showing the country name still appears on hover of the flag itself.

## [1.5.30] - 2026-05-15
### Added
- **POS** — Each item in the cart now shows the time it was added (e.g. `· 14:32`) next to the price row. New items get an `addedAt` timestamp when first added to a tab; existing items without a timestamp show nothing.

## [1.5.29] - 2026-05-15
### Fixed
- **Auth** — First-time login bootstrap: when a Firebase account exists but no staff record is linked yet, the login flow now shows a "Set up your account" step (name + 4-digit PIN) and creates the first manager record automatically instead of showing an error.

## [1.5.28] - 2026-05-15
### Added
- **Auth** — Per-staff Firebase Auth (email + password). Each staff member now has a Firebase account; `LoginForm` replaces the old anonymous session on first load.
- **Auth** — PIN kept as idle-lock only. After Firebase sign-in, the device auto-locks after the configured idle timeout and shows a staff-specific `PinPad` (no staff picker — identity is already known from Firebase).
- **Settings → Staff** — "Add staff" now opens a dialog collecting name, role, email, initial password, and 4-digit PIN. Creates a Firebase Auth account via a secondary app instance (avoids signing out the current manager).
- **Settings → Staff** — "Reset Password" button (RefreshCw icon) sends a Firebase password-reset email to the staff member's email address.
- **Firestore rules** — `firestore.rules` file added. POS collections require `auth != null`; `website-orders` allows public `create` (customer bookings) but only authenticated reads/updates.

## [1.5.27] - 2026-05-15
### Fixed
- **Calendar** — Multi-hour bookings (e.g. "Private Office — Per Hour (2hr)") now correctly detect as hourly period. The `(2hr)` suffix was preventing the period lookup from matching, causing the paid-hourly anchor rule to silently skip and the booking to bleed into the next calendar day.

## [1.5.26] - 2026-05-15
### Fixed
- **Calendar** — Paid/refunded hourly bookings now anchor to the `openedAt` day only. Previously, `bookingEndsAt = payment_time + hours` caused the booking to bleed into the next calendar day; it is a billing sentinel, not a date range.
- **History** — Date correction delta now uses `paidAt` as the reference point (not `openedAt`), so editing a tab date correctly shifts `openedAt` and `bookingEndsAt` for future corrections.

## [1.5.25] - 2026-05-15
### Fixed
- **History / Calendar** — Correcting an order's date now also shifts `openedAt` and `bookingEndsAt` by the same delta, so desk bookings appear on the right day in the calendar grid (which uses `openedAt` for placement, not `paidAt`). Multi-day bookings (weekly, monthly) keep their original duration.

## [1.5.24] - 2026-05-15
### Added
- **History** — Managers can now correct the date and time of a past order. In edit mode, the Date/Time rows are replaced by a single datetime picker pre-filled with the current value. Saving writes the corrected timestamp to the order.

## [1.5.23] - 2026-05-15
### Added
- **History** — "Reopen in POS" button (manager-only, external-link icon) on the order detail panel. After confirmation, moves the tab back to Open Tabs (clearing payment info) and navigates directly to the POS with that tab selected, ready to add or change items. Re-paying the tab sends it back to history as normal.

## [1.5.22] - 2026-05-15
### Added
- **History** — Managers can now edit line items on past orders. In the order detail panel, clicking the edit (pencil) button shows qty +/− controls and a remove button next to each item. Totals update live as items are changed. Refunded items cannot be removed. At least one item must remain before saving.

## [1.5.21] - 2026-05-15
### Fixed
- **POS** — Desk hourly rate picker now calculates the total using tiered pricing (same `calcRentalTotal` logic as equipment), so spaces with per-hour volume tiers (e.g. Hour 1 = ฿200, Hour 2 = ฿190, …) show the correct price instead of a flat multiplication.

## [1.5.20] - 2026-05-15
### Changed
- **POS** — Selecting "Per Hour" in the desk rate picker now shows a second step with an hours stepper (same UX as equipment rental). Price is multiplied by hours and the line item name shows the duration (e.g. "Private Office — Per Hour (3hr)"). Non-hourly rates (Daily, Weekly, etc.) add to the tab immediately as before. Back button returns to rate selection.

## [1.5.19] - 2026-05-15
### Changed
- **Calendar** — Clicking a tab pill (grid or list view) now opens an inline side panel with item breakdown, total, discount, and payment info instead of redirecting to another page. A "View in History" / "Open in POS" link is available in the panel footer for full access.

## [1.5.18] - 2026-05-15
### Fixed
- **Calendar** — Multi-seat desk bookings (qty > 1 on a single line item) now show one pill per occupied seat in the grid view, so a customer booking 2 "No Desk" spots appears twice in that space's row.

## [1.5.17] - 2026-05-15
### Fixed
- **Dashboard / Reports** — Crash ("e.rates is not iterable") when spaces in localStorage predate the rates field. Added defensive `?? []` guards on space rate iteration.

## [1.5.16] - 2026-05-14
### Added
- **Equipment** — "Cost per hour" field in the equipment editor (manager-only). The total cost (costPerHour × hours booked) is baked into the line item snapshot at booking time, so gross profit calculations in Reports and Dashboard automatically include equipment rental costs.

## [1.5.15] - 2026-05-14
### Added
- **CoWorking** — Cost price field per rate period (manager-only) in the space editor, for both hot desk and dedicated desk rates. Cost shows inline next to the price input in teal.
- **Rooms** — "Cost per night" field in the room editor (manager-only).
- **Dashboard / Reports** — Gross profit cards and COGS calculations now include desk and room cost prices, not just cafe/food products.

## [1.5.14] - 2026-05-14
### Fixed
- **Dashboard / Reports** — Gross profit, COGS, and margin now correctly appear for historical sales. Line item snapshots don't carry cost data when cost was set after the sale; both pages now fall back to the current product cost so all existing data is included.

## [1.5.13] - 2026-05-14
### Added
- **Dashboard** — "Gross Profit today" stat card (manager-only) showing revenue minus COGS and margin %, appears when any sold item has a cost price set.
- **Reports** — "By Area" section now shows COGS and gross margin % per area (Cafe/CoWorking/Rooms) when cost data is available.
- **Reports** — New "Top Items by Profit" section sorted by gross profit (revenue − COGS), showing margin % and profit per item.

## [1.5.12] - 2026-05-14
### Added
- **Menu** — Stock filter chips: "Low stock" (amber) and "Out of stock" (rose) show badge counts and filter the list to only those items.

## [1.5.11] - 2026-05-14
### Added
- **Menu** — Profit per item now shown alongside cost price for managers: "+฿X.XX (Y%)" in green, or negative in red.

## [1.5.10] - 2026-05-14
### Added
- **Menu** — Cost price is now visible on each menu item row for managers (shown in teal, "cost £X.XX"; dash for items without a cost set).

## [1.5.9] - 2026-05-14
### Added
- **Reports** — Gross Profit card shows when any menu item has a cost price set: displays total gross profit and overall margin % for items with cost data.
- **Reports** — Top Items now shows a margin % badge per item where cost data is available.
### Changed
- **Menu** — Cost price toggle and Low-stock alert threshold are now hidden from non-manager staff. Non-managers can still update stock counts but cannot see cost prices or alert thresholds.

## [1.5.8] - 2026-05-14
### Added
- **History page** — Managers can now edit a paid order's customer name, label, and payment method via a new pencil icon in the order detail panel footer.
- **History page** — Managers can link any unlinked order to a customer profile via a new "Link to customer profile" section in the order detail. Supports searching existing customers or creating a new customer record from the tab name.

## [1.5.7] - 2026-05-14
### Fixed
- **Firestore sync** — Paid tabs reverting to unpaid seconds after payment. Root cause: full-document `setDoc` writes with no locking meant a stale write from another open device/tab could overwrite a newer local write. Fix: every Firestore write now includes a `writtenAt` timestamp; incoming snapshots are rejected if their `writtenAt` is older than the last local write, preventing stale remote data from overwriting recent changes.

## [1.5.6] - 2026-05-14
### Added
- **Bills** — "Paid By" field on bills: select JD or Sasinee (or leave blank) when adding/editing a bill. Payer badge appears on each row. Per-payer totals (JD vs Sasinee) shown in the summary banner. Filter chips to view bills by payer.

## [1.5.5] - 2026-05-14
### Fixed
- **POS** — Added missing "Desserts" category chip to the POS product grid filter bar. Dessert products were stored correctly but had no dedicated tab to filter by, making them hard to find. They now appear under both "All" and the new "Desserts" chip.

## [1.5.4] - 2026-05-14
### Fixed
- **POS** — Incrementing/decrementing an equipment rental or hourly desk line item in the cart now follows tiered hourly pricing. The + button adds 1 hour (recalculating from tiers), the − button removes 1 hour, and the name updates (e.g. "Mac Mini (2hr)", "Private Office (3hr)"). Applies to both Equipment-tab items and desk items where the space has a matching equipment entry with tiers.

## [1.5.3] - 2026-05-13
### Fixed
- **POS** — Equipment rentals now appear in the product grid. An "Equipment" category chip is added to the filter bar. Tapping an equipment card with an active tab opens a hours-picker dialog with live tiered-price total; confirming adds a line item (e.g. "Camera (2hr)") to the tab. Equipment also appears when "All" is selected.

## [1.5.2] - 2026-05-13
### Fixed
- **Calendar** — room stay pills (violet) are now clickable. Tapping one navigates to the Rooms page with that stay's folio opened automatically. Works in both Grid and List views.

## [1.5.1] - 2026-05-13
### Added
- **Calendar** — unpaid/open desk tabs now appear in orange, paid tabs remain blue. Grid pills, list card borders, icons, and badges all reflect the payment status. Legend updated with "Pending payment" and "Paid booking" entries.

## [1.5.0] - 2026-05-13
### Added
- **Calendar** — clicking a blue POS booking pill now navigates directly to the relevant page with that tab pre-selected: open tabs open the Tabs page with the tab active; paid/historical tabs open the History page with the receipt visible. Works in both Grid and List views.

## [1.4.9] - 2026-05-13
### Fixed
- **Calendar** — historical desk bookings now appear when navigating to past weeks. Previously only tabs with a future end date were included; now all paid desk tabs with a resolvable booking period are shown, and `tabCoversDay` handles the date-range matching per cell.

## [1.4.8] - 2026-05-13
### Fixed
- **Tabs sidebar** — pending online booking cards now show the space name (e.g. "Standup + 27"") instead of the raw internal space ID.

## [1.4.7] - 2026-05-13
### Added
- **Calendar** — clicking a pending (amber) order pill now navigates directly to the Online Orders page with that order pre-selected and the Pending filter active, so you can review and approve/decline without hunting for it manually.

## [1.4.6] - 2026-05-13
### Fixed
- **Calendar** — weekly desk bookings now display as exactly 5 open (working) days from the start date, rather than 7 raw calendar days. Previously a Monday weekly pass would bleed into the following Monday (the 6th visible day). The calendar now counts forward 5 non-closed days based on the venue's opening hours settings.

## [1.4.5] - 2026-05-13
### Fixed
- **Calendar** — daily desk bookings no longer bleed into the following calendar day. A paid daily tab with `bookingEndsAt` a few hours into the next day would previously show on both days. Now uses calendar-day comparison against `openedAt` for daily-period tabs, consistent with how the coworking page handles daily sessions.

## [1.4.4] - 2026-05-13
### Changed
- **Calendar** — desk/coworking bookings now respect opening hours from Settings. Days marked as closed (e.g. Saturday, Sunday) show a greyed-out "Closed" state in the grid and a "(Coworking closed)" label in the list view — no desk bookings shown on those days. Room bookings are unaffected and always shown (guesthouse is 24/7).

## [1.4.3] - 2026-05-13
### Fixed
- **Calendar** — paid desk tabs with an active booking period now appear (e.g. a weekly hot desk that has been paid but hasn't expired). Mirrors the coworking page's "Away · May Return" logic: infers booking expiry from `paidAt + period duration` when no explicit `bookingEndsAt` is stored.

## [1.4.2] - 2026-05-13
### Fixed
- **Calendar** — now shows desk bookings created by adding a desk item to any tab (e.g. a café tab with a desk added from the POS), not just tabs with `type === 'desk'`. Space matching also checks line item product names so tabs without a matching label still appear in the correct space row.

## [1.4.1] - 2026-05-13
### Fixed
- **Calendar** — POS desk tabs (created via the Tabs page) now appear on the calendar alongside web orders. Blue pill = POS booking, showing customer name and booking end date. Accepted web orders are deduplicated so they don't double-show once a tab exists.

## [1.4.0] - 2026-05-13
### Added
- **Calendar page** (`/calendar`) — manager-only overview of all coworking and room bookings for the week. Two switchable views:
  - **Grid view**: spaces and rooms as rows, Mon–Sun as columns; accepted bookings show as green pills, pending as amber, room stays as violet.
  - **List view**: diary-style cards grouped by day, showing space/room, period, and start date.
- Week navigation with ← → arrows and a Today button.
- Firestore listener pulls accepted + pending web orders with a `bookingDate`; room stays from local store.
- `CalendarDays` icon added to sidebar and mobile nav (manager-only, after Online Orders).

## [1.3.1] - 2026-05-13
### Added
- **Delete online order** — a "Delete order" button now appears at the bottom of the order detail panel on the Online Orders page. Requires confirmation before permanently removing the record from Firestore.

## [1.3.0] - 2026-05-13
### Added
- **Online Orders page** (`/online-orders`) — manager-only overview of all orders placed through the Denz website. Shows every order (pending, accepted, declined) grouped by date with real-time Firestore updates. Features: search by customer name, status filter (All / Pending / Accepted / Declined), type filter (All / Café / Desk / Room), stats pills in the header, and a detail panel showing full order info. Pending orders can be accepted or declined directly from the detail panel — accepting creates the appropriate tab automatically. Completed orders show a read-only status banner.
- Added "Online Orders" nav item to sidebar and "Orders" to mobile bottom bar (manager-only).

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
