// lib/firebaseAdmin.js
import admin from 'firebase-admin';

// نستخدم متغير واحد في الـ env فيه JSON كامل للـ Service Account
// FIREBASE_SERVICE_ACCOUNT_JSON= {"type":"service_account",...}

if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is missing');
  }
}

export default admin;
