import React, { useState } from 'react';
import {
  Target,
  Plus,
  Trash2,
  FolderKanban,
  Calendar,
  Briefcase,
  User,
  BookOpen,
  HeartPulse,
  TrendingUp,
} from 'lucide-react';
import { LongTermGoal } from '../types';

interface LongTermGoalsPanelProps {
  goals: LongTermGoal[];
  onAddGoal: (goal: Omit<LongTermGoal, 'id'>) => void;
  onUpdateGoalProgress: (goalId: string, progress: number) => void;
  onDeleteGoal: (goalId: string) => void;
}

const GOAL_CATEGORIES: Record<
  LongTermGoal['category'],
  { label: string; colorClass: string; barClass: string; icon: React.ReactNode }
> = {
  work: {
    label: 'العمل والمشاريع',
    colorClass: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60',
    barClass: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    icon: <Briefcase className="w-3.5 h-3.5 text-cyan-400" />,
  },
  learning: {
    label: 'التعلم والتطوير',
    colorClass: 'bg-violet-950/70 text-violet-300 border-violet-800/60',
    barClass: 'bg-gradient-to-r from-violet-500 to-indigo-500',
    icon: <BookOpen className="w-3.5 h-3.5 text-violet-400" />,
  },
  health: {
    label: 'الصحة واللياقة',
    colorClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60',
    barClass: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    icon: <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />,
  },
  personal: {
    label: 'شخصي وحياتي',
    colorClass: 'bg-amber-950/70 text-amber-300 border-amber-800/60',
    barClass: 'bg-gradient-to-r from-amber-500 to-orange-500',
    icon: <User className="w-3.5 h-3.5 text-amber-400" />,
  },
};

const PROJECT_LABELS: Record<string, string> = {
  publishing: 'النشر والكتب',
  'app-dev': 'تطوير التطبيقات',
  'shaker-pastry': 'معجنات شاكر',
};

export const LongTermGoalsPanel: React.FC<LongTermGoalsPanelProps> = ({
  goals,
  onAddGoal,
  onUpdateGoalProgress,
  onDeleteGoal,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LongTermGoal['category']>('work');
  const [targetDate, setTargetDate] = useState('2026-12-31');
  const [associatedProject, setAssociatedProject] = useState('');
  const [progress, setProgress] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddGoal({
      title: title.trim(),
      category,
      progress: Math.max(0, Math.min(100, Number(progress) || 0)),
      targetDate,
      associatedProject: associatedProject.trim() || undefined,
    });

    setTitle('');
    setAssociatedProject('');
    setProgress(10);
    setIsAdding(false);
  };

  const filteredGoals =
    filterCat === 'all' ? goals : goals.filter((g) => g.category === filterCat);

  const avgProgress =
    goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0;

  return (
    <section
      aria-label="الأهداف الاستراتيجية بعيدة المدى"
      className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600/30 to-violet-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">
                الأهداف الاستراتيجية بعيدة المدى
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                متوسط التقدم {avgProgress}%
              </span>
            </div>
            <p className="text-xs text-slate-400">
              تتبع تقدم مشاريعك الكبرى واربط مهامك اليومية برؤيتك طويلة المدى
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            aria-label="تصفية الأهداف حسب الفئة"
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">كل المجالات</option>
            <option value="work">العمل والمشاريع</option>
            <option value="learning">التعلم والتطوير</option>
            <option value="health">الصحة واللياقة</option>
            <option value="personal">شخصي وحياتي</option>
          </select>

          <button
            type="button"
            id="btn-add-long-term-goal"
            onClick={() => setIsAdding((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>هدف جديد</span>
          </button>
        </div>
      </div>

      {/* Add Goal Form */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-950/80 rounded-2xl border border-indigo-800/50 p-4 space-y-3.5 animate-fadeIn"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">عنوان الهدف بعيد المدى *</label>
              <input
                type="text"
                required
                placeholder="مثال: إطلاق المنصة السحابية وتجاوز 1000 عميل"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">المجال</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LongTermGoal['category'])}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="work">العمل والمشاريع</option>
                <option value="learning">التعلم والتطوير</option>
                <option value="health">الصحة واللياقة</option>
                <option value="personal">شخصي وحياتي</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">المشروع المرتبط (اختياري)</label>
              <input
                type="text"
                placeholder="مثال: منصة التوأم الرقمي"
                value={associatedProject}
                onChange={(e) => setAssociatedProject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">التاريخ المستهدف</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                نسبة التقدم الحالية ({progress}%)
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer mt-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
            >
              حفظ الهدف
            </button>
          </div>
        </form>
      )}

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800">
          لا توجد أهداف مسجلة في هذا المجال بعد.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGoals.map((goal) => {
            const conf = GOAL_CATEGORIES[goal.category] || GOAL_CATEGORIES.work;

            return (
              <div
                key={goal.id}
                className="bg-slate-950/80 rounded-2xl border border-slate-800 hover:border-slate-700 p-4 space-y-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${conf.colorClass}`}
                      >
                        {conf.icon}
                        <span>{conf.label}</span>
                      </span>

                      {goal.associatedProject && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                          <FolderKanban className="w-3 h-3 text-cyan-400" />
                          {PROJECT_LABELS[goal.associatedProject] || goal.associatedProject}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-100 leading-snug">
                      {goal.title}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteGoal(goal.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer shrink-0"
                    title="حذف الهدف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress Bar + Interactive Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      الموعد المستهدف: <span className="font-mono text-slate-300">{goal.targetDate}</span>
                    </span>
                    <span className="font-bold text-cyan-300 flex items-center gap-1 font-mono">
                      <TrendingUp className="w-3 h-3" />
                      {goal.progress}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${conf.barClass}`}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={goal.progress}
                      onChange={(e) => onUpdateGoalProgress(goal.id, Number(e.target.value))}
                      aria-label={`تحديث نسبة التقدم للهدف ${goal.title}`}
                      className="flex-1 h-1 accent-cyan-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateGoalProgress(goal.id, Math.min(100, goal.progress + 10))
                      }
                      className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-semibold cursor-pointer"
                    >
                      +10%
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
