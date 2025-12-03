import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        {/* Tajawal + Roboto */}
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        <title>ألاء سنتر    </title>

        {/* وصف بسيط للمشروع */}
        <meta
          name="description"
          content="إدارة الفساتين والحجوزات مع تذكير تلقائي قبل بداية الحجز بيومين لتجهيز الفستان للتسليم."
        />
        <link rel="icon" href="/logo-rentdress.jpeg" />
        <style>{`
          body {
            font-family: 'Tajawal', 'Roboto', sans-serif;
            background-color: #f7f7f7;
          }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
