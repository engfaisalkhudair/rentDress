// pages/index.js
import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db, messagingPromise } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */

// المفتاح العام للفابيد (لازم يكون نفس اللي في إعدادات Firebase)
const VAPID_PUBLIC_KEY =
  'BATd4-6nGAJszdJQ5_KTBhkgF21U9J-jcHClfpSHMIf77HzCTREIT2YhxkXl1xk-wZh3OsriAC_w1I-HmBNQ0YM';

// فورمات التاريخ بصيغة YYYY-MM-DD
function formatDateYmd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// تحويل أي قيمة (Timestamp / Date / string) إلى JS Date
function toJsDate(value) {
  if (!value) return null;
  let d = value;
  if (value.toDate) d = value.toDate();
  else d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

// جلب YMD من الحقل النصي أو من التاريخ
function resolveYmd(ymdField, dateField) {
  if (typeof ymdField === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ymdField)) {
    return ymdField;
  }
  const d = toJsDate(dateField);
  if (!d) return null;
  return formatDateYmd(d);
}

// للتحويل إلى value مناسب لـ input[type="date"]
function toInputDate(value) {
  const d = toJsDate(value);
  if (!d) return '';
  return formatDateYmd(d);
}

// التحقق من تداخل الفترات باستخدام YMD نصية
function rangesOverlapYmd(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return !(endA < startB || startA > endB);
}

/* ------------------------------------------------------------------
 * Components (Presentational)
 * ------------------------------------------------------------------ */

function NotificationButton({ show, onClick }) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="chip-button chip-button--primary"
    >
      تفعيل الإشعارات على هذا الجهاز
    </button>
  );
}
// this for new commint in git
function TabsBar({ activeView, setActiveView }) {
  return (
    <div className="toolbar">
      <button
        type="button"
        onClick={() => setActiveView('addBooking')}
        className={
          'toolbar-tab' +
          (activeView === 'addBooking' ? ' toolbar-tab--active' : '')
        }
      >
        إضافة حجز جديد
      </button>

      <button
        type="button"
        onClick={() => setActiveView('addDress')}
        className={
          'toolbar-tab' +
          (activeView === 'addDress' ? ' toolbar-tab--active' : '')
        }
      >
        إضافة فستان جديد
      </button>

      <button
        type="button"
        onClick={() => setActiveView('bookingsList')}
        className={
          'toolbar-tab' +
          (activeView === 'bookingsList' ? ' toolbar-tab--active' : '')
        }
      >
        عرض كل الحجوزات
      </button>

      <button
        type="button"
        onClick={() => setActiveView('timeView')}
        className={
          'toolbar-tab' +
          (activeView === 'timeView' ? ' toolbar-tab--active' : '')
        }
      >
        عرض الحجوزات حسب الوقت
      </button>

      <button
        type="button"
        onClick={() => setActiveView('dressesList')}
        className={
          'toolbar-tab' +
          (activeView === 'dressesList' ? ' toolbar-tab--active' : '')
        }
      >
        عرض كل الفساتين
      </button>
    </div>
  );
}

function InAppToast({ notification }) {
  if (!notification) return null;
  return (
    <div className="inapp-toast inapp-toast--visible">
      <strong>{notification.title}</strong>
      <div>{notification.body}</div>
    </div>
  );
}

/* --- فورم إضافة حجز ---------------------------------------------------- */

