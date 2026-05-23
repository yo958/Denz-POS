'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart2, RefreshCw, Users, Eye, MousePointerClick,
  Globe, Monitor, Smartphone, Tablet, Loader2, AlertCircle, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useCurrentStaff } from '@/lib/hooks/useStore';
import { toast } from '@/components/ui/toast';
import type { GaStats } from '@/lib/google-analytics';

// ── Helpers ──────────────────────────────────────────────────────────────────
function num(n: number) { return Math.round(n).toLocaleString(); }
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function dur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function fmtDate(yyyymmdd: string) {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}`;
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

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false, iconBg, iconColor }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent?: boolean;
  iconBg?: string; iconColor?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-row items-center gap-3 ${accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-white/50 dark:bg-white/3'}`}>
      <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${iconBg ?? (accent ? 'bg-primary/10' : 'bg-black/5 dark:bg-white/8')}`}>
        <Icon size={16} className={iconColor ?? (accent ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold tabular-nums truncate ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
        <p className="text-xs font-medium text-foreground/80">{label}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Sessions area chart ───────────────────────────────────────────────────────
function SessionsChart({ data }: { data: Array<{ date: string; sessions: number }> }) {
  if (!data.length) return null;
  const chartData = data.map(d => ({ label: fmtDate(d.date), sessions: d.sessions }));
  const interval  = data.length > 20 ? 4 : data.length > 10 ? 2 : 0;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.45 }}
          axisLine={false} tickLine={false}
          interval={interval}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.45 }}
          axisLine={false} tickLine={false} width={36}
          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px', padding: '8px 12px' }}
          formatter={(value: unknown) => [num(Number(value)), 'Sessions']}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          cursor={{ stroke: 'currentColor', strokeOpacity: 0.1, strokeWidth: 20 }}
        />
        <Area type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} fill="url(#gradSessions)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Horizontal bar ────────────────────────────────────────────────────────────
function HBar({ label, value, pctVal, color = 'bg-primary' }: {
  label: string; value: string; pctVal: number; color?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium truncate max-w-[60%]">{label}</span>
        <span className="text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, pctVal * 100)}%` }} />
      </div>
    </div>
  );
}

// ── Device icon ───────────────────────────────────────────────────────────────
function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase();
  if (d === 'mobile') return <Smartphone size={14} className="text-muted-foreground" />;
  if (d === 'tablet') return <Tablet size={14} className="text-muted-foreground" />;
  return <Monitor size={14} className="text-muted-foreground" />;
}

