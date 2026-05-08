import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
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

// Silently sign in anonymously so Firestore rules can verify the request
// comes from the real app. Resolves immediately if already signed in.
export function ensureAuth(): Promise<void> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn('[auth] anonymous sign-in failed', e);
        }
      }
      resolve();
    });
  });
}
