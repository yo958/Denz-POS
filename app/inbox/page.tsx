'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Inbox, Mail, RefreshCw, Reply, Send, ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useCurrentStaff } from '@/lib/hooks/useStore';
import { getStore } from '@/lib/store/store';
import { toast } from '@/components/ui/toast';

/* ── types ──────────────────────────────────────────────────────── */

interface GmailListItem {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
}

interface EmailDetail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyHtml: string;
  messageId: string;
  references: string;
}

/* ── helpers ────────────────────────────────────────────────────── */

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^"?([^"<]+?)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: from, email: from };
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / 3_600_000;
    if (diffH < 1)  return `${Math.max(1, Math.round(diffMs / 60_000))}m ago`;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 48) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

/* ── sub-components ─────────────────────────────────────────────── */

function EmailListItem({
  email,
  selected,
  onClick,
}: {
  email: GmailListItem;
  selected: boolean;
  onClick: () => void;
}) {
  const { name, email: addr } = parseFrom(email.from);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        selected
          ? 'bg-primary/8 border-primary/20'
          : 'border-transparent hover:bg-black/4 dark:hover:bg-white/4'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {email.isUnread && (
          <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-primary" />
        )}
        {!email.isUnread && <span className="mt-1.5 shrink-0 w-2 h-2" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-sm truncate ${email.isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
              {name || addr}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{formatDate(email.date)}</span>
          </div>
          <p className={`text-xs truncate mb-0.5 ${email.isUnread ? 'font-medium text-foreground/80' : 'text-muted-foreground'}`}>
            {email.subject}
          </p>
          <p className="text-xs text-muted-foreground/70 truncate">{email.snippet}</p>
        </div>
      </div>
    </button>
  );
}

/* ── page ────────────────────────────────────────────────────────── */

type PageState = 'loading' | 'not-connected' | 'ready' | 'error';

export default function InboxPage() {
  const me           = useCurrentStaff();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const store        = getStore();

  const [pageState, setPageState]     = useState<PageState>('loading');
  const [gmailAddress, setAddress]    = useState('');
  const [emails, setEmails]           = useState<GmailListItem[]>([]);
  const [nextPageToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [detail, setDetail]               = useState<EmailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mobileDetail, setMobileDetail]   = useState(false);

  const [replying, setReplying]     = useState(false);
  const [replyText, setReplyText]   = useState('');
  const [sending, setSending]       = useState(false);

  const replyRef = useRef<HTMLTextAreaElement>(null);

  /* ── manager gate ──────────────────────────────────────────────── */

  if (me && me.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-8">
        <AlertCircle size={32} className="text-muted-foreground/50" />
        <p className="text-sm font-medium">Manager access required</p>
      </div>
    );
  }

  /* ── fetch helpers ─────────────────────────────────────────────── */

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchMessages = useCallback(async (pageToken?: string) => {
    try {
      const url = pageToken
        ? `/api/gmail/messages?pageToken=${encodeURIComponent(pageToken)}`
        : '/api/gmail/messages';
      const res = await fetch(url);

      if (res.status === 401) {
        setPageState('not-connected');
        return;
      }
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json() as {
        messages: GmailListItem[];
        nextPageToken: string | null;
        gmailAddress: string;
      };

      if (pageToken) {
        setEmails(prev => [...prev, ...data.messages]);
      } else {
        setEmails(data.messages);
      }
      setNextToken(data.nextPageToken);
      setAddress(data.gmailAddress);
      setPageState('ready');
    } catch {
      setPageState('error');
      setErrorMsg('Failed to load inbox. Check your connection and try again.');
    }
  }, []);

  /* ── handle URL params on mount ────────────────────────────────── */

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error     = searchParams.get('error');

    if (connected === 'true') {
      router.replace('/inbox');
      fetchMessages().then(() => {
        if (me) store.log('gmail.connect', me.id, 'Gmail connected');
        toast.success('Gmail connected successfully');
      });
      return;
    }

    if (error === 'no_refresh_token') {
      setPageState('not-connected');
      setErrorMsg('Google didn\'t return a refresh token. Please try connecting again — make sure to click "Allow" on the consent screen.');
      router.replace('/inbox');
      return;
    }

    if (error) {
      setPageState('not-connected');
      setErrorMsg('Something went wrong during Gmail sign-in. Please try again.');
      router.replace('/inbox');
      return;
    }

    fetchMessages();
  // only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── load email detail ─────────────────────────────────────────── */

  async function openEmail(email: GmailListItem) {
    setSelectedId(email.id);
    setMobileDetail(true);
    setDetail(null);
    setReplying(false);
    setReplyText('');
    setLoadingDetail(true);

    try {
      const res = await fetch(`/api/gmail/messages/${email.id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as EmailDetail;
      setDetail(data);

      // optimistically mark as read in list
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isUnread: false } : e));
    } catch {
      toast.error('Failed to load email');
    } finally {
      setLoadingDetail(false);
    }
  }

  /* ── send reply ────────────────────────────────────────────────── */

  async function sendReply() {
    if (!detail || !replyText.trim()) return;
    setSending(true);
    try {
      const { name: fromName, email: fromEmail } = parseFrom(detail.from);
      const replyTo = fromEmail || detail.from;
      const subject = detail.subject.startsWith('Re:') ? detail.subject : `Re: ${detail.subject}`;

      const res = await fetch('/api/gmail/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: detail.threadId,
          to: replyTo,
          subject,
          inReplyTo: detail.messageId,
          references: detail.references,
          bodyText: replyText,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      if (me) store.log('gmail.reply', me.id, `Replied to ${fromName || fromEmail}`);
      toast.success('Reply sent');
      setReplying(false);
      setReplyText('');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  /* ── refresh ───────────────────────────────────────────────────── */

  async function refresh() {
    setRefreshing(true);
    setSelectedId(null);
    setDetail(null);
    setMobileDetail(false);
    await fetchMessages();
    setRefreshing(false);
  }

  /* ── render: loading ───────────────────────────────────────────── */

  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Connecting to Gmail…</span>
      </div>
    );
  }

  /* ── render: not connected ─────────────────────────────────────── */

  if (pageState === 'not-connected') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center">
          <Inbox size={28} className="text-primary/60" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Gmail not connected</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Connect your business Gmail account to view and reply to emails from within the POS.
          </p>
        </div>
        {errorMsg && (
          <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl px-4 py-3 max-w-sm text-left text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        <button
          onClick={() => { window.location.href = '/api/gmail/auth'; }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Mail size={15} />
          Connect Gmail
        </button>
      </div>
    );
  }

  /* ── render: error ─────────────────────────────────────────────── */

  if (pageState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle size={28} className="text-rose-500" />
        <p className="text-sm text-muted-foreground max-w-xs">{errorMsg}</p>
        <button
          onClick={() => { setPageState('loading'); fetchMessages(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  /* ── render: ready ─────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Inbox size={18} className="text-muted-foreground" />
          <h1 className="font-semibold text-sm">Inbox</h1>
          {gmailAddress && (
            <span className="hidden sm:inline text-xs bg-primary/8 text-primary px-2.5 py-1 rounded-full font-medium">
              {gmailAddress}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Body — two columns */}
      <div className="flex flex-1 overflow-hidden">

        {/* Email list — hidden on mobile when detail is open */}
        <div className={`${mobileDetail ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[340px] xl:w-[380px] shrink-0 border-r border-border overflow-y-auto`}>
          {emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground p-8 text-center">
              <Inbox size={28} className="text-muted-foreground/30" />
              <p className="text-sm">Your inbox is empty</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-2">
              {emails.map(email => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  selected={email.id === selectedId}
                  onClick={() => openEmail(email)}
                />
              ))}

              {nextPageToken && (
                <button
                  onClick={async () => {
                    setLoadingMore(true);
                    await fetchMessages(nextPageToken);
                    setLoadingMore(false);
                  }}
                  disabled={loadingMore}
                  className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-black/4 dark:hover:bg-white/4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                >
                  {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null}
                  Load more
                </button>
              )}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className={`${mobileDetail ? 'flex' : 'hidden lg:flex'} flex-col flex-1 overflow-hidden`}>

          {/* Mobile: back button */}
          {mobileDetail && (
            <button
              onClick={() => { setMobileDetail(false); setSelectedId(null); }}
              className="lg:hidden flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b border-border cursor-pointer"
            >
              <ChevronLeft size={16} />
              Back to inbox
            </button>
          )}

          {!selectedId && !loadingDetail && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
              <Mail size={28} className="text-muted-foreground/20" />
              <p className="text-sm">Select an email to read</p>
            </div>
          )}

          {loadingDetail && (
            <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {detail && !loadingDetail && (
            <div className="flex flex-col flex-1 overflow-hidden">

              {/* Email header */}
              <div className="shrink-0 px-6 py-4 border-b border-border">
                <h2 className="font-semibold text-base mb-3 leading-snug">{detail.subject}</h2>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div className="flex gap-2">
                    <span className="w-7 shrink-0 text-xs font-medium text-foreground/50 uppercase tracking-wide pt-px">From</span>
                    <span className="text-foreground/80">{detail.from}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-7 shrink-0 text-xs font-medium text-foreground/50 uppercase tracking-wide pt-px">To</span>
                    <span className="text-foreground/80">{detail.to}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-7 shrink-0 text-xs font-medium text-foreground/50 uppercase tracking-wide pt-px">Date</span>
                    <span className="text-foreground/60 text-xs">{detail.date}</span>
                  </div>
                </div>
              </div>

              {/* Email body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: detail.bodyHtml }}
                />
              </div>

              {/* Reply composer */}
              <div className="shrink-0 border-t border-border">
                {!replying ? (
                  <div className="px-6 py-3">
                    <button
                      onClick={() => {
                        setReplying(true);
                        setTimeout(() => replyRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Reply size={14} />
                      Reply
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 px-6 py-4">
                    <div className="text-xs text-muted-foreground">
                      Replying to <span className="font-medium text-foreground/70">{detail.from}</span>
                    </div>
                    <textarea
                      ref={replyRef}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Write your reply…"
                      rows={5}
                      className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground/50"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={sendReply}
                        disabled={sending || !replyText.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        {sending ? 'Sending…' : 'Send reply'}
                      </button>
                      <button
                        onClick={() => { setReplying(false); setReplyText(''); }}
                        className="px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
