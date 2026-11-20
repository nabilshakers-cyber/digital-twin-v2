import React, { useState } from 'react';
import { 
  Calendar, 
  Sparkles, 
  Plus, 
  Clock, 
  Flame, 
  CheckCircle2, 
  Circle, 
  Lock, 
  Trash2, 
  Edit, 
  Zap, 
  Coffee, 
  Users, 
  Code, 
  Moon, 
  Sun, 
  AlertTriangle,
  Loader2,
  Check,
  CalendarClock,
  ShieldCheck,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BatteryCharging,
} from 'lucide-react';
import { TimeBlock, DigitalTwinProfile, Task } from '../types';
import {
  analyzeTomorrowEnergyLoad,
  evaluateCognitiveLoad,
  getSmartReschedulingSuggestions,
  getTomorrowDateString,
} from '../utils/burnoutEngine';
import {
  getCalendarStripDays,
  getDualDateInfo,
  parseLocalIsoDate,
  toLocalIsoDate,
} from '../utils/calendarUtils';

interface ScheduleViewProps {
  schedule: TimeBlock[];
  tasks: Task[];
  profile: DigitalTwinProfile;
  onToggleScheduleBlock: (blockId: string) => void;
  onAddScheduleBlock: (block: Partial<TimeBlock>) => void;
  onUpdateScheduleBlock?: (block: TimeBlock) => void;
  onDeleteScheduleBlock: (blockId: string) => void;
  onOptimizeSchedule: () => Promise<void>;
  onStartFocus: (task?: Task) => void;
  onPostponeTask: (taskId: string) => void;
  onPostponeAllSuggested: () => void;
  isOptimizing: boolean;
  optimizationResult?: {
    summary: string;
    energyStrategy: string;
    topPriorities: string[];
    warnings?: string[];
  } | null;
  initialSelectedDate?: string;
  onOpenProfileSettings?: () => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  schedule,
  tasks,
  profile,
  onToggleScheduleBlock,
  onAddScheduleBlock,
  onUpdateScheduleBlock,
  onDeleteScheduleBlock,
  onOptimizeSchedule,
  onStartFocus,
  onPostponeTask,
  onPostponeAllSuggested,
  isOptimizing,
  optimizationResult,
  initialSelectedDate,
  onOpenProfileSettings,
}) => {
  const todayIso = toLocalIsoDate(new Date());
  const [selectedDateIso, setSelectedDateIso] = useState<string>(initialSelectedDate || todayIso);
  const [calendarMode, setCalendarMode] = useState<'dual' | 'hijri' | 'gregorian'>('dual');
  const [stripAnchorIso, setStripAnchorIso] = useState<string>(todayIso);

  React.useEffect(() => {
    if (initialSelectedDate) {
      setSelectedDateIso(initialSelectedDate);
    }
  }, [initialSelectedDate]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [blockDate, setBlockDate] = useState<string>(todayIso);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<TimeBlock['category']>('deep_work');
  const [priority, setPriority] = useState<TimeBlock['priority']>('medium');
  const [isFixed, setIsFixed] = useState(false);

  const selectedDateInfo = getDualDateInfo(selectedDateIso);
  const stripDays = getCalendarStripDays(stripAnchorIso, 1, 7);
  const blockDateInfo = getDualDateInfo(blockDate || selectedDateIso);

  const shiftStripByDays = (delta: number) => {
    const d = parseLocalIsoDate(stripAnchorIso);
    d.setDate(d.getDate() + delta);
    setStripAnchorIso(toLocalIsoDate(d));
  };

  const handleSelectDay = (iso: string) => {
    setSelectedDateIso(iso);
    if (!editingBlockId) {
      setBlockDate(iso);
    }
  };

  const openAddBlockForm = () => {
    setEditingBlockId(null);
    setTitle('');
    setDescription('');
    setBlockDate(selectedDateIso);
    setStartTime('09:00');
    setEndTime('10:00');
    setCategory('deep_work');
    setPriority('medium');
    setIsFixed(false);
    setIsFormOpen((v) => (editingBlockId ? true : !v));
  };

  const openEditBlockForm = (block: TimeBlock) => {
    setEditingBlockId(block.id);
    setTitle(block.title);
    setDescription(block.description || '');
    setBlockDate(block.date || selectedDateIso);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setCategory(block.category);
    setPriority(block.priority || 'medium');
    setIsFixed(Boolean(block.isFixed));
    setIsFormOpen(true);
  };

  const closeBlockForm = () => {
    setIsFormOpen(false);
    setEditingBlockId(null);
    setTitle('');
    setDescription('');
  };

  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingBlockId && onUpdateScheduleBlock) {
      const existing = schedule.find((b) => b.id === editingBlockId);
      onUpdateScheduleBlock({
        ...(existing || { id: editingBlockId, isCompleted: false }),
        id: editingBlockId,
        title: title.trim(),
        description: description.trim(),
        date: blockDate || selectedDateIso,
        startTime,
        endTime,
        category,
        priority,
        isFixed,
      });
    } else {
      onAddScheduleBlock({
        title: title.trim(),
        description: description.trim(),
        date: blockDate || selectedDateIso,
        startTime,
        endTime,
        category,
        priority,
        isFixed,
        isCompleted: false,
      });
    }

    closeBlockForm();
  };

  // Filter & sort schedule blocks for the selected date
  const isSelectedToday = selectedDateIso === todayIso;
  const visibleBlocks = schedule.filter((b) =>
    isSelectedToday ? !b.date || b.date === todayIso : b.date === selectedDateIso
  );
  const sortedBlocks = [...visibleBlocks].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
  const tasksDueOnSelectedDate = tasks.filter(
    (t) => t.dueDate === selectedDateIso && t.status !== 'completed'
  );

  const getCategoryConfig = (cat: TimeBlock['category']) => {
    switch (cat) {
      case 'deep_work':
        return {
          label: 'تركيز عميق',
          bg: 'bg-amber-950/40 border-amber-800/60 text-amber-300',
          badge: 'bg-amber-950/80 text-amber-300 border-amber-800',
          icon: <Zap className="w-4 h-4 text-amber-400" />,
        };
      case 'meeting':
        return {
          label: 'اجتماع وتواصل',
          bg: 'bg-blue-950/40 border-blue-800/60 text-blue-300',
          badge: 'bg-blue-950/80 text-blue-300 border-blue-800',
          icon: <Users className="w-4 h-4 text-blue-400" />,
        };
      case 'health':
        return {
          label: 'صحة وراحة وغذاء',
          bg: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300',
          badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          icon: <Coffee className="w-4 h-4 text-emerald-400" />,
        };
      case 'routine':
        return {
          label: 'روتن وإدارة',
          bg: 'bg-slate-900 border-slate-800 text-slate-300',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: <Sun className="w-4 h-4 text-slate-400" />,
        };
      case 'review':
        return {
          label: 'مراجعة وتخطيط',
          bg: 'bg-purple-950/40 border-purple-800/60 text-purple-300',
          badge: 'bg-purple-950/80 text-purple-300 border-purple-800',
          icon: <Moon className="w-4 h-4 text-purple-400" />,
        };
      default:
        return {
          label: 'شخصي',
          bg: 'bg-slate-900 border-slate-800 text-slate-300',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: <Clock className="w-4 h-4 text-slate-400" />,
        };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      
      {/* Top Header & AI Optimizer CTA */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 rounded-2xl border border-indigo-800/50 p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-100">
              الجدول الزمني الذكي وتوزيع اليوم
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            تقوم نسختك الرقمية بتحليل مهامك العالقة، مواعيدك الثابتة، وأوقات ذروة طاقتك لتنظيم يومك بنظام البلوكات الزمنية (Time-Blocking).
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            id="btn-ai-optimize-schedule"
            onClick={onOptimizeSchedule}
            disabled={isOptimizing}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isOptimizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري بناء الجدول الأمثل...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>إعادة تحسين وتوزيع الجدول بالذكاء الاصطناعي</span>
              </>
            )}
          </button>

          <button
            onClick={openAddBlockForm}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">إضافة موعد/بلوك</span>
          </button>

          {onOpenProfileSettings && (
            <button
              type="button"
              onClick={onOpenProfileSettings}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-700/50 text-xs font-semibold cursor-pointer"
              title="فتح إعدادات مزامنة تقويم Google"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden lg:inline">مزامنة Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Dual Hijri & Gregorian Calendar Strip */}
      <div className="bg-slate-900/90 border border-emerald-500/25 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-white">
                {selectedDateInfo.weekday}
              </span>
              {selectedDateIso === todayIso && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                  اليوم
                </span>
              )}
              {selectedDateInfo.spiritualTag && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300">
                  🌙 {selectedDateInfo.spiritualTag}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {(calendarMode === 'dual' || calendarMode === 'hijri') && (
                <span className="text-emerald-300 font-semibold flex items-center gap-1">
                  <span>🕌 الهجري:</span>
                  <span>{selectedDateInfo.hijriFull}</span>
                </span>
              )}
              {calendarMode === 'dual' && (
                <span className="text-slate-600 hidden sm:inline">•</span>
              )}
              {(calendarMode === 'dual' || calendarMode === 'gregorian') && (
                <span className="text-cyan-300 font-semibold flex items-center gap-1">
                  <span>📅 الميلادي:</span>
                  <span>{selectedDateInfo.gregorianFull}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Calendar Mode Switch */}
            <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setCalendarMode('dual')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  calendarMode === 'dual'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                هجري + ميلادي
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('hijri')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  calendarMode === 'hijri'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                هجري
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('gregorian')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  calendarMode === 'gregorian'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ميلادي
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftStripByDays(-7)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer"
                title="الأسبوع السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setStripAnchorIso(todayIso);
                  handleSelectDay(todayIso);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 cursor-pointer"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => shiftStripByDays(7)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer"
                title="الأسبوع التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 7-Day Dual Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {stripDays.map((dayInfo) => {
            const isSelected = dayInfo.iso === selectedDateIso;
            const dayBlocksCount = schedule.filter((b) =>
              dayInfo.iso === todayIso
                ? !b.date || b.date === todayIso
                : b.date === dayInfo.iso
            ).length;
            const dayTasksCount = tasks.filter(
              (t) => t.dueDate === dayInfo.iso && t.status !== 'completed'
            ).length;

            return (
              <button
                key={dayInfo.iso}
                type="button"
                onClick={() => handleSelectDay(dayInfo.iso)}
                className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-slate-900 border-emerald-400/70 shadow-md shadow-emerald-500/10'
                    : dayInfo.isToday
                    ? 'bg-slate-800/80 border-cyan-500/40 hover:border-cyan-400'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-[11px] font-bold ${
                      isSelected ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {dayInfo.weekday}
                  </span>
                  {dayInfo.isToday && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                  )}
                </div>

                {(calendarMode === 'dual' || calendarMode === 'hijri') && (
                  <p className="text-xs font-bold text-emerald-300 truncate">
                    {dayInfo.hijriShort}
                  </p>
                )}

                {(calendarMode === 'dual' || calendarMode === 'gregorian') && (
                  <p className="text-[11px] font-medium text-cyan-300/90 truncate">
                    {dayInfo.gregorianShort}
                  </p>
                )}

                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                  <span>{dayBlocksCount} بلوك</span>
                  {dayTasksCount > 0 && (
                    <span className="text-amber-300 font-semibold">
                      • {dayTasksCount} مهام
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Burnout & Smart Rescheduling Evaluation Panel */}
      {(() => {
        const burnoutEvaluation = evaluateCognitiveLoad(tasks);
        const tomorrowStr = getTomorrowDateString();
        const reschedulingSuggestions = getSmartReschedulingSuggestions(tasks).filter(
          (t) => t.suggestedPostpone
        );
        const unpostponedCount = reschedulingSuggestions.filter(
          (t) => !t.dueDate || t.dueDate < tomorrowStr
        ).length;

        return (
          <div
            className={`rounded-2xl border p-4 space-y-3 shadow-lg ${
              burnoutEvaluation.isOverloaded
                ? 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border-rose-800/70'
                : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                    burnoutEvaluation.isOverloaded
                      ? 'bg-rose-950/80 border-rose-700 text-rose-400'
                      : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  }`}
                >
                  {burnoutEvaluation.isOverloaded ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-100">
                      مراقب الحمل المعرفي وإعادة الجدولة الذكية
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                        burnoutEvaluation.isOverloaded
                          ? 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                          : 'bg-slate-800 text-cyan-300 border-slate-700'
                      }`}
                    >
                      الإجراء المقترح: {burnoutEvaluation.recommendedAction}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {burnoutEvaluation.message}
                  </p>
                </div>
              </div>

              {unpostponedCount > 0 && (
                <button
                  onClick={() => {
                    onPostponeAllSuggested();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>تأجيل الكل للغد ({unpostponedCount})</span>
                </button>
              )}
            </div>

            {/* Tomorrow Energy Capacity Analysis Bar */}
            {(() => {
              const tomorrowAnalysis = analyzeTomorrowEnergyLoad(tasks, schedule, profile);
              return (
                <div
                  className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                    tomorrowAnalysis.isOverloaded
                      ? 'bg-amber-950/35 border-amber-500/50 text-amber-100'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <BatteryCharging
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        tomorrowAnalysis.isOverloaded ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-100">
                          تحليل طاقة الغد ({tomorrowAnalysis.tomorrowIso})
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            tomorrowAnalysis.isOverloaded
                              ? 'bg-rose-950/80 text-rose-200 border-rose-700/70'
                              : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                          }`}
                        >
                          {tomorrowAnalysis.usagePercent}% من الطاقة ({tomorrowAnalysis.capacity.label})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {profile.endOfDayOverloadAlertEnabled
                            ? `تنبيه نهاية اليوم مفعل (${profile.endOfDayAlertTime || '20:00'})`
                            : 'تنبيه نهاية اليوم اختياري (معطل)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {tomorrowAnalysis.summary}{' '}
                        {tomorrowAnalysis.isOverloaded && tomorrowAnalysis.overloadReasons[0]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleSelectDay(tomorrowAnalysis.tomorrowIso)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      عرض الغد
                    </button>
                    {onOpenProfileSettings && (
                      <button
                        type="button"
                        onClick={onOpenProfileSettings}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        ضبط الطاقة
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {reschedulingSuggestions.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    مهام منخفضة الأولوية مقترحة للتأجيل لتخفيف الضغط ({reschedulingSuggestions.length}):
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {reschedulingSuggestions.map((task) => {
                    const alreadyPostponed = Boolean(task.dueDate && task.dueDate >= tomorrowStr);
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800/90"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span>المدة: {task.estimatedMinutes || 30} د</span>
                            {task.dueDate && <span>الموعد: {task.dueDate}</span>}
                          </div>
                        </div>

                        {alreadyPostponed ? (
                          <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shrink-0 font-semibold">
                            مؤجلة ({task.dueDate})
                          </span>
                        ) : (
                          <button
                            onClick={() => onPostponeTask(task.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-cyan-300 hover:text-white border border-slate-700 hover:border-indigo-500 text-[11px] font-semibold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <span>تأجيل للغد</span>
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* AI Strategy & Rationale banner if recently generated */}
      {optimizationResult && (
        <div className="bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 rounded-2xl border border-cyan-800/60 p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-amber-400" />
            تحليل ورؤية التوأم الرقمي للجدول:
          </div>

          <p className="text-xs text-slate-200 leading-relaxed font-medium">
            {optimizationResult.summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-amber-400 font-bold block mb-1">استراتيجية الطاقة:</span>
              <p className="text-slate-300 text-[11px]">{optimizationResult.energyStrategy}</p>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-cyan-400 font-bold block mb-1">أولويات لا تقبل المساومة:</span>
              <ul className="text-slate-300 text-[11px] list-disc list-inside space-y-0.5">
                {optimizationResult.topPriorities?.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Manual Timeblock Add / Edit Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveBlock}
          className="bg-slate-900 rounded-2xl border border-cyan-800/60 p-5 space-y-4 shadow-xl animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              {editingBlockId ? (
                <>
                  <Edit className="w-4 h-4 text-cyan-400" />
                  <span>تعديل البلوك الزمني</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>إضافة بلوك زمني أو موعد ثابت</span>
                </>
              )}
            </h4>
            <button
              type="button"
              onClick={closeBlockForm}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">عنوان البلوك الزمني *</label>
              <input
                type="text"
                required
                placeholder="مثال: جلسة برمجة وتركيز عميق / اجتماع العميل"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">التفاصيل والأهداف من هذا البلوك</label>
              <input
                type="text"
                placeholder="تفاصيل إضافية..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">
                تاريخ الموعد (ميلادي ويُحوّل تلقائياً للهجري)
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <div className="text-xs px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-700/40 text-emerald-300 flex flex-wrap items-center gap-2">
                  <span>🕌 يوافق هجرياً:</span>
                  <span className="font-bold">{blockDateInfo.weekday}، {blockDateInfo.hijriFull}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">وقت البداية</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">وقت النهاية</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">النوع والتصنيف</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TimeBlock['category'])}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="deep_work">تركيز عميق (Deep Work)</option>
                <option value="meeting">اجتماع / تواصل</option>
                <option value="health">صحة ورياضة ووجبات</option>
                <option value="routine">روتين ومراسلات</option>
                <option value="review">مراجعة وتخطيط</option>
                <option value="personal">شخصي</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الأولوية</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TimeBlock['priority'])}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </select>
            </div>

            <div className="flex items-center gap-2 md:col-span-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFixed}
                  onChange={(e) => setIsFixed(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>موعد ثابت غير قابل للتغيير في الجدولة التلقائية</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={closeBlockForm}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md cursor-pointer"
            >
              {editingBlockId ? 'حفظ التعديلات' : 'إضافة للجدول'}
            </button>
          </div>
        </form>
      )}

      {/* Tasks Due on Selected Date */}
      {tasksDueOnSelectedDate.length > 0 && (
        <div className="bg-slate-900/75 rounded-2xl border border-slate-800 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4" />
              مهام مستحقة في {selectedDateInfo.weekday} ({selectedDateInfo.hijriShort} / {selectedDateInfo.gregorianShort})
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {tasksDueOnSelectedDate.length} مهام
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tasksDueOnSelectedDate.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 truncate">{t.title}</p>
                  <span className="text-[10px] text-slate-400">
                    {t.dueTime ? `الساعة ${t.dueTime} • ` : ''}
                    {t.estimatedMinutes || 30} دقيقة
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onStartFocus(t)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  تركيز
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Blocks Flow */}
      <div className="space-y-3">
        {sortedBlocks.length === 0 ? (
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-10 text-center space-y-2">
            <Calendar className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">
              لا توجد بلوكات مجدولة ليوم {selectedDateInfo.weekday} ({selectedDateInfo.hijriShort} / {selectedDateInfo.gregorianShort})
            </p>
            <p className="text-xs text-slate-400">
              اضغط على &quot;إضافة موعد/بلوك&quot; لجدولة نشاط في هذا التاريخ، أو عد لليوم الحالي.
            </p>
          </div>
        ) : (
          sortedBlocks.map((block) => {
            const isCompleted = block.isCompleted;
            const config = getCategoryConfig(block.category);

            // Match related task if exists
            const relatedTask = tasks.find((t) => t.id === block.relatedTaskId);

            return (
              <div
                key={block.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isCompleted
                    ? 'bg-slate-950/50 border-slate-800/60 opacity-60'
                    : `${config.bg} shadow-md hover:border-slate-600`
                }`}
              >
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  
                  {/* Time & Title Info */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    
                    {/* Completion button */}
                    <button
                      onClick={() => onToggleScheduleBlock(block.id)}
                      className="mt-0.5 sm:mt-0 text-slate-400 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                      title={isCompleted ? 'إلغاء الإكمال' : 'تحديد كمكتمل'}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    {/* Time pill */}
                    <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0 font-mono text-xs text-cyan-300 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{block.startTime} - {block.endTime}</span>
                    </div>

                    {/* Title & Desc */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`text-sm font-bold text-slate-100 ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                          {block.title}
                        </h4>
                        {block.isFixed && (
                          <span className="flex items-center gap-1 text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> موعد ثابت
                          </span>
                        )}
                        {block.date && (
                          <span className="text-[10px] bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 px-2 py-0.5 rounded">
                            {getDualDateInfo(block.date).hijriShort} • {getDualDateInfo(block.date).gregorianShort}
                          </span>
                        )}
                      </div>

                      {block.description && (
                        <p className="text-xs text-slate-300/80 mt-1 line-clamp-1">
                          {block.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Badge */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-xl border font-medium flex items-center gap-1.5 ${config.badge}`}>
                      {config.icon}
                      <span>{config.label}</span>
                    </span>

                    {/* Start Focus Button if deep work */}
                    <button
                      onClick={() => onStartFocus(relatedTask)}
                      className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer"
                      title="بدء جلسة تركيز لهذه الكتلة"
                    >
                      <Flame className="w-4 h-4" />
                    </button>

                    {onUpdateScheduleBlock && (
                      <button
                        type="button"
                        onClick={() => openEditBlockForm(block)}
                        className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 transition-all cursor-pointer"
                        title="تعديل البلوك"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteScheduleBlock(block.id)}
                      className="p-2 rounded-xl bg-slate-900/80 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 transition-all cursor-pointer"
                      title="حذف البلوك"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
