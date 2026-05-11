'use client';

import { useState, useEffect } from 'react';
import { X, Coffee, Monitor, BedDouble } from 'lucide-react';
import type { CoworkSpace, TabType } from '@/lib/types';
import { CustomerPicker } from '@/components/customers/CustomerPicker';
import { Switch } from '@/components/ui/switch';
import { getStore } from '@/lib/store/store';
import { newId } from '@/lib/domain/id';
import { useCurrentStaff, useSpaces } from '@/lib/hooks/useStore';

interface NewTabDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, type: TabType, label: string, customerId?: string) => void;
}

const TYPES: { value: TabType; label: string; icon: typeof Coffee; placeholder: string }[] = [
  { value: 'cafe',  label: 'Cafe',  icon: Coffee,    placeholder: 'Table 4' },
  { value: 'desk',  label: 'Desk',  icon: Monitor,   placeholder: 'Desk 7' },
  { value: 'room',  label: 'Room',  icon: BedDouble, placeholder: 'Room 2' },
];

export function NewTabDialog({ open, onClose, onCreate }: NewTabDialogProps) {
  const me = useCurrentStaff();
  const allSpaces = useSpaces();
  const availableSpaces = allSpaces.filter(s => !s.archived);

  const [name,            setName]            = useState('');
  const [customerId,      setCustomerId]       = useState<string | undefined>();
  const [type,            setType]             = useState<TabType>('cafe');
  const [label,           setLabel]            = useState('');
  const [selectedSpace,   setSelectedSpace]    = useState<CoworkSpace | null>(null);
  const [saveAsCustomer,  setSaveAsCustomer]   = useState(false);

  // Show the "save as customer" toggle only when a free-text name is entered
  // (i.e. no existing customer was picked from the dropdown)
  const showSaveToggle = name.trim().length > 0 && !customerId;

  useEffect(() => {
    if (open) {
      setName('');
      setCustomerId(undefined);
      setType('cafe');
      setLabel('');
      setSelectedSpace(null);
      setSaveAsCustomer(false);
    }
  }, [open]);

  if (!open) return null;

  const placeholder = TYPES.find(t => t.value === type)?.placeholder ?? '';
  const canCreate = name.trim().length > 0 && (type !== 'desk' || selectedSpace !== null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    let resolvedCustomerId = customerId;
    // If "Save as new customer" is on and no existing customer was picked, create one now
    if (saveAsCustomer && !customerId) {
      const newCustomer = {
        id: newId('cust'),
        name: name.trim(),
        createdAt: new Date(),
      };
      getStore().customers.set(prev => [...prev, newCustomer]);
      getStore().log('customer.create', newCustomer.name, me?.id);
      resolvedCustomerId = newCustomer.id;
    }
    // For desk tabs, label must be the space name so Coworking can match the tab to the space.
    const resolvedLabel = type === 'desk' ? (selectedSpace?.name ?? '') : (label.trim() || placeholder);
    onCreate(name.trim(), type, resolvedLabel, resolvedCustomerId);
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

        {/* Customer picker */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Customer Name
          </label>
          <CustomerPicker
            value={name}
            customerId={customerId}
            onChange={(n, id) => { setName(n); setCustomerId(id); setSaveAsCustomer(false); }}
            placeholder="Search or type a name…"
            autoFocus
          />
          {showSaveToggle && (
            <Switch
              checked={saveAsCustomer}
              onChange={setSaveAsCustomer}
              label="Save as new customer"
              size="sm"
            />
          )}
        </div>

        {/* Type selector */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Type
          </span>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(({ value: v, label: tLabel, icon: Icon }) => {
              const active = type === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
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

        {/* Label / Space picker */}
        {type === 'desk' ? (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Desk Space
            </span>
            {availableSpaces.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-xl px-3 py-2.5">
                No spaces configured. Add spaces in the CoWorking page first.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {availableSpaces.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                      selectedSpace?.id === s.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-black/3 dark:bg-white/3 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="desk-space"
                      checked={selectedSpace?.id === s.id}
                      onChange={() => setSelectedSpace(s)}
                      className="accent-primary shrink-0"
                    />
                    <span className="text-sm font-medium truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
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
        )}

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
