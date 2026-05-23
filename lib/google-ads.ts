import { google } from 'googleapis';
import { GoogleAdsApi, fromMicros } from 'google-ads-api';

// ── Paths ───────────────────────────────────────────────────────────────────
const suffix = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
export const ADS_TOKEN_DOC_PATH  = `venue-settings/google-ads-${suffix}`;
export const ADS_CACHE_DOC_PATH  = `venue-settings/ads-stats-${suffix}`;
export const OPENAI_DOC_PATH     = `venue-settings/openai`;

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

// ── Google Ads API client ────────────────────────────────────────────────────
export function makeAdsApiClient() {
  return new GoogleAdsApi({
    client_id:       process.env.GMAIL_CLIENT_ID!,
    client_secret:   process.env.GMAIL_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
}

// ── Stats types ──────────────────────────────────────────────────────────────
export interface AdsCampaign {
  id:           string;
  name:         string;
  status:       string;
  impressions:  number;
  clicks:       number;
  ctr:          number;   // 0-1
  cost:         number;   // actual currency (not micros)
  conversions:  number;
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
  impressions:     number;
  clicks:          number;
  ctr:             number;
  cost:            number;
  averageCpc:      number;
  conversions:     number;
  conversionsValue:number;
  roas:            number;  // conversionsValue / cost (0 if no conv tracking)
}

export interface AdsStats {
  summary:      AdsSummary;
  campaigns:    AdsCampaign[];
  topKeywords:  AdsKeyword[];   // by spend
  lowCtrKeywords: AdsKeyword[]; // CTR < avg, cost > 0
  customerId:   string;
  fetchedAt:    string;         // ISO
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export { fromMicros };
