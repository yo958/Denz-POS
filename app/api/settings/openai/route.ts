import { type NextRequest, NextResponse } from 'next/server';
import { OPENAI_DOC_PATH } from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }
  const doc = await getAdminDb().doc(OPENAI_DOC_PATH).get();
  if (!doc.exists || !doc.data()?.apiKey) {
    return NextResponse.json({ hasKey: false });
  }
  const key = doc.data()!.apiKey as string;
  // Return masked version: sk-...XXXX
  const masked = key.length > 8 ? `${key.slice(0, 7)}...${key.slice(-4)}` : '****';
  return NextResponse.json({ hasKey: true, masked });
}

export async function POST(request: NextRequest) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }
  const body = await request.json() as { apiKey?: string };
  const apiKey = (body.apiKey ?? '').trim();

  if (!apiKey.startsWith('sk-')) {
    return NextResponse.json({ error: 'invalid_key', message: 'Key must start with sk-' }, { status: 400 });
  }

  await getAdminDb().doc(OPENAI_DOC_PATH).set({ apiKey, updatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await getAdminDb().doc(OPENAI_DOC_PATH).delete();
  return NextResponse.json({ ok: true });
}
