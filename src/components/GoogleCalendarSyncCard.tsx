import React, { useEffect, useState } from 'react';
import {
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  UploadCloud,
  DownloadCloud,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { TimeBlock } from '../types';
import { toLocalIsoDate } from '../utils/calendarUtils';
import {
  buildCalendarSyncPlan,
  CalendarSyncPlan,
  clearGoogleCalendarToken,
  connectGoogleCalendarWithGIS,
  fetchGoogleCalendarEvents,
  isGoogleCalendarConnected,
  pushEventsToGoogleCalendar,
  subscribeGoogleCalendarAuth,
} from '../utils/googleCalendarSync';

interface GoogleCalendarSyncCardProps {
  schedule: TimeBlock[];
  onApplyCalendarSync: (payload: {
    importedBlocks: TimeBlock[];
    updatedLocalBlocks: TimeBlock[];
    linkedResults?: { blockId: string; googleEventId: string; updated?: string }[];
  }) => void;
  buttonId?: string;
}

export const GoogleCalendarSyncCard: React.FC<GoogleCalendarSyncCardProps> = ({
  schedule,
  onApplyCalendarSync,
  buttonId = 'btn-sync-google-calendar',
}) => {
  const [connected, setConnected] = useState<boolean>(() => isGoogleCalendarConnected());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [pendingPushPlan, setPendingPushPlan] = useState<{
    plan: CalendarSyncPlan;
    importedCount: number;
    updatedLocallyCount: number;
  } | null>(null);

  useEffect(() => {
    setConnected(isGoogleCalendarConnected());
    return subscribeGoogleCalendarAuth(() => {
      setConnected(isGoogleCalendarConnected());
    });
  }, []);

  const handleGoogleSignIn = async (): Promise<boolean> => {
    setIsConnecting(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      await connectGoogleCalendarWithGIS('select_account');
      setConnected(true);
      setSyncNotice('تم ربط حساب Google Calendar بنجاح. يمكنك الآن مزامنة مواعيدك.');
      return true;
    } catch (err: any) {
      setSyncError(err?.message || 'تعذر ربط حساب Google Calendar.');
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearGoogleCalendarToken();
    setConnected(false);
    setPendingPushPlan(null);
    setSyncNotice('تم قطع الاتصال بتقويم Google وحذف التصريح من الذاكرة.');
  };

  const handleSyncCalendar = async () => {
    setSyncError(null);
    setSyncNotice(null);

    if (!isGoogleCalendarConnected()) {
      const ok = await handleGoogleSignIn();
      if (!ok) return;
    }

    setIsSyncing(true);
    try {
      const today = new Date();
      const windowEnd = new Date(today);
      windowEnd.setDate(windowEnd.getDate() + 14);
      const windowStartIso = toLocalIsoDate(today);
      const windowEndIso = toLocalIsoDate(windowEnd);

      const googleEvents = await fetchGoogleCalendarEvents(windowStartIso, windowEndIso);
      const plan = buildCalendarSyncPlan(schedule, googleEvents, windowStartIso, windowEndIso);

      if (
        plan.importedBlocks.length > 0 ||
        plan.updatedLocalBlocks.length > 0 ||
        plan.localLinkUpdates.length > 0
      ) {
        onApplyCalendarSync({
          importedBlocks: plan.importedBlocks,
          updatedLocalBlocks: plan.updatedLocalBlocks,
          linkedResults: plan.localLinkUpdates,
        });
      }

      const importedCount = plan.importedBlocks.length;
      const updatedLocallyCount = plan.updatedLocalBlocks.length;

      if (plan.toCreateOnGoogle.length > 0 || plan.toUpdateOnGoogle.length > 0) {
        // Explicit user confirmation required before creating or modifying Google Calendar events
        setPendingPushPlan({
          plan,
          importedCount,
          updatedLocallyCount,
        });
      } else {
        setSyncNotice(
          importedCount > 0 || updatedLocallyCount > 0
            ? `تمت المزامنة: استيراد ${importedCount} موعد جديد وتحديث ${updatedLocallyCount} موعد من Google Calendar.`
            : 'تقويمك محدّث بالكامل مع Google Calendar (لا توجد تغييرات جديدة).'
        );
      }
    } catch (err: any) {
      setSyncError(err?.message || 'حدث خطأ أثناء مزامنة تقويم Google Calendar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmPushToGoogle = async () => {
    if (!pendingPushPlan) return;
    setIsPushing(true);
    setSyncError(null);

    try {
      const { plan, importedCount, updatedLocallyCount } = pendingPushPlan;
      const pushResult = await pushEventsToGoogleCalendar(
        plan.toCreateOnGoogle,
        plan.toUpdateOnGoogle
      );

      if (pushResult.linkedResults.length > 0) {
        onApplyCalendarSync({
          importedBlocks: [],
          updatedLocalBlocks: [],
          linkedResults: pushResult.linkedResults,
        });
      }

      setPendingPushPlan(null);
      setSyncNotice(
        `اكتملت المزامنة الثنائية بنجاح: استيراد ${importedCount} وتحديث ${updatedLocallyCount} محلياً، وإضافة ${pushResult.createdCount} وتحديث ${pushResult.updatedCount} في Google Calendar.`
      );
    } catch (err: any) {
      setSyncError(err?.message || 'تعذر رفع التحديثات إلى Google Calendar.');
    } finally {
      setIsPushing(false);
    }
  };

  const handleCancelPush = () => {
    if (!pendingPushPlan) return;
    const { importedCount, updatedLocallyCount } = pendingPushPlan;
    setPendingPushPlan(null);
    setSyncNotice(
      importedCount > 0 || updatedLocallyCount > 0
        ? `تم استيراد ${importedCount} وتحديث ${updatedLocallyCount} موعد محلياً، وتم إلغاء الرفع إلى Google Calendar.`
        : 'تم إلغاء تعديل مواعيد Google Calendar.'
    );
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-800/40 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-300 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-slate-100">
                مزامنة تقويم Google Calendar
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  connected
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                {connected ? 'متصل' : 'غير متصل'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              مزامنة المواعيد من وإلى Google Calendar (للـ 14 يوماً القادمة) عبر Google Identity Services.
            </p>
          </div>
        </div>

        {connected && (
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>قطع الاتصال</span>
          </button>
        )}
      </div>

      {/* Action Buttons: Official Sign in with Google + Sync Calendar Button */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {!connected && (
          <button
            type="button"
            id={`${buttonId}-signin`}
            disabled={isConnecting || isSyncing}
            onClick={handleGoogleSignIn}
            className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="gsi-material-button-icon w-4 h-4 shrink-0">
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
            </div>
            <span className="gsi-material-button-contents">
              {isConnecting ? 'جارٍ الربط بـ Google...' : 'Sign in with Google'}
            </span>
          </button>
        )}

        <button
          type="button"
          id={buttonId}
          disabled={isConnecting || isSyncing || isPushing}
          onClick={handleSyncCalendar}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSyncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>{isSyncing ? 'جارٍ المزامنة...' : 'مزامنة التقويم'}</span>
        </button>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <DownloadCloud className="w-3.5 h-3.5 text-cyan-400" />
            استيراد من Google
          </span>
          <span className="inline-flex items-center gap-1">
            <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
            رفع إلى Google
          </span>
        </div>
      </div>

      {/* Explicit Confirmation Dialog Before Modifying Google Calendar */}
      {pendingPushPlan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد مزامنة المواعيد إلى Google Calendar"
          className="p-3.5 rounded-xl bg-amber-950/35 border border-amber-600/60 space-y-3"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-200">
                تأكيد تعديل مواعيد Google Calendar
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {pendingPushPlan.importedCount > 0 || pendingPushPlan.updatedLocallyCount > 0
                  ? `تم استيراد ${pendingPushPlan.importedCount} موعد وتحديث ${pendingPushPlan.updatedLocallyCount} في تطبيقنا. `
                  : ''}
                هل تؤكد تنفيذ التغييرات التالية على تقويم Google الخاص بك؟
              </p>
              <ul className="text-[11px] text-slate-200 space-y-1 pt-1 max-h-36 overflow-y-auto">
                {pendingPushPlan.plan.toCreateOnGoogle.map((b) => (
                  <li key={`c-${b.id}`} className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold">
                      إضافة
                    </span>
                    <span className="truncate font-semibold">{b.title}</span>
                    <span className="text-slate-400 font-mono text-[10px] shrink-0">
                      ({b.date} • {b.startTime}-{b.endTime})
                    </span>
                  </li>
                ))}
                {pendingPushPlan.plan.toUpdateOnGoogle.map(({ block: b }) => (
                  <li key={`u-${b.id}`} className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 text-[10px] font-bold">
                      تحديث
                    </span>
                    <span className="truncate font-semibold">{b.title}</span>
                    <span className="text-slate-400 font-mono text-[10px] shrink-0">
                      ({b.date} • {b.startTime}-{b.endTime})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isPushing}
              onClick={handleCancelPush}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={isPushing}
              onClick={handleConfirmPushToGoogle}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isPushing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>
                {isPushing
                  ? 'جارٍ التنفيذ...'
                  : `تأكيد المزامنة (${
                      pendingPushPlan.plan.toCreateOnGoogle.length +
                      pendingPushPlan.plan.toUpdateOnGoogle.length
                    })`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Feedback & Errors */}
      {syncError && (
        <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-200 flex items-start gap-2 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{syncError}</span>
        </div>
      )}

      {syncNotice && !syncError && (
        <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-700/50 text-emerald-200 flex items-start gap-2 text-[11px]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{syncNotice}</span>
        </div>
      )}
    </div>
  );
};