function BookingForm({
  dresses,
  bookingDressName,
  setBookingDressName,
  bookingCustomer,
  setBookingCustomer,
  bookingStart,
  setBookingStart,
  bookingEnd,
  setBookingEnd,
  addingBooking,
  bookingStatus,
  onSubmit,
}) {
  return (
    <section className="view-section">
      <div className="card card--animate">
        <div className="card-header">
          <h2 className="card-title">إضافة حجز لفستان</h2>
        </div>
        <p className="card-description">
          اختر الفستان وحدد فترة الحجز. النظام سيتحقق تلقائيًا إذا كان الفستان
          محجوزًا في نفس الفترة، وسيصلك تذكير قبل بداية الحجز بيومين لتجهيز
          الفستان للتسليم.
        </p>

        <form
          onSubmit={onSubmit}
          className="form-grid form-grid--cols-2"
        >
          <div>
            <label className="label">الفستان</label>
            <select
              className="input select"
              value={bookingDressName}
              onChange={(e) => setBookingDressName(e.target.value)}
            >
              <option value="">اختر فستانًا</option>
              {dresses.map((dress) => (
                <option key={dress.id} value={dress.name}>
                  {dress.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">اسم الزبونة (اختياري)</label>
            <input
              className="input"
              type="text"
              value={bookingCustomer}
              onChange={(e) => setBookingCustomer(e.target.value)}
              placeholder="مثال: سارة أحمد"
            />
          </div>
          <div>
            <label className="label">تاريخ بداية الحجز</label>
            <input
              className="input"
              type="date"
              value={bookingStart}
              onChange={(e) => setBookingStart(e.target.value)}
            />
          </div>
          <div>
            <label className="label">تاريخ نهاية الحجز</label>
            <input
              className="input"
              type="date"
              value={bookingEnd}
              onChange={(e) => setBookingEnd(e.target.value)}
            />
          </div>
          <div>
            <button
              type="submit"
              className="button-primary"
              disabled={addingBooking}
            >
              {addingBooking ? 'جاري الحفظ...' : 'حفظ الحجز'}
            </button>
            {bookingStatus && (
              <p
                className={
                  'status-text ' +
                  (bookingStatus.startsWith('تم')
                    ? 'status-success'
                    : 'status-error')
                }
              >
                {bookingStatus}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

/* --- فورم إضافة فستان -------------------------------------------------- */

function DressForm({
  dressName,
  setDressName,
  addingDress,
  dressStatus,
  onSubmit,
}) {
  return (
    <section className="view-section">
      <div className="card card--animate">
        <div className="card-header">
          <h2 className="card-title">إضافة فستان جديد</h2>
        </div>
        <p className="card-description">
          أدخل اسم الفستان فقط. يجب أن يكون اسم الفستان فريدًا في النظام (لا يتم
          السماح بتكرار نفس الاسم).
        </p>

        <form onSubmit={onSubmit} className="form-grid">
          <div>
            <label className="label">اسم الفستان</label>
            <input
              className="input"
              type="text"
              value={dressName}
              onChange={(e) => setDressName(e.target.value)}
              placeholder="مثال: فستان زفاف أبيض"
            />
          </div>
          <div>
            <button
              type="submit"
              className="button-primary"
              disabled={addingDress}
            >
              {addingDress ? 'جاري الحفظ...' : 'حفظ الفستان'}
            </button>
            {dressStatus && (
              <p
                className={
                  'status-text ' +
                  (dressStatus.startsWith('تم')
                    ? 'status-success'
                    : 'status-error')
                }
              >
                {dressStatus}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

/* --- قائمة الفساتين ---------------------------------------------------- */

function DressesList({
  dresses,
  editingDressId,
  editDressName,
  setEditDressName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  savingDressEdit,
}) {
  return (
    <section className="view-section">
      <div className="card card--animate">
        <div className="card-header">
          <h2 className="card-title">كل الفساتين المضافة</h2>
        </div>
        <p className="card-description">
          يمكنك تعديل اسم الفستان أو حذفه. لا يمكن تكرار نفس اسم الفستان لأكثر من
          عنصر.
        </p>

        <div className="scroll-panel">
          {dresses.length === 0 && (
            <p className="empty-text">لم تتم إضافة أي فستان بعد.</p>
          )}

          {dresses.length > 0 &&
            dresses.map((dress) => {
              const isEditing = editingDressId === dress.id;
              return (
                <div key={dress.id} className="list-row">
                  <div className="list-row-main">
                    {isEditing ? (
                      <input
                        className="input"
                        type="text"
                        value={editDressName}
                        onChange={(e) => setEditDressName(e.target.value)}
                        placeholder="اسم الفستان"
                      />
                    ) : (
                      <div className="dress-name">
                        {dress.name || 'بدون اسم'}
                      </div>
                    )}
                  </div>

                  <div className="list-row-actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={onSaveEdit}
                          disabled={savingDressEdit}
                          className="pill-button pill-button--success"
                        >
                          {savingDressEdit ? 'جارٍ الحفظ...' : 'حفظ'}
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="pill-button"
                        >
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onStartEdit(dress)}
                          className="pill-button"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(dress.id)}
                          className="pill-button pill-button--danger"
                        >
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
}

/* --- قائمة الحجوزات مع "الأسبوعين الجايين" ---------------------------- */

function BookingsList({
  bookings,
  bookingSearch,
  setBookingSearch,
  editingBookingId,
  editBookingCustomer,
  setEditBookingCustomer,
  editBookingStart,
  setEditBookingStart,
  editBookingEnd,
  setEditBookingEnd,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  savingBookingEdit,
}) {
  // الحجوزات خلال الأسبوعين القادمين
  const upcomingBookings = useMemo(() => {
    const today = new Date();
    const todayYmd = formatDateYmd(today);
    const future = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 14
    );
    const futureYmd = formatDateYmd(future);

    return bookings
      .filter((b) => {
        const startYmd = resolveYmd(b.startDateYmd, b.startDate);
        if (!startYmd) return false;
        return startYmd >= todayYmd && startYmd <= futureYmd;
      })
      .sort((a, b) => {
        const aY = resolveYmd(a.startDateYmd, a.startDate) || '';
        const bY = resolveYmd(b.startDateYmd, b.startDate) || '';
        return aY.localeCompare(bY);
      });
  }, [bookings]);

  // فلترة الحجوزات حسب البحث (اسم فستان / زبونة)
  const filteredBookings = useMemo(() => {
    const term = bookingSearch.trim().toLowerCase();
    if (!term) return bookings;

    return bookings.filter((b) => {
      const dressName = (b.dressName || '').toLowerCase();
      const customer = (b.customerName || '').toLowerCase();

      return dressName.includes(term) || customer.includes(term);
    });
  }, [bookingSearch, bookings]);

  return (
    <section className="view-section">
      <div className="card card--animate">
        <div className="card-header">
          <h2 className="card-title">كل الحجوزات</h2>
        </div>
        <p className="card-description">
          يمكنك البحث عن الحجز باستخدام اسم الفستان أو اسم الزبونة، مع إمكانية
          تعديل بيانات الحجز أو حذفه.
        </p>

        {/* خانة الحجوزات خلال الأسبوعين القادمين */}
        <div className="upcoming-box">
          <div className="upcoming-title">
            الحجوزات خلال الأسبوعين القادمين
          </div>
          <p className="upcoming-sub">
            عدد الحجوزات القادمة:{' '}
            <strong>{upcomingBookings.length}</strong>
          </p>
          {upcomingBookings.length === 0 ? (
            <p className="upcoming-empty">
              لا توجد حجوزات خلال الأسبوعين القادمين.
            </p>
          ) : (
            <ul className="upcoming-list">
              {upcomingBookings.map((b) => {
                const dressName = b.dressName || '';
                const startLabel =
                  resolveYmd(b.startDateYmd, b.startDate) || '-';
                return (
                  <li key={b.id} className="upcoming-item">
                    <span className="upcoming-item-date">
                      {startLabel}
                    </span>
                    <span className="upcoming-item-main">
                      {dressName || 'فستان'}
                    </span>
                    <span className="upcoming-item-customer">
                      {b.customerName || 'بدون اسم زبونة'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="search-row">
          <input
            className="input"
            type="text"
            value={bookingSearch}
            onChange={(e) => setBookingSearch(e.target.value)}
            placeholder="ابحث باسم الفستان أو اسم الزبونة..."
          />
        </div>

        <div className="scroll-panel">
          {filteredBookings.length === 0 && (
            <p className="empty-text">لا توجد حجوزات مطابقة حاليًا.</p>
          )}

          {filteredBookings.map((booking) => {
            const isEditing = editingBookingId === booking.id;
            const dressName = booking.dressName || '';

            const startLabel = toInputDate(booking.startDate);
            const endLabel = toInputDate(booking.endDate);

            return (
              <div
                key={booking.id}
                className="list-row list-row--booking"
              >
                <div className="list-row-main">
                  <div className="booking-title">
                    {dressName || 'فستان بدون اسم'}
                  </div>

                  {isEditing ? (
                    <>
                      <input
                        className="input"
                        type="text"
                        value={editBookingCustomer}
                        onChange={(e) =>
                          setEditBookingCustomer(e.target.value)
                        }
                        placeholder="اسم الزبونة (اختياري)"
                        style={{ marginBottom: '0.25rem' }}
                      />
                      <div className="booking-edit-dates">
                        <div>
                          <label className="label label--tiny">
                            بداية الحجز
                          </label>
                          <input
                            className="input"
                            type="date"
                            value={editBookingStart}
                            onChange={(e) =>
                              setEditBookingStart(e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label className="label label--tiny">
                            نهاية الحجز
                          </label>
                          <input
                            className="input"
                            type="date"
                            value={editBookingEnd}
                            onChange={(e) =>
                              setEditBookingEnd(e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="booking-customer">
                        الزبونة:{' '}
                        {booking.customerName || (
                          <span className="booking-customer--muted">
                            (غير محدد)
                          </span>
                        )}
                      </div>
                      <div className="booking-dates">
                        من {startLabel || '-'} إلى {endLabel || '-'}
                      </div>
                    </>
                  )}
                </div>

                <div className="list-row-actions">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={onSaveEdit}
                        disabled={savingBookingEdit}
                        className="pill-button pill-button--success"
                      >
                        {savingBookingEdit ? 'جارٍ الحفظ...' : 'حفظ'}
                      </button>
                      <button
                        type="button"
                        onClick={onCancelEdit}
                        className="pill-button"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onStartEdit(booking)}
                        className="pill-button"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(booking.id)}
                        className="pill-button pill-button--danger"
                      >
                        حذف
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --- عرض الحجوزات حسب الوقت (فلتر + أيام الشهر) --------------------- */

function TimeView({ bookings }) {
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [selectedFilterDate, setSelectedFilterDate] = useState(null);

  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);

  // group bookings by start day YMD
  const bookingsByDate = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      const ymd = resolveYmd(b.startDateYmd, b.startDate);
      if (!ymd) return;
      if (!map[ymd]) map[ymd] = [];
      map[ymd].push(b);
    });
    return map;
  }, [bookings]);

  // Calendar days: from today to end of month
  const calendarDays = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const start = new Date(year, month, today.getDate());
    const end = new Date(year, month + 1, 0); // آخر يوم في الشهر

    const days = [];
    let d = new Date(start.getTime());
    while (d <= end) {
      const ymd = formatDateYmd(d);
      days.push({
        ymd,
        dayNum: d.getDate(),
        count: bookingsByDate[ymd] ? bookingsByDate[ymd].length : 0,
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [bookingsByDate]);

  // Filtered date list
  const filteredDates = useMemo(() => {
    if (!filterFrom || !filterTo) return [];
    if (filterFrom > filterTo) return [];

    return Object.keys(bookingsByDate)
      .filter((ymd) => ymd >= filterFrom && ymd <= filterTo)
      .sort()
      .map((ymd) => ({
        date: ymd,
        bookings: bookingsByDate[ymd],
      }));
  }, [filterFrom, filterTo, bookingsByDate]);

  const selectedFilterBookings =
    selectedFilterDate && bookingsByDate[selectedFilterDate]
      ? bookingsByDate[selectedFilterDate]
      : [];

  const calendarSelectedBookings =
    calendarSelectedDate && bookingsByDate[calendarSelectedDate]
      ? bookingsByDate[calendarSelectedDate]
      : [];

  return (
    <section className="view-section">
      <div className="card card--animate">
        <div className="card-header">
          <h2 className="card-title">عرض الحجوزات حسب الوقت</h2>
        </div>
        <p className="card-description">
          يمكنك استعراض الحجوزات حسب الفترة الزمنية، أو عبر التقويم من اليوم حتى
          نهاية الشهر الحالي.
        </p>

        {/* فلتر من تاريخ إلى تاريخ */}
        <div className="time-filter">
          <div className="time-filter-row">
            <div>
              <label className="label">من تاريخ</label>
              <input
                type="date"
                className="input"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">إلى تاريخ</label>
              <input
                type="date"
                className="input"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
          </div>
          {filterFrom && filterTo && filterFrom > filterTo && (
            <p className="status-text status-error">
              تأكد أن تاريخ البداية قبل تاريخ النهاية.
            </p>
          )}
          {filterFrom && filterTo && filteredDates.length === 0 && filterFrom <= filterTo && (
            <p className="status-text">
              لا توجد حجوزات في هذه الفترة الزمنية.
            </p>
          )}
        </div>

        {/* جدول الأيام في الفترة */}
        {filteredDates.length > 0 && filterFrom <= filterTo && (
          <div className="time-filter-results">
            <h3 className="time-filter-results-title">
              الأيام ضمن الفترة المختارة
            </h3>
            <div className="scroll-panel scroll-panel--small">
              {filteredDates.map((item) => (
                <div
                  key={item.date}
                  className={
                    'time-filter-row-item' +
                    (selectedFilterDate === item.date
                      ? ' time-filter-row-item--active'
                      : '')
                  }
                  onClick={() =>
                    setSelectedFilterDate(
                      selectedFilterDate === item.date ? null : item.date
                    )
                  }
                >
                  <div className="time-filter-row-date">
                    {item.date}
                  </div>
                  <div className="time-filter-row-count">
                    عدد الحجوزات: {item.bookings.length}
                  </div>
                </div>
              ))}
            </div>

            {/* تفاصيل اليوم المختار */}
            {selectedFilterDate && (
              <div className="time-filter-details">
                <div className="time-filter-details-title">
                  حجوزات يوم {selectedFilterDate}
                </div>
                {selectedFilterBookings.length === 0 ? (
                  <p className="empty-text">
                    لا توجد حجوزات في هذا اليوم.
                  </p>
                ) : (
                  <ul className="time-filter-details-list">
                    {selectedFilterBookings.map((b) => {
                      const dressName = b.dressName || '';
                      const endLabel =
                        resolveYmd(b.endDateYmd, b.endDate) || '-';
                      return (
                        <li
                          key={b.id}
                          className="time-filter-details-item"
                        >
                          <div className="time-filter-details-main">
                            {dressName || 'فستان'}
                          </div>
                          <div className="time-filter-details-sub">
                            الزبونة:{' '}
                            {b.customerName || 'غير محدد'} / ينتهي:{' '}
                            {endLabel}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* تقويم الشهر من اليوم وحتى نهاية الشهر */}
        <div className="time-calendar">
          <h3 className="time-calendar-title">
            تقويم الشهر الحالي (من اليوم حتى نهايته)
          </h3>
          <div className="time-calendar-grid">
            {calendarDays.map((day) => (
              <button
                key={day.ymd}
                type="button"
                className={
                  'time-calendar-day' +
                  (day.count > 0 ? ' time-calendar-day--has' : '')
                }
                onClick={() => {
                  if (day.count > 0) {
                    setCalendarSelectedDate(day.ymd);
                  }
                }}
              >
                <div className="time-calendar-day-num">{day.dayNum}</div>
                <div className="time-calendar-day-date">
                  {day.ymd.slice(5)}
                </div>
                {day.count > 0 && (
                  <div className="time-calendar-day-badge">
                    {day.count} حجز
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="time-calendar-hint">
            الأيام الملونة تحتوي على حجوزات. اضغط على اليوم لعرض تفاصيل
            الفساتين المحجوزة.
          </p>
        </div>
      </div>

      {/* Popup لعرض حجوزات يوم التقويم */}
      {calendarSelectedDate && (
        <div
          className="modal-backdrop"
          onClick={() => setCalendarSelectedDate(null)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">
                حجوزات يوم {calendarSelectedDate}
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCalendarSelectedDate(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {calendarSelectedBookings.length === 0 ? (
                <p className="empty-text">لا توجد حجوزات في هذا اليوم.</p>
              ) : (
                <ul className="time-filter-details-list">
                  {calendarSelectedBookings.map((b) => {
                    const dressName = b.dressName || '';
                    const endLabel =
                      resolveYmd(b.endDateYmd, b.endDate) || '-';
                    return (
                      <li
                        key={b.id}
                        className="time-filter-details-item"
                      >
                        <div className="time-filter-details-main">
                          {dressName || 'فستان'}
                        </div>
                        <div className="time-filter-details-sub">
                          الزبونة:{' '}
                          {b.customerName || 'غير محدد'} / ينتهي:{' '}
                          {endLabel}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------
 * Main Page Component
 * ------------------------------------------------------------------ */

export default function HomePage() {
  const [activeView, setActiveView] = useState('addBooking');

  // فساتين
  const [dresses, setDresses] = useState([]);
  const [dressName, setDressName] = useState('');
  const [addingDress, setAddingDress] = useState(false);
  const [dressStatus, setDressStatus] = useState('');

  // حجوزات
  const [bookings, setBookings] = useState([]);
  const [bookingDressName, setBookingDressName] = useState('');
  const [bookingCustomer, setBookingCustomer] = useState('');
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [addingBooking, setAddingBooking] = useState(false);
  const [bookingSearch, setBookingSearch] = useState('');

  // إشعار داخل الصفحة
  const [inAppNotification, setInAppNotification] = useState(null);

  // حالة الإذن
  const [notificationPermission, setNotificationPermission] =
    useState('default');
  const [isNotificationSupported, setIsNotificationSupported] =
    useState(false);

  // تحرير الفساتين
  const [editingDressId, setEditingDressId] = useState(null);
  const [editDressName, setEditDressName] = useState('');
  const [savingDressEdit, setSavingDressEdit] = useState(false);

  // تحرير الحجوزات
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [editBookingCustomer, setEditBookingCustomer] = useState('');
  const [editBookingStart, setEditBookingStart] = useState('');
  const [editBookingEnd, setEditBookingEnd] = useState('');
  const [savingBookingEdit, setSavingBookingEdit] = useState(false);

  /* --- Notifications setup ---------------------------------------- */

  async function setupNotificationsIfPossible(showAlert = false) {
    if (typeof window === 'undefined') return;

    if (!('Notification' in window)) {
      if (showAlert) alert('هذا المتصفح لا يدعم الإشعارات.');
      return;
    }

    setIsNotificationSupported(true);
    setNotificationPermission(Notification.permission);

    if (Notification.permission !== 'granted') {
      if (showAlert) {
        alert('يجب السماح بالإشعارات من إعدادات المتصفح أولاً.');
      }
      return;
    }

    const existingToken = localStorage.getItem('fcmToken');
    if (existingToken) {
      if (showAlert) alert('الإشعارات مفعّلة مسبقاً على هذا الجهاز ✅');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      if (showAlert) alert('هذا المتصفح لا يدعم Service Workers.');
      return;
    }

    let registration;
    try {
      const existingReg = await navigator.serviceWorker.getRegistration(
        '/firebase-messaging-sw.js'
      );

      if (existingReg) {
        registration = existingReg;
      } else {
        registration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js'
        );
      }

      if (!registration.active) {
        registration = await navigator.serviceWorker.ready;
      }
    } catch (err) {
      console.error('Service Worker registration error:', err);
      if (showAlert) alert('حدث خطأ أثناء تسجيل Service Worker.');
      return;
    }

    const messaging = await messagingPromise;
    if (!messaging) {
      if (showAlert) alert('خدمة الإشعارات غير مدعومة في هذا المتصفح.');
      return;
    }

    try {
      const token = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        if (showAlert) alert('تعذر الحصول على FCM token.');
        return;
      }

      const tokensRef = collection(db, 'deviceTokens');
      const qTokens = query(tokensRef, where('token', '==', token));
      const snapTokens = await getDocs(qTokens);

      if (snapTokens.empty) {
        await addDoc(tokensRef, {
          token,
          createdAt: serverTimestamp(),
        });
      }

      localStorage.setItem('fcmToken', token);
      setNotificationPermission('granted');
      if (showAlert) alert('تم تفعيل الإشعارات على هذا الجهاز بنجاح ✅');
    } catch (err) {
      console.error('getToken error:', err);
      if (showAlert) alert('حدث خطأ أثناء الحصول على التوكن.');
    }
  }

  async function enableNotifications() {
    if (typeof window === 'undefined') return;

    if (!('Notification' in window)) {
      alert('هذا المتصفح لا يدعم الإشعارات.');
      return;
    }

    setIsNotificationSupported(true);

    if (Notification.permission === 'granted') {
      setNotificationPermission('granted');
      await setupNotificationsIfPossible(true);
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission !== 'granted') {
      alert('لم يتم السماح بالإشعارات.');
      return;
    }

    await setupNotificationsIfPossible(true);
  }

  /* --- Firestore listeners ---------------------------------------- */

  useEffect(() => {
    const dressesRef = collection(db, 'dresses');
    const qDresses = query(dressesRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(qDresses, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setDresses(list);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const bookingsRef = collection(db, 'bookings');
    const qBookings = query(bookingsRef, orderBy('startDate', 'desc'));

    const unsub = onSnapshot(qBookings, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setBookings(list);
    });

    return () => unsub();
  }, []);

  // onMessage + قراءة حالة الإذن
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsNotificationSupported(true);
      setNotificationPermission(Notification.permission);
    }

    let unsubscribe = null;

    messagingPromise.then((messaging) => {
      if (!messaging) return;

      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'إشعار جديد';
        const body = payload.notification?.body || '';

        setInAppNotification({ title, body });

        setTimeout(() => {
          setInAppNotification(null);
        }, 8000);
      });
    });

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      setupNotificationsIfPossible(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Handling: Add Dress ---------------------------------------- */

  async function handleAddDress(e) {
    e.preventDefault();
    setDressStatus('');

    if (!dressName.trim()) {
      setDressStatus('يرجى إدخال اسم الفستان.');
      return;
    }

    try {
      setAddingDress(true);

      const dressesRef = collection(db, 'dresses');

      // تحقق من فريدة الاسم فقط
      const existingNameQ = query(
        dressesRef,
        where('name', '==', dressName.trim())
      );
      const nameSnap = await getDocs(existingNameQ);

      if (!nameSnap.empty) {
        setDressStatus('اسم الفستان مستخدم بالفعل لفستان آخر.');
        setAddingDress(false);
        return;
      }

      await addDoc(dressesRef, {
        name: dressName.trim(),
        createdAt: serverTimestamp(),
      });

      setDressName('');
      setDressStatus('تم إضافة الفستان بنجاح.');
    } catch (err) {
      console.error(err);
      setDressStatus('حدث خطأ غير متوقع أثناء إضافة الفستان.');
    } finally {
      setAddingDress(false);
    }
  }

  /* --- Handling: Add Booking -------------------------------------- */

  async function handleAddBooking(e) {
    e.preventDefault();
    setBookingStatus('');

    if (!bookingDressName || !bookingStart || !bookingEnd) {
      setBookingStatus('يرجى اختيار الفستان وتحديد تاريخ البداية والنهاية.');
      return;
    }

    const startDate = new Date(bookingStart);
    const endDate = new Date(bookingEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setBookingStatus('تواريخ غير صالحة.');
      return;
    }

    if (endDate < startDate) {
      setBookingStatus('تاريخ النهاية يجب أن يكون بعد تاريخ البداية.');
      return;
    }

    const newStartYmd = bookingStart;
    const newEndYmd = bookingEnd;

    try {
      setAddingBooking(true);

      const bookingsRef = collection(db, 'bookings');
      const qBookings = query(
        bookingsRef,
        where('dressName', '==', bookingDressName.trim())
      );
      const snap = await getDocs(qBookings);

      let hasConflict = false;
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const existingStartYmd = resolveYmd(
          data.startDateYmd,
          data.startDate
        );
        const existingEndYmd = resolveYmd(
          data.endDateYmd,
          data.endDate
        );

        if (
          existingStartYmd &&
          existingEndYmd &&
          rangesOverlapYmd(
            newStartYmd,
            newEndYmd,
            existingStartYmd,
            existingEndYmd
          )
        ) {
          hasConflict = true;
        }
      });

      if (hasConflict) {
        setBookingStatus('هذا الفستان محجوز في هذه الفترة.');
        setAddingBooking(false);
        return;
      }

      await addDoc(bookingsRef, {
        dressName: bookingDressName.trim(),
        customerName: bookingCustomer.trim() || null,
        startDate,
        endDate,
        startDateYmd: newStartYmd,
        endDateYmd: newEndYmd,
        returnReminderSent: false,
        createdAt: serverTimestamp(),
      });

      setBookingCustomer('');
      setBookingStart('');
      setBookingEnd('');
      setBookingDressName('');
      setBookingStatus('تم حفظ الحجز بنجاح.');
    } catch (err) {
      console.error(err);
      setBookingStatus('حدث خطأ غير متوقع أثناء حفظ الحجز.');
    } finally {
      setAddingBooking(false);
    }
  }

  /* --- Handling: Edit Dress --------------------------------------- */

  function startEditDress(dress) {
    setEditingDressId(dress.id);
    setEditDressName(dress.name || '');
  }

  async function saveDressEdit() {
    if (!editingDressId) return;

    if (!editDressName.trim()) {
      alert('يرجى إدخال اسم الفستان.');
      return;
    }

    try {
      setSavingDressEdit(true);

      const dressesRef = collection(db, 'dresses');

      const nameQ = query(
        dressesRef,
        where('name', '==', editDressName.trim())
      );
      const nameSnap = await getDocs(nameQ);

      let usedByAnother = false;
      nameSnap.forEach((docSnap) => {
        if (docSnap.id !== editingDressId) usedByAnother = true;
      });
      if (usedByAnother) {
        alert('اسم الفستان مستخدم بالفعل لفستان آخر.');
        setSavingDressEdit(false);
        return;
      }

      const ref = doc(db, 'dresses', editingDressId);
      await updateDoc(ref, {
        name: editDressName.trim(),
      });

      setEditingDressId(null);
      setEditDressName('');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setSavingDressEdit(false);
    }
  }

  function cancelDressEdit() {
    setEditingDressId(null);
    setEditDressName('');
  }

  async function deleteDress(dressId) {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفستان؟')) return;
    try {
      await deleteDoc(doc(db, 'dresses', dressId));
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حذف الفستان.');
    }
  }

  /* --- Handling: Edit Booking ------------------------------------- */

  function startEditBooking(booking) {
    setEditingBookingId(booking.id);
    setEditBookingCustomer(booking.customerName || '');
    setEditBookingStart(toInputDate(booking.startDate));
    setEditBookingEnd(toInputDate(booking.endDate));
  }

  async function saveBookingEdit() {
    if (!editingBookingId) return;

    if (!editBookingStart || !editBookingEnd) {
      alert('يرجى تحديد تاريخ البداية والنهاية.');
      return;
    }

    const startDate = new Date(editBookingStart);
    const endDate = new Date(editBookingEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      alert('تواريخ غير صالحة.');
      return;
    }

    if (endDate < startDate) {
      alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية.');
      return;
    }

    const newStartYmd = editBookingStart;
    const newEndYmd = editBookingEnd;

    const currentBooking = bookings.find(
      (b) => b.id === editingBookingId
    );
    if (!currentBooking) {
      alert('تعذر العثور على الحجز.');
      return;
    }
    const dressNameForBooking = currentBooking.dressName;

    try {
      setSavingBookingEdit(true);

      const bookingsRef = collection(db, 'bookings');
      const qBookings = query(
        bookingsRef,
        where('dressName', '==', dressNameForBooking)
      );
      const snap = await getDocs(qBookings);

      let hasConflict = false;
      snap.forEach((docSnap) => {
        if (docSnap.id === editingBookingId) return; // نتجاهل نفس الحجز
        const data = docSnap.data();
        const existingStartYmd = resolveYmd(
          data.startDateYmd,
          data.startDate
        );
        const existingEndYmd = resolveYmd(
          data.endDateYmd,
          data.endDate
        );

        if (
          existingStartYmd &&
          existingEndYmd &&
          rangesOverlapYmd(
            newStartYmd,
            newEndYmd,
            existingStartYmd,
            existingEndYmd
          )
        ) {
          hasConflict = true;
        }
      });

      if (hasConflict) {
        alert('هذا الفستان محجوز في هذه الفترة (بعد التعديل).');
        setSavingBookingEdit(false);
        return;
      }

      const ref = doc(db, 'bookings', editingBookingId);

      await updateDoc(ref, {
        customerName: editBookingCustomer.trim() || null,
        startDate,
        endDate,
        startDateYmd: newStartYmd,
        endDateYmd: newEndYmd,
        returnReminderSent: false,
      });

      cancelBookingEdit();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ تعديل الحجز.');
    } finally {
      setSavingBookingEdit(false);
    }
  }

  function cancelBookingEdit() {
    setEditingBookingId(null);
    setEditBookingCustomer('');
    setEditBookingStart('');
    setEditBookingEnd('');
  }

  async function deleteBooking(bookingId) {
    if (!window.confirm('هل أنت متأكد من حذف هذا الحجز؟')) return;
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حذف الحجز.');
    }
  }

  const showNotificationButton =
    isNotificationSupported && notificationPermission === 'default';

  return (
    <main dir="rtl">
      <div className="app-root">
        <div className="app-container">
          <InAppToast notification={inAppNotification} />

          <header className="app-header">
            <h1 className="app-title">نظام إدارة حجوزات الفساتين</h1>
            <p className="app-subtitle">
              إدارة الفساتين والحجوزات مع تذكير تلقائي قبل بداية الحجز بيومين
              لتجهيز الفستان للتسليم.
            </p>
          </header>

          <NotificationButton
            show={showNotificationButton}
            onClick={enableNotifications}
          />

          <TabsBar
            activeView={activeView}
            setActiveView={setActiveView}
          />

          {activeView === 'addBooking' && (
            <BookingForm
              dresses={dresses}
              bookingDressName={bookingDressName}
              setBookingDressName={setBookingDressName}
              bookingCustomer={bookingCustomer}
              setBookingCustomer={setBookingCustomer}
              bookingStart={bookingStart}
              setBookingStart={setBookingStart}
              bookingEnd={bookingEnd}
              setBookingEnd={setBookingEnd}
              addingBooking={addingBooking}
              bookingStatus={bookingStatus}
              onSubmit={handleAddBooking}
            />
          )}

          {activeView === 'addDress' && (
            <DressForm
              dressName={dressName}
              setDressName={setDressName}
              addingDress={addingDress}
              dressStatus={dressStatus}
              onSubmit={handleAddDress}
            />
          )}

          {activeView === 'dressesList' && (
            <DressesList
              dresses={dresses}
              editingDressId={editingDressId}
              editDressName={editDressName}
              setEditDressName={setEditDressName}
              onStartEdit={startEditDress}
              onSaveEdit={saveDressEdit}
              onCancelEdit={cancelDressEdit}
              onDelete={deleteDress}
              savingDressEdit={savingDressEdit}
            />
          )}

          {activeView === 'bookingsList' && (
            <BookingsList
              bookings={bookings}
              bookingSearch={bookingSearch}
              setBookingSearch={setBookingSearch}
              editingBookingId={editingBookingId}
              editBookingCustomer={editBookingCustomer}
              setEditBookingCustomer={setEditBookingCustomer}
              editBookingStart={editBookingStart}
              setEditBookingStart={setEditBookingStart}
              editBookingEnd={editBookingEnd}
              setEditBookingEnd={setEditBookingEnd}
              onStartEdit={startEditBooking}
              onSaveEdit={saveBookingEdit}
              onCancelEdit={cancelBookingEdit}
              onDelete={deleteBooking}
              savingBookingEdit={savingBookingEdit}
            />
          )}

          {activeView === 'timeView' && (
            <TimeView bookings={bookings} />
          )}
        </div>
      </div>
    </main>
  );
}
