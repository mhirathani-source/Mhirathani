import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.primeboxingacademy.app',
  appName: 'Prime Boxing Academy',
  webDir: 'dist/public',
  server: {
    // Hosted, online-only app: retain the website's same-origin API and Clerk
    // session rather than copying financial data or tokens into a local shell.
    url: 'https://prime-boxing-academy.replit.app/',
    errorPath: 'offline.html',
    androidScheme: 'https',
    // WKWebView cannot register http/https as its local URL scheme.
    iosScheme: 'capacitor',
    cleartext: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 2000 },
  },
};

export default config;
