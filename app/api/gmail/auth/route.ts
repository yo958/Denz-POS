import { NextResponse } from 'next/server';
import { GMAIL_SCOPES, makeOAuth2Client } from '@/lib/gmail-oauth';

export async function GET() {
  const oauth2Client = makeOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent',
  });
  return NextResponse.redirect(authUrl);
}
