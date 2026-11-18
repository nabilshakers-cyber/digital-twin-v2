import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  CheckCircle2,
  Clock,
  Award,
} from 'lucide-react';
import { Task, TimeBlock, TaskCategory } from '../types';

interface ProductivityStatsPanelProps {
  tasks: Task[];
  schedule: TimeBlock[];
}

const CATEGORY_META: Record<
  TaskCategory,
  { label: string; color: string; bgClass: string }
> = {
  work: { label: 'العمل والمشاريع', color: '#06b6d4', bgClass: 'bg-cyan-500' },
  urgent: { label: 'مهام عاجلة', color: '#f43f5e', bgClass: 'bg-rose-500' },
  health: { label: 'الصحة واللياقة', color: '#10b981', bgClass: 'bg-emerald-500' },
  study: { label: 'التعلم والتطوير', color: '#8b5cf6', bgClass: 'bg-violet-500' },
  personal: { label: 'شخصي وإداري', color: '#f59e0b', bgClass: 'bg-amber-500' },
};

const SCHEDULE_META: Record<
  TimeBlock['category'],
  { label: string; color: string }
> = {
  deep_work: { label: 'تركيز عميق', color: '#f59e0b' },
  meeting: { label: 'اجتماعات', color: '#3b82f6' },
  health: { label: 'صحة وراحة', color: '#10b981' },
  routine: { label: 'روتين وإدارة', color: '#64748b' },
  review: { label: 'مراجعة وتخطيط', color: '#8b5cf6' },
  personal: { label: 'شخصي', color: '#06b6d4' },
};

const ARABIC_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

// Baseline weekly history for past days before live local tasks accumulate
const BASELINE_BY_DAY_INDEX: Record<number, { completed: number; planned: number; focusHours: number }> = {
  0: { completed: 5, planned: 6, focusHours: 4.5 },  // الأحد
  1: { completed: 6, planned: 7, focusHours: 5.5 },  // الإثنين
  2: { completed: 4, planned: 6, focusHours: 4.0 },  // الثلاثاء
  3: { completed: 7, planned: 8, focusHours: 6.0 },  // الأربعاء
  4: { completed: 5, planned: 6, focusHours: 5.0 },  // الخميس
  5: { completed: 3, planned: 4, focusHours: 2.5 },  // الجمعة
  6: { completed: 4, planned: 5, focusHours: 3.5 },  // السبت
};

const parseMinutesBetween = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) {
    return 60;
  }
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 60;
};

