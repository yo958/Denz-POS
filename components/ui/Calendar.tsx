'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Returns grid of Date | null for a given month, padded to Mon-start weeks
function buildGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(year, month, d));
  }
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

interface CalendarProps {
  value: string;         // 'YYYY-MM-DD'
  minDate?: string;      // 'YYYY-MM-DD', defaults to today
  onChange: (value: string) => void;
}

export function Calendar({ value, minDate, onChange }: CalendarProps) {
  const today = startOfDay(new Date());
  const min = minDate ? startOfDay(new Date(minDate + 'T00:00:00')) : today;

  const selected = value ? startOfDay(new Date(value + 'T00:00:00')) : null;
  const initial = selected && selected >= min ? selected : min;

  const [viewYear,  setViewYear]  = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const canGoPrev = new Date(viewYear, viewMonth, 0) >= min;
  const grid = buildGrid(viewYear, viewMonth);

  return (
    <div className="rounded-2xl border border-border bg-black/3 dark:bg-white/3 p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/8 dark:hover:bg-white/8 hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-black/8 dark:hover:bg-white/8 hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold py-1 text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((date, i) => {
          if (!date) return <div key={i} />;
          const isDisabled = startOfDay(date) < min;
          const isToday    = isSameDay(date, today);
          const isSelected = selected ? isSameDay(date, selected) : false;
          return (
            <button
              key={i}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(toDateStr(date))}
              className={[
                'mx-auto w-9 h-9 rounded-full text-sm font-medium transition-colors',
                isDisabled
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'cursor-pointer',
                isSelected && !isDisabled
                  ? 'bg-primary text-primary-foreground'
                  : isToday && !isDisabled
                  ? 'ring-1 ring-primary text-foreground hover:bg-black/8 dark:hover:bg-white/8'
                  : !isDisabled
                  ? 'text-foreground hover:bg-black/8 dark:hover:bg-white/8'
                  : '',
              ].join(' ')}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Friendly display string for a 'YYYY-MM-DD' value */
export function formatCalendarDate(value: string): string {
  if (!value) return '';
  const d = new Date(value + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
