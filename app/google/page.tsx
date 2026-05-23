'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Layers, RefreshCw, TrendingUp, LineChart, Search,
  ChevronRight, Loader2, WifiOff, AlertCircle,
  Eye, MousePointerClick, DollarSign, Zap, Target,
  Users, BarChart2, Clock, Trophy,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from 'recharts';
import { useCurrentStaff } from '@/lib/hooks/useStore';
import type { AdsStats } from '@/lib/google-ads';
import type { GaStats } from '@/lib/google-analytics';
import type { GscStats } from '@/lib/google-search-console';

// ── Types ─────────────────────────────────────────────────────────────────────
type ServiceState = 'loading' | 'ready' | 'not_connected' | 'not_configured' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────
function num(n: number)  { return Math.round(n).toLocaleString(); }
function fmt(n: number)  { return `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function pct(n: number)  { return `${(n * 100).toFixed(1)}%`; }
function dur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Mini stat ─────────────────────────────────────────────────────────────────
function Mini({ label, value, icon: Icon, iconBg, iconColor }: {
  label: string; value: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-black/3 dark:bg-white/4">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${iconBg}`}>
        <Icon size={14} className={iconColor} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold tabular-nums truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Spark({ data, dataKey, color }: { data: Record<string, unknown>[]; dataKey: string; color: string }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', padding: '4px 8px' }}
          itemStyle={{ color: 'var(--foreground)' }}
          labelStyle={{ display: 'none' }}
          formatter={(v: unknown) => [typeof v === 'number' && dataKey === 'cost' ? fmt(v) : num(Number(v)), '']}
          cursor={false}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#grad-${dataKey})`}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Service section shell ─────────────────────────────────────────────────────
function ServiceCard({
  state, icon: Icon, label, href, accentBorder, children,
}: {
  state: ServiceState;
  icon: React.ElementType;
  label: string;
  href: string;
  accentBorder: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-white/60 dark:bg-white/4 overflow-hidden flex flex-col border-t-2 ${accentBorder}`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-muted-foreground" strokeWidth={1.8} />
          <span className="text-sm font-semibold">{label}</span>
          {state === 'loading' && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        </div>
        {state === 'ready' && (
          <Link href={href} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Details <ChevronRight size={12} />
          </Link>
        )}
      </div>

      {/* Card body */}
      <div className="flex-1 p-4">
        {state === 'loading' && (
          <div className="flex items-center justify-center h-36 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {(state === 'not_connected' || state === 'not_configured') && (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-center">
            <WifiOff size={20} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {state === 'not_configured' ? 'Setup required' : 'Not connected'}
            </p>
            <Link href={href} className="text-xs text-primary hover:underline">
              Go to {label} →
            </Link>
          </div>
        )}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-center">
            <AlertCircle size={20} className="text-rose-500" />
            <p className="text-xs text-muted-foreground">Failed to load</p>
            <Link href={href} className="text-xs text-primary hover:underline">
              Check {label} →
            </Link>
          </div>
        )}
        {state === 'ready' && children}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GoogleOverviewPage() {
  const me = useCurrentStaff();

  const [adsState,  setAdsState]  = useState<ServiceState>('loading');
  const [adsStats,  setAdsStats]  = useState<AdsStats | null>(null);

  const [gaState,   setGaState]   = useState<ServiceState>('loading');
  const [gaStats,   setGaStats]   = useState<GaStats | null>(null);

  const [gscState,  setGscState]  = useState<ServiceState>('loading');
  const [gscStats,  setGscStats]  = useState<GscStats | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  if (me?.role !== 'manager') {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Manager access required.
      </div>
    );
  }

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchAds = useCallback(async (force = false) => {
    setAdsState('loading');
    try {
      const res  = await fetch(`/api/ads/stats${force ? '?refresh=true' : ''}`);
      const data = await res.json() as { stats?: AdsStats; error?: string };
      if (!res.ok) {
        if (data.error === 'not_connected') { setAdsState('not_connected'); return; }
        if (data.error === 'not_configured') { setAdsState('not_configured'); return; }
        setAdsState('error'); return;
      }
      if (data.stats) { setAdsStats(data.stats); setAdsState('ready'); }
    } catch { setAdsState('error'); }
  }, []);

  const fetchGa = useCallback(async (force = false) => {
    setGaState('loading');
    try {
      const res  = await fetch(`/api/analytics/stats${force ? '?refresh=true' : ''}`);
      const data = await res.json() as { stats?: GaStats; error?: string };
      if (!res.ok) {
        if (data.error === 'not_configured') { setGaState('not_configured'); return; }
        setGaState('error'); return;
      }
      if (data.stats) { setGaStats(data.stats); setGaState('ready'); }
    } catch { setGaState('error'); }
  }, []);

  const fetchGsc = useCallback(async (force = false) => {
    setGscState('loading');
    try {
      const res  = await fetch(`/api/gsc/stats${force ? '?refresh=true' : ''}`);
      const data = await res.json() as { stats?: GscStats; error?: string };
      if (!res.ok) {
        if (data.error === 'not_configured') { setGscState('not_configured'); return; }
        setGscState('error'); return;
      }
      if (data.stats) { setGscStats(data.stats); setGscState('ready'); }
    } catch { setGscState('error'); }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAds(true), fetchGa(true), fetchGsc(true)]);
    setRefreshing(false);
  }, [fetchAds, fetchGa, fetchGsc]);

  useEffect(() => {
    void Promise.all([fetchAds(), fetchGa(), fetchGsc()]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived summary numbers (for top strip) ──────────────────────────────
  const totalSpend   = adsStats?.summary.cost ?? null;
  const totalSessions = gaStats?.summary.sessions ?? null;
  const organicClicks = gscStats?.summary.clicks ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong shrink-0">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Layers size={18} className="text-primary" strokeWidth={2} />
            Google Overview
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ads · Analytics · Search Console — last 30 days
          </p>
        </div>
        <button
          onClick={() => void refreshAll()}
          disabled={refreshing}
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh All'}
        </button>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Top-line summary strip */}
        <div className="grid grid-cols-3 gap-3">
          {/* Ads spend */}
          <div className="flex flex-row items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/10 p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-amber-100 dark:bg-amber-900/30">
              <DollarSign size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold tabular-nums truncate">
                {adsState === 'ready' && totalSpend !== null ? fmt(totalSpend) : adsState === 'loading' ? '…' : '—'}
              </p>
              <p className="text-xs font-medium text-foreground/80">Ad Spend</p>
              <p className="text-[11px] text-muted-foreground">Google Ads · 30d</p>
            </div>
          </div>

          {/* Analytics sessions */}
          <div className="flex flex-row items-center gap-3 rounded-2xl border border-primary/20 dark:border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-primary/10">
              <Users size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold tabular-nums truncate text-primary">
                {gaState === 'ready' && totalSessions !== null ? num(totalSessions) : gaState === 'loading' ? '…' : '—'}
              </p>
              <p className="text-xs font-medium text-foreground/80">Sessions</p>
              <p className="text-[11px] text-muted-foreground">Analytics · 30d</p>
            </div>
          </div>

          {/* GSC clicks */}
          <div className="flex flex-row items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-700/30 bg-emerald-50 dark:bg-emerald-900/10 p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-emerald-100 dark:bg-emerald-900/30">
              <MousePointerClick size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold tabular-nums truncate">
                {gscState === 'ready' && organicClicks !== null ? num(organicClicks) : gscState === 'loading' ? '…' : '—'}
              </p>
              <p className="text-xs font-medium text-foreground/80">Organic Clicks</p>
              <p className="text-[11px] text-muted-foreground">Search Console · 28d</p>
            </div>
          </div>
        </div>

        {/* Three service cards */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* ── Google Ads ── */}
          <ServiceCard state={adsState} icon={TrendingUp} label="Google Ads" href="/ads" accentBorder="border-t-amber-400">
            {adsStats && (() => {
              const s = adsStats.summary;
              const sparkData = adsStats.dailyTrend.map(d => ({ cost: d.cost, clicks: d.clicks }));
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Mini label="Impressions" value={num(s.impressions)} icon={Eye}              iconBg="bg-sky-100 dark:bg-sky-900/20"     iconColor="text-sky-600 dark:text-sky-400" />
                    <Mini label="Clicks"      value={num(s.clicks)}      icon={MousePointerClick} iconBg="bg-blue-100 dark:bg-blue-900/20"   iconColor="text-blue-600 dark:text-blue-400" />
                    <Mini label="Avg. CPC"    value={fmt(s.averageCpc)}  icon={DollarSign}       iconBg="bg-amber-100 dark:bg-amber-900/20"  iconColor="text-amber-600 dark:text-amber-400" />
                    <Mini label="ROAS"        value={s.roas > 0 ? `${s.roas.toFixed(2)}×` : '—'} icon={Zap} iconBg="bg-emerald-100 dark:bg-emerald-900/20" iconColor="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Spend trend</p>
                    <Spark data={sparkData} dataKey="cost" color="#f59e0b" />
                  </div>
                </div>
              );
            })()}
          </ServiceCard>

          {/* ── Analytics ── */}
          <ServiceCard state={gaState} icon={LineChart} label="Analytics" href="/analytics" accentBorder="border-t-blue-400">
            {gaStats && (() => {
              const s = gaStats.summary;
              const sparkData = gaStats.dailyTrend.map(d => ({ sessions: d.sessions }));
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Mini label="Users"        value={num(s.users)}               icon={Users}     iconBg="bg-sky-100 dark:bg-sky-900/20"     iconColor="text-sky-600 dark:text-sky-400" />
                    <Mini label="Page Views"   value={num(s.pageViews)}           icon={Eye}       iconBg="bg-emerald-100 dark:bg-emerald-900/20" iconColor="text-emerald-600 dark:text-emerald-400" />
                    <Mini label="Bounce Rate"  value={pct(s.bounceRate)}          icon={BarChart2} iconBg="bg-amber-100 dark:bg-amber-900/20"   iconColor="text-amber-600 dark:text-amber-400" />
                    <Mini label="Avg Duration" value={dur(s.avgSessionDuration)}  icon={Clock}     iconBg="bg-teal-100 dark:bg-teal-900/20"     iconColor="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Sessions trend</p>
                    <Spark data={sparkData} dataKey="sessions" color="#3b82f6" />
                  </div>
                </div>
              );
            })()}
          </ServiceCard>

          {/* ── Search Console ── */}
          <ServiceCard state={gscState} icon={Search} label="Search Console" href="/gsc" accentBorder="border-t-emerald-400">
            {gscStats && (() => {
              const s = gscStats.summary;
              const sparkData = gscStats.dailyTrend.map(d => ({ clicks: d.clicks }));
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Mini label="Impressions"  value={num(s.impressions)}                           icon={Eye}      iconBg="bg-sky-100 dark:bg-sky-900/20"     iconColor="text-sky-600 dark:text-sky-400" />
                    <Mini label="Avg CTR"      value={pct(s.ctr)}                                   icon={BarChart2} iconBg="bg-violet-100 dark:bg-violet-900/20" iconColor="text-violet-600 dark:text-violet-400" />
                    <Mini label="Avg Position" value={s.position > 0 ? s.position.toFixed(1) : '—'} icon={Trophy}  iconBg="bg-amber-100 dark:bg-amber-900/20"   iconColor="text-amber-600 dark:text-amber-400" />
                    <Mini label="Top Query"    value={gscStats.topQueries[0]?.query ?? '—'}         icon={Search}  iconBg="bg-emerald-100 dark:bg-emerald-900/20" iconColor="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Clicks trend</p>
                    <Spark data={sparkData} dataKey="clicks" color="#10b981" />
                  </div>
                </div>
              );
            })()}
          </ServiceCard>

        </div>

        {/* Cross-service table: Top Campaigns vs Top Queries */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Top Campaigns */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp size={13} className="text-amber-500" /> Top Campaigns
              </h2>
              <Link href="/ads" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                All <ChevronRight size={11} />
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden">
              {adsState === 'loading' && (
                <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
              )}
              {adsState === 'ready' && adsStats && adsStats.campaigns.slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                  <span className="text-xs font-medium flex-1 truncate">{c.name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.status === 'ENABLED' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
                    {c.status === 'ENABLED' ? 'Active' : 'Paused'}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">{fmt(c.cost)}</span>
                </div>
              ))}
              {(adsState === 'not_connected' || adsState === 'not_configured' || adsState === 'error') && (
                <p className="px-4 py-4 text-xs text-muted-foreground text-center">Not available</p>
              )}
            </div>
          </section>

          {/* Top Queries */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Search size={13} className="text-emerald-500" /> Top Search Queries
              </h2>
              <Link href="/gsc" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                All <ChevronRight size={11} />
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden">
              {gscState === 'loading' && (
                <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
              )}
              {gscState === 'ready' && gscStats && gscStats.topQueries.slice(0, 4).map((q, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                  <span className="text-xs font-medium flex-1 truncate">{q.query}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{num(q.clicks)} clicks</span>
                  <span className="text-xs tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">#{q.position.toFixed(0)}</span>
                </div>
              ))}
              {(gscState === 'not_connected' || gscState === 'not_configured' || gscState === 'error') && (
                <p className="px-4 py-4 text-xs text-muted-foreground text-center">Not available</p>
              )}
            </div>
          </section>

        </div>

        {/* Traffic Sources from Analytics */}
        {gaState === 'ready' && gaStats && gaStats.channels.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <LineChart size={13} className="text-blue-500" /> Traffic Sources
              </h2>
              <Link href="/analytics" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                Full report <ChevronRight size={11} />
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden divide-y divide-border">
              {gaStats.channels.slice(0, 5).map((ch, i) => {
                const total = gaStats.channels.reduce((a, c) => a + c.sessions, 0);
                const pctVal = total > 0 ? ch.sessions / total : 0;
                const COLORS: Record<string, string> = {
                  'Organic Search': 'bg-emerald-500', 'Direct': 'bg-sky-500',
                  'Organic Social': 'bg-violet-500',  'Referral': 'bg-amber-500',
                  'Paid Search': 'bg-rose-500',       'Email': 'bg-orange-500',
                };
                const bar = COLORS[ch.channel] ?? 'bg-primary';
                return (
                  <div key={i} className="px-4 py-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{ch.channel}</span>
                      <span className="text-muted-foreground tabular-nums">{num(ch.sessions)} ({(pctVal * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="h-1 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pctVal * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