export const ProductivityStatsPanel: React.FC<ProductivityStatsPanelProps> = ({
  tasks,
  schedule,
}) => {
  const [weeklyChartType, setWeeklyChartType] = useState<'area' | 'bar'>('area');
  const [distributionSource, setDistributionSource] = useState<'tasks' | 'schedule'>('tasks');

  // 1. Build 7-day weekly completion dataset ending today (or ordered Saturday -> Friday / last 7 days)
  const weeklyData = useMemo(() => {
    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];

    const days = [];
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const dateIso = date.toISOString().split('T')[0];
      const dayIndex = date.getDay();
      const isToday = dateIso === todayIso;

      // Match real tasks for this date
      const tasksForDay = tasks.filter(
        (t) =>
          (t.dueDate && t.dueDate === dateIso) ||
          (t.completedAt && t.completedAt.split('T')[0] === dateIso) ||
          (isToday && !t.dueDate)
      );

      if (isToday || tasksForDay.length > 0) {
        const total = tasksForDay.length;
        const completed = tasksForDay.filter((t) => t.status === 'completed').length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const completedMinutes = tasksForDay
          .filter((t) => t.status === 'completed')
          .reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);

        days.push({
          day: isToday ? `${ARABIC_DAYS[dayIndex]} (اليوم)` : ARABIC_DAYS[dayIndex],
          shortDay: ARABIC_DAYS[dayIndex],
          completionRate: rate,
          completedTasks: completed,
          plannedTasks: total,
          focusHours: Number((completedMinutes / 60).toFixed(1)),
          isToday,
        });
      } else {
        const base = BASELINE_BY_DAY_INDEX[dayIndex];
        const rate = Math.round((base.completed / base.planned) * 100);
        days.push({
          day: ARABIC_DAYS[dayIndex],
          shortDay: ARABIC_DAYS[dayIndex],
          completionRate: rate,
          completedTasks: base.completed,
          plannedTasks: base.planned,
          focusHours: base.focusHours,
          isToday: false,
        });
      }
    }

    return days;
  }, [tasks]);

  // 2. Build work category distribution dataset
  const categoryData = useMemo(() => {
    if (distributionSource === 'tasks') {
      const counts: Record<string, { count: number; completed: number; minutes: number }> = {};

      tasks.forEach((task) => {
        const cat = task.category || 'work';
        if (!counts[cat]) {
          counts[cat] = { count: 0, completed: 0, minutes: 0 };
        }
        counts[cat].count += 1;
        if (task.status === 'completed') counts[cat].completed += 1;
        counts[cat].minutes += task.estimatedMinutes || 30;
      });

      const totalCount = tasks.length || 1;

      return (Object.keys(counts) as TaskCategory[])
        .map((cat) => {
          const meta = CATEGORY_META[cat] || { label: cat, color: '#64748b' };
          return {
            key: cat,
            name: meta.label,
            value: counts[cat].count,
            minutes: counts[cat].minutes,
            completed: counts[cat].completed,
            percentage: Math.round((counts[cat].count / totalCount) * 100),
            color: meta.color,
          };
        })
        .sort((a, b) => b.value - a.value);
    } else {
      const counts: Record<string, { count: number; minutes: number; completed: number }> = {};

      schedule.forEach((block) => {
        const cat = block.category || 'personal';
        if (!counts[cat]) {
          counts[cat] = { count: 0, minutes: 0, completed: 0 };
        }
        counts[cat].count += 1;
        counts[cat].minutes += parseMinutesBetween(block.startTime, block.endTime);
        if (block.isCompleted) counts[cat].completed += 1;
      });

      const totalMinutes =
        Object.values(counts).reduce((acc, item) => acc + item.minutes, 0) || 1;

      return (Object.keys(counts) as TimeBlock['category'][])
        .map((cat) => {
          const meta = SCHEDULE_META[cat] || { label: cat, color: '#64748b' };
          return {
            key: cat,
            name: meta.label,
            value: counts[cat].minutes,
            minutes: counts[cat].minutes,
            completed: counts[cat].completed,
            percentage: Math.round((counts[cat].minutes / totalMinutes) * 100),
            color: meta.color,
          };
        })
        .sort((a, b) => b.value - a.value);
    }
  }, [tasks, schedule, distributionSource]);

  // 3. Summary KPIs
  const avgWeeklyRate = useMemo(() => {
    if (weeklyData.length === 0) return 0;
    const sum = weeklyData.reduce((acc, d) => acc + d.completionRate, 0);
    return Math.round(sum / weeklyData.length);
  }, [weeklyData]);

  const totalWeeklyCompleted = useMemo(
    () => weeklyData.reduce((acc, d) => acc + d.completedTasks, 0),
    [weeklyData]
  );

  const bestDay = useMemo(() => {
    if (weeklyData.length === 0) return '-';
    return weeklyData.reduce((best, curr) =>
      curr.completionRate >= best.completionRate ? curr : best
    ).shortDay;
  }, [weeklyData]);

  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const todayRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <section
      aria-label="لوحة إحصائيات الإنتاجية"
      className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-5"
    >
      {/* Header + Quick KPI Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600/30 to-indigo-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              إحصائيات الإنتاجية والأداء الأسبوعي
            </h3>
            <p className="text-xs text-slate-400">
              تحليل مباشر لمعدل إنجاز مهامك خلال الأسبوع وتوزيع وقتك على تصنيفات العمل
            </p>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <span className="block text-[10px] text-slate-400">متوسط الأسبوع</span>
              <span className="text-xs font-bold text-slate-100">{avgWeeklyRate}%</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="block text-[10px] text-slate-400">المهام المنجزة</span>
              <span className="text-xs font-bold text-slate-100">{totalWeeklyCompleted} مهمة</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="block text-[10px] text-slate-400">ذروة الإنجاز</span>
              <span className="text-xs font-bold text-slate-100">{bestDay}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Weekly Task Completion Chart (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/70 rounded-2xl border border-slate-800/80 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-200">
                معدل إنجاز المهام الأسبوعي (%)
              </h4>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setWeeklyChartType('area')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  weeklyChartType === 'area'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                منحنى
              </button>
              <button
                type="button"
                onClick={() => setWeeklyChartType('bar')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  weeklyChartType === 'bar'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                أعمدة
              </button>
            </div>
          </div>

          <div className="h-[240px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {weeklyChartType === 'area' ? (
                <AreaChart
                  data={weeklyData}
                  margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="weeklyRateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="shortDay"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#1e293b' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = payload[0].payload;
                      return (
                        <div
                          dir="rtl"
                          className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-xl text-xs space-y-1 backdrop-blur-md"
                        >
                          <p className="font-bold text-cyan-300">{item.day}</p>
                          <p className="text-slate-200">
                            نسبة الإنجاز: <span className="font-bold text-emerald-400">{item.completionRate}%</span>
                          </p>
                          <p className="text-slate-400">
                            المهام: {item.completedTasks} من {item.plannedTasks} منجزة
                          </p>
                          <p className="text-slate-400">
                            ساعات التركيز: {item.focusHours} ساعة
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completionRate"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#weeklyRateGradient)"
                    activeDot={{ r: 5, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={weeklyData}
                  margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="shortDay"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#1e293b' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const item = payload[0].payload;
                      return (
                        <div
                          dir="rtl"
                          className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-xl text-xs space-y-1 backdrop-blur-md"
                        >
                          <p className="font-bold text-cyan-300">{item.day}</p>
                          <p className="text-slate-200">
                            نسبة الإنجاز: <span className="font-bold text-emerald-400">{item.completionRate}%</span>
                          </p>
                          <p className="text-slate-400">
                            المهام: {item.completedTasks} من {item.plannedTasks} منجزة
                          </p>
                          <p className="text-slate-400">
                            ساعات التركيز: {item.focusHours} ساعة
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="completionRate"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  >
                    {weeklyData.map((entry, idx) => (
                      <Cell
                        key={`bar-${idx}`}
                        fill={entry.isToday ? '#22d3ee' : '#6366f1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Work Category Distribution Donut Chart (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 rounded-2xl border border-slate-800/80 p-4 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-slate-200">
                توزيع تصنيفات العمل
              </h4>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setDistributionSource('tasks')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  distributionSource === 'tasks'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                المهام
              </button>
              <button
                type="button"
                onClick={() => setDistributionSource('schedule')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  distributionSource === 'schedule'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الجدول
              </button>
            </div>
          </div>

          {categoryData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
              لا توجد بيانات كافية لعرض التوزيع حالياً
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-3 flex-1">
              {/* Donut Chart */}
              <div className="relative h-[190px] w-[190px] shrink-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {categoryData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const item = payload[0].payload;
                        return (
                          <div
                            dir="rtl"
                            className="bg-slate-900/95 border border-slate-700 rounded-xl p-2.5 shadow-xl text-xs space-y-0.5 backdrop-blur-md"
                          >
                            <p className="font-bold text-slate-100">{item.name}</p>
                            <p className="text-cyan-300">النسبة: {item.percentage}%</p>
                            <p className="text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.minutes} دقيقة
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-slate-100">{todayRate}%</span>
                  <span className="text-[10px] text-slate-400">إنجاز اليوم</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex-1 w-full space-y-2">
                {categoryData.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 text-xs bg-slate-900/70 px-2.5 py-1.5 rounded-lg border border-slate-800/70"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-200 font-medium truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-400">
                        {distributionSource === 'tasks'
                          ? `${item.value} مهام`
                          : `${Math.round(item.minutes / 60 * 10) / 10} س`}
                      </span>
                      <span className="text-[11px] font-bold text-cyan-300 w-9 text-left font-mono">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </section>
  );
};
