import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { isCapacitorNativeRuntime } from './utils/api';

const app = initializeApp(firebaseConfig);

const firestoreDatabaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  'ai-studio-digitaltwintaskm-9dac13b3-7978-4cfa-aa0e-77a427f44496';

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firestoreDatabaseId
  );
} catch {
  firestoreInstance = getFirestore(app, firestoreDatabaseId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

export interface AppAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  mode: 'local' | 'firebase';
}

export const LOCAL_AUTH_STORAGE_KEY = 'digital_twin_local_auth_v1';

export function getSavedLocalAuthUser(): AppAuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid) {
      return {
        uid: String(parsed.uid),
        displayName: parsed.displayName || 'مستخدم التطبيق',
        email: parsed.email || 'local@digitaltwin.app',
        photoURL: parsed.photoURL || null,
        mode: 'local',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function signInLocally(displayName?: string, email?: string): AppAuthUser {
  const user: AppAuthUser = {
    uid: 'local-twin-user',
    displayName: displayName?.trim() || 'حسابك المحلي',
    email: email?.trim() || 'حساب محفوظ محلياً على الجهاز',
    photoURL: null,
    mode: 'local',
  };
  try {
    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore storage errors
  }
  return user;
}

export function clearLocalAuthUser(): void {
  try {
    localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInInApp(
  fallbackName?: string,
  fallbackEmail?: string,
  preferCloudPopup = false
): Promise<AppAuthUser> {
  // Inside Capacitor / Android WebView, NEVER open external firebaseapp.com popups or redirects
  if (isCapacitorNativeRuntime() || !preferCloudPopup) {
    return signInLocally(fallbackName, fallbackEmail);
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    clearLocalAuthUser();
    return {
      uid: result.user.uid,
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
      mode: 'firebase',
    };
  } catch (err: any) {
    const code = err?.code || '';
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    ) {
      throw new Error('تم إلغاء نافذة تسجيل الدخول.');
    }
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      throw new Error(
        'المتصفح منع النافذة المنبثقة. يمكنك تسجيل الدخول محلياً داخل التطبيق بدون مغادرة الصفحة.'
      );
    }
    throw new Error('تعذر تسجيل الدخول السحابي. يمكنك استخدام الدخول المحلي داخل التطبيق.');
  }
}

export async function signOutUser(): Promise<void> {
  clearLocalAuthUser();
  if (auth.currentUser) {
    try {
      await signOut(auth);
    } catch {
      // Never block sign-out or leave app on network failure
    }
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
