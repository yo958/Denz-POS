import { type NextRequest, NextResponse } from 'next/server';
import { ADS_TOKEN_DOC_PATH } from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }

  const body = await request.json() as { customerId: string };
  const customerId = (body.customerId ?? '').replace(/-/g, '');  // strip dashes

  if (!customerId || !/^\d+$/.test(customerId)) {
    return NextResponse.json({ error: 'invalid_customer_id' }, { status: 400 });
  }

  const tokenDoc = await getAdminDb().doc(ADS_TOKEN_DOC_PATH).get();
  if (!tokenDoc.exists) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  await getAdminDb().doc(ADS_TOKEN_DOC_PATH).update({ customerId });
  return NextResponse.json({ ok: true, customerId });
}
