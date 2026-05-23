'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  TrendingUp, RefreshCw, Link2, Link2Off, ChevronRight,
  MousePointerClick, Eye, DollarSign, Target, Zap, Loader2,
  AlertCircle,
} from 'lucide-react';
import { InsightsPanel } from '@/components/ui/insights-panel';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useCurrentStaff } from '@/lib/hooks/useStore';
import { toast } from '@/components/ui/toast';
import type { AdsStats } from '@/lib/google-ads';

// ── Types ────────────────────────────────────────────────────────────────────
interface StatsResponse { stats: AdsStats; fromCache: boolean }
interface InsightsResponse { insights: string | null; insightsUpdatedAt: string | null }
interface CustomerItem  { id: string; formatted: string }

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2) { return `฿${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`; }
function pct(n: number) { return `${(n * 100).toFixed(2)}%`; }
function num(n: number) { return n.toLocaleString(); }
/** Convert YYYY-MM-DD → DD/MM */
function fmtDate(d: string) { return `${d.slice(8, 10)}/${d.slice(5, 7)}`; }
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

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const enabled = status === 'ENABLED';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      enabled ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {enabled ? 'Active' : 'Paused'}
    </span>
  );
}

// ── Daily trend chart ─────────────────────────────────────────────────────────
function AdsChart({ data }: { data: AdsStats['dailyTrend'] }) {
  if (!data || data.length === 0) return null;
  const interval = data.length > 20 ? 6 : data.length > 14 ? 3 : 1;
  const chartData = data.map(d => ({ label: fmtDate(d.date), spend: d.cost, clicks: d.clicks }));
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">30-Day Trend</h2>
      <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 p-4">
        <div className="flex items-center gap-4 mb-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-3 h-0.5 rounded bg-[#f59e0b]" /> Spend (฿)
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-3 h-0.5 rounded bg-[#3b82f6]" /> Clicks
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
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
              yAxisId="spend"
              orientation="left"
              tick={{ fontSize: 10, fill: '#f59e0b', opacity: 0.8 }}
              axisLine={false} tickLine={false}
              width={48}
              tickFormatter={v => v >= 1000 ? `฿${(v / 1000).toFixed(0)}k` : `฿${v}`}
            />
            <YAxis
              yAxisId="clicks"
              orientation="right"
              tick={{ fontSize: 10, fill: '#3b82f6', opacity: 0.8 }}
              axisLine={false} tickLine={false}
              width={36}
              tickFormatter={v => String(v)}
            />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px', padding: '8px 12px' }}
              formatter={(value, name) => name === 'spend'
                ? [fmt(Number(value)), 'Spend']
                : [num(Number(value)), 'Clicks']
              }
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              cursor={{ stroke: 'currentColor', strokeOpacity: 0.1, strokeWidth: 20 }}
            />
            <Area yAxisId="spend"  type="monotone" dataKey="spend"  stroke="#f59e0b" strokeWidth={2} fill="url(#gradSpend)"  dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#f59e0b' }} />
            <Area yAxisId="clicks" type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} fill="url(#gradClicks)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ── Match type badge ──────────────────────────────────────────────────────────
function MatchBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    EXACT: 'bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400',
    PHRASE: 'bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400',
    BROAD: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
  };
  const label: Record<string, string> = { EXACT: 'Exact', PHRASE: 'Phrase', BROAD: 'Broad' };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${map[type] ?? 'bg-border text-muted-foreground'}`}>
      {label[type] ?? type}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdsPage() {
  const me           = useCurrentStaff();
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [state, setState]             = useState<'loading' | 'not_configured' | 'not_connected' | 'choose_customer' | 'ready' | 'error'>('loading');
  const [stats, setStats]             = useState<AdsStats | null>(null);
  const [insights, setInsights]       = useState<InsightsResponse>({ insights: null, insightsUpdatedAt: null });
  const [fromCache, setFromCache]     = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [customers, setCustomers]     = useState<CustomerItem[]>([]);
  const [loadError, setLoadError]     = useState('');
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [manualBusy, setManualBusy]   = useState(false);

  // Manager guard
  if (me?.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">Manager access required.</p>
      </div>
    );
  }

  // ── Load stats ─────────────────────────────────────────────────────────────
  const loadStats = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const res  = await fetch(`/api/ads/stats${force ? '?refresh=true' : ''}`);
      const data = await res.json() as { stats?: AdsStats; fromCache?: boolean; error?: string; message?: string };

      if (!res.ok) {
        if (data.error === 'not_connected') { setState('not_connected'); return; }
        if (data.error === 'not_configured') { setState('not_configured'); return; }
        if (data.error === 'no_customer')    { await loadCustomers(); return; }
        setLoadError(data.message ?? data.error ?? 'Unknown error');
        setState('error');
        return;
      }

      if (data.stats) {
        setStats(data.stats);
        setFromCache(data.fromCache ?? false);
        setState('ready');
        // Also load stored insights (no OpenAI call)
        void loadInsights();
      }
    } catch (e) {
      setLoadError(String(e));
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCustomers = useCallback(async () => {
    const res  = await fetch('/api/ads/customers');
    const data = await res.json() as { customers?: CustomerItem[]; error?: string; message?: string };
    if (!res.ok) {
      if (data.error === 'not_connected') { setState('not_connected'); return; }
      // Show customer picker with manual entry even if auto-detect fails
      setLoadError(data.message ?? data.error ?? 'Could not list accounts automatically');
      setCustomers([]);
      setState('choose_customer');
      return;
    }
    setCustomers(data.customers ?? []);
    setState('choose_customer');
  }, []);

  const loadInsights = useCallback(async () => {
    const res  = await fetch('/api/ads/insights');
    if (!res.ok) return;
    const data = await res.json() as InsightsResponse;
    setInsights(data);
  }, []);

  const generateInsights = useCallback(async () => {
    setInsightsBusy(true);
    try {
      const res  = await fetch('/api/ads/insights', { method: 'POST' });
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

  const selectCustomer = useCallback(async (id: string) => {
    const res = await fetch('/api/ads/select-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: id }),
    });
    if (res.ok) { setState('loading'); void loadStats(); }
  }, [loadStats]);

  const disconnect = useCallback(async () => {
    if (!window.confirm('Disconnect Google Ads?')) return;
    await fetch('/api/ads/disconnect', { method: 'DELETE' });
    setState('not_connected');
    setStats(null);
    setInsights({ insights: null, insightsUpdatedAt: null });
    toast.success('Disconnected');
  }, []);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const connected       = searchParams.get('connected') === 'true';
    const chooseCustomer  = searchParams.get('choose_customer') === 'true';
    const error           = searchParams.get('error');

    // Clear URL params
    if (connected || chooseCustomer || error) {
      router.replace('/ads');
    }

    if (error === 'not_configured') {
      setState('not_configured');
    } else if (chooseCustomer) {
      void loadCustomers();
    } else if (connected) {
      if (error) {
        toast.error(`Connection error: ${error}`);
      } else {
        toast.success('Google Ads connected!');
      }
      void loadStats();
    } else {
      void loadStats();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render states ──────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading Google Ads data…</span>
      </div>
    );
  }

  if (state === 'not_configured') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
          <AlertCircle size={28} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Setup required</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Add <code className="text-xs bg-black/8 dark:bg-white/10 px-1.5 py-0.5 rounded">GOOGLE_ADS_DEVELOPER_TOKEN</code> and{' '}
            <code className="text-xs bg-black/8 dark:bg-white/10 px-1.5 py-0.5 rounded">GOOGLE_ADS_REDIRECT_URI</code> to your{' '}
            <code className="text-xs bg-black/8 dark:bg-white/10 px-1.5 py-0.5 rounded">.env.local</code> file, then rebuild Docker.
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Get your developer token from <strong>Google Ads → Tools → API Center</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'not_connected') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <TrendingUp size={28} className="text-primary" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Connect Google Ads</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View your campaign stats, keyword performance, and get AI-powered recommendations — all without leaving the POS.
          </p>
        </div>
        <div className="space-y-2 text-left w-full rounded-2xl border border-border bg-white/50 dark:bg-white/3 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">You'll need</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><ChevronRight size={12} className="text-primary shrink-0" /> Google Ads account access</li>
            <li className="flex items-center gap-2"><ChevronRight size={12} className="text-primary shrink-0" /> Developer token (from Google Ads → Tools → API Center)</li>
            <li className="flex items-center gap-2"><ChevronRight size={12} className="text-primary shrink-0" /> OpenAI API key (for AI insights — add in Settings)</li>
          </ul>
        </div>
        <button
          onClick={() => { window.location.href = '/api/ads/auth'; }}
          className="flex items-center gap-2 h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          <Link2 size={16} /> Connect Google Ads →
        </button>
      </div>
    );
  }

  if (state === 'choose_customer') {
    const autoFailed = customers.length === 0;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6 max-w-md mx-auto">
        <div className="text-center">
          <h2 className="text-lg font-semibold">
            {autoFailed ? 'Enter your Customer ID' : 'Choose an account'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {autoFailed
              ? 'Auto-detection failed. Enter your Google Ads Customer ID manually.'
              : 'Multiple Google Ads accounts found. Pick which one to track.'}
          </p>
          {autoFailed && loadError && (
            <p className="text-xs text-rose-500 dark:text-rose-400 mt-2 font-mono break-all">{loadError}</p>
          )}
        </div>

        {/* Auto-detected accounts */}
        {customers.length > 0 && (
          <div className="w-full rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {customers.map(c => (
              <button
                key={c.id}
                onClick={() => void selectCustomer(c.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="font-medium tabular-nums">{c.formatted}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Manual entry fallback */}
        <div className="w-full space-y-2">
          {customers.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">— or enter manually —</p>
          )}
          <div className="flex gap-2">
            <input
              value={manualCustomerId}
              onChange={e => setManualCustomerId(e.target.value.replace(/[^0-9-]/g, ''))}
              placeholder="123-456-7890"
              className="flex-1 h-10 px-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-border focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
            />
            <button
              disabled={manualBusy || !manualCustomerId.trim()}
              onClick={async () => {
                setManualBusy(true);
                try { await selectCustomer(manualCustomerId); }
                finally { setManualBusy(false); }
              }}
              className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {manualBusy ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              Use this ID
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Find it in Google Ads → click your account name at the top → the number shown (e.g. 123-456-7890).
          </p>
        </div>

        <button onClick={disconnect} className="text-xs text-muted-foreground hover:text-rose-500 cursor-pointer">
          Disconnect and start over
        </button>
      </div>
    );
  }

  if (state === 'error') {
    const isTokenError = loadError.includes('DEVELOPER_TOKEN_INVALID') || loadError.includes('developer token');
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 max-w-lg mx-auto text-center">
        <AlertCircle size={28} className="text-rose-500" />
        <div>
          <h2 className="text-base font-semibold">
            {isTokenError ? 'Invalid developer token' : 'Failed to load stats'}
          </h2>
          {isTokenError ? (
            <p className="text-sm text-muted-foreground mt-1">
              Your Google Ads developer token is missing or invalid. Get it from{' '}
              <strong>Google Ads → Tools & Settings → API Center</strong>, add it as{' '}
              <code className="text-xs bg-black/8 dark:bg-white/10 px-1 py-0.5 rounded">GOOGLE_ADS_DEVELOPER_TOKEN</code>{' '}
              in <code className="text-xs bg-black/8 dark:bg-white/10 px-1 py-0.5 rounded">.env.local</code>, then rebuild Docker.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1 font-mono text-xs break-all">{loadError}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadStats()} className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer">
            <RefreshCw size={13} /> Retry
          </button>
          <button onClick={disconnect} className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer">
            <Link2Off size={13} /> Disconnect
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const s = stats!.summary;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border glass-strong shrink-0">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" strokeWidth={2} />
            Google Ads
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last 30 days · account {stats!.customerId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}
            {fromCache && stats?.fetchedAt && (
              <span className="ml-2 text-muted-foreground/70">· cached {timeAgo(stats.fetchedAt)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadStats(true)}
            disabled={refreshing}
            title="Refresh data from Google Ads"
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border border-border bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={disconnect}
            title="Disconnect Google Ads"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-white/50 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-700 transition-colors cursor-pointer"
          >
            <Link2Off size={14} />
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Impressions"  value={num(s.impressions)}         icon={Eye}              />
          <StatCard label="Clicks"       value={num(s.clicks)}              icon={MousePointerClick}/>
          <StatCard label="CTR"          value={pct(s.ctr)}                 icon={Target}           />
          <StatCard label="Total Spend"  value={fmt(s.cost)}                icon={DollarSign} accent/>
          <StatCard label="Avg. CPC"     value={fmt(s.averageCpc)}          icon={DollarSign}       />
          <StatCard label="Conversions"  value={String(s.conversions.toFixed(0))} icon={Zap}       sub={s.roas > 0 ? `${s.roas.toFixed(2)}x ROAS` : undefined} />
        </div>

        {/* 30-day trend chart */}
        {stats?.dailyTrend && stats.dailyTrend.length > 0 && (
          <AdsChart data={stats.dailyTrend} />
        )}

        {/* Campaigns + Keywords side by side */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Campaigns */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Campaigns</h2>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-black/3 dark:bg-white/3">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Campaign</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Spend</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Clicks</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">CTR</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats?.campaigns ?? []).map(c => (
                    <tr key={c.id} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                      <td className="px-3 py-2.5 font-medium truncate max-w-[140px]">{c.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.cost)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(c.clicks)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{pct(c.ctr)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                  {(stats?.campaigns?.length ?? 0) === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No campaign data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top Keywords */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Top Keywords by Spend</h2>
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-white/3 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-black/3 dark:bg-white/3">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Keyword</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Spend</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">CTR</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Conv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats?.topKeywords ?? []).map((k, i) => (
                    <tr key={i} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate max-w-[120px]">{k.text}</span>
                          <MatchBadge type={k.matchType} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(k.cost)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{pct(k.ctr)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{k.conversions}</td>
                    </tr>
                  ))}
                  {(stats?.topKeywords?.length ?? 0) === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No keyword data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Low CTR Keywords */}
        {(stats?.lowCtrKeywords?.length ?? 0) > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500" />
              Underperforming Keywords
              <span className="text-xs font-normal text-muted-foreground">— high spend, below-average CTR</span>
            </h2>
            <div className="rounded-2xl border border-amber-200 dark:border-amber-700/30 bg-amber-50/50 dark:bg-amber-900/5 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-amber-200 dark:border-amber-700/30 bg-amber-100/50 dark:bg-amber-900/10">
                    <th className="text-left px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Keyword</th>
                    <th className="text-right px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Impressions</th>
                    <th className="text-right px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">CTR</th>
                    <th className="text-right px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Spend</th>
                    <th className="text-right px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Conv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200/50 dark:divide-amber-700/20">
                  {(stats?.lowCtrKeywords ?? []).map((k, i) => (
                    <tr key={i} className="hover:bg-amber-100/30 dark:hover:bg-amber-900/10 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate max-w-[150px]">{k.text}</span>
                          <MatchBadge type={k.matchType} />
                        </div>
                        <div className="text-muted-foreground truncate max-w-[150px]">{k.campaign}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(k.impressions)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{pct(k.ctr)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(k.cost)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{k.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* AI Insights */}
        <InsightsPanel
          insights={insights.insights}
          insightsUpdatedAt={insights.insightsUpdatedAt}
          busy={insightsBusy}
          emptyText='Click "Generate Insights" to get AI-powered recommendations for your ads.'
          onGenerate={() => void generateInsights()}
        />

      </div>
    </div>
  );
}
