import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { makeOAuth2Client, TOKEN_DOC_PATH } from '@/lib/gmail-oauth';
import { getAdminDb } from '@/lib/firebase-admin';

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  color?: { backgroundColor: string; textColor: string };
}

export async function GET() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.GMAIL_CLIENT_ID) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const tokenDoc = await getAdminDb().doc(TOKEN_DOC_PATH).get();
  if (!tokenDoc.exists) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const td = tokenDoc.data()!;
  const oauth2Client = makeOAuth2Client();
  oauth2Client.setCredentials({
    access_token:  td.accessToken  as string,
    refresh_token: td.refreshToken as string,
    expiry_date:   td.expiryDate   as number,
    token_type:    td.tokenType    as string,
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await getAdminDb().doc(TOKEN_DOC_PATH).update({
        accessToken: tokens.access_token,
        expiryDate:  tokens.expiry_date ?? 0,
      });
    }
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.labels.list({ userId: 'me' });

  const labels: GmailLabel[] = (res.data.labels ?? []).map(l => ({
    id:    l.id    ?? '',
    name:  l.name  ?? '',
    type:  (l.type === 'user' ? 'user' : 'system') as 'system' | 'user',
    color: l.color?.backgroundColor
      ? { backgroundColor: l.color.backgroundColor, textColor: l.color.textColor ?? '#000000' }
      : undefined,
  })).filter(l => l.id && l.name);

  return NextResponse.json({ labels });
}
