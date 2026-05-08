import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
