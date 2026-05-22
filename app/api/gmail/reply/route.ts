import { type NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { makeOAuth2Client, TOKEN_DOC_PATH } from '@/lib/gmail-oauth';
import { getAdminDb } from '@/lib/firebase-admin';

interface ReplyBody {
  threadId: string;
  to: string;
  subject: string;
  inReplyTo: string;
  references: string;
  bodyText: string;
}

export async function POST(request: NextRequest) {
  const body: ReplyBody = await request.json();
  const { threadId, to, subject, inReplyTo, references, bodyText } = body;

  const tokenDoc = await getAdminDb().doc(TOKEN_DOC_PATH).get();
  if (!tokenDoc.exists) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const td = tokenDoc.data()!;
  const oauth2Client = makeOAuth2Client();
  oauth2Client.setCredentials({
    access_token: td.accessToken as string,
    refresh_token: td.refreshToken as string,
    expiry_date: td.expiryDate as number,
    token_type: td.tokenType as string,
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await getAdminDb().doc(TOKEN_DOC_PATH).update({
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date ?? 0,
      });
    }
  });

  const safeText = bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const bodyHtml = `<div style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${safeText}</div>`;

  const rawLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${references ? `${references} ${inReplyTo}` : inReplyTo}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    bodyHtml,
  ];

  const raw = Buffer.from(rawLines.join('\r\n')).toString('base64url');

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const sent = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId },
  });

  return NextResponse.json({ success: true, messageId: sent.data.id });
}
