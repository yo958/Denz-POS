import { type NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { makeOAuth2Client, TOKEN_DOC_PATH } from '@/lib/gmail-oauth';
import { getAdminDb } from '@/lib/firebase-admin';

// Derive the app's external origin from GMAIL_REDIRECT_URI so Docker's
// internal 0.0.0.0:3000 address is never used in redirects.
function appOrigin(): string {
  const uri = process.env.GMAIL_REDIRECT_URI;
  if (uri) return new URL(uri).origin;
  return 'http://localhost:3001';
}

export async function GET(request: NextRequest) {
  const code  = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  const base  = appOrigin();

  if (error) {
    console.error('[gmail/callback] Google returned error:', error);
    return NextResponse.redirect(`${base}/inbox?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${base}/inbox?error=no_code`);
  }

  try {
    const oauth2Client = makeOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('[gmail/callback] No refresh_token returned — user may have already consented.');
      return NextResponse.redirect(`${base}/inbox?error=no_refresh_token`);
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    await getAdminDb().doc(TOKEN_DOC_PATH).set({
      accessToken:  tokens.access_token  ?? '',
      refreshToken: tokens.refresh_token,
      expiryDate:   tokens.expiry_date   ?? 0,
      scope:        tokens.scope         ?? '',
      tokenType:    tokens.token_type    ?? 'Bearer',
      gmailAddress: profile.data.emailAddress ?? '',
      connectedAt:  new Date().toISOString(),
    });

    return NextResponse.redirect(`${base}/inbox?connected=true`);
  } catch (e) {
    console.error('[gmail/callback] OAuth exchange failed:', e);
    return NextResponse.redirect(`${base}/inbox?error=oauth_failed`);
  }
}
