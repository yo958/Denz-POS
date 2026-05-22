import { type NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { makeOAuth2Client, TOKEN_DOC_PATH } from '@/lib/gmail-oauth';
import { getAdminDb } from '@/lib/firebase-admin';

function extractBody(part: gmail_v1.Schema$MessagePart): { html: string; text: string } {
  const mime = part.mimeType ?? '';
  const data = part.body?.data;

  if (mime === 'text/html' && data) {
    return { html: Buffer.from(data, 'base64url').toString('utf-8'), text: '' };
  }
  if (mime === 'text/plain' && data) {
    return { html: '', text: Buffer.from(data, 'base64url').toString('utf-8') };
  }
  if (part.parts) {
    let html = '';
    let text = '';
    for (const sub of part.parts) {
      const r = extractBody(sub);
      if (r.html) html = r.html;
      if (r.text) text = r.text;
    }
    return { html, text };
  }
  return { html: '', text: '' };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });

  const headers = msg.data.payload?.headers ?? [];
  const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';

  const { html: rawHtml, text: rawText } = extractBody(msg.data.payload ?? {});

  let bodyHtml = '';
  if (rawHtml) {
    const { window } = new JSDOM('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const purify = createDOMPurify(window as any);
    bodyHtml = purify.sanitize(rawHtml);
  } else if (rawText) {
    bodyHtml = `<pre style="white-space:pre-wrap;font-family:inherit">${rawText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
  }

  return NextResponse.json({
    id,
    threadId: msg.data.threadId ?? id,
    from: get('From'),
    to: get('To'),
    subject: get('Subject') || '(no subject)',
    date: get('Date'),
    bodyHtml,
    messageId: get('Message-ID'),
    references: get('References'),
  });
}
