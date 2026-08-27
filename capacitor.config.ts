import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.commerceflow.app',
  appName: 'CommerceFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
