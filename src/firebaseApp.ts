import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from 'firebase/app';
import rawFirebaseConfig from '../firebase-applet-config.json';

export const firebaseConfig: FirebaseOptions = {
  apiKey: rawFirebaseConfig.apiKey,
  authDomain: rawFirebaseConfig.authDomain,
  projectId: rawFirebaseConfig.projectId,
  storageBucket: rawFirebaseConfig.storageBucket,
  messagingSenderId: rawFirebaseConfig.messagingSenderId,
  appId: rawFirebaseConfig.appId,
  ...(rawFirebaseConfig.measurementId
    ? { measurementId: rawFirebaseConfig.measurementId }
    : {}),
};

export const firebaseExtraConfig = {
  firestoreDatabaseId:
    (rawFirebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
    'ai-studio-digitaltwintaskm-9dac13b3-7978-4cfa-aa0e-77a427f44496',
  oAuthClientId:
    (rawFirebaseConfig as { oAuthClientId?: string }).oAuthClientId || '',
};

export function ensureFirebaseApp(): FirebaseApp {
  if (!firebaseConfig.apiKey || !firebaseConfig.appId || !firebaseConfig.projectId) {
    throw new Error(
      `INVALID_FIREBASE_CONFIG: إعدادات firebase-applet-config.json غير مكتملة (${JSON.stringify({
        hasApiKey: Boolean(firebaseConfig.apiKey),
        hasAppId: Boolean(firebaseConfig.appId),
        hasProjectId: Boolean(firebaseConfig.projectId),
      })})`
    );
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export const app: FirebaseApp = ensureFirebaseApp();
