import { google } from 'googleapis';

// ── Paths ────────────────────────────────────────────────────────────────────
const suffix = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
export const GSC_CACHE_DOC_PATH = `venue-settings/gsc-stats-${suffix}`;

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Auth — reuses GA4 service account with webmasters scope ──────────────────
export async function getGscAccessToken(): Promise<string> {
  const privateKey = (process.env.GA4_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email:  process.env.GA4_CLIENT_EMAIL,
    key:    privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('Failed to get GSC access token');
  return token;
}

// ── REST helper ───────────────────────────────────────────────────────────────
export async function gscQuery(
  siteUrl: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<GscQueryResponse> {
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC query failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<GscQueryResponse>;
}

// ── Response types ────────────────────────────────────────────────────────────
export interface GscQueryResponse {
  rows?: Array<{
    keys:        string[];
    clicks:      number;
    impressions: number;
    ctr:         number;   // 0-1
    position:    number;
  }>;
  responseAggregationType?: string;
}

// ── Stats types ───────────────────────────────────────────────────────────────
export interface GscSummary {
  clicks:      number;
  impressions: number;
  ctr:         number;   // 0-1
  position:    number;   // avg position (lower = better)
}

export interface GscQueryStat {
  query:       string;
  clicks:      number;
  impressions: number;
  ctr:         number;
  position:    number;
}

export interface GscPageStat {
  page:        string;
  clicks:      number;
  impressions: number;
  ctr:         number;
  position:    number;
}

export interface GscCountryStat {
  country:     string;
  clicks:      number;
  impressions: number;
  ctr:         number;
  position:    number;
}

export interface GscDeviceStat {
  device:      string;
  clicks:      number;
  impressions: number;
  ctr:         number;
  position:    number;
}

export interface GscDailyPoint {
  date:        string;  // YYYY-MM-DD
  clicks:      number;
  impressions: number;
}

export interface GscStats {
  summary:    GscSummary;
  topQueries: GscQueryStat[];
  topPages:   GscPageStat[];
  countries:  GscCountryStat[];
  devices:    GscDeviceStat[];
  dailyTrend: GscDailyPoint[];
  siteUrl:    string;
  fetchedAt:  string;
}
