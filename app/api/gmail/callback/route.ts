import { type NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { makeOAuth2Client, TOKEN_DOC_PATH } from '@/lib/gmail-oauth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/inbox?error=no_code`);
  }

  try {
    const oauth2Client = makeOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/inbox?error=no_refresh_token`);
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    await getAdminDb().doc(TOKEN_DOC_PATH).set({
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date ?? 0,
      scope: tokens.scope ?? '',
      tokenType: tokens.token_type ?? 'Bearer',
      gmailAddress: profile.data.emailAddress ?? '',
      connectedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(`${origin}/inbox?connected=true`);
  } catch {
    return NextResponse.redirect(`${origin}/inbox?error=oauth_failed`);
  }
}
