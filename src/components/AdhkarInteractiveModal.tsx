import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Moon,
  RotateCcw,
  Sparkles,
  SquareStack,
  Sun,
  X,
  CheckCheck,
} from 'lucide-react';
import { DhikrItem, EVENING_ADHKAR, MORNING_ADHKAR } from '../data/adhkarData';
import { getTodayIso } from '../utils/reminderEngine';
import { soundEngine } from '../utils/audioSynth';
import { useModalScrollLock } from '../utils/modalCoordinator';
import { useScheduledReminders } from '../utils/localNotifications';
import { ReminderPickerTarget, ReminderTimePickerModal } from './ReminderTimePickerModal';

const ADHKAR_COUNTS_STORAGE_KEY = 'digital_twin_adhkar_counts_v1';

interface StoredAdhkarCounts {
  date: string;
  morning: Record<string, number>;
  evening: Record<string, number>;
}

const loadStoredCounts = (): StoredAdhkarCounts => {
  const today = getTodayIso(new Date());
  try {
    const raw = localStorage.getItem(ADHKAR_COUNTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAdhkarCounts;
      if (parsed.date === today) {
        return {
          date: today,
          morning: parsed.morning || {},
          evening: parsed.evening || {},
        };
      }
    }
  } catch {
    // ignore storage read errors
  }
  return { date: today, morning: {}, evening: {} };
};

interface AdhkarInteractiveModalProps {
  isOpen: boolean;
  period: 'morning' | 'evening' | null;
  isPeriodCompleted: boolean;
  onClose: () => void;
  onCompletePeriod: (period: 'morning' | 'evening') => void;
}

