'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search, RefreshCw, MousePointerClick, Eye,
  BarChart2, Trophy, Globe, Monitor, Smartphone, Tablet,
  Loader2, AlertCircle, Clock, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useCurrentStaff } from '@/lib/hooks/useStore';
import { toast } from '@/components/ui/toast';
import { InsightsPanel } from '@/components/ui/insights-panel';
import type { GscStats } from '@/lib/google-search-console';

// ── Types ─────────────────────────────────────────────────────────────────────
interface InsightsResponse { insights: string | null; insightsUpdatedAt: string | null }

// ── Helpers ──────────────────────────────────────────────────────────────────
function num(n: number) { return Math.round(n).toLocaleString(); }
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

/** GSC dates come back as YYYY-MM-DD */
function fmtDate(d: string) {
  if (!d || d.length < 10) return d;
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h === 1) return '1 hour ago';
  if (h < 24) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** ISO 3166-1 alpha-3 → { name, alpha2 } — common countries seen in GSC */
const ISO3: Record<string, { name: string; a2: string }> = {
  tha: { name: 'Thailand',        a2: 'TH' },
  usa: { name: 'United States',   a2: 'US' },
  gbr: { name: 'United Kingdom',  a2: 'GB' },
  aus: { name: 'Australia',       a2: 'AU' },
  sgp: { name: 'Singapore',       a2: 'SG' },
  ind: { name: 'India',           a2: 'IN' },
  idn: { name: 'Indonesia',       a2: 'ID' },
  nld: { name: 'Netherlands',     a2: 'NL' },
  can: { name: 'Canada',          a2: 'CA' },
  ita: { name: 'Italy',           a2: 'IT' },
  deu: { name: 'Germany',         a2: 'DE' },
  fra: { name: 'France',          a2: 'FR' },
  esp: { name: 'Spain',           a2: 'ES' },
  jpn: { name: 'Japan',           a2: 'JP' },
  kor: { name: 'South Korea',     a2: 'KR' },
  chn: { name: 'China',           a2: 'CN' },
  phl: { name: 'Philippines',     a2: 'PH' },
  mys: { name: 'Malaysia',        a2: 'MY' },
  vnm: { name: 'Vietnam',         a2: 'VN' },
  hkg: { name: 'Hong Kong',       a2: 'HK' },
  twn: { name: 'Taiwan',          a2: 'TW' },
  nzl: { name: 'New Zealand',     a2: 'NZ' },
  zaf: { name: 'South Africa',    a2: 'ZA' },
  bra: { name: 'Brazil',          a2: 'BR' },
  mex: { name: 'Mexico',          a2: 'MX' },
  rus: { name: 'Russia',          a2: 'RU' },
  are: { name: 'UAE',             a2: 'AE' },
  che: { name: 'Switzerland',     a2: 'CH' },
  swe: { name: 'Sweden',          a2: 'SE' },
  nor: { name: 'Norway',          a2: 'NO' },
  dnk: { name: 'Denmark',         a2: 'DK' },
  fin: { name: 'Finland',         a2: 'FI' },
  pol: { name: 'Poland',          a2: 'PL' },
  irl: { name: 'Ireland',         a2: 'IE' },
  aut: { name: 'Austria',         a2: 'AT' },
  bel: { name: 'Belgium',         a2: 'BE' },
  prt: { name: 'Portugal',        a2: 'PT' },
  mlt: { name: 'Malta',           a2: 'MT' },
  lka: { name: 'Sri Lanka',       a2: 'LK' },
  bgd: { name: 'Bangladesh',      a2: 'BD' },
  pak: { name: 'Pakistan',        a2: 'PK' },
  kaz: { name: 'Kazakhstan',      a2: 'KZ' },
  ukr: { name: 'Ukraine',         a2: 'UA' },
  arg: { name: 'Argentina',       a2: 'AR' },
  col: { name: 'Colombia',        a2: 'CO' },
  chl: { name: 'Chile',           a2: 'CL' },
  egy: { name: 'Egypt',           a2: 'EG' },
  isr: { name: 'Israel',          a2: 'IL' },
  mmr: { name: 'Myanmar',         a2: 'MM' },
  khm: { name: 'Cambodia',        a2: 'KH' },
  lao: { name: 'Laos',            a2: 'LA' },
};