// ── Channel colour ────────────────────────────────────────────────────────────
const CHANNEL_COLORS: Record<string, string> = {
  'Organic Search':  'bg-emerald-500',
  'Direct':          'bg-sky-500',
  'Organic Social':  'bg-violet-500',
  'Referral':        'bg-amber-500',
  'Paid Search':     'bg-rose-500',
  'Email':           'bg-orange-500',
  'Paid Social':     'bg-pink-500',
  'Unassigned':      'bg-slate-400',
};
function channelColor(ch: string) {
  return CHANNEL_COLORS[ch] ?? 'bg-primary';
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const me = useCurrentStaff();

  const [state, setState]           = useState<'loading' | 'not_configured' | 'ready' | 'error'>('loading');
  const [stats, setStats]           = useState<GaStats | null>(null);
  const [fromCache, setFromCache]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError]   = useState('');

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
      const res  = await fetch(`/api/analytics/stats${force ? '?refresh=true' : ''}`);
      const data = await res.json() as { stats?: GaStats; fromCache?: boolean; error?: string; message?: string };

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
      }
    } catch (e) {
      setLoadError(String(e));
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── States ────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading Analytics…</span>
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
            Add these three variables to <code className="text-xs bg-black/8 dark:bg-white/10 px-1.5 py-0.5 rounded">.env.local</code> then rebuild Docker:
          </p>
          <div className="mt-3 text-left rounded-xl border border-border bg-black/3 dark:bg-white/3 p-3 text-xs font-mono space-y-1 text-muted-foreground">
            <p>GA4_PROPERTY_ID=<span className="text-foreground">376105042</span></p>
            <p>GA4_CLIENT_EMAIL=<span className="text-foreground">jd-claude@codicts.iam.gserviceaccount.com</span></p>
            <p>GA4_PRIVATE_KEY=<span className="text-foreground italic">{"<private key — see instructions>"}</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 max-w-lg mx-auto text-center">
        <AlertCircle size={28} className="text-rose-500" />
        <div>
          <h2 className="text-base font-semibold">Failed to load Analytics</h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{loadError}</p>
        </div>
        <button onClick={() => { setState('loading'); void loadStats(true); }} className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm border border-border hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const s = stats!.summary;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong shrink-0">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <BarChart2 size={18} className="text-primary" strokeWidth={2} />
            Google Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 30 days · property {stats!.propertyId}
            {fromCache && stats?.fetchedAt && (
              <span className="ml-2 text-muted-foreground/70 flex-inline items-center gap-1">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Sessions"     value={num(s.sessions)}            icon={MousePointerClick} accent />
          <StatCard label="Users"        value={num(s.users)}               icon={Users}     iconBg="bg-sky-100 dark:bg-sky-900/20"     iconColor="text-sky-600 dark:text-sky-400" />
          <StatCard label="New Users"    value={num(s.newUsers)}            icon={Users}     iconBg="bg-violet-100 dark:bg-violet-900/20" iconColor="text-violet-600 dark:text-violet-400" sub={`${pct(s.users > 0 ? s.newUsers / s.users : 0)} of users`} />
          <StatCard label="Page Views"   value={num(s.pageViews)}           icon={Eye}       iconBg="bg-emerald-100 dark:bg-emerald-900/20" iconColor="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Bounce Rate"  value={pct(s.bounceRate)}          icon={BarChart2} iconBg="bg-amber-100 dark:bg-amber-900/20"   iconColor="text-amber-600 dark:text-amber-400" sub={s.bounceRate < 0.4 ? 'Great' : s.bounceRate < 0.6 ? 'Average' : 'High'} />
          <StatCard label="Avg Duration" value={dur(s.avgSessionDuration)}  icon={Clock}     iconBg="bg-teal-100 dark:bg-teal-900/20"     iconColor="text-teal-600 dark:text-teal-400" />
        </div>

        {/* Daily trend */}
        {(stats!.dailyTrend?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-border bg-white/60 dark:bg-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold">Daily Sessions</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(stats!.dailyTrend[0]?.date ?? '')} – {fmtDate(stats!.dailyTrend[stats!.dailyTrend.length - 1]?.date ?? '')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/80" />
                Sessions
              </div>
            </div>
            <SessionsChart data={stats!.dailyTrend} />
          </div>
        )}

        {/* Middle row: Top Pages + Traffic Channels */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Top Pages */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Top Pages</h2>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-black/3 dark:bg-white/3">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Page</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Views</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Sessions</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Avg time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats!.topPages ?? []).map((p, i) => (
                    <tr key={i} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="font-medium truncate max-w-[160px]" title={p.title}>{p.title || '(no title)'}</p>
                        <p className="text-muted-foreground truncate max-w-[160px]" title={p.path}>{p.path}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(p.pageViews)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(p.sessions)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{dur(p.avgTimeSec)}</td>
                    </tr>
                  ))}
                  {(stats!.topPages?.length ?? 0) === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No page data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Traffic Channels */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Traffic Sources</h2>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 p-4 space-y-3">
              {(stats!.channels ?? []).map((c, i) => (
                <HBar
                  key={i}
                  label={c.channel}
                  value={`${num(c.sessions)} (${pct(c.pct)})`}
                  pctVal={c.pct}
                  color={channelColor(c.channel)}
                />
              ))}
              {(stats!.channels?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No channel data</p>
              )}
            </div>
          </section>
        </div>

        {/* Bottom row: Devices + Countries */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Devices */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Devices</h2>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 divide-y divide-border">
              {(stats!.devices ?? []).map((d, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <DeviceIcon device={d.device} />
                  <span className="text-sm font-medium capitalize flex-1">{d.device}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{num(d.sessions)}</span>
                  <div className="w-20">
                    <div className="h-1.5 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, d.pct * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-medium w-10 text-right tabular-nums">{pct(d.pct)}</span>
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
              {(stats!.countries ?? []).map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Globe size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{c.country}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{num(c.sessions)}</span>
                  <span className="text-xs font-medium text-muted-foreground w-10 text-right tabular-nums">{pct(c.pct)}</span>
                </div>
              ))}
              {(stats!.countries?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-3">No country data</p>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
