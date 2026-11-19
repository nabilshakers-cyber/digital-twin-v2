import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flame,
  AlarmClock,
  X,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  ShieldCheck,
  Moon,
  BatteryCharging,
  Calendar,
} from 'lucide-react';
import { SmartReminder } from '../utils/reminderEngine';
import { TomorrowEnergyAnalysis } from '../utils/burnoutEngine';
import { Task } from '../types';

interface NotificationCenterProps {
  reminders: SmartReminder[];
  pushPermission: NotificationPermission | 'unsupported';
  pushEnabled: boolean;
  soundEnabled: boolean;
  onEnablePush: () => Promise<void>;
  onTogglePushEnabled: () => void;
  onToggleSound: () => void;
  onTestAlert: () => void;
  onCompleteReminder: (reminder: SmartReminder) => void;
  onSnoozeReminder: (reminderId: string, minutes: number) => void;
  onDismissReminder: (reminderId: string) => void;
  onStartFocus: (task?: Task) => void;
  isDndActive: boolean;
  autoDndEnabled: boolean;
  manualDnd: boolean;
  onToggleAutoDnd: () => void;
  onToggleManualDnd: () => void;
  onReviewTomorrowSchedule?: () => void;
  onRebalanceWithTwin?: (analysis: TomorrowEnergyAnalysis) => void;
  onCheckTomorrowEnergy?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  reminders,
  pushPermission,
  pushEnabled,
  soundEnabled,
  onEnablePush,
  onTogglePushEnabled,
  onToggleSound,
  onTestAlert,
  onCompleteReminder,
  onSnoozeReminder,
  onDismissReminder,
  onStartFocus,
  isDndActive,
  autoDndEnabled,
  manualDnd,
  onToggleAutoDnd,
  onToggleManualDnd,
  onReviewTomorrowSchedule,
  onRebalanceWithTwin,
  onCheckTomorrowEnergy,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const overdueCount = reminders.filter((r) => r.urgency === 'overdue').length;
  const dueSoonCount = reminders.filter((r) => r.urgency === 'due_soon').length;
  const totalCount = reminders.length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Trigger Button */}
      <button
        id="btn-notifications-center"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
          isDndActive
            ? 'bg-indigo-950/70 hover:bg-indigo-900/70 text-indigo-300 border-indigo-700/70'
            : overdueCount > 0
            ? 'bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border-rose-700/70 shadow-md shadow-rose-500/10'
            : totalCount > 0
            ? 'bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border-amber-700/60'
            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/80'
        }`}
        title={
          isDndActive
            ? 'وضع عدم الإزعاج مفعل — التنبيهات مخفية'
            : 'مركز التنبيهات والتذكيرات الذكية'
        }
        aria-label="مركز التنبيهات والتذكيرات الذكية"
      >
        {isDndActive ? (
          <BellOff className="w-4 h-4" />
        ) : overdueCount > 0 ? (
          <BellRing className="w-4 h-4 animate-bounce" />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {!isDndActive && totalCount > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center shadow ${
              overdueCount > 0
                ? 'bg-rose-500 text-white'
                : 'bg-amber-400 text-slate-950'
            }`}
          >
            {totalCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 mt-2.5 w-[340px] sm:w-[390px] max-w-[calc(100vw-1.5rem)] max-h-[85vh] flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="shrink-0 sticky top-0 z-20 p-3.5 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-100">
                التنبيهات والتذكيرات الذكية
              </h4>
              {totalCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                  {overdueCount > 0 && `${overdueCount} متأخر`}
                  {overdueCount > 0 && dueSoonCount > 0 && ' • '}
                  {dueSoonCount > 0 && `${dueSoonCount} قريب`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleSound}
                className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                  soundEnabled
                    ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title={soundEnabled ? 'إيقاف صوت التنبيه' : 'تفعيل صوت التنبيه'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Push Notifications Status Bar */}
          <div className="px-3.5 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              {pushPermission === 'granted' && pushEnabled ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              ) : (
                <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="text-slate-300 truncate">
                {pushPermission === 'unsupported'
                  ? 'التنبيهات المرئية الذكية مفعلة'
                  : pushPermission === 'denied'
                  ? 'إشعارات المتصفح محظورة (التنبيهات المرئية نشطة)'
                  : pushPermission === 'granted'
                  ? pushEnabled
                    ? 'إشعارات الدفع (Push) مفعلة'
                    : 'إشعارات الدفع متوقفة مؤقتاً'
                  : 'إشعارات المتصفح غير مفعلة بعد'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {pushPermission === 'default' && (
                <button
                  type="button"
                  onClick={onEnablePush}
                  className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors cursor-pointer"
                >
                  تفعيل الدفع
                </button>
              )}

              {pushPermission === 'granted' && (
                <button
                  type="button"
                  onClick={onTogglePushEnabled}
                  className={`px-2 py-1 rounded-lg border font-medium cursor-pointer ${
                    pushEnabled
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {pushEnabled ? 'مفعل' : 'متوقف'}
                </button>
              )}

              {onCheckTomorrowEnergy && (
                <button
                  type="button"
                  onClick={onCheckTomorrowEnergy}
                  className="px-2 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/70 text-amber-300 border border-amber-700/70 flex items-center gap-1 cursor-pointer"
                  title="تحليل مهام الغد مقارنة بمستوى طاقتك الآن"
                >
                  <BatteryCharging className="w-3 h-3" />
                  <span>طاقة الغد</span>
                </button>
              )}

              <button
                type="button"
                onClick={onTestAlert}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
                title="إرسال تنبيه تجريبي الآن"
              >
                <Send className="w-3 h-3" />
                <span>تجربة</span>
              </button>
            </div>
          </div>

          {/* Auto-Focus DND & Manual DND Controls */}
          <div className="px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <Moon className={`w-3.5 h-3.5 shrink-0 ${isDndActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span className="text-slate-300 truncate">وضع التركيز التلقائي (عدم الإزعاج)</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onToggleAutoDnd}
                className={`px-2 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
                  autoDndEnabled
                    ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="تفعيل عدم الإزعاج تلقائياً عند بدء جلسة التركيز"
              >
                {autoDndEnabled ? 'تلقائي: مفعل' : 'تلقائي: معطل'}
              </button>

              <button
                type="button"
                onClick={onToggleManualDnd}
                className={`px-2 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
                  manualDnd
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="تفعيل أو إيقاف عدم الإزعاج يدوياً"
              >
                {manualDnd ? 'عدم إزعاج: نشط' : 'كتم الآن'}
              </button>
            </div>
          </div>

          {/* Reminders Feed */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2.5">
            {isDndActive ? (
              <div className="py-8 text-center space-y-2.5 bg-indigo-950/20 rounded-xl border border-indigo-800/40 p-4">
                <ShieldCheck className="w-8 h-8 text-indigo-400 mx-auto" />
                <p className="text-xs font-bold text-indigo-200">
                  وضع عدم الإزعاج مفعل حالياً
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تم إخفاء جميع التنبيهات وإشعارات المتصفح لحماية تركيزك العميق. ستعود التذكيرات فور انتهاء الجلسة.
                </p>
              </div>
            ) : reminders.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Sparkles className="w-7 h-7 text-emerald-400 mx-auto opacity-80" />
                <p className="text-xs font-bold text-slate-200">
                  كل شيء تحت السيطرة تماماً!
                </p>
                <p className="text-[11px] text-slate-400">
                  لا توجد مهام متأخرة أو مواعيد عاجلة مقتربة حالياً.
                </p>
              </div>
            ) : (
              reminders.map((rem) => {
                const isOverdue = rem.urgency === 'overdue';
                const isGentle = rem.urgency === 'gentle' || rem.sourceType === 'adhkar';
                const isEnergyWarning =
                  rem.urgency === 'energy_warning' || rem.sourceType === 'energy_overload';
                return (
                  <div
                    key={rem.id}
                    className={`rounded-xl border p-3 space-y-2.5 transition-all ${
                      isEnergyWarning
                        ? 'bg-amber-950/30 border-amber-500/60'
                        : isGentle
                        ? 'bg-emerald-950/25 border-amber-500/40'
                        : isOverdue
                        ? 'bg-rose-950/25 border-rose-800/60'
                        : 'bg-amber-950/20 border-amber-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {isEnergyWarning ? (
                          <BatteryCharging className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : isGentle ? (
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : isOverdue ? (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-100 leading-snug">
                            {rem.title}
                          </h5>
                          {isEnergyWarning && rem.energyAnalysis && (
                            <p className="text-[10px] text-amber-200/80 mt-1 leading-relaxed">
                              {rem.energyAnalysis.overloadReasons[0] || rem.energyAnalysis.recommendation}
                            </p>
                          )}
                          <span
                            className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isEnergyWarning
                                ? 'bg-amber-950 text-amber-300 border border-amber-700/70'
                                : isGentle
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/70'
                                : isOverdue
                                ? 'bg-rose-950 text-rose-300 border border-rose-800/70'
                                : 'bg-amber-950 text-amber-300 border border-amber-800/70'
                            }`}
                          >
                            {rem.timeLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDismissReminder(rem.id)}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 shrink-0 cursor-pointer"
                        title="إغلاق التذكير"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800/60 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {isEnergyWarning ? (
                          <>
                            {onReviewTomorrowSchedule && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  onReviewTomorrowSchedule();
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-semibold transition-colors cursor-pointer"
                              >
                                <Calendar className="w-3 h-3" />
                                <span>جدول الغد</span>
                              </button>
                            )}
                            {onRebalanceWithTwin && rem.energyAnalysis && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  onRebalanceWithTwin(rem.energyAnalysis!);
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/70 font-medium cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>موازنة AI</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onCompleteReminder(rem)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/70 font-medium cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isGentle ? 'تمت الأذكار' : 'إكمال'}</span>
                            </button>

                            {rem.task && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  onStartFocus(rem.task);
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 font-semibold transition-colors cursor-pointer"
                              >
                                <Flame className="w-3 h-3" />
                                <span>تركيز الآن</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSnoozeReminder(rem.id, 15)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                        title="تأجيل التذكير 15 دقيقة"
                      >
                        <AlarmClock className="w-3 h-3 text-cyan-400" />
                        <span>تأجيل 15د</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
