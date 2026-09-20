import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.schnitzery.app',
  appName: 'Schnitzery',
  webDir: 'public',
  // HYBRID: the native shell loads the deployed app so Server Components and
  // Server Actions keep working (a static export can't run them). Replace this
  // with your real Vercel URL, then re-run `npx cap sync`.
  server: {
    url: 'https://YOUR-APP.vercel.app',
    cleartext: false,
  },
};

export default config;
