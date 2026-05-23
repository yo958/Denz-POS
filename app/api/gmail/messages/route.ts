import { type NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { makeOAuth2Client, TOKEN_DOC_PATH } from '@/lib/gmail-oauth';
import { getAdminDb } from '@/lib/firebase-admin';

export interface GmailListItem {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  labelIds: string[];
}

export async function GET(request: NextRequest) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.GMAIL_CLIENT_ID) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const pageToken  = request.nextUrl.searchParams.get('pageToken')  ?? undefined;
  const q          = request.nextUrl.searchParams.get('q')          ?? undefined;
  // Optional user-label filter — combined with INBOX so we only show inbox emails
  const labelId    = request.nextUrl.searchParams.get('labelId')    ?? null;

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

  // When a user label is selected, combine it with INBOX (AND filter)
  const labelIds = labelId ? ['INBOX', labelId] : ['INBOX'];

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    labelIds,
    maxResults: 20,
    pageToken,
    q,
  });

  const messageRefs = listRes.data.messages ?? [];

  const messages: GmailListItem[] = await Promise.all(
    messageRefs.map(async ({ id, threadId }) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = msg.data.payload?.headers ?? [];
      const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';
      const msgLabelIds = msg.data.labelIds ?? [];

      return {
        id:        id!,
        threadId:  threadId ?? id!,
        from:      get('From'),
        subject:   get('Subject') || '(no subject)',
        date:      get('Date'),
        snippet:   msg.data.snippet ?? '',
        isUnread:  msgLabelIds.includes('UNREAD'),
        labelIds:  msgLabelIds,
      };
    }),
  );

  return NextResponse.json({
    messages,
    nextPageToken: listRes.data.nextPageToken ?? null,
    gmailAddress:  td.gmailAddress as string,
  });
}
