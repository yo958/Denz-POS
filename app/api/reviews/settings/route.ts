import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

const DOC = 'venue-settings/google-reviews';

export async function GET() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }
  const snap = await getAdminDb().doc(DOC).get();
  if (!snap.exists) {
    return NextResponse.json({
      hasKey: false,
      placeId: '',
      maxReviews: 50,
      mediaOnly: true,
      minRating: 4,
      cacheTtlHours: 720,
      checkIntervalHours: 24,
    });
  }
  const data = snap.data()!;
  const key = data.apiKey as string | undefined;
  const masked = key && key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : key ? '****' : '';
  return NextResponse.json({
    hasKey: !!key,
    maskedKey: masked,
    placeId: data.placeId ?? '',
    maxReviews: data.maxReviews ?? 50,
    mediaOnly: data.mediaOnly ?? true,
    minRating: data.minRating ?? 4,
    cacheTtlHours: data.cacheTtlHours ?? 720,
    checkIntervalHours: data.checkIntervalHours ?? 24,
    fetchedAt: data.fetchedAt ?? null,
    nextCheckAt: data.nextCheckAt ?? null,
    totalFetched: data.totalFetched ?? 0,
  });
}

export async function POST(request: NextRequest) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }
  const body = await request.json() as {
    apiKey?: string;
    placeId?: string;
    maxReviews?: number;
    mediaOnly?: boolean;
    minRating?: number;
    cacheTtlHours?: number;
    checkIntervalHours?: number;
  };

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.apiKey !== undefined && body.apiKey !== '') patch.apiKey = body.apiKey.trim();
  if (body.placeId !== undefined) patch.placeId = body.placeId.trim();
  if (body.maxReviews !== undefined) patch.maxReviews = Number(body.maxReviews);
  if (body.mediaOnly !== undefined) patch.mediaOnly = body.mediaOnly;
  if (body.minRating !== undefined) patch.minRating = Number(body.minRating);
  if (body.cacheTtlHours !== undefined) patch.cacheTtlHours = Number(body.cacheTtlHours);
  if (body.checkIntervalHours !== undefined) patch.checkIntervalHours = Number(body.checkIntervalHours);

  await getAdminDb().doc(DOC).set(patch, { merge: true });
  return NextResponse.json({ ok: true });
}
