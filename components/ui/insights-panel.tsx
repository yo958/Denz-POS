'use client';

import { Sparkles, Loader2, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h === 1) return '1 hour ago';
  if (h < 24) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

interface InsightsPanelProps {
  insights:          string | null;
  insightsUpdatedAt: string | null;
  busy:              boolean;
  emptyText?:        string;
  onGenerate:        () => void;
}

export function InsightsPanel({
  insights,
  insightsUpdatedAt,
  busy,
  emptyText = 'Click "Generate Insights" to get AI-powered recommendations.',
  onGenerate,
}: InsightsPanelProps) {
  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles size={14} className="text-violet-500" />
          AI Insights
          {insightsUpdatedAt && (
            <span className="text-xs font-normal text-muted-foreground flex items-center gap-1 ml-1">
              <Clock size={10} /> {timeAgo(insightsUpdatedAt)}
            </span>
          )}
        </h2>
        <button
          onClick={onGenerate}
          disabled={busy}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 active:scale-95 disabled:opacity-60 transition-all cursor-pointer"
        >
          {busy
            ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
            : <><Sparkles size={12} /> {insights ? 'Regenerate' : 'Generate Insights'}</>
          }
        </button>
      </div>

      {/* Empty state */}
      {!insights ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <Sparkles size={24} className="mx-auto mb-3 text-violet-400" strokeWidth={1.5} />
          <p className="text-sm font-medium">No insights yet</p>
          <p className="text-sm mt-1 text-muted-foreground/80">{emptyText}</p>
          <p className="text-xs mt-2 text-muted-foreground/60">
            Requires an OpenAI API key — add it in <strong className="font-semibold text-muted-foreground">Settings → AI Settings</strong>.
          </p>
        </div>
      ) : (
        /* Insights card */
        <div className="rounded-2xl border border-violet-200 dark:border-violet-700/30 overflow-hidden">
          <ReactMarkdown
            components={{
              // ### Section headings — full-width tinted strip
              h3: ({ children }) => (
                <div className="flex items-center gap-2 px-5 py-3 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800/30">
                  <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
                  <h3 className="text-sm font-semibold text-foreground">{children}</h3>
                </div>
              ),
              // Unordered list — contains li items
              ul: ({ children }) => (
                <ul className="px-5 py-3 space-y-2.5 bg-white/60 dark:bg-white/3 border-b border-violet-100/60 dark:border-violet-800/20 last:border-0">
                  {children}
                </ul>
              ),
              // Ordered list
              ol: ({ children }) => (
                <ol className="px-5 py-3 space-y-2.5 bg-white/60 dark:bg-white/3 border-b border-violet-100/60 dark:border-violet-800/20 last:border-0 list-none">
                  {children}
                </ol>
              ),
              // List item — violet chevron bullet
              li: ({ children }) => (
                <li className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
                  <span className="text-violet-400 shrink-0 mt-0.5 text-base leading-none">›</span>
                  <span>{children}</span>
                </li>
              ),
              // Standalone paragraphs (intro text between heading and list, or solo sections)
              p: ({ children }) => (
                <p className="px-5 py-3 text-sm text-muted-foreground leading-relaxed bg-white/60 dark:bg-white/3 border-b border-violet-100/60 dark:border-violet-800/20 last:border-0">
                  {children}
                </p>
              ),
              // Bold text — stands out against muted body copy
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
              // Inline code
              code: ({ children }) => (
                <code className="text-[11px] bg-black/8 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono">
                  {children}
                </code>
              ),
            }}
          >
            {insights}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
}
