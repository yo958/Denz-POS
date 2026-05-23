import { NextResponse } from 'next/server';
import { makeAdsApiClient, ADS_TOKEN_DOC_PATH } from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }

  const tokenDoc = await getAdminDb().doc(ADS_TOKEN_DOC_PATH).get();
  if (!tokenDoc.exists) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 });
  }

  const td = tokenDoc.data()!;
  const refreshToken = td.refreshToken as string;

  try {
    const adsClient = makeAdsApiClient();
    const res = await adsClient.listAccessibleCustomers(refreshToken);
    const resourceNames = res.resource_names ?? [];

    // Return IDs with formatting
    const customers = resourceNames.map(rn => {
      const id = rn.replace('customers/', '');
      const formatted = id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      return { id, formatted, resourceName: rn };
    });

    return NextResponse.json({ customers, currentId: td.customerId ?? '' });
  } catch (e) {
    console.error('[ads/customers]', e);
    return NextResponse.json({ error: 'fetch_failed', message: String(e) }, { status: 500 });
  }
}
