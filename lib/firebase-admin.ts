import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let _db: Firestore | undefined;

export function getAdminDb(): Firestore {
  if (_db) return _db;
  const app =
    getApps().find(a => a.name === 'admin') ??
    initializeApp(
      { credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)) },
      'admin',
    );
  _db = getFirestore(app);
  return _db;
}
