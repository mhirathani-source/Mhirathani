import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import { ErrorBoundary } from '@/components/error-boundary';
import { registerPublicWorker } from './lib/pwa';

import './index.css';

const App = lazy(() => import('./App'));
const DownloadPage = lazy(() => import('./pages/DownloadPage'));
const NativePortal = lazy(() => import('./pages/NativePortal'));
const path = window.location.pathname.replace(/\/+$/, "");
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const isDownload = path === `${base}/download` || path === `${base}/app`;
const native = Capacitor.isNativePlatform();
if (!native) registerPublicWorker();

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <Suspense fallback={<div className="center" dir="rtl">جارٍ التحميل…</div>}>
      {native ? <NativePortal/> : isDownload ? <DownloadPage/> : <App/>}
    </Suspense>
  </ErrorBoundary>,
);
