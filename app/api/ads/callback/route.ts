import { type NextRequest, NextResponse } from 'next/server';
import {
  makeAdsOAuth2Client,
  adsAppOrigin,
  ADS_TOKEN_DOC_PATH,
  getAdsAccessToken,
  adsListCustomers,
} from '@/lib/google-ads';
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

    // Store tokens first
    await getAdminDb().doc(ADS_TOKEN_DOC_PATH).set({
      accessToken:   tokens.access_token  ?? '',
      refreshToken:  tokens.refresh_token,
      expiryDate:    tokens.expiry_date   ?? 0,
      tokenType:     tokens.token_type    ?? 'Bearer',
      customerId:    '',   // filled below or by user
      connectedAt:   new Date().toISOString(),
    });

    // Try to list customers via REST
    let customerId    = '';
    let customerCount = 0;
    try {
      const accessToken = await getAdsAccessToken({
        refreshToken: tokens.refresh_token,
        accessToken:  tokens.access_token ?? '',
        expiryDate:   tokens.expiry_date  ?? 0,
      });
      const customers = await adsListCustomers(accessToken);
      customerCount   = customers.length;
      if (customers.length === 1) {
        customerId = customers[0].replace('customers/', '');
        await getAdminDb().doc(ADS_TOKEN_DOC_PATH).update({ customerId });
      }
    } catch (e) {
      console.warn('[ads/callback] Could not list customers:', e);
    }

    const qs = customerId
      ? 'connected=true'
      : 'connected=true&choose_customer=true';
    return NextResponse.redirect(`${base}/ads?${qs}`);
  } catch (e) {
    console.error('[ads/callback] OAuth exchange failed:', e);
    return NextResponse.redirect(`${base}/ads?error=oauth_failed`);
  }
}
