// pages/api/checkReturnReminders.js
import { adminDb, adminMessaging } from '../../lib/firebaseAdmin';

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!adminDb || !adminMessaging) {
      return res.status(500).json({
        ok: false,
        error: 'firebase-admin-not-configured',
      });
    }

    // اليوم + 2
    const today = new Date();
    const target = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 2
    );
    const targetYmd = formatYmd(target);

    // نجيب كل الحجوزات
    const bookingsSnap = await adminDb.collection('bookings').get();

    if (bookingsSnap.empty) {
      return res.status(200).json({
        ok: true,
        message: 'No bookings in collection',
        targetYmd,
        totalSent: 0,
        totalFailed: 0,
      });
    }

    // نجيب كل التوكينات
    const tokensSnap = await adminDb.collection('deviceTokens').get();
    if (tokensSnap.empty) {
      return res.status(200).json({
        ok: true,
        message: 'No device tokens saved',
        targetYmd,
        totalSent: 0,
        totalFailed: 0,
      });
    }

    const tokens = tokensSnap.docs
      .map((d) => d.data().token)
      .filter(Boolean);

    if (!tokens.length) {
      return res.status(200).json({
        ok: true,
        message: 'No valid tokens',
        targetYmd,
        totalSent: 0,
        totalFailed: 0,
      });
    }

    let totalSent = 0;
    let totalFailed = 0;

    const bookingsToRemind = [];

    bookingsSnap.forEach((doc) => {
      const data = doc.data();

      // لو سبق أرسلنا تذكير لهذا الحجز نتجاهله
      if (data.returnReminderSent) return;

      // نحاول نحول startDate لأي شكل: Timestamp أو String
      let startDate = null;

      if (data.startDate && typeof data.startDate.toDate === 'function') {
        startDate = data.startDate.toDate();
      } else if (typeof data.startDate === 'string') {
        const d = new Date(data.startDate);
        if (!isNaN(d.getTime())) startDate = d;
      }

      if (!startDate) return;

      const startYmd = formatYmd(startDate);
      if (startYmd === targetYmd) {
        bookingsToRemind.push({ id: doc.id, data });
      }
    });

    if (!bookingsToRemind.length) {
      return res.status(200).json({
        ok: true,
        message: 'No bookings starting in 2 days',
        targetYmd,
        totalSent: 0,
        totalFailed: 0,
      });
    }

    for (const booking of bookingsToRemind) {
      const b = booking.data;
      const dressName = b.dressName || b.dress || 'فستان';
      const customerName = b.customerName || 'الزبونة';

      const title = `تذكير حجز لفستان "${dressName}" بعد يومين`;
      const body = `موعد بداية حجز ${customerName} هو ${targetYmd}. يرجى تجهيز الفستان للتسليم.`;

      const payload = {
        notification: { title, body },
        data: {
          type: 'return-reminder',
          dressName,
          targetYmd,
        },
      };

      try {
        const result = await adminMessaging.sendToDevice(tokens, payload);
        result.results.forEach((r) => {
          if (r.error) totalFailed += 1;
          else totalSent += 1;
        });

        await adminDb.collection('bookings').doc(booking.id).update({
          returnReminderSent: true,
        });
      } catch (err) {
        console.error('Error sending reminder for booking', booking.id, err);
        totalFailed += tokens.length;
      }
    }

    return res.status(200).json({
      ok: true,
      targetYmd,
      totalSent,
      totalFailed,
    });
  } catch (err) {
    console.error('checkReturnReminders error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'internal-error',
    });
  }
}
