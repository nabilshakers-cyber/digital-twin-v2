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
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { DigitalTwinProfile, Task } from '../types';

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

export const WeeklyGoalComparisonChart: React.FC<
  WeeklyGoalComparisonChartProps
> = ({ tasks, profile, onOpenProfile }) => {
  const [metricMode, setMetricMode] = useState<'rate' | 'hours'>('rate');

  const targetRate = Math.max(
    10,
    Math.min(100, profile.weeklyCompletionGoalRate ?? 85)
  );
  const dailyHoursTarget = Math.max(1, profile.dailyWorkHoursTarget || 7);

  const weeklyComparisonData = useMemo(() => {
    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];

    const rows = [];
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const dateIso = date.toISOString().split('T')[0];
      const dayIndex = date.getDay();
      const isToday = dateIso === todayIso;

      const tasksForDay = tasks.filter(
        (t) =>
          (t.dueDate && t.dueDate === dateIso) ||
          (t.completedAt && t.completedAt.split('T')[0] === dateIso) ||
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

  const avgWeeklyRate = useMemo(() => {
    if (weeklyComparisonData.length === 0) return 0;
    const sum = weeklyComparisonData.reduce((acc, d) => acc + d.actualRate, 0);
    return Math.round(sum / weeklyComparisonData.length);
  }, [weeklyComparisonData]);

  const avgDailyHours = useMemo(() => {
    if (weeklyComparisonData.length === 0) return 0;
    const sum = weeklyComparisonData.reduce((acc, d) => acc + d.focusHours, 0);
    return Number((sum / weeklyComparisonData.length).toFixed(1));
  }, [weeklyComparisonData]);

  const daysMetGoal = useMemo(
    () =>
      weeklyComparisonData.filter((d) =>
        metricMode === 'rate' ? d.metRateGoal : d.metHoursGoal
      ).length,
    [weeklyComparisonData, metricMode]
  );

  const avgGap = avgWeeklyRate - targetRate;
  const maxHoursAxis = Math.max(
    dailyHoursTarget + 2,
    ...weeklyComparisonData.map((d) => Math.ceil(d.focusHours) + 1),
    8
  );

  return (
    <section
      aria-label="معدل الإنجاز الأسبوعي مقارنة بالهدف الشخصي"
      className="bg-slate-900/90 rounded-2xl border border-indigo-500/30 p-5 shadow-xl space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-amber-500/20 border border-indigo-500/40 flex items-center justify-center text-amber-300 shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex flex-wrap items-center gap-2">
              <span>معدل الإنجاز الأسبوعي مقابل الهدف الشخصي</span>
              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                الهدف: {targetRate}%
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              الهدف الاستراتيجي في ملف التوأم: {profile.mainGoals}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
              ساعات العمل (س)
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

      {/* KPI Comparison Summary */}
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

      {/* Main Recharts Composed Chart */}
      <div className="bg-slate-950/70 rounded-2xl border border-slate-800/80 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-200">
            {metricMode === 'rate'
              ? 'مقارنة نسبة إنجاز المهام اليومية (%) بخط الهدف الشخصي'
              : 'مقارنة ساعات الإنجاز اليومية بخط الساعات المستهدفة'}
          </span>

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
        </div>

        <div className="h-[265px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={weeklyComparisonData}
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
                domain={metricMode === 'rate' ? [0, 100] : [0, maxHoursAxis]}
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
                        المهام: {item.completedTasks} من {item.plannedTasks} منجزة
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
                {weeklyComparisonData.map((entry, idx) => {
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
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
