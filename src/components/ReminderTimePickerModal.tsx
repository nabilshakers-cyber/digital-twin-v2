import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Clock, Repeat, Sparkles, X } from 'lucide-react';
import {
  cancelReminder,
  NOTIFICATION_DENIED_ALERT_MESSAGE,
  ReminderItemCategory,
  requestLocalNotificationPermissions,
  ScheduledLocalReminder,
  scheduleReminder,
} from '../utils/localNotifications';
import { useModalCloseListener, useModalScrollLock } from '../utils/modalCoordinator';

export interface ReminderPickerTarget {
  itemKey: string;
  title: string;
  notificationTitle: string;
  notificationBody: string;
  category: ReminderItemCategory;
  defaultTime?: string; // "HH:MM"
  defaultDate?: string; // "YYYY-MM-DD"
  defaultRepeatDaily?: boolean;
}

interface ReminderTimePickerModalProps {
  target: ReminderPickerTarget | null;
  existingReminder?: ScheduledLocalReminder;
  onClose: () => void;
  onScheduled?: (reminder: ScheduledLocalReminder) => void;
  onCancelled?: (itemKey: string) => void;
  /** Set false when rendered nested inside another open modal (e.g. AdhkarInteractiveModal) */
  listenGlobalClose?: boolean;
}

const getTodayDateString = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDefaultFutureTime = (): string => {
  const future = new Date(Date.now() + 30 * 60 * 1000);
  const hh = String(future.getHours()).padStart(2, '0');
  const mm = String(future.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const QUICK_PRESETS = [
  { label: 'بعد 15 د', offsetMinutes: 15 },
  { label: 'بعد ساعة', offsetMinutes: 60 },
  { label: '05:30 ص', time: '05:30' },
  { label: '09:00 ص', time: '09:00' },
  { label: '05:00 م', time: '17:00' },
  { label: '09:00 م', time: '21:00' },
];

export const ReminderTimePickerModal: React.FC<ReminderTimePickerModalProps> = ({
  target,
  existingReminder,
  onClose,
  onScheduled,
  onCancelled,
  listenGlobalClose = true,
}) => {
  const [timeValue, setTimeValue] = useState<string>('09:00');
  const [dateValue, setDateValue] = useState<string>(getTodayDateString());
  const [repeatDaily, setRepeatDaily] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useModalCloseListener(
    listenGlobalClose ? 'reminder-time-picker' : 'reminder-time-picker-nested',
    () => {
      if (listenGlobalClose) onClose();
    }
  );
  useModalScrollLock(
    listenGlobalClose ? 'reminder-time-picker' : 'reminder-time-picker-nested',
    Boolean(target)
  );

  useEffect(() => {
    if (!target) return;
    setErrorMsg(null);
    if (existingReminder) {
      setTimeValue(existingReminder.timeHHMM);
      setDateValue(existingReminder.dateISO || getTodayDateString());
      setRepeatDaily(existingReminder.repeatDaily);
    } else {
      setTimeValue(target.defaultTime || getDefaultFutureTime());
      setDateValue(target.defaultDate || getTodayDateString());
      setRepeatDaily(Boolean(target.defaultRepeatDaily));
    }
  }, [target, existingReminder]);

  if (!target) return null;

  const categoryLabel =
    target.category === 'quran'
      ? '📖 ورد القرآن'
      : target.category === 'adhkar'
      ? '🤲 الأذكار اليومية'
      : '✅ مهمة';

  const applyPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    if (preset.offsetMinutes) {
      const future = new Date(Date.now() + preset.offsetMinutes * 60_000);
      setDateValue(
        `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(
          future.getDate()
        ).padStart(2, '0')}`
      );
      setTimeValue(
        `${String(future.getHours()).padStart(2, '0')}:${String(
          future.getMinutes()
        ).padStart(2, '0')}`
      );
    } else if (preset.time) {
      setTimeValue(preset.time);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeValue || !/^\d{2}:\d{2}$/.test(timeValue)) {
      setErrorMsg('يرجى اختيار وقت صحيح للتذكير.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const [hours, minutes] = timeValue.split(':').map(Number);
      const [y, m, d] = (dateValue || getTodayDateString()).split('-').map(Number);
      const targetDate = new Date(y, m - 1, d, hours, minutes, 0, 0);

      // If selected time today already passed, automatically advance to tomorrow
      if (targetDate.getTime() <= Date.now()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      const perm = await requestLocalNotificationPermissions();
      const scheduled = await scheduleReminder(
        target.notificationTitle,
        target.notificationBody,
        targetDate,
        {
          itemKey: target.itemKey,
          repeatDaily,
          category: target.category,
        }
      );

      onScheduled?.(scheduled);
      if (perm === 'denied') {
        setErrorMsg(NOTIFICATION_DENIED_ALERT_MESSAGE);
        return;
      }
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : NOTIFICATION_DENIED_ALERT_MESSAGE;
      setErrorMsg(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelExisting = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await cancelReminder(existingReminder ? existingReminder.id : target.itemKey);
      onCancelled?.(target.itemKey);
      onClose();
    } catch {
      setErrorMsg('تعذر إلغاء التذكير.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="app-modal-overlay bg-slate-950/80 backdrop-blur-sm animate-fadeIn z-[70]"
      onClick={onClose}
    >
      <div
        className="app-modal-panel max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-modal-header px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white truncate">ضبط منبّه التذكير</h4>
              <span className="text-[11px] text-cyan-300">{categoryLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="app-modal-close p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSchedule} className="app-modal-body p-4 space-y-4">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-xs font-bold text-slate-100 line-clamp-2">{target.title}</div>
            {existingReminder && (
              <div className="text-[11px] text-emerald-300 flex items-center gap-1.5 pt-1">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  مجدول حالياً الساعة {existingReminder.timeHHMM}
                  {existingReminder.repeatDaily ? ' (يتكرر يومياً)' : ` (${existingReminder.dateISO})`}
                </span>
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400">أوقات سريعة:</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950/80 border border-slate-700 hover:border-cyan-500/50 text-[11px] text-slate-200 cursor-pointer transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time & Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>اختر الوقت *</span>
              </label>
              <input
                type="time"
                required
                dir="ltr"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {!repeatDaily && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">التاريخ</label>
                <input
                  type="date"
                  dir="ltr"
                  min={getTodayDateString()}
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          {/* Daily Repeat Toggle */}
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <Repeat className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-semibold">تكرار التذكير يومياً</div>
                <div className="text-[11px] text-slate-400">
                  ينبهك تلقائياً كل يوم في نفس الموعد حتى في الخلفية
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={repeatDaily}
              onChange={(e) => setRepeatDaily(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
            />
          </label>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            {existingReminder ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCancelExisting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/70 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <BellOff className="w-3.5 h-3.5" />
                <span>إلغاء التذكير</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إغلاق
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{existingReminder ? 'تحديث التذكير' : 'جدولة التذكير'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
