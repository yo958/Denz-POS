// ─────────────────────────────────────────────────────────────────
// Lightweight toast system. No external deps.
// Usage:  import { toast } from '@/components/ui/toast';
//         toast.success('Saved'); toast.error('Boom'); toast.info('FYI');
// ─────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastMsg { id: number; kind: ToastKind; text: string }

const listeners = new Set<(t: ToastMsg[]) => void>();
let queue: ToastMsg[] = [];
let nextId = 1;

function emit() { listeners.forEach(l => l(queue)); }

function push(kind: ToastKind, text: string, ttl = 3500) {
  const id = nextId++;
  queue = [...queue, { id, kind, text }];
  emit();
  setTimeout(() => dismiss(id), ttl);
}

function dismiss(id: number) {
  queue = queue.filter(t => t.id !== id);
  emit();
}

export const toast = {
  success: (t: string) => push('success', t),
  error:   (t: string) => push('error', t, 5000),
  info:    (t: string) => push('info', t),
};

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const STYLES: Record<ToastKind, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200',
  error:   'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-200',
  info:    'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-200',
};

export function ToastViewport() {
  const [items, setItems] = useState<ToastMsg[]>(queue);
  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
    >
      {items.map(t => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 px-3 py-2 rounded-xl border shadow-lg backdrop-blur-md ${STYLES[t.kind]} animate-in slide-in-from-bottom-2 duration-200`}
          >
            <Icon size={16} strokeWidth={2} className="shrink-0 mt-0.5" />
            <span className="text-sm flex-1">{t.text}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