function countryInfo(code: string) {
  const key = code.toLowerCase();
  return ISO3[key] ?? { name: code.toUpperCase(), a2: '' };
}

/** Regional indicator emoji from 2-letter ISO alpha-2 code */
function flagEmoji(a2: string) {
  if (!a2 || a2.length !== 2) return '🌐';
  return String.fromCodePoint(
    ...a2.toUpperCase().split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0)),
  );
}

/** Strip site origin from a full page URL for cleaner display */
function stripOrigin(url: string, siteUrl: string) {
  try {
    const origin = new URL(siteUrl).origin;
    return url.startsWith(origin) ? url.slice(origin.length) || '/' : url;
  } catch {
    return url;
  }
}

/** Avg position badge — colour-coded (lower = better) */
function PosBadge({ pos }: { pos: number }) {
  const label = pos.toFixed(1);
  if (pos <= 3)  return <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{label}</span>;
  if (pos <= 10) return <span className="font-semibold tabular-nums text-sky-600 dark:text-sky-400">{label}</span>;
  if (pos <= 20) return <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{label}</span>;
  return <span className="font-semibold tabular-nums text-rose-500">{label}</span>;
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-white/50 dark:bg-white/3'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon size={14} className={accent ? 'text-primary' : 'text-muted-foreground'} strokeWidth={1.8} />
      </div>
      <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Clicks + Impressions area chart (dual Y-axis) ─────────────────────────────
function GscTrendChart({ data }: { data: GscStats['dailyTrend'] }) {
  if (!data.length) return null;
  const chartData = data.map(d => ({
    label:       fmtDate(d.date),
    clicks:      d.clicks,
    impressions: d.impressions,
  }));
  const interval = data.length > 20 ? 4 : data.length > 10 ? 2 : 0;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradImpressions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.30} />
            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.40} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.45 }}
          axisLine={false} tickLine={false}
          interval={interval}
        />
        {/* Left axis — impressions */}
        <YAxis
          yAxisId="imp"
          orientation="left"
          tick={{ fontSize: 10, fill: '#38bdf8', opacity: 0.7 }}
          axisLine={false} tickLine={false} width={42}
          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        {/* Right axis — clicks (independent scale so it's always visible) */}
        <YAxis
          yAxisId="clk"
          orientation="right"
          tick={{ fontSize: 10, fill: '#f43f5e', opacity: 0.7 }}
          axisLine={false} tickLine={false} width={36}
          tickFormatter={v => String(v)}
        />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px', padding: '8px 12px' }}
          formatter={(value: unknown, name: unknown) => [num(Number(value)), name === 'clicks' ? 'Clicks' : 'Impressions']}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          cursor={{ stroke: 'currentColor', strokeOpacity: 0.1, strokeWidth: 20 }}
        />
        <Area yAxisId="imp" type="monotone" dataKey="impressions" stroke="#38bdf8" strokeWidth={2} fill="url(#gradImpressions)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#38bdf8' }} />
        <Area yAxisId="clk" type="monotone" dataKey="clicks"      stroke="#f43f5e" strokeWidth={2} fill="url(#gradClicks)"      dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#f43f5e' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Device icon ───────────────────────────────────────────────────────────────
