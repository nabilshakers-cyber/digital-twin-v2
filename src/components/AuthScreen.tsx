import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import {
  reloadFirebaseUser,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  type AppAuthUser,
} from '../firebase';

type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthScreenProps {
  unverifiedUser: AppAuthUser | null;
  onAuthSuccess: (user: AppAuthUser) => void;
  onSignOut: () => Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthScreen: React.FC<AuthScreenProps> = ({
  unverifiedUser,
  onAuthSuccess,
  onSignOut,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (!password) {
      setErrorMsg('يرجى إدخال كلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const user = await signInWithEmail(cleanEmail, password);
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (cleanName.length < 2) {
      setErrorMsg('يرجى إدخال اسمك الكامل (حرفان على الأقل).');
      return;
    }
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const user = await signUpWithEmail(cleanName, cleanEmail, password);
      if (!user.emailVerified) {
        setInfoMsg('تم إنشاء الحساب وإرسال رابط التفعيل إلى بريدك الإلكتروني.');
      }
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح لاستعادة كلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(cleanEmail);
      setInfoMsg(
        'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى مراجعة البريد الوارد أو البريد غير الهام.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إرسال رابط الاستعادة.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تسجيل الدخول عبر Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const refreshed = await reloadFirebaseUser();
      if (refreshed && refreshed.emailVerified) {
        onAuthSuccess(refreshed);
      } else {
        setErrorMsg(
          'لم يتم تأكيد البريد الإلكتروني بعد. يرجى الضغط على رابط التفعيل المرسل لبريدك ثم المحاولة مجدداً.'
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر التحقق من حالة الحساب.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      await resendVerificationEmail();
      setInfoMsg('تمت إعادة إرسال رابط التفعيل إلى بريدك الإلكتروني.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إعادة إرسال رابط التفعيل.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden"
    >
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute -top-36 -right-36 w-96 h-96 rounded-full bg-cyan-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -left-36 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl" />

      <div className="w-full max-w-md relative z-10 space-y-5 animate-fadeIn">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-emerald-500 p-[1px] shadow-xl shadow-cyan-500/20">
            <div className="w-full h-full rounded-2xl bg-[#0f172a] flex items-center justify-center">
              <Bot className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>منصة التوأم الرقمي السحابية</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {unverifiedUser
              ? 'تأكيد البريد الإلكتروني'
              : mode === 'login'
              ? 'تسجيل الدخول إلى مساحتك'
              : mode === 'signup'
              ? 'إنشاء حساب سحابي جديد'
              : 'استعادة كلمة المرور'}
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            {unverifiedUser
              ? 'لحماية مهامك وأهدافك الخاصة في السحابة، يرجى تفعيل بريدك الإلكتروني للمتابعة.'
              : mode === 'login'
              ? 'سجّل دخولك لمزامنة مهامك وأهدافك وجدولك اليومي بأمان عبر جميع أجهزتك.'
              : mode === 'signup'
              ? 'أنشئ حساباً شخصياً لحفظ بياناتك سحابياً وتخصيص التوأم الرقمي حسب أسلوبك.'
              : 'أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور.'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-start gap-2.5 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {unverifiedUser ? (
            /* Email Verification Step */
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-center">
                <div className="w-11 h-11 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <Mail className="w-5 h-5" />
                </div>
                <p className="text-slate-200 font-bold">
                  أرسلنا رابط التفعيل إلى:
                </p>
                <p dir="ltr" className="text-cyan-300 font-mono text-xs break-all">
                  {unverifiedUser.email}
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  افتح بريدك الإلكتروني واضغط على رابط التفعيل، ثم عد واضغط على زر التحقق أدناه للدخول مباشرة.
                </p>
              </div>

              <button
                type="button"
                id="btn-check-email-verified"
                disabled={loading}
                onClick={handleCheckVerification}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>تم تفعيل البريد — متابعة الدخول</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  id="btn-resend-verification"
                  disabled={loading}
                  onClick={handleResendVerification}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-slate-700 font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة إرسال الرابط</span>
                </button>

                <button
                  type="button"
                  id="btn-verification-signout"
                  disabled={loading}
                  onClick={onSignOut}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-200 border border-slate-700 font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تغيير الحساب</span>
                </button>
              </div>
            </div>
          ) : mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="auth-login-email" className="text-xs font-semibold text-slate-300 block">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-login-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="auth-login-password" className="text-xs font-semibold text-slate-300">
                    كلمة المرور
                  </label>
                  <button
                    type="button"
                    id="btn-forgot-password"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-login-password"
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-auth-login-submit"
                disabled={loading || googleLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>تسجيل الدخول</span>
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-800" />
                <span className="shrink mx-3 text-[11px] text-slate-500 font-medium">
                  أو المتابعة باستخدام
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <button
                type="button"
                id="btn-auth-google"
                disabled={loading || googleLoading}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                )}
                <span>تسجيل الدخول باستخدام Google</span>
              </button>

              <div className="pt-2 text-center text-xs text-slate-400">
                ليس لديك حساب؟{' '}
                <button
                  type="button"
                  id="btn-switch-to-signup"
                  onClick={() => switchMode('signup')}
                  className="text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-4 cursor-pointer"
                >
                  إنشاء حساب جديد
                </button>
              </div>
            </form>
          ) : mode === 'signup' ? (
            /* Sign Up Form */
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label htmlFor="auth-signup-name" className="text-xs font-semibold text-slate-300 block">
                  الاسم الكامل
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-signup-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="أدخل اسمك"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="auth-signup-email" className="text-xs font-semibold text-slate-300 block">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-signup-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="auth-signup-password" className="text-xs font-semibold text-slate-300 block">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-signup-password"
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6 أحرف على الأقل"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="auth-signup-confirm" className="text-xs font-semibold text-slate-300 block">
                  تأكيد كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-signup-confirm"
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-auth-signup-submit"
                disabled={loading || googleLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>إنشاء الحساب</span>
              </button>

              <button
                type="button"
                id="btn-signup-google"
                disabled={loading || googleLoading}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                )}
                <span>التسجيل السريع عبر Google</span>
              </button>

              <div className="pt-1 text-center text-xs text-slate-400">
                لديك حساب بالفعل؟{' '}
                <button
                  type="button"
                  id="btn-switch-to-login"
                  onClick={() => switchMode('login')}
                  className="text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-4 cursor-pointer"
                >
                  تسجيل الدخول
                </button>
              </div>
            </form>
          ) : (
            /* Forgot Password Form */
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="w-11 h-11 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                <KeyRound className="w-5 h-5" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="auth-forgot-email" className="text-xs font-semibold text-slate-300 block">
                  البريد الإلكتروني المسجل
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-forgot-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-auth-forgot-submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>إرسال رابط استعادة كلمة المرور</span>
              </button>

              <button
                type="button"
                id="btn-back-to-login"
                onClick={() => switchMode('login')}
                className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>العودة إلى تسجيل الدخول</span>
              </button>
            </form>
          )}
        </div>

        {/* Security Assurance Footer */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
          <span>بياناتك محمية ومشفرة ومحصورة بحسابك الشخصي فقط</span>
        </div>
      </div>
    </div>
  );
};
