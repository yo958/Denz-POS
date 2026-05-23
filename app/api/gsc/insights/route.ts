import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GSC_CACHE_DOC_PATH, type GscStats } from '@/lib/google-search-console';
import { OPENAI_DOC_PATH } from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  const cacheDoc = await getAdminDb().doc(GSC_CACHE_DOC_PATH).get();
  if (!cacheDoc.exists) {
    return NextResponse.json({ error: 'no_stats' }, { status: 404 });
  }
  const data = cacheDoc.data()!;
  return NextResponse.json({
    insights:          data.insights          ?? null,
    insightsUpdatedAt: data.insightsUpdatedAt ?? null,
  });
}

export async function POST() {
  // ── Check OpenAI key ───────────────────────────────────────────────────────
  const openaiDoc = await getAdminDb().doc(OPENAI_DOC_PATH).get();
  if (!openaiDoc.exists || !openaiDoc.data()?.apiKey) {
    return NextResponse.json({ error: 'no_openai_key' }, { status: 401 });
  }
  const openaiData = openaiDoc.data()!;
  const apiKey     = openaiData.apiKey as string;
  const model      = (openaiData.model as string | undefined) ?? 'gpt-4.1-mini';

  // ── Load GSC stats ─────────────────────────────────────────────────────────
  const cacheDoc = await getAdminDb().doc(GSC_CACHE_DOC_PATH).get();
  if (!cacheDoc.exists) {
    return NextResponse.json({ error: 'no_stats', message: 'Refresh stats first' }, { status: 404 });
  }
  const stats = cacheDoc.data() as GscStats;

  // ── Build prompt ───────────────────────────────────────────────────────────
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const strikingDistance = (stats.topQueries ?? [])
    .filter(q => q.position >= 4 && q.position <= 10);

  const lowCtrPages = (stats.topPages ?? [])
    .filter(p => p.impressions >= 50 && p.ctr < (stats.summary?.ctr ?? 0))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  const prompt = `You are an SEO expert consultant. Analyse the following 28-day Google Search Console data for ${stats.siteUrl} and provide specific, actionable recommendations. Focus on things that can realistically be done to improve organic search performance.

## Summary (Last 28 Days)
- Total Clicks: ${stats.summary?.clicks?.toLocaleString() ?? 0}
- Total Impressions: ${stats.summary?.impressions?.toLocaleString() ?? 0}
- Average CTR: ${pct(stats.summary?.ctr ?? 0)}
- Average Position: ${stats.summary?.position?.toFixed(1) ?? 'N/A'}

## Top Queries by Clicks
${(stats.topQueries ?? []).slice(0, 15).map(q =>
    `- "${q.query}" | Clicks: ${q.clicks} | Impressions: ${q.impressions} | CTR: ${pct(q.ctr)} | Pos: ${q.position.toFixed(1)}`
  ).join('\n') || 'No data'}

## Striking Distance Queries (Positions 4–10 — nearly on page 1)
${strikingDistance.slice(0, 8).map(q =>
    `- "${q.query}" | Pos: ${q.position.toFixed(1)} | Impressions: ${q.impressions} | CTR: ${pct(q.ctr)}`
  ).join('\n') || 'None identified'}

## Top Pages
${(stats.topPages ?? []).map(p =>
    `- ${p.page} | Clicks: ${p.clicks} | Impressions: ${p.impressions} | CTR: ${pct(p.ctr)} | Pos: ${p.position.toFixed(1)}`
  ).join('\n') || 'No data'}

## Pages with Low CTR (high impressions, below-average CTR — likely need better title/meta)
${lowCtrPages.map(p =>
    `- ${p.page} | Impressions: ${p.impressions} | CTR: ${pct(p.ctr)} | Pos: ${p.position.toFixed(1)}`
  ).join('\n') || 'None identified'}

## Traffic by Device
${(stats.devices ?? []).map(d =>
    `- ${d.device}: ${d.clicks} clicks | CTR: ${pct(d.ctr)} | Avg Pos: ${d.position.toFixed(1)}`
  ).join('\n') || 'No data'}

## Top Countries
${(stats.countries ?? []).slice(0, 5).map(c =>
    `- ${c.country}: ${c.clicks} clicks | CTR: ${pct(c.ctr)}`
  ).join('\n') || 'No data'}

---

Please provide your analysis in the following structured format using Markdown:

### 🎯 Quick Wins
3–5 specific actions that can be done this week for the biggest SEO impact.

### 📈 Striking Distance Keywords
Specific queries ranking positions 4–10 that could reach page 1 with targeted content updates. Include the query, current position, and a concrete suggestion.

### 📉 Low CTR Opportunities
Pages or queries with high impressions but low click-through rates — likely need better title tags or meta descriptions. Suggest specific copy improvements.

### 📱 Device & Audience Insights
Notable differences in mobile vs desktop performance, or country-specific opportunities worth acting on.

### 🔍 Content & Growth Opportunities
2–3 content gaps or new topic areas that the query data suggests people are searching for but the site doesn't fully address.

Keep each section concise and specific. Use the actual query names and page paths from the data.`;

  // ── Call OpenAI ────────────────────────────────────────────────────────────
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  2000,
      temperature: 0.3,
    });

    const insights          = completion.choices[0]?.message?.content ?? '';
    const insightsUpdatedAt = new Date().toISOString();

    await getAdminDb().doc(GSC_CACHE_DOC_PATH).update({ insights, insightsUpdatedAt });

    return NextResponse.json({ insights, insightsUpdatedAt });
  } catch (e: unknown) {
    console.error('[gsc/insights] OpenAI error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'openai_failed', message }, { status: 500 });
  }
}
