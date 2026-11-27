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
    allowNavigation: ['accounts.google.com', '*.google.com'],
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#06b6d4',
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
