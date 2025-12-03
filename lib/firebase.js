// lib/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// نفس الإعدادات الموجودة في .env.local
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);

// Messaging كـ Promise عشان ما نلمس window في السيرفر
export const messagingPromise = (async () => {
  if (typeof window === 'undefined') return null;

  try {
    const { getMessaging, isSupported } = await import('firebase/messaging');
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;

    const messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.error('messagingPromise error:', err);
    return null;
  }
})();
