'use client';

import { useId } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Pill-style toggle switch.
 * Replaces <input type="checkbox"> for boolean settings.
 */
export function Switch({ checked, onChange, label, disabled = false, size = 'md' }: SwitchProps) {
  const id = useId();

  const track =
    size === 'sm'
      ? 'w-8 h-4'
      : 'w-10 h-[22px]';

  const thumb =
    size === 'sm'
      ? `w-3 h-3 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`
      : `w-[18px] h-[18px] ${checked ? 'translate-x-[20px]' : 'translate-x-0.5'}`;

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        role="switch"
        aria-checked={checked}
        id={id}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={e => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onChange(!checked); } }}
        tabIndex={disabled ? -1 : 0}
        className={`
          relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${track}
          ${checked ? 'bg-primary' : 'bg-black/15 dark:bg-white/20'}
        `}
      >
        <span
          className={`
            inline-block rounded-full bg-white shadow-sm
            transition-transform duration-200 ease-in-out
            ${thumb}
          `}
        />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
