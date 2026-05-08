// ─────────────────────────────────────────────────────────────────
// React hooks: subscribe to a storage slice, plus auth state.
// ─────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { StorageSlice } from '../store/storage';
import { getStore } from '../store/store';
import type { Staff } from '../types';

/**
 * Subscribe a component to a slice. Returns the current value.
 * Uses useSyncExternalStore for tear-free reads + SSR-safe snapshots.
 */
export function useSlice<T>(slice: StorageSlice<T>): T {
  return useSyncExternalStore(
    cb => slice.subscribe(cb),
    () => slice.get(),
    () => slice.get(), // server snapshot — SSR returns the seed value
  );
}

/* ── Convenience selectors for the singleton store ────────────── */
export function useTabs()     { return useSlice(getStore().tabs); }
export function useStays()    { return useSlice(getStore().stays); }
export function useProducts() { return useSlice(getStore().products); }
export function useModifierGroups() { return useSlice(getStore().modifierGroups); }
export function useSettings() { return useSlice(getStore().settings); }
export function useShift()    { return useSlice(getStore().shift); }
export function useTickets()  { return useSlice(getStore().tickets); }
export function useStaff()    { return useSlice(getStore().staff); }
export function useAudit()    { return useSlice(getStore().audit); }

/* ── Auth (local only, sessionStorage) ────────────────────────── */
const AUTH_KEY = 'denz.auth.staffId';
const authListeners = new Set<() => void>();
function emit() { authListeners.forEach(l => l()); }

export function getCurrentStaffId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(AUTH_KEY);
}
export function setCurrentStaffId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) window.sessionStorage.setItem(AUTH_KEY, id);
  else    window.sessionStorage.removeItem(AUTH_KEY);
  emit();
}

export function useCurrentStaff(): Staff | null {
  const staff = useStaff();
  const [id, setId] = useState<string | null>(() => getCurrentStaffId());
  useEffect(() => {
    const l = () => setId(getCurrentStaffId());
    authListeners.add(l);
    return () => { authListeners.delete(l); };
  }, []);
  if (!id) return null;
  return staff.find(s => s.id === id) ?? null;
}