function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase().trim();
  if (d === 'mobile')  return <Smartphone size={14} className="text-muted-foreground" />;
  if (d === 'tablet')  return <Tablet     size={14} className="text-muted-foreground" />;
  return <Monitor size={14} className="text-muted-foreground" />;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GscPage() {
  const me = useCurrentStaff();

  const [state, setState]           = useState<'loading' | 'not_configured' | 'ready' | 'error'>('loading');
  const [stats, setStats]           = useState<GscStats | null>(null);
  const [fromCache, setFromCache]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError]   = useState('');
  const [insights, setInsights]     = useState<InsightsResponse>({ insights: null, insightsUpdatedAt: null });
  const [insightsBusy, setInsightsBusy] = useState(false);

  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">Manager access required.</p>
      </div>
    );
  }

  const loadStats = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const res  = await fetch(`/api/gsc/stats${force ? '?refresh=true' : ''}`);
      const data = await res.json() as { stats?: GscStats; fromCache?: boolean; error?: string; message?: string };

      if (!res.ok) {
        if (data.error === 'not_configured') { setState('not_configured'); return; }
        setLoadError(data.message ?? data.error ?? 'Unknown error');
        setState('error');
        return;
      }

      if (data.stats) {
        setStats(data.stats);
        setFromCache(data.fromCache ?? false);
        setState('ready');
        void loadInsights();
      }
    } catch (e) {
      setLoadError(String(e));
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInsights = useCallback(async () => {
    const res = await fetch('/api/gsc/insights');
    if (!res.ok) return;
    const data = await res.json() as InsightsResponse;
    setInsights(data);
  }, []);

  const generateInsights = useCallback(async () => {
    setInsightsBusy(true);
    try {
      const res  = await fetch('/api/gsc/insights', { method: 'POST' });
      const data = await res.json() as InsightsResponse & { error?: string; message?: string };
      if (!res.ok) {
        if (data.error === 'no_openai_key') {
          toast.error('No OpenAI API key — add it in Settings → AI Settings');
        } else if (data.error === 'no_stats') {
          toast.error('Refresh stats first');
        } else {
          toast.error(data.message ?? 'Failed to generate insights');
        }
        return;
      }
      setInsights({ insights: data.insights ?? null, insightsUpdatedAt: data.insightsUpdatedAt ?? null });
      toast.success('Insights updated!');
    } catch {
      toast.error('Failed to generate insights');
    } finally {
      setInsightsBusy(false);
    }
  }, []);

  useEffect(() => { void loadStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── States ────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading Search Console…</span>
      </div>
    );
  }

  if (state === 'not_configured') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 px-6 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
          <AlertCircle size={28} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Setup required</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Add these variables to <code className="text-xs bg-black/8 dark:bg-white/10 px-1.5 py-0.5 rounded">.env.local</code> then rebuild Docker:
          </p>
          <div className="mt-3 text-left rounded-xl border border-border bg-black/3 dark:bg-white/3 p-3 text-xs font-mono space-y-1 text-muted-foreground">
            <p>GSC_SITE_URL=<span className="text-foreground">https://denzphuket.com/</span></p>
            <p>GA4_CLIENT_EMAIL=<span className="text-foreground">jd-claude@codicts.iam.gserviceaccount.com</span></p>
            <p>GA4_PRIVATE_KEY=<span className="text-foreground italic">{"<service account private key>"}</span></p>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Ensure the service account has been added as a user in Search Console.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 max-w-lg mx-auto text-center">
        <AlertCircle size={28} className="text-rose-500" />
        <div>
          <h2 className="text-base font-semibold">Failed to load Search Console</h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{loadError}</p>
        </div>
        <button
          onClick={() => { setState('loading'); void loadStats(true); }}
          className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm border border-border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const s       = stats!.summary;
  const siteUrl = stats!.siteUrl;
  const totalClicks = Math.max(stats!.devices.reduce((a, d) => a + d.clicks, 0), 1);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong shrink-0">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Search size={18} className="text-primary" strokeWidth={2} />
            Search Console
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 28 days · {siteUrl}
            {fromCache && stats?.fetchedAt && (
              <span className="ml-2 text-muted-foreground/70">
                · <Clock size={10} className="inline" /> cached {timeAgo(stats.fetchedAt)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => void loadStats(true).then(() => toast.success('Stats refreshed'))}
          disabled={refreshing}
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Clicks"  value={num(s.clicks)}                              icon={MousePointerClick} accent />
          <StatCard label="Impressions"   value={num(s.impressions)}                          icon={Eye} />
          <StatCard label="Avg CTR"       value={pct(s.ctr)}                                  icon={BarChart2}
            sub={s.ctr > 0.05 ? 'Above average' : s.ctr > 0.02 ? 'Average' : 'Below average'} />
          <StatCard label="Avg Position"  value={s.position > 0 ? s.position.toFixed(1) : '—'} icon={Trophy}
            sub={s.position > 0 ? (s.position <= 3 ? 'Top 3' : s.position <= 10 ? 'Page 1' : s.position <= 20 ? 'Page 2' : 'Page 3+') : undefined} />
        </div>

        {/* Daily trend */}
        {(stats!.dailyTrend?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-border bg-white/60 dark:bg-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold">Daily Trend</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(stats!.dailyTrend[0]?.date ?? '')} – {fmtDate(stats!.dailyTrend[stats!.dailyTrend.length - 1]?.date ?? '')}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-sky-400/80" />Impressions</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-rose-500/80" />Clicks</span>
              </div>
            </div>
            <GscTrendChart data={stats!.dailyTrend} />
          </div>
        )}

        {/* Top Queries */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Top Queries</h2>
          <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-black/3 dark:bg-white/3">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Query</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Clicks</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">Impr.</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">CTR</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Pos.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(stats!.topQueries ?? []).map((q, i) => (
                  <tr key={i} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                    <td className="px-3 py-2.5 font-medium truncate max-w-[200px]" title={q.query}>{q.query}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{num(q.clicks)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{num(q.impressions)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{pct(q.ctr)}</td>
                    <td className="px-3 py-2.5 text-right"><PosBadge pos={q.position} /></td>
                  </tr>
                ))}
                {(stats!.topQueries?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No query data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Pages */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Top Pages</h2>
            <TrendingUp size={13} className="text-muted-foreground" />
          </div>
          <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-black/3 dark:bg-white/3">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Page</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Clicks</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">Impr.</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">CTR</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Pos.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(stats!.topPages ?? []).map((p, i) => (
                  <tr key={i} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="font-medium truncate max-w-[200px]" title={p.page}>
                        {stripOrigin(p.page, siteUrl)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{num(p.clicks)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{num(p.impressions)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{pct(p.ctr)}</td>
                    <td className="px-3 py-2.5 text-right"><PosBadge pos={p.position} /></td>
                  </tr>
                ))}
                {(stats!.topPages?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No page data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bottom row: Devices + Countries */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Devices */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Devices</h2>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
              {(stats!.devices ?? []).map((d, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <DeviceIcon device={d.device} />
                  <span className="text-sm font-medium capitalize flex-1">{d.device.toLowerCase()}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{num(d.clicks)} clicks</span>
                  <div className="w-20">
                    <div className="h-1.5 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (d.clicks / totalClicks) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium w-10 text-right tabular-nums">
                    {pct(d.clicks / totalClicks)}
                  </span>
                </div>
              ))}
              {(stats!.devices?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-3">No device data</p>
              )}
            </div>
          </section>

          {/* Countries */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Top Countries</h2>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
              {(stats!.countries ?? []).map((c, i) => {
                const info    = countryInfo(c.country);
                const flag    = flagEmoji(info.a2);
                const clkPct  = s.clicks > 0 ? c.clicks / s.clicks : 0;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base leading-none" aria-hidden>{flag}</span>
                    <span className="text-sm font-medium flex-1 truncate">{info.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{num(c.clicks)}</span>
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right tabular-nums">{pct(clkPct)}</span>
                  </div>
                );
              })}
              {(stats!.countries?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-3">No country data</p>
              )}
            </div>
          </section>

        </div>

        {/* AI Insights */}
        <InsightsPanel
          insights={insights.insights}
          insightsUpdatedAt={insights.insightsUpdatedAt}
          busy={insightsBusy}
          emptyText='Click "Generate Insights" to get AI-powered SEO recommendations.'
          onGenerate={() => void generateInsights()}
        />

      </div>
    </div>
  );
}
