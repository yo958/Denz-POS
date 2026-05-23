import { type NextRequest, NextResponse } from 'next/server';
import { makeAdsOAuth2Client, makeAdsApiClient, ADS_TOKEN_DOC_PATH, adsAppOrigin } from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const code  = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  const base  = adsAppOrigin();

  if (error) {
    console.error('[ads/callback] Google returned error:', error);
    return NextResponse.redirect(`${base}/ads?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/ads?error=no_code`);
  }

  try {
    const oauth2Client = makeAdsOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('[ads/callback] No refresh_token — user may have already consented.');
      return NextResponse.redirect(`${base}/ads?error=no_refresh_token`);
    }

    // List accessible customers so we can auto-select if only one
    const adsClient = makeAdsApiClient();
    let customerId: string | null = null;
    let customerName: string | null = null;
    let customerCount = 0;

    try {
      const res = await adsClient.listAccessibleCustomers(tokens.refresh_token);
      const customers = res.resource_names ?? [];
      customerCount = customers.length;
      if (customers.length === 1) {
        // Extract ID from "customers/1234567890"
        customerId = customers[0].replace('customers/', '');
      }
      // If multiple, we store all resource names and let user pick on the /ads page
    } catch (e) {
      console.warn('[ads/callback] Could not list customers:', e);
    }

    await getAdminDb().doc(ADS_TOKEN_DOC_PATH).set({
      accessToken:   tokens.access_token  ?? '',
      refreshToken:  tokens.refresh_token,
      expiryDate:    tokens.expiry_date   ?? 0,
      tokenType:     tokens.token_type    ?? 'Bearer',
      customerId:    customerId ?? '',          // empty = user must pick
      customerName:  customerName ?? '',
      customerCount,
      connectedAt:   new Date().toISOString(),
    });

    const qs = customerId ? 'connected=true' : 'connected=true&choose_customer=true';
    return NextResponse.redirect(`${base}/ads?${qs}`);
  } catch (e) {
    console.error('[ads/callback] OAuth exchange failed:', e);
    return NextResponse.redirect(`${base}/ads?error=oauth_failed`);
  }
}
