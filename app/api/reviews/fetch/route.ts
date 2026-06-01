import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import type { GoogleReview } from '@/lib/types';

const DOC = 'venue-settings/google-reviews';

interface OutscraperReview {
  review_id?: string;
  author_id?: string;
  author_title?: string;
  author_image?: string;
  review_text?: string;
  review_rating?: number;
  review_datetime_utc?: string;
  review_img_url?: string;
  review_img_urls?: string[];
}

export async function POST() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'not_configured' }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.doc(DOC).get();
  const config = snap.exists ? snap.data()! : {};

  const apiKey = config.apiKey as string | undefined;
  const placeId = config.placeId as string | undefined;

  if (!apiKey || !placeId) {
    return NextResponse.json({ error: 'missing_config', message: 'API key and Place ID required' }, { status: 400 });
  }

  const maxReviews: number = (config.maxReviews as number | undefined) ?? 50;
  const mediaOnly: boolean = (config.mediaOnly as boolean | undefined) ?? true;
  const minRating: number = (config.minRating as number | undefined) ?? 4;
  const checkIntervalHours: number = (config.checkIntervalHours as number | undefined) ?? 24;

  const url = `https://api.app.outscraper.com/maps/reviews-v3?query=${encodeURIComponent(placeId)}&reviewsLimit=${maxReviews}&limit=1&async=false`;
  const res = await fetch(url, {
    headers: { 'X-API-KEY': apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[reviews/fetch] Outcraper error:', res.status, text.slice(0, 500));
    return NextResponse.json({ error: 'outcraper_error', message: text }, { status: 502 });
  }

  // Outcraper v3 returns { data: [ { reviews_data: [...] } ], status: "Success" }
  // reviews_data items may be nested one level deeper in some responses
  const json = await res.json() as {
    data?: (OutscraperReview[] | { reviews_data?: OutscraperReview[] })[];
    status?: string;
  };

  const firstItem = json.data?.[0];
  let raw: OutscraperReview[] = [];
  if (Array.isArray(firstItem)) {
    // v3 sometimes returns data[0] as a flat array of review objects
    raw = firstItem as OutscraperReview[];
  } else if (firstItem && 'reviews_data' in firstItem) {
    raw = (firstItem as { reviews_data?: OutscraperReview[] }).reviews_data ?? [];
  }

  // Filter by rating and media
  const filtered = raw.filter(r => {
    if ((r.review_rating ?? 0) < minRating) return false;
    const hasPhoto = (r.review_img_urls && r.review_img_urls.length > 0) || !!r.review_img_url;
    if (mediaOnly && !hasPhoto) return false;
    return true;
  });

  // Merge with existing reviews (dedup by reviewId, preserve existing visible/tags/approved)
  const existing: GoogleReview[] = (config.reviews as GoogleReview[] | undefined) ?? [];
  const existingMap = new Map(existing.map(r => [r.reviewId, r]));

  let added = 0;
  for (const r of filtered) {
    const id = r.review_id ?? r.author_id ?? '';
    if (!id) continue;
    if (!existingMap.has(id)) {
      const photos = r.review_img_urls && r.review_img_urls.length > 0
        ? r.review_img_urls
        : r.review_img_url ? [r.review_img_url] : [];
      existingMap.set(id, {
        reviewId: id,
        authorName: r.author_title ?? 'Guest',
        authorPhoto: r.author_image,
        rating: r.review_rating ?? 5,
        text: r.review_text ?? '',
        photos,
        publishedAt: r.review_datetime_utc ?? new Date().toISOString(),
        visible: true,
        tags: ['general'],
        approved: true,
      });
      added++;
    }
  }

  const merged = Array.from(existingMap.values());
  const now = new Date().toISOString();
  const nextCheckAt = new Date(Date.now() + checkIntervalHours * 3600 * 1000).toISOString();

  await db.doc(DOC).set(
    { reviews: merged, fetchedAt: now, nextCheckAt, totalFetched: merged.length },
    { merge: true },
  );

  return NextResponse.json({ ok: true, added, total: merged.length });
}
