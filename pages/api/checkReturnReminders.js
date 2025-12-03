// pages/api/checkReturnReminders.js
import admin from '../../lib/firebaseAdmin';

const firestore = admin.firestore();

function formatDateYmd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!admin.apps.length) {
      return res
        .status(500)
        .json({ ok: false, error: 'Firebase admin not initialized' });
    }

    // نحسب التاريخ بعد يومين من اليوم الحالي
    const now = new Date();
    const targetDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 2,
      0,
      0,
      0
    );
    const targetYmd = formatDateYmd(targetDate);

    // نجيب الحجوزات اللي يبدأ حجزها بعد يومين (بناءً على startDateYmd)
    const bookingsSnap = await firestore
      .collection('bookings')
      .where('startDateYmd', '==', targetYmd)
      .get();

    if (bookingsSnap.empty) {
      return res.status(200).json({
        ok: true,
        message: 'No bookings starting in 2 days',
        targetYmd,
      });
    }

    // نجيب كل التوكينات المسجلة للأجهزة اللي فعّلت الإشعارات
    const tokensSnap = await firestore.collection('deviceTokens').get();
    const tokens = tokensSnap.docs
      .map((doc) => doc.data().token)
      .filter(Boolean);

    if (!tokens.length) {
      return res.status(200).json({
        ok: true,
        message: 'No device tokens registered',
        targetYmd,
      });
    }

    const uniqueTokens = Array.from(new Set(tokens));

    let totalSent = 0;
    let totalFailed = 0;

    for (const docSnap of bookingsSnap.docs) {
      const data = docSnap.data();

      // لو أرسلنا التذكير قبل هيك ما نعيده
      if (data.returnReminderSent) continue;

      const dressCode = data.dressCode || 'غير معروف';
      const customerName = data.customerName || 'الزبونة';
      const startDate = data.startDate
        ? data.startDate.toDate
          ? data.startDate.toDate()
          : new Date(data.startDate)
        : targetDate;

      const startDateStr = formatDateYmd(startDate);

      const title = 'تذكير بموعد تجهيز الفستان';
      const body = `بعد يومين يبدأ حجز الفستان (${dressCode}) الخاص بـ ${customerName} بتاريخ ${startDateStr}. يرجى تجهيز الفستان للتسليم.`;

      const message = {
        notification: { title, body },
        tokens: uniqueTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      totalSent += response.successCount;
      totalFailed += response.failureCount;

      // نعلّم إن التذكير لهذا الحجز تم إرساله
      await docSnap.ref.update({
        returnReminderSent: true,
      });
    }

    return res.status(200).json({
      ok: true,
      targetYmd,
      totalSent,
      totalFailed,
    });
  } catch (err) {
    console.error('checkReturnReminders error:', err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || 'Internal error' });
  }
}
