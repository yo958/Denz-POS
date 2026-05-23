import { google } from 'googleapis';

// ── Paths ────────────────────────────────────────────────────────────────────
const suffix = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
export const ADS_TOKEN_DOC_PATH  = `venue-settings/google-ads-${suffix}`;
export const ADS_CACHE_DOC_PATH  = `venue-settings/ads-stats-${suffix}`;
export const OPENAI_DOC_PATH     = `venue-settings/openai`;

// Google Ads REST API version (matches v23 of the API)
const ADS_API_VERSION = 'v23';

// ── OAuth2 client (reuses same Google app as Gmail) ─────────────────────────
export function makeAdsOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID!,
    process.env.GMAIL_CLIENT_SECRET!,
    process.env.GOOGLE_ADS_REDIRECT_URI ?? 'http://localhost:3001/api/ads/callback',
  );
}

export const ADS_SCOPES = ['https://www.googleapis.com/auth/adwords'];

/** Derive host origin from the Ads redirect URI (avoids Docker 0.0.0.0) */
export function adsAppOrigin(): string {
  const uri = process.env.GOOGLE_ADS_REDIRECT_URI;
  if (uri) return new URL(uri).origin;
  return 'http://localhost:3001';
}

// ── Token helper ─────────────────────────────────────────────────────────────
/** Returns a fresh access token, auto-refreshing if expired. */
export async function getAdsAccessToken(td: {
  refreshToken: string;
  accessToken:  string;
  expiryDate:   number;
}): Promise<string> {
  const oauth2Client = makeAdsOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: td.refreshToken,
    access_token:  td.accessToken,
    expiry_date:   td.expiryDate,
  });
  const { token } = await oauth2Client.getAccessToken();
  if (!token) throw new Error('Failed to get Google access token');
  return token;
}

// ── REST helpers ─────────────────────────────────────────────────────────────
function adsHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization':   `Bearer ${accessToken}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type':    'application/json',
  };
  // Manager (MCC) accounts require login-customer-id so the API knows which
  // account the developer token is registered under.
  const loginId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (loginId) headers['login-customer-id'] = loginId;
  return headers;
}

/** List all accessible customer resource names (e.g. "customers/1234567890"). */
export async function adsListCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${ADS_API_VERSION}/customers:listAccessibleCustomers`,
    { headers: adsHeaders(accessToken) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`listAccessibleCustomers failed (${res.status}): ${text}`);
  }
  const data = await res.json() as { resourceNames?: string[] };
  return data.resourceNames ?? [];
}

/** Run a GAQL query and return the results array. */
export async function adsSearch(
  customerId: string,
  accessToken: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
    {
      method:  'POST',
      headers: adsHeaders(accessToken),
      body:    JSON.stringify({ query }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Ads search failed (${res.status}): ${text}`);
  }
  const data = await res.json() as { results?: Record<string, unknown>[] };
  return data.results ?? [];
}

// ── Stats types ───────────────────────────────────────────────────────────────
export interface AdsCampaign {
  id:          string;
  name:        string;
  status:      string;
  impressions: number;
  clicks:      number;
  ctr:         number;
  cost:        number;
  conversions: number;
}

export interface AdsKeyword {
  text:        string;
  matchType:   string;
  campaign:    string;
  adGroup:     string;
  impressions: number;
  clicks:      number;
  ctr:         number;
  cost:        number;
  conversions: number;
}

export interface AdsSummary {
  impressions:      number;
  clicks:           number;
  ctr:              number;
  cost:             number;
  averageCpc:       number;
  conversions:      number;
  conversionsValue: number;
  roas:             number;
}

export interface AdsStats {
  summary:        AdsSummary;
  campaigns:      AdsCampaign[];
  topKeywords:    AdsKeyword[];
  lowCtrKeywords: AdsKeyword[];
  customerId:     string;
  fetchedAt:      string;
}

// ── Micro helpers ─────────────────────────────────────────────────────────────
/** REST API returns int64 values as strings; parse safely. */
export function micros(v: unknown): number {
  return (typeof v === 'string' ? parseInt(v, 10) : Number(v) || 0) / 1_000_000;
}
export function int64(v: unknown): number {
  return typeof v === 'string' ? parseInt(v, 10) : Number(v) || 0;
}
export function float64(v: unknown): number {
  return Number(v) || 0;
}
