import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, X, Share, Terminal, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  broadcastCloseAllModals,
  useModalCloseListener,
  useModalScrollLock,
} from '../utils/modalCoordinator';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { canNativeInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useModalCloseListener('pwa-guide-modal', () => setIsGuideOpen(false));
  useModalScrollLock('pwa-guide-modal', isGuideOpen);

  const openGuideModal = () => {
    broadcastCloseAllModals('pwa-guide-modal');
    setIsGuideOpen(true);
  };

  const handleClick = async () => {
    if (canNativeInstall) {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') {
        openGuideModal();
      }
    } else {
      openGuideModal();
    }
  };

  if (isInstalled) {
    return compact ? null : (
      <span
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[11px] font-semibold"
        title="يعمل الآن بوضع تطبيق الأندرويد المستقل"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>وضع التطبيق</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        id="btn-install-android-app"
        onClick={handleClick}
        className={
          compact
            ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer'
            : 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer'
        }
        title="تثبيت التطبيق على هاتف الأندرويد"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">تثبيت على أندرويد</span>
        <Download className="w-3 h-3 sm:hidden" />
      </button>

      {isGuideOpen && (
        <div
          className="app-modal-overlay bg-slate-950/85 backdrop-blur-md sm:p-4 animate-fadeIn"
          onClick={() => setIsGuideOpen(false)}
        >
          <div
            className="app-modal-panel max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header with Always-Visible Close (X) */}
            <div className="app-modal-header p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                    تشغيل وتثبيت التطبيق على هاتف Android
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                    التطبيق مهيأ للعمل كتطبيق أندرويد مستقل وبوضع عدم الاتصال
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="app-modal-close p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="app-modal-body p-4 sm:p-5 space-y-4">
              {isIOS ? (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs text-slate-300">
                  <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Share className="w-4 h-4" /> التثبيت على iPhone / iPad (Safari):
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                    <li>افتح رابط التطبيق في متصفح Safari.</li>
                    <li>اضغط على زر المشاركة (المربع بسهم للأعلى).</li>
                    <li>اختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-700/40 space-y-2 text-xs text-slate-200">
                    <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> الطريقة ١: التثبيت الفوري كتطبيق أندرويد (WebAPK)
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                      <li>افتح رابط التطبيق مباشرة في متصفح <strong>Chrome</strong> على هاتفك الأندرويد (خارج نافذة المعاينة).</li>
                      <li>اضغط على قائمة المتصفح (النقاط الثلاث <strong>⋮</strong> بالأعلى).</li>
                      <li>اختر <strong>«تثبيت التطبيق»</strong> (Install app) أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</li>
                      <li>سيظهر أيقونة «التوأم الرقمي» على شاشة هاتفك ويعمل بملء الشاشة وبدون إنترنت.</li>
                    </ol>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4" /> الطريقة ٢: بناء ملف APK أصلي عبر مشروع Android المدمج (Capacitor)
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      تم تجهيز مجلد <code className="text-cyan-300 font-mono">android/</code> وملف <code className="text-cyan-300 font-mono">capacitor.config.ts</code> في المشروع لبناء APK عبر Android Studio:
                    </p>
                    <pre className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto text-left" dir="ltr">
{`npm run android:sync
npx cap open android`}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(false)}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  حسناً، فهمت
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
