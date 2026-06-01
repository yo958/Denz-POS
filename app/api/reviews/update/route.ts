import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { GoogleReview, ReviewTag } from '@/lib/types';

const DOC = 'venue-settings/google-reviews';

export async function POST(request: NextRequest) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }
  const body = await request.json() as {
    reviewId: string;
    visible?: boolean;
    tags?: ReviewTag[];
    approved?: boolean;
  };

  if (!body.reviewId) {
    return NextResponse.json({ error: 'missing_reviewId' }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.doc(DOC).get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const reviews: GoogleReview[] = (snap.data()!.reviews as GoogleReview[] | undefined) ?? [];
  const idx = reviews.findIndex(r => r.reviewId === body.reviewId);
  if (idx === -1) return NextResponse.json({ error: 'review_not_found' }, { status: 404 });

  const updated = { ...reviews[idx] };
  if (body.visible !== undefined) updated.visible = body.visible;
  if (body.tags !== undefined) updated.tags = body.tags;
  if (body.approved !== undefined) updated.approved = body.approved;

  reviews[idx] = updated;
  await db.doc(DOC).set({ reviews }, { merge: true });
  return NextResponse.json({ ok: true });
}
