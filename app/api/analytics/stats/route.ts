import { type NextRequest, NextResponse } from 'next/server';
import {
  GA_CACHE_DOC_PATH,
  CACHE_TTL_MS,
  getGa4AccessToken,
  ga4RunReport,
  parseRow,
  type GaStats,
  type GaSummary,
  type GaPageStat,
  type GaChannelStat,
  type GaDeviceStat,
  type GaCountryStat,
  type GaDailyPoint,
} from '@/lib/google-analytics';
import { getAdminDb } from '@/lib/firebase-admin';

const DATE_RANGE = [{ startDate: '30daysAgo', endDate: 'today' }];

export async function GET(request: NextRequest) {
  // ── Config check ───────────────────────────────────────────────────────────
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!process.env.GA4_CLIENT_EMAIL || !process.env.GA4_PRIVATE_KEY || !propertyId) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  // ── Cache check ────────────────────────────────────────────────────────────
  if (!forceRefresh) {
    const cacheDoc = await getAdminDb().doc(GA_CACHE_DOC_PATH).get();
    if (cacheDoc.exists) {
      const cached    = cacheDoc.data()!;
      const fetchedAt = new Date(cached.fetchedAt as string).getTime();
      if (Date.now() - fetchedAt < CACHE_TTL_MS) {
        return NextResponse.json({ stats: cached as GaStats, fromCache: true });
      }
    }
  }

  // ── Fresh fetch ────────────────────────────────────────────────────────────
  try {
    const token = await getGa4AccessToken();

    // Run all reports in parallel
    const [summaryRes, pagesRes, channelsRes, devicesRes, countriesRes, trendRes] =
      await Promise.all([
        // 1. Account summary
        ga4RunReport(propertyId, token, {
          dateRanges: DATE_RANGE,
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
          ],
        }),

        // 2. Top pages
        ga4RunReport(propertyId, token, {
          dateRanges: DATE_RANGE,
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'sessions' },
            { name: 'averageSessionDuration' },
          ],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10,
        }),

        // 3. Traffic channels
        ga4RunReport(propertyId, token, {
          dateRanges: DATE_RANGE,
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        }),

        // 4. Devices
        ga4RunReport(propertyId, token, {
          dateRanges: DATE_RANGE,
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        }),

        // 5. Countries
        ga4RunReport(propertyId, token, {
          dateRanges: DATE_RANGE,
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        }),

        // 6. Daily trend
        ga4RunReport(propertyId, token, {
          dateRanges: DATE_RANGE,
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
      ]);

    // ── Parse summary ────────────────────────────────────────────────────────
    const sumMetrics = ['sessions', 'activeUsers', 'newUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration'];
    const sumRow = summaryRes.rows?.[0];
    const sumParsed = sumRow
      ? parseRow(sumRow, [], sumMetrics)
      : {} as Record<string, number>;

    const summary: GaSummary = {
      sessions:           Number(sumParsed.sessions)           || 0,
      users:              Number(sumParsed.activeUsers)         || 0,
      newUsers:           Number(sumParsed.newUsers)            || 0,
      pageViews:          Number(sumParsed.screenPageViews)     || 0,
      bounceRate:         Number(sumParsed.bounceRate)          || 0,
      avgSessionDuration: Number(sumParsed.averageSessionDuration) || 0,
    };

    // ── Parse top pages ──────────────────────────────────────────────────────
    const pageDims = ['pagePath', 'pageTitle'];
    const pageMets = ['screenPageViews', 'sessions', 'averageSessionDuration'];
    const topPages: GaPageStat[] = (pagesRes.rows ?? []).map(row => {
      const p = parseRow(row, pageDims, pageMets);
      return {
        path:       String(p.pagePath),
        title:      String(p.pageTitle),
        pageViews:  Number(p.screenPageViews)      || 0,
        sessions:   Number(p.sessions)             || 0,
        avgTimeSec: Number(p.averageSessionDuration) || 0,
      };
    });

    // ── Parse channels ───────────────────────────────────────────────────────
    const totalSessions = summary.sessions || 1;
    const chanDims = ['sessionDefaultChannelGroup'];
    const chanMets = ['sessions', 'activeUsers'];
    const channels: GaChannelStat[] = (channelsRes.rows ?? []).map(row => {
      const c = parseRow(row, chanDims, chanMets);
      const sess = Number(c.sessions) || 0;
      return {
        channel:  String(c.sessionDefaultChannelGroup),
        sessions: sess,
        users:    Number(c.activeUsers) || 0,
        pct:      sess / totalSessions,
      };
    });

    // ── Parse devices ────────────────────────────────────────────────────────
    const devDims = ['deviceCategory'];
    const devMets = ['sessions'];
    const devices: GaDeviceStat[] = (devicesRes.rows ?? []).map(row => {
      const d = parseRow(row, devDims, devMets);
      const sess = Number(d.sessions) || 0;
      return {
        device:   String(d.deviceCategory),
        sessions: sess,
        pct:      sess / totalSessions,
      };
    });

    // ── Parse countries ──────────────────────────────────────────────────────
    const ctryDims = ['country'];
    const ctryMets = ['sessions'];
    const countries: GaCountryStat[] = (countriesRes.rows ?? []).map(row => {
      const c = parseRow(row, ctryDims, ctryMets);
      const sess = Number(c.sessions) || 0;
      return {
        country:  String(c.country),
        sessions: sess,
        pct:      sess / totalSessions,
      };
    });

    // ── Parse daily trend ────────────────────────────────────────────────────
    const trendDims = ['date'];
    const trendMets = ['sessions'];
    const dailyTrend: GaDailyPoint[] = (trendRes.rows ?? []).map(row => {
      const t = parseRow(row, trendDims, trendMets);
      return {
        date:     String(t.date),
        sessions: Number(t.sessions) || 0,
      };
    });

    const stats: GaStats = {
      summary,
      topPages,
      channels,
      devices,
      countries,
      dailyTrend,
      propertyId,
      fetchedAt: new Date().toISOString(),
    };

    // Cache to Firestore
    await getAdminDb().doc(GA_CACHE_DOC_PATH).set(stats);

    return NextResponse.json({ stats, fromCache: false });
  } catch (e: unknown) {
    console.error('[analytics/stats] error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'fetch_failed', message }, { status: 500 });
  }
}