export const AdhkarInteractiveModal: React.FC<AdhkarInteractiveModalProps> = ({
  isOpen,
  period,
  isPeriodCompleted,
  onClose,
  onCompletePeriod,
}) => {
  const [countsState, setCountsState] = useState<StoredAdhkarCounts>(() =>
    loadStoredCounts()
  );
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');
  const [showOnlyRemaining, setShowOnlyRemaining] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<ReminderPickerTarget | null>(null);
  const scheduledReminders = useScheduledReminders();

  useEffect(() => {
    try {
      localStorage.setItem(
        ADHKAR_COUNTS_STORAGE_KEY,
        JSON.stringify(countsState)
      );
    } catch {
      // ignore storage write errors
    }
  }, [countsState]);

  // Jump to first incomplete dhikr whenever modal opens or period switches (and reset if day changed)
  useEffect(() => {
    if (!isOpen || !period) return;
    const today = getTodayIso(new Date());
    let activeCounts = countsState[period] || {};
    if (countsState.date !== today) {
      setCountsState({ date: today, morning: {}, evening: {} });
      activeCounts = {};
    }
    const list = period === 'morning' ? MORNING_ADHKAR : EVENING_ADHKAR;
    const firstRemainingIdx = list.findIndex(
      (item) => (activeCounts[item.id] || 0) < item.repeat
    );
    setCurrentIndex(firstRemainingIdx >= 0 ? firstRemainingIdx : 0);
  }, [isOpen, period]);

  useModalScrollLock('adhkar-modal', Boolean(isOpen && period));

  if (!isOpen || !period) return null;

  const list: DhikrItem[] =
    period === 'morning' ? MORNING_ADHKAR : EVENING_ADHKAR;
  const currentCounts = countsState[period] || {};

  const completedItemsCount = list.filter(
    (item) => (currentCounts[item.id] || 0) >= item.repeat
  ).length;
  const totalItemsCount = list.length;
  const overallPercentage =
    totalItemsCount > 0
      ? Math.round((completedItemsCount / totalItemsCount) * 100)
      : 0;
  const allDone = completedItemsCount === totalItemsCount;

  const visibleList = showOnlyRemaining
    ? list.filter((item) => (currentCounts[item.id] || 0) < item.repeat)
    : list;

  const safeIndex = Math.min(Math.max(0, currentIndex), list.length - 1);
  const activeItem = list[safeIndex];
  const activeDoneCount = activeItem ? currentCounts[activeItem.id] || 0 : 0;
  const activeRemaining = activeItem
    ? Math.max(0, activeItem.repeat - activeDoneCount)
    : 0;
  const activeIsDone = activeRemaining === 0;
  const activeProgressRatio = activeItem
    ? Math.min(1, activeDoneCount / activeItem.repeat)
    : 0;

  const textSizeClass =
    fontScale === 'sm'
      ? 'text-base sm:text-lg leading-loose'
      : fontScale === 'lg'
      ? 'text-xl sm:text-2xl leading-[2.2]'
      : 'text-lg sm:text-xl leading-[2]';

  const handleAdvanceDhikr = (item: DhikrItem, step = 1, autoAdvance = false) => {
    const prevCount = currentCounts[item.id] || 0;
    if (prevCount >= item.repeat) return;

    const nextCount = Math.min(item.repeat, prevCount + step);
    const updatedPeriodCounts: Record<string, number> = {
      ...currentCounts,
      [item.id]: nextCount,
    };

    setCountsState((prev) => ({
      ...prev,
      date: getTodayIso(new Date()),
      [period]: updatedPeriodCounts,
    }));

    const justFinishedThisItem = nextCount >= item.repeat;
    const allFinishedNow = list.every(
      (d) => (updatedPeriodCounts[d.id] || 0) >= d.repeat
    );

    if (allFinishedNow) {
      soundEngine.playChime(true);
      if (!isPeriodCompleted) {
        onCompletePeriod(period);
      }
    } else if (justFinishedThisItem) {
      soundEngine.playChime(true);
      if (autoAdvance) {
        const nextRemainingAfter = list.findIndex(
          (d, idx) => idx > safeIndex && (updatedPeriodCounts[d.id] || 0) < d.repeat
        );
        const firstRemaining = list.findIndex(
          (d) => (updatedPeriodCounts[d.id] || 0) < d.repeat
        );
        const targetIdx =
          nextRemainingAfter >= 0 ? nextRemainingAfter : firstRemaining;
        if (targetIdx >= 0) {
          setTimeout(() => {
            setCurrentIndex(targetIdx);
          }, 260);
        }
      }
    }
  };

  const handleResetPeriodCounts = () => {
    setCountsState((prev) => ({
      ...prev,
      date: getTodayIso(new Date()),
      [period]: {},
    }));
    setCurrentIndex(0);
  };

  const handleCompleteAllNow = () => {
    const filled: Record<string, number> = {};
    for (const item of list) {
      filled[item.id] = item.repeat;
    }
    setCountsState((prev) => ({
      ...prev,
      date: getTodayIso(new Date()),
      [period]: filled,
    }));
    soundEngine.playChime(true);
    if (!isPeriodCompleted) {
      onCompletePeriod(period);
    }
  };

  const cycleFontScale = () => {
    setFontScale((prev) =>
      prev === 'sm' ? 'md' : prev === 'md' ? 'lg' : 'sm'
    );
  };

  const isMorning = period === 'morning';
  const circleRadius = 38;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleStrokeOffset =
    circleCircumference * (1 - activeProgressRatio);

  return (
    <div
      className="app-modal-overlay bg-slate-950/85 backdrop-blur-md sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="app-modal-panel max-w-3xl bg-slate-900 border border-amber-500/35 rounded-3xl shadow-2xl shadow-amber-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Sticky Header with Always-Visible Close (X) */}
        <div className="app-modal-header p-3.5 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
                  allDone || isPeriodCompleted
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-500 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/25'
                    : isMorning
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                }`}
              >
                {isMorning ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0">
                <h3 className="text-sm sm:text-lg font-bold text-amber-200 flex flex-wrap items-center gap-1.5 truncate">
                  <span>{isMorning ? 'أذكار الصباح' : 'أذكار المساء'}</span>
                  <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    نظام أذكاري التفاعلي
                  </span>
                  {(allDone || isPeriodCompleted) && (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/50 text-amber-200">
                      مكتملة ✨
                    </span>
                  )}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  مرتبة بالتسلسل الصحيح — اضغط على الذكر أو عدّاد التسبيح للعدّ التنازلي التلقائي
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(() => {
                const periodKey = `adhkar:${period}`;
                const periodReminder = scheduledReminders[periodKey];
                return (
                  <button
                    type="button"
                    onClick={() =>
                      setReminderTarget({
                        itemKey: periodKey,
                        title: isMorning ? 'أذكار الصباح' : 'أذكار المساء',
                        notificationTitle: isMorning
                          ? '☀️ تذكير أذكار الصباح'
                          : '🌙 تذكير أذكار المساء',
                        notificationBody: isMorning
                          ? 'حان موعد أذكار الصباح المباركة.'
                          : 'حان موعد أذكار المساء والسكينة.',
                        category: 'adhkar',
                        defaultTime: isMorning ? '06:00' : '17:30',
                        defaultRepeatDaily: true,
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                      periodReminder
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                    title="ضبط منبه لهذه الأذكار"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span className="font-mono">
                      {periodReminder ? periodReminder.timeHHMM : 'منبه'}
                    </span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="app-modal-close p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="app-modal-body p-4 sm:p-6 space-y-4">
          {/* Progress Bar + View Mode & Font Controls */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">
                  تقدم الورد:{' '}
                  <span className="text-amber-300 font-mono font-bold">
                    {completedItemsCount}/{totalItemsCount}
                  </span>{' '}
                  ذكر
                </span>
                <span className="text-amber-300 font-mono font-bold">
                  {overallPercentage}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {/* Toggle Card Mode vs Full List */}
              <div className="inline-flex rounded-xl bg-slate-800 border border-slate-700 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'card'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <SquareStack className="w-3.5 h-3.5" />
                  <span>بطاقة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>القائمة</span>
                </button>
              </div>

              <button
                type="button"
                onClick={cycleFontScale}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                title="تغيير حجم الخط"
              >
                أ{fontScale === 'lg' ? '++' : fontScale === 'md' ? '+' : ''}
              </button>

              {viewMode === 'list' && (
                <button
                  type="button"
                  onClick={() => setShowOnlyRemaining((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    showOnlyRemaining
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {showOnlyRemaining ? 'الكل' : 'المتبقي'}
                </button>
              )}

              {completedItemsCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetPeriodCounts}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-all cursor-pointer"
                  title="إعادة ضبط العدادات"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة</span>
                </button>
              )}

              {!allDone && (
                <button
                  type="button"
                  onClick={handleCompleteAllNow}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>إتمام الكل</span>
                </button>
              )}
            </div>
          </div>
          {allDone && (
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-emerald-500/15 border border-amber-400/50 text-amber-100 flex items-center justify-between gap-3 shadow-lg shadow-amber-500/10">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-200">
                    تقبّل الله منك! أتممت{' '}
                    {isMorning ? 'أذكار الصباح' : 'أذكار المساء'} كاملة.
                  </p>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    تم حفظ إنجازك وتحديث بطاقة أذكار اليوم باللون الذهبي.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shrink-0 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          )}

          {viewMode === 'card' && activeItem ? (
            /* Single Card Mode (Athkari Experience) */
            <div className="flex flex-col justify-between gap-5">
              {/* Step Dots Strip */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {list.map((d, idx) => {
                  const done = (currentCounts[d.id] || 0) >= d.repeat;
                  const isCurrent = idx === safeIndex;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      title={d.title}
                      className={`h-2 rounded-full transition-all shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'w-7 bg-amber-400'
                          : done
                          ? 'w-3 bg-emerald-400/80'
                          : 'w-2 bg-slate-700 hover:bg-slate-600'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Active Dhikr Card */}
              <div
                onClick={() => handleAdvanceDhikr(activeItem, 1, true)}
                className={`rounded-3xl border p-5 sm:p-7 transition-all duration-300 select-none min-h-[270px] flex flex-col justify-between ${
                  activeIsDone
                    ? 'bg-gradient-to-br from-amber-500/20 via-yellow-500/5 to-slate-900 border-amber-400/70 shadow-xl shadow-amber-500/10'
                    : 'bg-slate-800/50 border-slate-700/80 hover:border-amber-500/50 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-amber-300">
                      {safeIndex + 1} / {totalItemsCount}
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-amber-200">
                      {activeItem.title}
                    </h4>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-xl border font-semibold ${
                      activeIsDone
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    التكرار: {activeItem.repeat}{' '}
                    {activeItem.repeat === 1
                      ? 'مرة'
                      : activeItem.repeat <= 10
                      ? 'مرات'
                      : 'مرة'}
                  </span>
                </div>

                {/* Main Arabic Dhikr Text */}
                <p
                  className={`${textSizeClass} font-medium text-center py-3 ${
                    activeIsDone ? 'text-amber-100/85' : 'text-slate-100'
                  }`}
                >
                  {activeItem.text}
                </p>

                {/* Virtue Banner */}
                <div className="mt-4 pt-3 border-t border-slate-700/50 text-center">
                  <p className="text-xs text-slate-400">
                    <span className="text-amber-400 font-semibold">الفضل:</span>{' '}
                    {activeItem.virtue}
                  </p>
                </div>
              </div>

              {/* Bottom Interactive Tasbih Ring + Prev / Next Controls */}
              <div
                className="flex items-center justify-between gap-3 pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  disabled={safeIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابق</span>
                </button>

                {/* Circular Countdown Button (Athkari Touch Counter) */}
                <div className="flex items-center gap-2.5">
                  {!activeIsDone && activeItem.repeat >= 10 && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceDhikr(activeItem, 10, true)}
                      className="px-3 py-2 rounded-2xl bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400/50 text-amber-300 text-xs font-mono font-bold transition-all cursor-pointer"
                      title="إنقاص 10 دفعة واحدة"
                    >
                      10-
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAdvanceDhikr(activeItem, 1, true)}
                    disabled={activeIsDone}
                    className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all select-none ${
                      activeIsDone
                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 shadow-xl shadow-amber-500/30 cursor-default'
                        : 'bg-slate-800 hover:bg-slate-700 active:scale-95 text-white shadow-xl shadow-emerald-950/60 cursor-pointer'
                    }`}
                  >
                    <svg
                      className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                      viewBox="0 0 96 96"
                    >
                      <circle
                        cx="48"
                        cy="48"
                        r={circleRadius}
                        stroke="currentColor"
                        strokeWidth="5"
                        fill="transparent"
                        className={activeIsDone ? 'text-amber-200/40' : 'text-slate-700'}
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r={circleRadius}
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeLinecap="round"
                        fill="transparent"
                        strokeDasharray={circleCircumference}
                        strokeDashoffset={circleStrokeOffset}
                        className={`transition-all duration-300 ${
                          activeIsDone ? 'text-slate-950' : 'text-amber-400'
                        }`}
                      />
                    </svg>

                    {activeIsDone ? (
                      <>
                        <CheckCircle2 className="w-7 h-7 text-slate-950" />
                        <span className="text-[11px] font-bold mt-0.5">تم</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-mono font-black text-amber-300 leading-none">
                          {activeRemaining}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">
                          اضغط للعدّ
                        </span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={safeIndex >= list.length - 1}
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(list.length - 1, i + 1))
                  }
                  className="flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Full List Mode */
            <div className="space-y-3.5">
              {visibleList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  جميع الأذكار مكتملة بحمد الله!
                </div>
              ) : (
                visibleList.map((item, idx) => {
                  const count = currentCounts[item.id] || 0;
                  const remaining = Math.max(0, item.repeat - count);
                  const isDone = remaining === 0;
                  const itemPercent = Math.round((count / item.repeat) * 100);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleAdvanceDhikr(item, 1, false)}
                      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-300 select-none ${
                        isDone
                          ? 'bg-gradient-to-br from-amber-500/15 via-yellow-500/5 to-slate-900 border-amber-400/60 shadow-md shadow-amber-500/10'
                          : 'bg-slate-800/55 border-slate-700/80 hover:border-amber-500/50 hover:bg-slate-800/80 cursor-pointer active:scale-[0.995]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400">
                            #{idx + 1}
                          </span>
                          <h4
                            className={`text-sm font-bold ${
                              isDone ? 'text-amber-300' : 'text-emerald-300'
                            }`}
                          >
                            {item.title}
                          </h4>
                        </div>

                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(() => {
                            const dhikrKey = `adhkar:${period}:${item.id}`;
                            const dhikrReminder = scheduledReminders[dhikrKey];
                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  setReminderTarget({
                                    itemKey: dhikrKey,
                                    title: item.title,
                                    notificationTitle: `🤲 تذكير ذِكر: ${item.title}`,
                                    notificationBody: item.text.slice(0, 120),
                                    category: 'adhkar',
                                    defaultTime: isMorning ? '06:00' : '17:30',
                                    defaultRepeatDaily: true,
                                  })
                                }
                                title="ضبط منبه لهذا الذكر"
                                className={`px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                                  dhikrReminder
                                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-cyan-300'
                                }`}
                              >
                                <Bell className="w-3.5 h-3.5" />
                                {dhikrReminder && (
                                  <span className="font-mono text-[11px]">{dhikrReminder.timeHHMM}</span>
                                )}
                              </button>
                            );
                          })()}

                          {!isDone && item.repeat >= 10 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleAdvanceDhikr(item, 10, false)
                              }
                              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400/50 text-amber-300 text-xs font-mono font-bold transition-colors cursor-pointer"
                              title="إنقاص 10 دفعة واحدة"
                            >
                              10-
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAdvanceDhikr(item, 1, false)}
                            disabled={isDone}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                              isDone
                                ? 'bg-amber-400/20 border-amber-400/60 text-amber-200 cursor-default'
                                : 'bg-emerald-600/25 hover:bg-emerald-500/35 border-emerald-500/50 text-emerald-200 cursor-pointer'
                            }`}
                          >
                            {isDone ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                                <span>تم ({item.repeat})</span>
                              </>
                            ) : (
                              <>
                                <span>متبقي</span>
                                <span className="font-mono text-amber-300">
                                  {remaining}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  / {item.repeat}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <p
                        className={`${textSizeClass} font-medium ${
                          isDone ? 'text-amber-100/80' : 'text-slate-100'
                        }`}
                      >
                        {item.text}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-700/50">
                        <p className="text-xs text-slate-400">
                          <span className="text-amber-400/90 font-semibold">
                            الفضل:
                          </span>{' '}
                          {item.virtue}
                        </p>
                      </div>

                      {item.repeat > 1 && (
                        <div className="mt-2.5 w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isDone
                                ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                                : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                            }`}
                            style={{ width: `${itemPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <ReminderTimePickerModal
        target={reminderTarget}
        existingReminder={
          reminderTarget ? scheduledReminders[reminderTarget.itemKey] : undefined
        }
        onClose={() => setReminderTarget(null)}
        listenGlobalClose={false}
      />
    </div>
  );
};
