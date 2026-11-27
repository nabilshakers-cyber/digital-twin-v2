import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
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

export const auth: Auth = (() => {
  if (Capacitor.isNativePlatform()) {
    try {
      return initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch {
      return getAuth(app);
    }
  }
  return getAuth(app);
})();

export interface AppAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  mode: 'firebase';
}

export const LOCAL_AUTH_STORAGE_KEY = 'digital_twin_local_auth_v1';

export function clearLocalAuthUser(): void {
  try {
    localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function toAppAuthUser(fbUser: User): AppAuthUser {
  return {
    uid: fbUser.uid,
    displayName: fbUser.displayName,
    email: fbUser.email,
    photoURL: fbUser.photoURL,
    emailVerified: fbUser.emailVerified,
    mode: 'firebase',
  };
}

function isUserCancellationError(err: unknown): boolean {
  const anyErr = err as { code?: unknown; message?: unknown } | null;
  const code = typeof anyErr?.code === 'string' ? anyErr.code.toLowerCase() : '';
  const msg = typeof anyErr?.message === 'string' ? anyErr.message.toLowerCase() : '';
  return (
    code.includes('cancel') ||
    msg.includes('cancel') ||
    msg.includes('12501') ||
    msg.includes('dismissed')
  );
}

export function mapFirebaseAuthError(err: unknown): string {
  const code = typeof (err as { code?: unknown })?.code === 'string'
    ? String((err as { code: string }).code)
    : '';
  const message = err instanceof Error
    ? err.message
    : typeof (err as { message?: unknown })?.message === 'string'
      ? String((err as { message: string }).message)
      : '';

  if (isUserCancellationError(err)) {
    return 'تم إلغاء تسجيل الدخول عبر Google.';
  }

  switch (code) {
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب. يرجى التواصل مع الدعم.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجل مسبقاً. جرّب تسجيل الدخول أو استعادة كلمة المرور.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة. يرجى استخدام 6 أحرف أو أرقام على الأقل.';
    case 'auth/too-many-requests':
      return 'تم تنفيذ محاولات كثيرة متتالية. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بخدمة المصادقة. يرجى التحقق من اتصال الإنترنت.';
    case 'auth/operation-not-allowed':
      return 'طريقة تسجيل الدخول هذه غير مفعّلة بعد في إعدادات Firebase Console لهذا المشروع.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'تم إلغاء نافذة تسجيل الدخول عبر Google.';
    case 'auth/popup-blocked':
    case 'auth/operation-not-supported-in-this-environment':
      return 'تعذر إتمام تسجيل الدخول في هذه البيئة. يمكنك تسجيل الدخول بالبريد وكلمة المرور.';
    case 'auth/unauthorized-domain':
      return 'النطاق الحالي غير مصرح به في Firebase Auth. يمكنك استخدام البريد وكلمة المرور أو إضافة النطاق في Firebase Console.';
    default: {
      const lowerMsg = message.toLowerCase();
      if (
        lowerMsg.includes('10:') ||
        lowerMsg.includes('developer_error') ||
        lowerMsg.includes('developer console') ||
        lowerMsg.includes('28444')
      ) {
        return 'إعدادات بصمة التطبيق (SHA-1) أو معرف العميل غير مطابقة في Firebase Console لنسخة الأندرويد.';
      }
      if (lowerMsg.includes('12500') || lowerMsg.includes('sign_in_failed')) {
        return 'فشل تسجيل الدخول عبر Google على الأندرويد (12500). يرجى التأكد من إضافة بصمة SHA-1 وبريد الدعم في Firebase Console.';
      }
      if (
        lowerMsg.includes('no credentials') ||
        lowerMsg.includes('matching credential') ||
        lowerMsg.includes('16:')
      ) {
        return 'لا توجد بيانات دخول متاحة لحساب Google على هذا الجهاز أو خدمات Google Play تحتاج تحديثاً.';
      }
      if (lowerMsg.includes('network') || lowerMsg.includes('7:')) {
        return 'تعذر الاتصال بخدمة المصادقة. يرجى التحقق من اتصال الإنترنت.';
      }
      if (message && /[\u0600-\u06FF]/.test(message)) {
        return message;
      }
      return 'تعذر إتمام العملية حالياً. يرجى التحقق من البيانات والمحاولة مرة أخرى.';
    }
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AppAuthUser> {
  try {
    const cleanEmail = email.trim();
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    clearLocalAuthUser();
    return toAppAuthUser(cred.user);
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AppAuthUser> {
  try {
    const cleanEmail = email.trim();
    const cleanName = name.trim();
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName });
    }
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // verification resend remains available if initial send hits rate limit
    }
    clearLocalAuthUser();
    return {
      ...toAppAuthUser(cred.user),
      displayName: cleanName || cred.user.displayName,
    };
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function signInWithGoogle(): Promise<AppAuthUser> {
  try {
    if (Capacitor.isNativePlatform()) {
      let nativeResult;
      try {
        nativeResult = await FirebaseAuthentication.signInWithGoogle({
          skipNativeAuth: true,
        });
      } catch (nativeErr) {
        if (isUserCancellationError(nativeErr)) {
          throw nativeErr;
        }
        // Fallback to classic Google Sign-In Intent if Credential Manager is unavailable or fails on device
        nativeResult = await FirebaseAuthentication.signInWithGoogle({
          skipNativeAuth: true,
          useCredentialManager: false,
        });
      }

      const idToken = nativeResult.credential?.idToken;
      if (!idToken) {
        throw new Error('تعذر الحصول على رمز التحقق (ID Token) من Google. يرجى المحاولة مرة أخرى.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      clearLocalAuthUser();
      return toAppAuthUser(result.user);
    }

    const webResult = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      customParameters: [{ key: 'prompt', value: 'select_account' }],
    });

    const idToken = webResult.credential?.idToken;
    if (idToken) {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      clearLocalAuthUser();
      return toAppAuthUser(result.user);
    }

    if (auth.currentUser) {
      clearLocalAuthUser();
      return toAppAuthUser(auth.currentUser);
    }

    throw new Error('تعذر الحصول على رمز التحقق (ID Token) من Google. يرجى المحاولة مرة أخرى.');
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('يرجى تسجيل الدخول أولاً.');
  }
  try {
    await sendEmailVerification(auth.currentUser);
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function reloadFirebaseUser(): Promise<AppAuthUser | null> {
  if (!auth.currentUser) return null;
  try {
    await reload(auth.currentUser);
    return auth.currentUser ? toAppAuthUser(auth.currentUser) : null;
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function signOutUser(): Promise<void> {
  clearLocalAuthUser();
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch {
      // Never block sign-out if native credential state is already empty
    }
  }
  if (auth.currentUser) {
    try {
      await signOut(auth);
    } catch {
      // Never block sign-out on transient network errors
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
