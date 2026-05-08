'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Coffee, Monitor, BedDouble } from 'lucide-react';
import type { TabType } from '@/lib/types';

interface NewTabDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, type: TabType, label: string) => void;
}

const TYPES: { value: TabType; label: string; icon: typeof Coffee; placeholder: string }[] = [
  { value: 'cafe',  label: 'Cafe',  icon: Coffee,    placeholder: 'Table 4' },
  { value: 'desk',  label: 'Desk',  icon: Monitor,   placeholder: 'Desk 7' },
  { value: 'room',  label: 'Room',  icon: BedDouble, placeholder: 'Room 2' },
];

export function NewTabDialog({ open, onClose, onCreate }: NewTabDialogProps) {
  const [name,  setName]  = useState('');
  const [type,  setType]  = useState<TabType>('cafe');
  const [label, setLabel] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setType('cafe');
      setLabel('');
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const placeholder = TYPES.find(t => t.value === type)?.placeholder ?? '';
  const canCreate = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    onCreate(name.trim(), type, label.trim() || placeholder);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New tab"
    >
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Tab</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="
              flex items-center justify-center w-8 h-8 rounded-xl
              text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5
              transition-colors duration-150 cursor-pointer
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            "
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Customer name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Customer Name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Emma K."
            required
            className="
              w-full h-10 px-3 rounded-xl text-sm
              bg-black/5 dark:bg-white/5 border border-border
              placeholder:text-muted-foreground text-foreground
              focus:outline-none focus:ring-2 focus:ring-ring
              transition-all duration-150
            "
          />
        </div>

        {/* Type selector */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Type
          </span>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(({ value, label: tLabel, icon: Icon }) => {
              const active = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`
                    flex flex-col items-center gap-1.5 py-3 rounded-2xl border text-sm font-medium
                    transition-all duration-150 cursor-pointer
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                    ${active
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-white/40 dark:bg-white/4 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                    }
                  `}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                  {tLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Label */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={placeholder}
            className="
              w-full h-10 px-3 rounded-xl text-sm
              bg-black/5 dark:bg-white/5 border border-border
              placeholder:text-muted-foreground text-foreground
              focus:outline-none focus:ring-2 focus:ring-ring
              transition-all duration-150
            "
          />
          <p className="text-xs text-muted-foreground">Leave blank to use &ldquo;{placeholder}&rdquo;</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="
              flex-1 h-10 rounded-2xl text-sm font-medium
              border border-border bg-white/50 dark:bg-white/5
              text-foreground hover:bg-black/5 dark:hover:bg-white/8 active:scale-95
              transition-all duration-150 cursor-pointer
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            "
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canCreate}
            className="
              flex-1 h-10 rounded-2xl text-sm font-semibold
              bg-primary text-primary-foreground
              hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150 cursor-pointer
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            "
          >
            Create Tab
          </button>
        </div>
      </form>
    </div>
  );
}
