import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut as fbSignOut,
  onAuthStateChanged, createUserWithEmailAndPassword,
  browserLocalPersistence, setPersistence, sendPasswordResetEmail,
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyBPlZwgurjfYWz7IocIoGCmlpIEFaYiMKo",
  authDomain: "denz-pos.firebaseapp.com",
  projectId: "denz-pos",
  storageBucket: "denz-pos.firebasestorage.app",
  messagingSenderId: "709054640574",
  appId: "1:709054640574:web:e323c7895c34bb4d8489ef",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Persist session in localStorage so it survives page reloads
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

/** Sign in with email + password. */
export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** Fully sign out the current Firebase user. */
export function signOut() {
  return fbSignOut(auth);
}

/** Subscribe to Firebase auth state changes. Returns an unsubscribe function. */
export function onAuthChanged(cb: (uid: string | null) => void) {
  return onAuthStateChanged(auth, u => cb(u?.uid ?? null));
}

/** Send a password reset email to the given address. */
export function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}

/**
 * Create a Firebase Auth account for a new staff member WITHOUT signing out
 * the currently logged-in manager. Uses a temporary secondary app instance.
 */
export async function createStaffAccount(email: string, password: string): Promise<string> {
  const appName = `staff-create-${Date.now()}`;
  const secondary = initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondary);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return cred.user.uid;
  } finally {
    // Clean up the secondary app to avoid memory leaks
    const { deleteApp } = await import('firebase/app');
    await deleteApp(secondary).catch(() => {});
  }
}

/**
 * Replaces the old ensureAuth() — waits until a real authenticated user is
 * present before resolving. The LoginForm handles the sign-in flow; this just
 * gates Firestore connection until that happens.
 */
export function ensureAuth(): Promise<void> {
  return new Promise(resolve => {
    // If already signed in, resolve immediately
    if (auth.currentUser) { resolve(); return; }
    const unsub = onAuthStateChanged(auth, user => {
      if (user) { unsub(); resolve(); }
      // No user yet — keep listening; LoginForm will sign the user in
    });
  });
}
