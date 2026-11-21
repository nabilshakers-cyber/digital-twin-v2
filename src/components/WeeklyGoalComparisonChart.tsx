import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Target,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  CalendarRange,
} from 'lucide-react';
import { DigitalTwinProfile, Task } from '../types';
import { toLocalIsoDate } from '../utils/calendarUtils';

interface WeeklyGoalComparisonChartProps {
  tasks: Task[];
  profile: DigitalTwinProfile;
  onOpenProfile?: () => void;
}

const ARABIC_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const BASELINE_BY_DAY_INDEX: Record<
  number,
  { completed: number; planned: number; focusHours: number }
> = {
  0: { completed: 5, planned: 6, focusHours: 5.5 },
  1: { completed: 6, planned: 7, focusHours: 6.5 },
  2: { completed: 4, planned: 6, focusHours: 4.5 },
  3: { completed: 7, planned: 8, focusHours: 7.2 },
  4: { completed: 6, planned: 7, focusHours: 6.0 },
  5: { completed: 3, planned: 4, focusHours: 3.5 },
  6: { completed: 5, planned: 6, focusHours: 5.0 },
};

// Progressive weekly history baseline when earlier weeks have no recorded tasks yet
const PREVIOUS_WEEKS_BASELINE: Record<
  number,
  { completed: number; planned: number; focusHours: number }
> = {
  4: { completed: 12, planned: 19, focusHours: 14.5 }, // 63%
  3: { completed: 15, planned: 22, focusHours: 17.0 }, // 68%
  2: { completed: 17, planned: 23, focusHours: 19.5 }, // 74%
  1: { completed: 19, planned: 24, focusHours: 22.0 }, // 79%
};

const WEEK_LABELS: Record<number, string> = {
  4: 'قبل 4 أسابيع',
  3: 'قبل 3 أسابيع',
  2: 'قبل أسبوعين',
  1: 'الأسبوع الماضي',
  0: 'الأسبوع الحالي',
};

const formatRangeShort = (start: Date, end: Date): string => {
  const fmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    day: 'numeric',
    month: 'short',
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
};

export const WeeklyGoalComparisonChart: React.FC<
  WeeklyGoalComparisonChartProps
