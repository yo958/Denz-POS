// ─────────────────────────────────────────────────────────────────
// App shell: three-state auth gate.
//   1. No Firebase session  → LoginForm (email + password)
//   2. Firebase session, idle-locked → PinPad (confirm it's still you)
//   3. Firebase session, PIN unlocked → render app
// ─────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { PinPad } from './PinPad';
import {
  getCurrentStaffId, setCurrentStaffId, useSettings, useCurrentStaff, useStaff,
} from '@/lib/hooks/useStore';
import { auth, onAuthChanged } from '@/lib/firebase';
import { Sidebar } from '@/components/shell/Sidebar';
import { MobileNav } from '@/components/shell/MobileNav';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname      = usePathname();
  const isReceiptPage = pathname?.startsWith('/receipt/');
  const settings      = useSettings();
  const allStaff      = useStaff();
  const me            = useCurrentStaff();

  // Firebase auth state
  const [firebaseUid, setFirebaseUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [fbLoading, setFbLoading]     = useState(!auth.currentUser);

  // PIN unlock state
  const [unlocked, setUnlocked] = useState<boolean>(() => !!getCurrentStaffId());

  // Subscribe to Firebase auth changes
  useEffect(() => {
    return onAuthChanged(uid => {
      setFirebaseUid(uid);
      setFbLoading(false);
      // Firebase signed out → clear the POS session and lock the device
      if (!uid) {
        setCurrentStaffId(null);
        setUnlocked(false);
      }
    });
  }, []);

  // Re-sync unlock state if session changes externally (e.g., sign-out from sidebar)
  useEffect(() => {
    setUnlocked(!!me);
  }, [me]);

  // Idle auto-lock — clears the PIN session but keeps the Firebase session
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

  // Receipt pages bypass auth entirely — they open in a new tab, read-only
  if (isReceiptPage) return <>{children}</>;

  // Waiting for Firebase to restore a persisted session from localStorage
  if (fbLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Map Firebase UID to a staff record
  const fbEmail  = auth.currentUser?.email?.toLowerCase() ?? '';
  const fbStaff  = firebaseUid
    ? (allStaff.find(s => s.firebaseUid === firebaseUid) ??
       allStaff.find(s => s.contact?.email?.toLowerCase() === fbEmail) ?? null)
    : null;

  // No Firebase session → show sign-in form
  if (!firebaseUid || !fbStaff) {
    return <LoginForm onLogin={() => setUnlocked(true)} />;
  }

  // Firebase session present but device is PIN-locked
  if (!unlocked) {
    return <PinPad staff={fbStaff} onUnlock={() => setUnlocked(true)} />;
  }

  // Fully authenticated
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
