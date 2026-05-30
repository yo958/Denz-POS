import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

const DOC = 'venue-settings/website';

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.doc(DOC).get();
    return NextResponse.json(snap.exists ? snap.data() : { noindex: false });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getAdminDb();
    await db.doc(DOC).set(body, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
