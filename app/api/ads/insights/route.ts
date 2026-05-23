import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  ADS_CACHE_DOC_PATH,
  OPENAI_DOC_PATH,
  type AdsStats,
} from '@/lib/google-ads';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  const cacheDoc = await getAdminDb().doc(ADS_CACHE_DOC_PATH).get();
  if (!cacheDoc.exists) {
    return NextResponse.json({ error: 'no_stats' }, { status: 404 });
  }
  const data = cacheDoc.data()!;
  return NextResponse.json({
    insights:           data.insights           ?? null,
    insightsUpdatedAt:  data.insightsUpdatedAt  ?? null,
  });
}

export async function POST() {
  // ── Check OpenAI key ───────────────────────────────────────────────────────
  const openaiDoc = await getAdminDb().doc(OPENAI_DOC_PATH).get();
  if (!openaiDoc.exists || !openaiDoc.data()?.apiKey) {
    return NextResponse.json({ error: 'no_openai_key' }, { status: 401 });
  }
  const openaiData = openaiDoc.data()!;
  const apiKey = openaiData.apiKey as string;
  const model  = (openaiData.model as string | undefined) ?? 'gpt-4.1-mini';

  // ── Load stats ─────────────────────────────────────────────────────────────
  const cacheDoc = await getAdminDb().doc(ADS_CACHE_DOC_PATH).get();
  if (!cacheDoc.exists) {
    return NextResponse.json({ error: 'no_stats', message: 'Refresh stats first' }, { status: 404 });
  }
  const stats = cacheDoc.data() as AdsStats;

  // ── Build prompt ───────────────────────────────────────────────────────────
  const currencySymbol = '฿';  // TODO: could read from Firestore settings
  const fmt = (n: number) => `${currencySymbol}${n.toFixed(2)}`;
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  const topKw = stats.topKeywords?.slice(0, 10) ?? [];
  const lowKw = stats.lowCtrKeywords?.slice(0, 10) ?? [];

  const prompt = `You are a Google Ads expert consultant. Analyse the following 30-day Google Ads account data and provide specific, actionable recommendations. Focus on what the account owner can do TODAY to improve performance.

## Account Summary (Last 30 Days)
- Impressions: ${stats.summary?.impressions?.toLocaleString() ?? 0}
- Clicks: ${stats.summary?.clicks?.toLocaleString() ?? 0}
- CTR: ${pct(stats.summary?.ctr ?? 0)}
- Total Spend: ${fmt(stats.summary?.cost ?? 0)}
- Avg CPC: ${fmt(stats.summary?.averageCpc ?? 0)}
- Conversions: ${stats.summary?.conversions ?? 0}
- ROAS: ${stats.summary?.roas?.toFixed(2) ?? 'N/A'}x

## Top Campaigns by Spend
${(stats.campaigns ?? []).map(c =>
  `- "${c.name}" [${c.status}]: ${c.impressions.toLocaleString()} imp, ${c.clicks} clicks, ${pct(c.ctr)} CTR, ${fmt(c.cost)} spend, ${c.conversions} conv`
).join('\n') || 'No data'}

## Top Keywords by Spend
${topKw.map(k =>
  `- "${k.text}" [${k.matchType}] | ${k.impressions.toLocaleString()} imp | ${pct(k.ctr)} CTR | ${fmt(k.cost)} | ${k.conversions} conv`
).join('\n') || 'No data'}

## Underperforming Keywords (High Spend, Low CTR)
${lowKw.map(k =>
  `- "${k.text}" [${k.matchType}] | ${k.impressions.toLocaleString()} imp | ${pct(k.ctr)} CTR | ${fmt(k.cost)} spend | ${k.conversions} conv`
).join('\n') || 'None identified'}

---

Please provide your analysis in the following structured format using Markdown:

### 🎯 Quick Wins
List 3-5 specific actions that can be done immediately (today) for the biggest impact.

### 🔑 Keywords to Pause or Remove
List specific keywords that should be paused or removed, with the reason why.

### 📝 Ad Copy Suggestions
Specific improvements for ad headlines and descriptions based on the current data.

### 💰 Budget & Bidding Recommendations
Specific bid adjustments or budget reallocation suggestions.

### 📈 Growth Opportunities
2-3 keyword gaps, new match type opportunities, or audience targeting ideas.

Keep each section concise and specific. Use the actual keyword names and figures from the data.`;

  // ── Call OpenAI ────────────────────────────────────────────────────────────
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  2000,
      temperature: 0.3,
    });

    const insights = completion.choices[0]?.message?.content ?? '';
    const insightsUpdatedAt = new Date().toISOString();

    // Merge into cache doc
    await getAdminDb().doc(ADS_CACHE_DOC_PATH).update({ insights, insightsUpdatedAt });

    return NextResponse.json({ insights, insightsUpdatedAt });
  } catch (e: unknown) {
    console.error('[ads/insights] OpenAI error:', e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'openai_failed', message }, { status: 500 });
  }
}
