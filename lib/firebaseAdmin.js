// lib/firebaseAdmin.js
import admin from 'firebase-admin';

let app = null;

function initFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.app();
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

    // لو في env كاملة نستخدمها (Vercel / prod)
    if (projectId && clientEmail && rawPrivateKey) {
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    // غير هيك (محلي مثلاً) نستخدم ملف الـ JSON
    // تأكد إن ملف firebase/serviceAccountKey.json موجود
    // في جذر المشروع (زي ما كان عندك)
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const serviceAccount = require('../firebase/serviceAccountKey.json');

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (err) {
    console.error('Error initializing Firebase admin:', err);
    return null;
  }
}

app = initFirebaseAdmin();

const adminDb = app ? admin.firestore() : null;
const adminMessaging = app ? admin.messaging() : null;

export default admin;
export { adminDb, adminMessaging };
