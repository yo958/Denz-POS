import { google } from 'googleapis';

// ── Paths ────────────────────────────────────────────────────────────────────
const suffix = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
export const GA_CACHE_DOC_PATH = `venue-settings/ga4-stats-${suffix}`;

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Auth ─────────────────────────────────────────────────────────────────────
/** Returns a fresh access token using the GA4 service account. */
export async function getGa4AccessToken(): Promise<string> {
  const privateKey = (process.env.GA4_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email:  process.env.GA4_CLIENT_EMAIL,
    key:    privateKey,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('Failed to get GA4 access token');
  return token;
}

// ── REST helper ───────────────────────────────────────────────────────────────
export async function ga4RunReport(
  propertyId: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Ga4ReportResponse> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
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
    throw new Error(`GA4 runReport failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<Ga4ReportResponse>;
}

// ── GA4 response types ────────────────────────────────────────────────────────
export interface Ga4ReportResponse {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?:    Array<{ name: string; type: string }>;
  rows?:             Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues:    Array<{ value: string }>;
  }>;
  totals?: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues:    Array<{ value: string }>;
  }>;
  rowCount?: number;
}

type Ga4Row = NonNullable<Ga4ReportResponse['rows']>[0];

/** Extract a row as { dimensionName: string, metricName: number } record */
export function parseRow(
  row: Ga4Row,
  dimHeaders: string[],
  metHeaders: string[],
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  dimHeaders.forEach((h, i) => { out[h] = row.dimensionValues[i]?.value ?? ''; });
  metHeaders.forEach((h, i) => { out[h] = parseFloat(row.metricValues[i]?.value ?? '0') || 0; });
  return out;
}

// ── Stats types ───────────────────────────────────────────────────────────────
export interface GaPageStat {
  path:       string;
  title:      string;
  pageViews:  number;
  sessions:   number;
  avgTimeSec: number;
}

export interface GaChannelStat {
  channel:  string;
  sessions: number;
  users:    number;
  pct:      number;
}

export interface GaDeviceStat {
  device:   string;
  sessions: number;
  pct:      number;
}

export interface GaCountryStat {
  country:  string;
  sessions: number;
  pct:      number;
}

export interface GaDailyPoint {
  date:     string; // YYYYMMDD
  sessions: number;
}

export interface GaSummary {
  sessions:           number;
  users:              number;
  newUsers:           number;
  pageViews:          number;
  bounceRate:         number; // 0-1
  avgSessionDuration: number; // seconds
}

export interface GaStats {
  summary:    GaSummary;
  topPages:   GaPageStat[];
  channels:   GaChannelStat[];
  devices:    GaDeviceStat[];
  countries:  GaCountryStat[];
  dailyTrend: GaDailyPoint[];
  propertyId: string;
  fetchedAt:  string;
}
