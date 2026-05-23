import { NextResponse } from 'next/server';
import { ADS_TOKEN_DOC_PATH } from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

export async function DELETE() {
  await getAdminDb().doc(ADS_TOKEN_DOC_PATH).delete();
  return NextResponse.json({ ok: true });
}
