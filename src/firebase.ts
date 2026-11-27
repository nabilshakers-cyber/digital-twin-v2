import { app, ensureFirebaseApp, firebaseExtraConfig } from './firebaseApp';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getApps } from 'firebase/app';
import {
  browserPopupRedirectResolver,
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

export { app };

const firestoreDatabaseId = firebaseExtraConfig.firestoreDatabaseId;

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
  try {
    return initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
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

function extractRawErrorDetails(err: unknown): {
  code: string;
  name: string;
  message: string;
  raw: string;
} {
  const anyErr =
    err && typeof err === 'object' ? (err as Record<string, unknown>) : null;
  const code =
    anyErr && anyErr.code !== undefined && anyErr.code !== null
      ? String(anyErr.code)
      : '';
  const name =
    err instanceof Error
      ? err.name
      : anyErr && typeof anyErr.name === 'string'
        ? anyErr.name
        : '';
  const message =
    err instanceof Error
      ? err.message
      : anyErr && typeof anyErr.message === 'string'
        ? anyErr.message
        : typeof err === 'string'
          ? err
          : '';
  let raw = '';
  try {
    raw =
      err instanceof Error
        ? JSON.stringify({
            name: err.name,
            code: (err as { code?: unknown }).code ?? null,
            message: err.message,
            ...(anyErr || {}),
          })
        : JSON.stringify(err);
  } catch {
    raw = String(err);
  }
  return { code, name, message, raw };
}

function formatGoogleSignInError(err: unknown, step?: string): string {
  const { code, name, message, raw } = extractRawErrorDetails(err);
  let appsCount = 0;
  try {
    appsCount = getApps().length;
  } catch {
    appsCount = -1;
  }
  const technicalParts = [
    step ? `step: ${step}` : '',
    code ? `code: ${code}` : '',
    name && name !== 'Error' ? `type: ${name}` : '',
    message ? `message: ${message}` : '',
    !code && !message && raw ? `raw: ${raw}` : '',
    `platform: ${Capacitor.getPlatform()}`,
    `native: ${Capacitor.isNativePlatform()}`,
    `apps: ${appsCount}`,
  ].filter(Boolean);
  const technicalDetails = technicalParts.join(' | ') || String(err);
  const hint = mapFirebaseAuthError(err);

  if (hint && hint !== 'تعذر إتمام العملية حالياً. يرجى التحقق من البيانات والمحاولة مرة أخرى.') {
    return `${hint} (${technicalDetails})`;
  }
  return `فشل تسجيل الدخول عبر Google: ${technicalDetails}`;
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
      return 'تعذر الاتصال بخدمة المصادقة (auth/network-request-failed). يرجى التحقق من اتصال الإنترنت.';
    case 'auth/internal-error':
      return 'حدث خطأ داخلي في المصادقة (auth/internal-error).';
    case 'auth/operation-not-allowed':
      return 'طريقة تسجيل الدخول هذه غير مفعّلة بعد في إعدادات Firebase Console لهذا المشروع.';
    case 'auth/unauthorized-domain':
      return 'النطاق الحالي غير مصرح به في Firebase Auth.';
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
  let step = 'ensureFirebaseApp';
  try {
    const firebaseApp = ensureFirebaseApp();
    const firebaseAuth = auth || getAuth(firebaseApp);

    step = 'FirebaseAuthentication.signInWithGoogle';
    const authResult = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      useCredentialManager: true,
    });

    step = 'validateGoogleCredential';
    const rawIdToken =
      typeof authResult.credential?.idToken === 'string'
        ? authResult.credential.idToken.trim()
        : '';
    const rawAccessToken =
      typeof authResult.credential?.accessToken === 'string'
        ? authResult.credential.accessToken.trim()
        : '';

    if (!rawIdToken) {
      if (!Capacitor.isNativePlatform() && firebaseAuth.currentUser) {
        clearLocalAuthUser();
        return toAppAuthUser(firebaseAuth.currentUser);
      }
      if (!Capacitor.isNativePlatform() && rawAccessToken) {
        step = 'GoogleAuthProvider.credential(accessToken)';
        const accessCredential = GoogleAuthProvider.credential(null, rawAccessToken);
        step = 'signInWithCredential(accessToken)';
        const accessResult = await signInWithCredential(firebaseAuth, accessCredential);
        clearLocalAuthUser();
        return toAppAuthUser(accessResult.user);
      }
      throw new Error(
        `MISSING_ID_TOKEN: لم يتم استلام رمز التحقق (idToken) من Google (${JSON.stringify({
          platform: Capacitor.getPlatform(),
          hasUser: Boolean(authResult.user),
          hasCredential: Boolean(authResult.credential),
          hasAccessToken: Boolean(rawAccessToken),
          providerId: authResult.credential?.providerId ?? null,
        })})`
      );
    }

    step = 'GoogleAuthProvider.credential(idToken)';
    const credential = GoogleAuthProvider.credential(rawIdToken);

    step = 'signInWithCredential';
    const result = await signInWithCredential(firebaseAuth, credential);
    clearLocalAuthUser();
    return toAppAuthUser(result.user);
  } catch (err) {
    console.error(`[GoogleSignIn] Failed at step="${step}":`, err);
    throw new Error(formatGoogleSignInError(err, step));
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