> = ({ tasks, profile, onOpenProfile }) => {
  const [viewMode, setViewMode] = useState<'weeks' | 'days'>('weeks');
  const [metricMode, setMetricMode] = useState<'rate' | 'hours'>('rate');

  const targetRate = Math.max(
    10,
    Math.min(100, profile.weeklyCompletionGoalRate ?? 85)
  );
  const dailyHoursTarget = Math.max(1, profile.dailyWorkHoursTarget || 7);
  const weeklyHoursTarget = dailyHoursTarget * 5;

  // 1. Multi-week comparison dataset (Current Week vs 4 Previous Weeks)
  const multiWeekComparisonData = useMemo(() => {
    const today = new Date();
    const rawWeeks: Array<{
      weekOffset: number;
      label: string;
      dateRange: string;
      completionRate: number;
      completedTasks: number;
      plannedTasks: number;
      focusHours: number;
      isCurrentWeek: boolean;
      isEstimatedBaseline: boolean;
      targetRate: number;
      weeklyHoursTarget: number;
    }> = [];

    for (let weekOffset = 4; weekOffset >= 0; weekOffset--) {
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - weekOffset * 7);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);

      const startIso = toLocalIsoDate(startDate);
      const endIso = toLocalIsoDate(endDate);
      const isCurrentWeek = weekOffset === 0;

      const tasksInWeek = tasks.filter((t) => {
        const due = t.dueDate || '';
        const completedDate = t.completedAt
          ? toLocalIsoDate(new Date(t.completedAt))
          : '';
        const inDueWindow = Boolean(due && due >= startIso && due <= endIso);
        const inCompletedWindow = Boolean(
          completedDate && completedDate >= startIso && completedDate <= endIso
        );
        if (isCurrentWeek) {
          return inDueWindow || inCompletedWindow || !t.dueDate;
        }
        return inDueWindow || inCompletedWindow;
      });

      let completedTasks = 0;
      let plannedTasks = 0;
      let completionRate = 0;
      let focusHours = 0;
      let isEstimatedBaseline = false;

      if (isCurrentWeek || tasksInWeek.length > 0) {
        plannedTasks = tasksInWeek.length;
        completedTasks = tasksInWeek.filter((t) => t.status === 'completed').length;
        completionRate =
          plannedTasks > 0
            ? Math.round((completedTasks / plannedTasks) * 100)
            : 0;
        const completedMinutes = tasksInWeek
          .filter((t) => t.status === 'completed')
          .reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
        focusHours = Number((completedMinutes / 60).toFixed(1));
      } else {
        const base = PREVIOUS_WEEKS_BASELINE[weekOffset];
        plannedTasks = base.planned;
        completedTasks = base.completed;
        completionRate = Math.round((base.completed / base.planned) * 100);
        focusHours = base.focusHours;
        isEstimatedBaseline = true;
      }

      rawWeeks.push({
        weekOffset,
        label: WEEK_LABELS[weekOffset],
        dateRange: formatRangeShort(startDate, endDate),
        completionRate,
        completedTasks,
        plannedTasks,
        focusHours,
        isCurrentWeek,
        isEstimatedBaseline,
        targetRate,
        weeklyHoursTarget,
      });
    }

    return rawWeeks.map((week, index) => {
      const prev = index > 0 ? rawWeeks[index - 1] : null;
      const rateDiffFromPrev = prev
        ? week.completionRate - prev.completionRate
        : 0;
      const hoursDiffFromPrev = prev
        ? Number((week.focusHours - prev.focusHours).toFixed(1))
        : 0;
      const rateDiffFromGoal = week.completionRate - targetRate;
      return {
        ...week,
        rateDiffFromPrev,
        hoursDiffFromPrev,
        rateDiffFromGoal,
      };
    });
  }, [tasks, targetRate, weeklyHoursTarget]);

  // 2. Daily breakdown dataset for current 7 days
  const dailyComparisonData = useMemo(() => {
    const today = new Date();
    const todayIso = toLocalIsoDate(today);

    const rows = [];
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const dateIso = toLocalIsoDate(date);
      const dayIndex = date.getDay();
      const isToday = dateIso === todayIso;

      const tasksForDay = tasks.filter(
        (t) =>
          (t.dueDate && t.dueDate === dateIso) ||
          (t.completedAt && toLocalIsoDate(new Date(t.completedAt)) === dateIso) ||
          (isToday && !t.dueDate)
      );

      let completedTasks = 0;
      let plannedTasks = 0;
      let actualRate = 0;
      let focusHours = 0;

      if (isToday || tasksForDay.length > 0) {
        plannedTasks = tasksForDay.length;
        completedTasks = tasksForDay.filter(
          (t) => t.status === 'completed'
        ).length;
        actualRate =
          plannedTasks > 0
            ? Math.round((completedTasks / plannedTasks) * 100)
            : 0;
        const completedMinutes = tasksForDay
          .filter((t) => t.status === 'completed')
          .reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
        focusHours = Number((completedMinutes / 60).toFixed(1));
      } else {
        const base = BASELINE_BY_DAY_INDEX[dayIndex];
        plannedTasks = base.planned;
        completedTasks = base.completed;
        actualRate = Math.round((base.completed / base.planned) * 100);
        focusHours = base.focusHours;
      }

      const rateDiff = actualRate - targetRate;
      const hoursDiff = Number((focusHours - dailyHoursTarget).toFixed(1));
      const metRateGoal = actualRate >= targetRate;
      const metHoursGoal = focusHours >= dailyHoursTarget;

      rows.push({
        day: isToday
          ? `${ARABIC_DAYS[dayIndex]} (اليوم)`
          : ARABIC_DAYS[dayIndex],
        shortDay: ARABIC_DAYS[dayIndex],
        actualRate,
        targetRate,
        rateDiff,
        focusHours,
        dailyHoursTarget,
        hoursDiff,
        completedTasks,
        plannedTasks,
        metRateGoal,
        metHoursGoal,
        isToday,
      });
    }
    return rows;
  }, [tasks, targetRate, dailyHoursTarget]);

  const currentWeekStats =
    multiWeekComparisonData[multiWeekComparisonData.length - 1];
  const previousWeekStats =
    multiWeekComparisonData[multiWeekComparisonData.length - 2];

  const weekOverWeekRateDelta =
    currentWeekStats && previousWeekStats
      ? currentWeekStats.completionRate - previousWeekStats.completionRate
      : 0;

  const bestWeekRate = useMemo(
    () =>
      multiWeekComparisonData.reduce(
        (max, w) => Math.max(max, w.completionRate),
        0
      ),
    [multiWeekComparisonData]
  );

  const avgWeeklyRate = useMemo(() => {
    if (dailyComparisonData.length === 0) return 0;
    const sum = dailyComparisonData.reduce((acc, d) => acc + d.actualRate, 0);
    return Math.round(sum / dailyComparisonData.length);
  }, [dailyComparisonData]);

  const avgDailyHours = useMemo(() => {
    if (dailyComparisonData.length === 0) return 0;
    const sum = dailyComparisonData.reduce((acc, d) => acc + d.focusHours, 0);
    return Number((sum / dailyComparisonData.length).toFixed(1));
  }, [dailyComparisonData]);

  const daysMetGoal = useMemo(
    () =>
      dailyComparisonData.filter((d) =>
        metricMode === 'rate' ? d.metRateGoal : d.metHoursGoal
      ).length,
    [dailyComparisonData, metricMode]
  );

  const avgGap = avgWeeklyRate - targetRate;
  const maxDailyHoursAxis = Math.max(
    dailyHoursTarget + 2,
    ...dailyComparisonData.map((d) => Math.ceil(d.focusHours) + 1),
    8
  );
  const maxWeeklyHoursAxis = Math.max(
    weeklyHoursTarget + 4,
    ...multiWeekComparisonData.map((w) => Math.ceil(w.focusHours) + 4),
    24
  );

  // Motivational feedback message comparing current week against previous weeks
  const motivationalFeedback = useMemo(() => {
    const curr = currentWeekStats?.completionRate ?? 0;
    const prev = previousWeekStats?.completionRate ?? 0;
    const diff = curr - prev;

    if (curr >= 100) {
      return {
        tone: 'emerald' as const,
        text: 'إنجاز استثنائي! أتممت 100% من مهام الأسبوع الحالي وتفوقت على جميع الأسابيع السابقة.',
      };
    }
    if (diff > 0) {
      return {
        tone: 'emerald' as const,
        text: `تقدّم رائع! معدل إنجازك هذا الأسبوع (${curr}%) أعلى بـ +${diff}% مقارنة بالأسبوع الماضي (${prev}%) — واصل هذا الزخم!`,
      };
    }
    if (diff === 0) {
      return {
        tone: 'cyan' as const,
        text: `ثبات ممتاز عند ${curr}% مثل الأسبوع الماضي — إكمال مهمة واحدة إضافية يمنحك رقماً قياسياً جديداً!`,
      };
    }
    const needed = Math.abs(diff) + 1;
    return {
      tone: 'amber' as const,
      text: `أنت على بُعد +${needed}% فقط لتجاوز معدل الأسبوع الماضي (${prev}%). أنجز مهمة واحدة الآن لترفع منحنى تقدمك!`,
    };
  }, [currentWeekStats, previousWeekStats]);

  return (
    <section
      aria-label="معدل الإنجاز الأسبوعي مقارنة بالأسابيع السابقة"
      className="bg-slate-900/90 rounded-2xl border border-indigo-500/30 p-5 shadow-xl space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-emerald-500/20 border border-indigo-500/40 flex items-center justify-center text-emerald-300 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex flex-wrap items-center gap-2">
              <span>معدل إنجاز المهام الأسبوعي مقارنة بالأسابيع السابقة</span>
              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                الهدف: {targetRate}%
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              تابع تطور أدائك عبر الأسابيع لتحفيز الاستمرارية — الهدف الرئيسي: {profile.mainGoals}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Weeks Comparison vs 7 Days */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('weeks')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'weeks'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>مقارنة الأسابيع</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('days')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'days'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              تفاصيل الأيام
            </button>
          </div>

          {/* Metric Toggle */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMetricMode('rate')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                metricMode === 'rate'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              نسبة الإنجاز (%)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('hours')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                metricMode === 'hours'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ساعات الإنجاز (س)
            </button>
          </div>

          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
              title="تعديل الهدف الأسبوعي وساعات العمل من ملف التوأم الرقمي"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>تعديل الهدف</span>
            </button>
          )}
        </div>
      </div>

      {/* Motivational Progress Banner */}
      <div
        className={`rounded-xl border px-4 py-3 flex items-center gap-3 text-xs ${
          motivationalFeedback.tone === 'emerald'
            ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-100'
            : motivationalFeedback.tone === 'cyan'
            ? 'bg-cyan-950/35 border-cyan-500/40 text-cyan-100'
            : 'bg-amber-950/35 border-amber-500/40 text-amber-100'
        }`}
      >
        <Sparkles
          className={`w-4 h-4 shrink-0 ${
            motivationalFeedback.tone === 'emerald'
              ? 'text-emerald-400'
              : motivationalFeedback.tone === 'cyan'
              ? 'text-cyan-400'
              : 'text-amber-400'
          }`}
        />
        <p className="font-medium leading-relaxed">{motivationalFeedback.text}</p>
      </div>

      {/* KPI Comparison Summary */}
      {viewMode === 'weeks' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {weekOverWeekRateDelta >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div>
                <span className="block text-[11px] text-slate-400">
                  الأسبوع الحالي / الأسبوع الماضي
                </span>
                <span className="text-sm font-bold text-slate-100 font-mono">
                  {currentWeekStats?.completionRate ?? 0}%{' '}
                  <span className="text-slate-500 font-normal">/</span>{' '}
                  <span className="text-indigo-300">
                    {previousWeekStats?.completionRate ?? 0}%
                  </span>
                </span>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border font-mono ${
                weekOverWeekRateDelta >= 0
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              {weekOverWeekRateDelta >= 0
                ? `+${weekOverWeekRateDelta}%`
                : `${weekOverWeekRateDelta}%`}
            </span>
          </div>

          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-400">
                  أعلى معدل أسبوعي مسجل
                </span>
                <span className="text-sm font-bold text-slate-100 font-mono">
                  {bestWeekRate}%{' '}
                  <span className="text-slate-500 font-normal">/</span>{' '}
                  <span className="text-amber-300">هدف {targetRate}%</span>
                </span>
              </div>
            </div>
            <Target className="w-4 h-4 text-amber-300 shrink-0" />
          </div>

          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-400">
                  مهام الأسبوع الحالي المنجزة
                </span>
                <span className="text-sm font-bold text-slate-100 font-mono">
                  {currentWeekStats?.completedTasks ?? 0} من{' '}
                  {currentWeekStats?.plannedTasks ?? 0}
                </span>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-cyan-300 font-mono">
              {currentWeekStats?.focusHours ?? 0} س
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-400">
                  المعدل الفعلي / الهدف الشخصي
                </span>
                <span className="text-sm font-bold text-slate-100 font-mono">
                  {avgWeeklyRate}%{' '}
                  <span className="text-slate-500 font-normal">/</span>{' '}
                  <span className="text-amber-300">{targetRate}%</span>
                </span>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border font-mono ${
                avgGap >= 0
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              {avgGap >= 0 ? `+${avgGap}%` : `${avgGap}%`}
            </span>
          </div>

          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-400">
                  أيام تحقيق الهدف الأسبوعي
                </span>
                <span className="text-sm font-bold text-slate-100 font-mono">
                  {daysMetGoal} من 7 أيام
                </span>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
              {Math.round((daysMetGoal / 7) * 100)}%
            </span>
          </div>

          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-400">
                  متوسط الإنجاز اليومي / المستهدف
                </span>
                <span className="text-sm font-bold text-slate-100 font-mono">
                  {avgDailyHours} س{' '}
                  <span className="text-slate-500 font-normal">/</span>{' '}
                  <span className="text-amber-300">{dailyHoursTarget} س</span>
                </span>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
        </div>
      )}

      {/* Main Recharts Composed Chart */}
      <div className="bg-slate-950/70 rounded-2xl border border-slate-800/80 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-200">
            {viewMode === 'weeks'
              ? metricMode === 'rate'
                ? 'تطور نسبة إنجاز المهام الأسبوعية (%) عبر آخر 5 أسابيع'
                : 'مقارنة ساعات الإنجاز الأسبوعية عبر آخر 5 أسابيع'
              : metricMode === 'rate'
              ? 'مقارنة نسبة إنجاز المهام اليومية (%) بخط الهدف الشخصي'
              : 'مقارنة ساعات الإنجاز اليومية بخط الساعات المستهدفة'}
          </span>

          {viewMode === 'weeks' ? (
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                الأسبوع الحالي
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
                الأسابيع السابقة
              </span>
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="w-4 h-0.5 bg-cyan-400 inline-block" />
                مسار التقدم
              </span>
              <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-400 inline-block" />
                خط الهدف
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                حقق الهدف
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
                قريب من الهدف
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                دون الهدف
              </span>
              <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-400 inline-block" />
                خط الهدف الشخصي
              </span>
            </div>
          )}
        </div>

        <div className="h-[275px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'weeks' ? (
              <ComposedChart
                data={multiWeekComparisonData}
                margin={{ top: 20, right: 18, left: -10, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                />
                <YAxis
                  domain={
                    metricMode === 'rate' ? [0, 100] : [0, maxWeeklyHoursAxis]
                  }
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) =>
                    metricMode === 'rate' ? `${val}%` : `${val}س`
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload;
                    const isRate = metricMode === 'rate';
                    const diffPrev = isRate
                      ? item.rateDiffFromPrev
                      : item.hoursDiffFromPrev;

                    return (
                      <div
                        dir="rtl"
                        className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-xl text-xs space-y-1.5 backdrop-blur-md"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold text-cyan-300">{item.label}</p>
                          <span className="text-[10px] text-slate-400">
                            {item.dateRange}
                          </span>
                        </div>
                        <p className="text-slate-200">
                          {isRate ? 'معدل الإنجاز:' : 'ساعات الإنجاز:'}{' '}
                          <span className="font-bold text-emerald-400 font-mono">
                            {isRate
                              ? `${item.completionRate}%`
                              : `${item.focusHours} ساعة`}
                          </span>
                        </p>
                        {item.weekOffset < 4 && (
                          <p
                            className={`font-semibold ${
                              diffPrev >= 0
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}
                          >
                            مقارنة بالأسبوع السابق:{' '}
                            <span className="font-mono">
                              {diffPrev >= 0 ? `+${diffPrev}` : diffPrev}
                              {isRate ? '%' : ' س'}
                            </span>
                          </p>
                        )}
                        <p className="text-slate-400 pt-1 border-t border-slate-800">
                          المهام: {item.completedTasks} من {item.plannedTasks}{' '}
                          منجزة
                          {item.isEstimatedBaseline && ' (مرجعي)'}
                        </p>
                      </div>
                    );
                  }}
                />

                <ReferenceLine
                  y={metricMode === 'rate' ? targetRate : weeklyHoursTarget}
                  stroke="#fbbf24"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  label={{
                    value:
                      metricMode === 'rate'
                        ? `الهدف (${targetRate}%)`
                        : `الهدف (${weeklyHoursTarget}س)`,
                    position: 'insideTopRight',
                    fill: '#fbbf24',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />

                <Bar
                  dataKey={metricMode === 'rate' ? 'completionRate' : 'focusHours'}
                  name={
                    metricMode === 'rate'
                      ? 'معدل الإنجاز الأسبوعي'
                      : 'ساعات الإنجاز الأسبوعية'
                  }
                  radius={[10, 10, 0, 0]}
                  maxBarSize={48}
                >
                  {multiWeekComparisonData.map((entry, idx) => {
                    const color = entry.isCurrentWeek
                      ? entry.completionRate >=
                        (previousWeekStats?.completionRate ?? 0)
                        ? '#10b981'
                        : '#06b6d4'
                      : entry.weekOffset === 1
                      ? '#6366f1'
                      : '#475569';
                    return <Cell key={`week-bar-${idx}`} fill={color} />;
                  })}
                </Bar>

                <Line
                  type="monotone"
                  dataKey={metricMode === 'rate' ? 'completionRate' : 'focusHours'}
                  name="منحنى التقدم"
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#22d3ee', strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            ) : (
              <ComposedChart
                data={dailyComparisonData}
                margin={{ top: 18, right: 16, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="shortDay"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                />
                <YAxis
                  domain={
                    metricMode === 'rate' ? [0, 100] : [0, maxDailyHoursAxis]
                  }
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) =>
                    metricMode === 'rate' ? `${val}%` : `${val}س`
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload;
                    const isRate = metricMode === 'rate';
                    const diff = isRate ? item.rateDiff : item.hoursDiff;
                    return (
                      <div
                        dir="rtl"
                        className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-xl text-xs space-y-1.5 backdrop-blur-md"
                      >
                        <p className="font-bold text-cyan-300">{item.day}</p>
                        <p className="text-slate-200">
                          {isRate ? 'الإنجاز الفعلي:' : 'ساعات الإنجاز:'}{' '}
                          <span className="font-bold text-emerald-400 font-mono">
                            {isRate
                              ? `${item.actualRate}%`
                              : `${item.focusHours} ساعة`}
                          </span>
                        </p>
                        <p className="text-slate-200">
                          {isRate ? 'الهدف الشخصي:' : 'الهدف اليومي:'}{' '}
                          <span className="font-bold text-amber-300 font-mono">
                            {isRate
                              ? `${item.targetRate}%`
                              : `${item.dailyHoursTarget} ساعة`}
                          </span>
                        </p>
                        <p
                          className={`font-semibold ${
                            diff >= 0 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          الفارق عن الهدف:{' '}
                          <span className="font-mono">
                            {diff >= 0 ? `+${diff}` : diff}
                            {isRate ? '%' : ' س'}
                          </span>
                        </p>
                        <p className="text-slate-400 pt-1 border-t border-slate-800">
                          المهام: {item.completedTasks} من {item.plannedTasks}{' '}
                          منجزة
                        </p>
                      </div>
                    );
                  }}
                />

                <ReferenceLine
                  y={metricMode === 'rate' ? targetRate : dailyHoursTarget}
                  stroke="#fbbf24"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  label={{
                    value:
                      metricMode === 'rate'
                        ? `الهدف (${targetRate}%)`
                        : `الهدف (${dailyHoursTarget}س)`,
                    position: 'insideTopRight',
                    fill: '#fbbf24',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />

                <Bar
                  dataKey={metricMode === 'rate' ? 'actualRate' : 'focusHours'}
                  name={metricMode === 'rate' ? 'الإنجاز الفعلي' : 'ساعات الإنجاز'}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={40}
                >
                  {dailyComparisonData.map((entry, idx) => {
                    const val =
                      metricMode === 'rate' ? entry.actualRate : entry.focusHours;
                    const goal =
                      metricMode === 'rate' ? targetRate : dailyHoursTarget;
                    const color =
                      val >= goal
                        ? '#10b981'
                        : val >= goal * 0.8
                        ? '#06b6d4'
                        : '#f59e0b';
                    return <Cell key={`goal-bar-${idx}`} fill={color} />;
                  })}
                </Bar>

                <Line
                  type="monotone"
                  dataKey={
                    metricMode === 'rate' ? 'targetRate' : 'dailyHoursTarget'
                  }
                  name="الهدف الشخصي"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
