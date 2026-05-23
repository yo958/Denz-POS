import { type NextRequest, NextResponse } from 'next/server';
import {
  GSC_CACHE_DOC_PATH,
  CACHE_TTL_MS,
  getGscAccessToken,
  gscQuery,
  type GscStats,
  type GscSummary,
  type GscQueryStat,
  type GscPageStat,
  type GscCountryStat,
  type GscDeviceStat,
  type GscDailyPoint,
} from '@/lib/google-search-console';
import { getAdminDb } from '@/lib/firebase-admin';

/** GSC API requires YYYY-MM-DD strings (no relative dates like GA4). */
function gscDateRange(days = 28) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt  = (d: Date)  => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const end  = new Date(); end.setDate(end.getDate() - 2);   // 2-day data lag
  const start = new Date(end); start.setDate(start.getDate() - (days - 1));
  return { startDate: fmt(start), endDate: fmt(end) };
}
const DATE_RANGE = gscDateRange(28);

export async function GET(request: NextRequest) {
  // ── Config check ───────────────────────────────────────────────────────────
  const siteUrl = process.env.GSC_SITE_URL;
  if (!process.env.GA4_CLIENT_EMAIL || !process.env.GA4_PRIVATE_KEY || !siteUrl) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  // ── Cache check ────────────────────────────────────────────────────────────
  if (!forceRefresh) {
    const cacheDoc = await getAdminDb().doc(GSC_CACHE_DOC_PATH).get();
    if (cacheDoc.exists) {
      const cached    = cacheDoc.data()!;
      const fetchedAt = new Date(cached.fetchedAt as string).getTime();
      if (Date.now() - fetchedAt < CACHE_TTL_MS) {
        return NextResponse.json({ stats: cached as GscStats, fromCache: true });
      }
    }
  }

  // ── Fresh fetch ────────────────────────────────────────────────────────────
  try {
    const token = await getGscAccessToken();

    const [summaryRes, queriesRes, pagesRes, countriesRes, devicesRes, trendRes] =
      await Promise.all([
        // 1. Overall summary (no dimensions)
        gscQuery(siteUrl, token, {
          startDate: DATE_RANGE.startDate,
          endDate:   DATE_RANGE.endDate,
        }),

        // 2. Top queries
        gscQuery(siteUrl, token, {
          startDate:  DATE_RANGE.startDate,
          endDate:    DATE_RANGE.endDate,
          dimensions: ['query'],
          rowLimit:   20,
        }),

        // 3. Top pages
        gscQuery(siteUrl, token, {
          startDate:  DATE_RANGE.startDate,
          endDate:    DATE_RANGE.endDate,
          dimensions: ['page'],
          rowLimit:   10,
        }),

        // 4. Countries
        gscQuery(siteUrl, token, {
          startDate:  DATE_RANGE.startDate,
          endDate:    DATE_RANGE.endDate,
          dimensions: ['country'],
          rowLimit:   10,
        }),

        // 5. Devices
        gscQuery(siteUrl, token, {
          startDate:  DATE_RANGE.startDate,
          endDate:    DATE_RANGE.endDate,
          dimensions: ['device'],
        }),

        // 6. Daily trend
        gscQuery(siteUrl, token, {
          startDate:  DATE_RANGE.startDate,
          endDate:    DATE_RANGE.endDate,
          dimensions: ['date'],
        }),
      ]);

    // ── Parse summary ────────────────────────────────────────────────────────
    const sumRow = summaryRes.rows?.[0];
    const summary: GscSummary = {
      clicks:      sumRow?.clicks      ?? 0,
      impressions: sumRow?.impressions ?? 0,
      ctr:         sumRow?.ctr         ?? 0,
      position:    sumRow?.position    ?? 0,
    };

    // ── Parse top queries ────────────────────────────────────────────────────
    const topQueries: GscQueryStat[] = (queriesRes.rows ?? [])
      .sort((a, b) => b.clicks - a.clicks)
      .map(row => ({
        query:       row.keys[0] ?? '',
        clicks:      row.clicks,
        impressions: row.impressions,
        ctr:         row.ctr,
        position:    row.position,
      }));

    // ── Parse top pages ──────────────────────────────────────────────────────
    const topPages: GscPageStat[] = (pagesRes.rows ?? [])
      .sort((a, b) => b.clicks - a.clicks)
      .map(row => ({
        page:        row.keys[0] ?? '',
        clicks:      row.clicks,
        impressions: row.impressions,
        ctr:         row.ctr,
        position:    row.position,
      }));

    // ── Parse countries ──────────────────────────────────────────────────────
    const countries: GscCountryStat[] = (countriesRes.rows ?? [])
      .sort((a, b) => b.clicks - a.clicks)
      .map(row => ({
        country:     row.keys[0] ?? '',
        clicks:      row.clicks,
        impressions: row.impressions,
        ctr:         row.ctr,
        position:    row.position,
      }));

    // ── Parse devices ────────────────────────────────────────────────────────
    const devices: GscDeviceStat[] = (devicesRes.rows ?? [])
      .sort((a, b) => b.clicks - a.clicks)
      .map(row => ({
        device:      row.keys[0] ?? '',
        clicks:      row.clicks,
        impressions: row.impressions,
        ctr:         row.ctr,
        position:    row.position,
      }));

    // ── Parse daily trend ────────────────────────────────────────────────────
    const dailyTrend: GscDailyPoint[] = (trendRes.rows ?? [])
      .sort((a, b) => a.keys[0].localeCompare(b.keys[0]))
      .map(row => ({
        date:        row.keys[0] ?? '',
        clicks:      row.clicks,
        impressions: row.impressions,
      }));

    const stats: GscStats = {
      summary,
      topQueries,
      topPages,
      countries,
      devices,
      dailyTrend,
      siteUrl,
      fetchedAt: new Date().toISOString(),
    };

    // Cache to Firestore
    await getAdminDb().doc(GSC_CACHE_DOC_PATH).set(stats);

    return NextResponse.json({ stats, fromCache: false });
  } catch (e: unknown) {
    console.error('[gsc/stats] error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'fetch_failed', message }, { status: 500 });
  }
}
