import React from 'react';
import {
  AlertTriangle,
  Clock,
  X,
  CheckCircle2,
  Flame,
  AlarmClock,
  BellRing,
  Sun,
  Moon,
  BatteryCharging,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { SmartReminder } from '../utils/reminderEngine';
import { TomorrowEnergyAnalysis } from '../utils/burnoutEngine';
import { Task } from '../types';

interface SmartReminderToastsProps {
  toasts: SmartReminder[];
  onDismissToast: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onComplete: (reminder: SmartReminder) => void;
  onStartFocus: (task?: Task) => void;
  onReviewTomorrowSchedule?: () => void;
  onRebalanceWithTwin?: (analysis: TomorrowEnergyAnalysis) => void;
}

export const SmartReminderToasts: React.FC<SmartReminderToastsProps> = ({
  toasts,
  onDismissToast,
  onSnooze,
  onComplete,
  onStartFocus,
  onReviewTomorrowSchedule,
  onRebalanceWithTwin,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 left-5 z-40 flex flex-col gap-3 w-[calc(100vw-2.5rem)] max-w-sm pointer-events-none"
    >
      {toasts.slice(0, 3).map((toast) => {
        const isOverdue = toast.urgency === 'overdue';
        const isGentleAdhkar = toast.urgency === 'gentle' || toast.sourceType === 'adhkar';
        const isEnergyWarning =
          toast.urgency === 'energy_warning' || toast.sourceType === 'energy_overload';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-xl animate-fadeIn transition-all ${
              isEnergyWarning
                ? 'bg-gradient-to-br from-amber-950/95 via-slate-900/95 to-rose-950/90 border-amber-500/60 shadow-amber-900/30'
                : isGentleAdhkar
                ? 'bg-gradient-to-br from-emerald-950/95 via-slate-900/95 to-amber-950/90 border-amber-500/40 shadow-amber-900/20'
                : isOverdue
                ? 'bg-gradient-to-br from-rose-950/95 via-slate-900/95 to-slate-950/95 border-rose-700/80 shadow-rose-900/30'
                : 'bg-gradient-to-br from-amber-950/90 via-slate-900/95 to-slate-950/95 border-amber-700/70 shadow-amber-900/20'
            }`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isEnergyWarning
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50'
                      : isGentleAdhkar
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                      : isOverdue
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  {isEnergyWarning ? (
                    <BatteryCharging className="w-4 h-4 animate-pulse" />
                  ) : isGentleAdhkar ? (
                    toast.adhkarPeriod === 'evening' ? (
                      <Moon className="w-4 h-4 text-indigo-300" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-300" />
                    )
                  ) : isOverdue ? (
                    <AlertTriangle className="w-4 h-4 animate-pulse" />
                  ) : (
                    <BellRing className="w-4 h-4 animate-pulse" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isEnergyWarning
                          ? 'bg-rose-500/25 text-amber-200 border border-amber-400/40'
                          : isGentleAdhkar
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                          : isOverdue
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isEnergyWarning
                        ? 'تنبيه طاقة نهاية اليوم'
                        : isGentleAdhkar
                        ? 'تذكير أذكار لطيف'
                        : isOverdue
                        ? 'تذكير متأخر'
                        : 'موعد استحقاق قريب'}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {toast.timeLabel}
                    </span>
                  </div>

                  <h5 className="text-xs font-bold text-slate-100 mt-1.5 leading-snug">
                    {toast.title}
                  </h5>

                  {isEnergyWarning && toast.energyAnalysis && (
                    <p className="text-[11px] text-amber-100/80 mt-1 leading-relaxed">
                      {toast.energyAnalysis.overloadReasons[0] || toast.energyAnalysis.recommendation}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismissToast(toast.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-1.5">
                {isEnergyWarning ? (
                  <>
                    {onReviewTomorrowSchedule && (
                      <button
                        type="button"
                        onClick={() => {
                          onDismissToast(toast.id);
                          onReviewTomorrowSchedule();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>جدول الغد</span>
                      </button>
                    )}

                    {onRebalanceWithTwin && toast.energyAnalysis && (
                      <button
                        type="button"
                        onClick={() => {
                          onDismissToast(toast.id);
                          onRebalanceWithTwin(toast.energyAnalysis!);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>موازنة AI</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onComplete(toast)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isGentleAdhkar ? 'تمت الأذكار' : 'إكمال'}</span>
                    </button>

                    {toast.task && (
                      <button
                        type="button"
                        onClick={() => {
                          onDismissToast(toast.id);
                          onStartFocus(toast.task);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>تركيز</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => onSnooze(toast.id, 15)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                <AlarmClock className="w-3 h-3 text-cyan-400" />
                <span>تأجيل 15د</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
