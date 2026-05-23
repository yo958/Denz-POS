import { type NextRequest, NextResponse } from 'next/server';
import {
  ADS_TOKEN_DOC_PATH,
  ADS_CACHE_DOC_PATH,
  getAdsAccessToken,
  adsSearch,
  micros,
  int64,
  float64,
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

  const td         = tokenDoc.data()!;
  const customerId = td.customerId as string;

  if (!customerId) {
    return NextResponse.json({ error: 'no_customer' }, { status: 400 });
  }

  // ── Cache check ────────────────────────────────────────────────────────────
  if (!forceRefresh) {
    const cacheDoc = await getAdminDb().doc(ADS_CACHE_DOC_PATH).get();
    if (cacheDoc.exists) {
      const cached    = cacheDoc.data()!;
      const fetchedAt = new Date(cached.fetchedAt as string).getTime();
      if (Date.now() - fetchedAt < CACHE_TTL_MS) {
        return NextResponse.json({ stats: cached as AdsStats, fromCache: true });
      }
    }
  }

  // ── Fresh fetch ────────────────────────────────────────────────────────────
  try {
    const accessToken = await getAdsAccessToken({
      refreshToken: td.refreshToken as string,
      accessToken:  td.accessToken  as string,
      expiryDate:   td.expiryDate   as number,
    });

    // ── Account summary ────────────────────────────────────────────────────
    // REST API returns int64 metrics as strings, doubles as numbers
    const summaryRows = await adsSearch(customerId, accessToken, `
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

    // REST response: row.metrics.impressions, row.metrics.costMicros (camelCase)
    const sm  = (summaryRows[0] as { metrics?: Record<string, unknown> })?.metrics ?? {};
    const totalCost  = micros(sm.costMicros);
    const convValue  = float64(sm.conversionsValue);
    const summary: AdsSummary = {
      impressions:      int64(sm.impressions),
      clicks:           int64(sm.clicks),
      ctr:              float64(sm.ctr),
      cost:             totalCost,
      averageCpc:       micros(sm.averageCpc),
      conversions:      float64(sm.conversions),
      conversionsValue: convValue,
      roas:             totalCost > 0 ? convValue / totalCost : 0,
    };

    // ── Campaigns ──────────────────────────────────────────────────────────
    const campaignRows = await adsSearch(customerId, accessToken, `
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
        metrics?:  Record<string, unknown>;
      };
      return {
        id:          String(r.campaign?.id ?? ''),
        name:        r.campaign?.name   ?? 'Unknown',
        status:      r.campaign?.status ?? 'UNKNOWN',
        impressions: int64(r.metrics?.impressions),
        clicks:      int64(r.metrics?.clicks),
        ctr:         float64(r.metrics?.ctr),
        cost:        micros(r.metrics?.costMicros),
        conversions: float64(r.metrics?.conversions),
      };
    });

    // ── Keywords ──────────────────────────────────────────────────────────
    // In REST responses, field segments snake_case → camelCase:
    //   ad_group_criterion → adGroupCriterion
    //   ad_group          → adGroup
    const keywordRows = await adsSearch(customerId, accessToken, `
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
        adGroupCriterion?: { keyword?: { text?: string; matchType?: string } };
        adGroup?:          { name?: string };
        campaign?:         { name?: string };
        metrics?:          Record<string, unknown>;
      };
      return {
        text:        r.adGroupCriterion?.keyword?.text      ?? '',
        matchType:   String(r.adGroupCriterion?.keyword?.matchType ?? 'BROAD'),
        campaign:    r.campaign?.name   ?? '',
        adGroup:     r.adGroup?.name    ?? '',
        impressions: int64(r.metrics?.impressions),
        clicks:      int64(r.metrics?.clicks),
        ctr:         float64(r.metrics?.ctr),
        cost:        micros(r.metrics?.costMicros),
        conversions: float64(r.metrics?.conversions),
      };
    });

    const avgCtr       = summary.impressions > 0 ? summary.clicks / summary.impressions : 0;
    const topKeywords  = allKeywords.slice(0, 10);
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

    await getAdminDb().doc(ADS_CACHE_DOC_PATH).set(stats);

    return NextResponse.json({ stats, fromCache: false });
  } catch (e: unknown) {
    console.error('[ads/stats] fetch error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'fetch_failed', message }, { status: 500 });
  }
}
