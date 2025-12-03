// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * sendTestNotification
 * HTTP endpoint:
 * يرسل إشعار تجريبي لكل الـ deviceTokens الموجودة في Firestore
 */
exports.sendTestNotification = functions.https.onRequest(async (req, res) => {
  try {
    const snapshot = await db.collection('deviceTokens').get();
    const tokens = snapshot.docs
      .map((doc) => doc.data().token)
      .filter(Boolean);

    if (!tokens.length) {
      return res.status(200).json({
        ok: true,
        message: 'لا يوجد أي device tokens في collection deviceTokens',
      });
    }

    const message = {
      notification: {
        title: 'اختبار إشعارات الفساتين',
        body: 'هذا إشعار تجريبي من نظام تأجير الفساتين 👗',
      },
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);

    return res.status(200).json({
      ok: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err) {
    console.error('sendTestNotification error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});
