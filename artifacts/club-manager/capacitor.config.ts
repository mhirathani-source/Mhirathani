import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.primeboxingacademy.app',
  appName: 'Prime Boxing Academy',
  webDir: 'dist/public',
  server: {
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
