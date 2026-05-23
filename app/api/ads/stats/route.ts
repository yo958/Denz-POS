import { type NextRequest, NextResponse } from 'next/server';
import {
  makeAdsApiClient,
  ADS_TOKEN_DOC_PATH,
  ADS_CACHE_DOC_PATH,
  type AdsStats,
  type AdsSummary,
  type AdsCampaign,
  type AdsKeyword,
} from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  const tokenDoc = await getAdminDb().doc(ADS_TOKEN_DOC_PATH).get();
  if (!tokenDoc.exists) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const td = tokenDoc.data()!;
  const customerId    = td.customerId as string;
  const refreshToken  = td.refreshToken as string;

  if (!customerId) {
    return NextResponse.json({ error: 'no_customer' }, { status: 400 });
  }

  // ── Cache check ────────────────────────────────────────────────────────────
  if (!forceRefresh) {
    const cacheDoc = await getAdminDb().doc(ADS_CACHE_DOC_PATH).get();
    if (cacheDoc.exists) {
      const cached = cacheDoc.data()!;
      const fetchedAt = new Date(cached.fetchedAt as string).getTime();
      if (Date.now() - fetchedAt < CACHE_TTL_MS) {
        return NextResponse.json({ stats: cached as AdsStats, fromCache: true });
      }
    }
  }

  // ── Fetch fresh data ───────────────────────────────────────────────────────
  try {
    const adsClient = makeAdsApiClient();
    const customer  = adsClient.Customer({ customer_id: customerId, refresh_token: refreshToken });

    // Account summary
    const summaryRows = await customer.query(`
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date DURING LAST_30_DAYS
    `);

    const sumRow = summaryRows[0] ?? {};
    const m = (sumRow as { metrics?: Record<string, number> }).metrics ?? {};
    const totalCost  = (m.cost_micros           ?? 0) / 1_000_000;
    const totalAvgCpc = (m.average_cpc          ?? 0) / 1_000_000;
    const convValue   = m.conversions_value      ?? 0;
    const summary: AdsSummary = {
      impressions:      m.impressions       ?? 0,
      clicks:           m.clicks            ?? 0,
      ctr:              m.ctr               ?? 0,
      cost:             totalCost,
      averageCpc:       totalAvgCpc,
      conversions:      m.conversions       ?? 0,
      conversionsValue: convValue,
      roas:             totalCost > 0 ? convValue / totalCost : 0,
    };

    // Campaigns
    const campaignRows = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
        AND campaign.status IN ('ENABLED', 'PAUSED')
      ORDER BY metrics.cost_micros DESC
      LIMIT 15
    `);

    const campaigns: AdsCampaign[] = campaignRows.map(row => {
      const r = row as {
        campaign?: { id?: string; name?: string; status?: string };
        metrics?:  { impressions?: number; clicks?: number; ctr?: number; cost_micros?: number; conversions?: number };
      };
      return {
        id:          String(r.campaign?.id ?? ''),
        name:        r.campaign?.name ?? 'Unknown',
        status:      r.campaign?.status ?? 'UNKNOWN',
        impressions: r.metrics?.impressions  ?? 0,
        clicks:      r.metrics?.clicks       ?? 0,
        ctr:         r.metrics?.ctr          ?? 0,
        cost:        (r.metrics?.cost_micros ?? 0) / 1_000_000,
        conversions: r.metrics?.conversions  ?? 0,
      };
    });

    // Keywords (top by spend)
    const keywordRows = await customer.query(`
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group.name,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros,
        metrics.conversions
      FROM keyword_view
      WHERE segments.date DURING LAST_30_DAYS
        AND ad_group_criterion.status != 'REMOVED'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 30
    `);

    const allKeywords: AdsKeyword[] = keywordRows.map(row => {
      const r = row as {
        ad_group_criterion?: { keyword?: { text?: string; match_type?: string } };
        ad_group?: { name?: string };
        campaign?: { name?: string };
        metrics?: { impressions?: number; clicks?: number; ctr?: number; cost_micros?: number; conversions?: number };
      };
      return {
        text:        r.ad_group_criterion?.keyword?.text      ?? '',
        matchType:   String(r.ad_group_criterion?.keyword?.match_type ?? ''),
        campaign:    r.campaign?.name   ?? '',
        adGroup:     r.ad_group?.name   ?? '',
        impressions: r.metrics?.impressions  ?? 0,
        clicks:      r.metrics?.clicks       ?? 0,
        ctr:         r.metrics?.ctr          ?? 0,
        cost:        (r.metrics?.cost_micros ?? 0) / 1_000_000,
        conversions: r.metrics?.conversions  ?? 0,
      };
    });

    const avgCtr = summary.clicks > 0 ? summary.clicks / summary.impressions : 0;
    const topKeywords    = allKeywords.slice(0, 10);
    const lowCtrKeywords = allKeywords
      .filter(k => k.cost > 0 && k.ctr < avgCtr && k.impressions >= 50)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const stats: AdsStats = {
      summary,
      campaigns,
      topKeywords,
      lowCtrKeywords,
      customerId,
      fetchedAt: new Date().toISOString(),
    };

    // Cache to Firestore
    await getAdminDb().doc(ADS_CACHE_DOC_PATH).set(stats);

    return NextResponse.json({ stats, fromCache: false });
  } catch (e: unknown) {
    console.error('[ads/stats] fetch error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'fetch_failed', message }, { status: 500 });
  }
}
