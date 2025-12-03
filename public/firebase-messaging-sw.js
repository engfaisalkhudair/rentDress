

// IMPORTANT: this file must stay in /public and use importScripts (not ES modules)
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

// نفس بيانات firebaseConfig تبعتك
firebase.initializeApp({
  apiKey: "AIzaSyB-3rSFwTOKEv0WcfXi97RGCUcKxw3Da28",
  authDomain: "rent-dress-59a83.firebaseapp.com",
  projectId: "rent-dress-59a83",
  storageBucket: "rent-dress-59a83.firebasestorage.app",
  messagingSenderId: "397453485926",
  appId: "1:397453485926:web:dad8dd3b9c52f3eb3d4aa7"
});

// Get messaging
const messaging = firebase.messaging();

// إشعار خلفي لما التاب مسكر أو المتصفح في الخلفية
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Background message', payload);

  const notificationTitle = payload.notification?.title || 'إشعار جديد';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192.png' // لو عندك أيقونة، أو احذف السطر
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
