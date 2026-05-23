import { NextResponse } from 'next/server';
import { makeAdsOAuth2Client, ADS_SCOPES, adsAppOrigin } from '@/lib/google-ads';

export async function GET() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return NextResponse.redirect(`${adsAppOrigin()}/ads?error=not_configured`);
  }

  const oauth2Client = makeAdsOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope:       ADS_SCOPES,
    prompt:      'consent',  // ensures refresh_token is always returned
  });

  return NextResponse.redirect(authUrl);
}
