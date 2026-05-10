// ─────────────────────────────────────────────────────────────────
// App shell wrapper: gates the UI behind PIN, handles idle auto-lock.
// ─────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PinPad } from './PinPad';
import {
  getCurrentStaffId, setCurrentStaffId, useSettings, useCurrentStaff,
} from '@/lib/hooks/useStore';
import { Sidebar } from '@/components/shell/Sidebar';
import { MobileNav } from '@/components/shell/MobileNav';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReceiptPage = pathname?.startsWith('/receipt/');
  const [unlocked, setUnlocked] = useState<boolean>(() => !!getCurrentStaffId());
  const settings = useSettings();
  const me = useCurrentStaff();

  // Re-sync if session changes externally (e.g., logout from sidebar)
  useEffect(() => {
    setUnlocked(!!me);
  }, [me]);

  // Idle auto-lock
  useEffect(() => {
    const minutes = settings.device.idleLockMinutes;
    if (!unlocked || !minutes || minutes <= 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setCurrentStaffId(null);
        setUnlocked(false);
      }, minutes * 60_000);
    };
    const events = ['mousemove', 'keydown', 'pointerdown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [unlocked, settings.device.idleLockMinutes]);

  if (!unlocked && !isReceiptPage) {
    return <PinPad onUnlock={() => setUnlocked(true)} />;
  }

  // Receipt pages are PIN-free — they open in a new tab and are read-only
  if (isReceiptPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div
        className="flex flex-col flex-1 min-h-screen min-w-0 overflow-hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)' }}
      >
        {children}
      </div>
      <MobileNav />
    </>
  );
}
