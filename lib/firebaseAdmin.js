// lib/firebaseAdmin.js
import admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawPrivateKey
  ? rawPrivateKey.replace(/\\n/g, '\n')
  : undefined;

if (!admin.apps.length) {
  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase admin credentials.');
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
}

const adminDb = admin.firestore();
const adminMessaging = admin.messaging();

// 👈 مهم: default + named exports معًا
export default admin;
export { adminDb, adminMessaging };
