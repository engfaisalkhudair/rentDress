// lib/firebaseAdmin.js
import admin from 'firebase-admin';

let app = null;

if (!admin.apps.length) {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!json) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  let serviceAccount = null;

  try {
    serviceAccount = JSON.parse(json);
  } catch (e) {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', e);
    throw new Error('Could not parse FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  app = admin.app();
} else {
  app = admin.app();
}

const adminDb = admin.firestore();
const adminMessaging = admin.messaging();

export default admin;
export { adminDb, adminMessaging };
