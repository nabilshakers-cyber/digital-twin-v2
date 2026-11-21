import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
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
export const auth = getAuth(app);

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

export function mapFirebaseAuthError(err: unknown): string {
  const code = typeof (err as { code?: unknown })?.code === 'string'
    ? String((err as { code: string }).code)
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
      return 'تعذر الاتصال بخدمة المصادقة. يرجى التحقق من اتصال الإنترنت.';
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل بعد في إعدادات Firebase Console لهذا المشروع.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'تم إلغاء نافذة تسجيل الدخول عبر Google.';
    case 'auth/popup-blocked':
    case 'auth/operation-not-supported-in-this-environment':
      return 'تعذر فتح نافذة تسجيل الدخول المنبثقة. يمكنك تسجيل الدخول بالبريد وكلمة المرور أو السماح بالنوافذ المنبثقة.';
    case 'auth/unauthorized-domain':
      return 'النطاق الحالي غير مصرح به في Firebase Auth. يمكنك استخدام البريد وكلمة المرور أو إضافة النطاق في Firebase Console.';
    default:
      return 'تعذر إتمام العملية حالياً. يرجى التحقق من البيانات والمحاولة مرة أخرى.';
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
    const result = await signInWithPopup(auth, googleProvider);
    clearLocalAuthUser();
    return toAppAuthUser(result.user);
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
