import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const db = getAdminDb();
    const snap = await db.collection('page-content').doc(slug).get();
    if (!snap.exists) return NextResponse.json({});
    return NextResponse.json(snap.data() ?? {});
  } catch (e) {
    console.error('pages GET', e);
    return NextResponse.json({ error: 'Failed to fetch page content' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await request.json() as Record<string, unknown>;
    const db = getAdminDb();
    await db.collection('page-content').doc(slug).set(body, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('pages PUT', e);
    return NextResponse.json({ error: 'Failed to save page content' }, { status: 500 });
  }
}
