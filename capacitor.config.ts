import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digitaltwin.taskmanager',
  appName: 'التوأم الرقمي',
  webDir: 'dist',
  backgroundColor: '#0a0e17',
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0e17',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
