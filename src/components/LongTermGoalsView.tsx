import React, { useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { LongTermGoal } from '../types';

interface Props {
  goals: LongTermGoal[];
  onAddGoal?: (goal: Omit<LongTermGoal, 'id'>) => void;
  onUpdateGoal?: (goal: LongTermGoal) => void;
  onUpdateGoalProgress?: (goalId: string, progress: number) => void;
  onDeleteGoal?: (goalId: string) => void;
}

const PROJECT_LABELS: Record<string, string> = {
  publishing: 'مشروع معتمد • النشر والكتب',
  'app-dev': 'مشروع معتمد • تطوير التطبيقات',
  'shaker-pastry': 'مشروع معتمد • معجنات شاكر',
};

export const LongTermGoalsView: React.FC<Props> = ({
  goals,
  onAddGoal,
  onUpdateGoal,
  onUpdateGoalProgress,
  onDeleteGoal,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LongTermGoal['category']>('work');
  const [targetDate, setTargetDate] = useState('2026-12-31');
  const [associatedProject, setAssociatedProject] = useState('');
  const [progress, setProgress] = useState(10);

  const openAddForm = () => {
    setEditingGoalId(null);
    setTitle('');
    setCategory('work');
    setTargetDate('2026-12-31');
    setAssociatedProject('');
    setProgress(10);
    setIsFormOpen((v) => (editingGoalId ? true : !v));
  };

  const openEditForm = (goal: LongTermGoal) => {
    setEditingGoalId(goal.id);
    setTitle(goal.title);
    setCategory(goal.category);
    setTargetDate(goal.targetDate);
    setAssociatedProject(goal.associatedProject || '');
    setProgress(goal.progress);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingGoalId(null);
    setTitle('');
    setAssociatedProject('');
    setProgress(10);
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'work':
        return (
          <span className="text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-500/30">
            عمل ومشاريع
          </span>
        );
      case 'personal':
        return (
          <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30">
            شخصي
          </span>
        );
      case 'learning':
        return (
          <span className="text-xs px-2.5 py-1 bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-500/30">
            تعلم
          </span>
        );
      case 'health':
        return (
          <span className="text-xs px-2.5 py-1 bg-teal-500/20 text-teal-300 rounded-md border border-teal-500/30">
            صحة
          </span>
        );
      default:
        return (
          <span className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded-md">
            عام
          </span>
        );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      category,
      progress: Math.max(0, Math.min(100, Number(progress) || 0)),
      targetDate,
      associatedProject: associatedProject.trim() || undefined,
    };

    if (editingGoalId && onUpdateGoal) {
      onUpdateGoal({
        id: editingGoalId,
        ...payload,
      });
    } else if (onAddGoal) {
      onAddGoal(payload);
    }

    closeForm();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🎯</span> الأهداف والمشاريع طويلة المدى
        </h3>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">متابعة الأداء الإستراتيجي</span>
          {onAddGoal && (
            <button
              type="button"
              id="btn-add-long-term-goal"
              onClick={openAddForm}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>هدف جديد</span>
            </button>
          )}
        </div>
      </div>

      {isFormOpen && (onAddGoal || onUpdateGoal) && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/70 rounded-xl border border-indigo-500/30 p-4 mb-4 space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
            <span className="text-xs font-bold text-indigo-300">
              {editingGoalId ? 'تعديل الهدف الإستراتيجي' : 'إضافة هدف جديد'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-300">عنوان الهدف *</label>
              <input
                type="text"
                required
                placeholder="مثال: إطلاق سلسلة كتب تعليمية جديدة"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">التصنيف</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LongTermGoal['category'])}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="work">عمل ومشاريع</option>
                <option value="personal">شخصي</option>
                <option value="learning">تعلم</option>
                <option value="health">صحة</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">المشروع المرتبط (اختياري)</label>
              <input
                type="text"
                placeholder="مثال: publishing"
                value={associatedProject}
                onChange={(e) => setAssociatedProject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">الموعد المستهدف</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                نسبة التقدم ({progress}%)
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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/60">
            <button
              type="button"
              onClick={closeForm}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
            >
              {editingGoalId ? 'حفظ التعديلات' : 'حفظ الهدف'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {goals.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 bg-slate-800/40 rounded-xl border border-slate-800">
            لا توجد أهداف طويلة المدى مسجلة حالياً.
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <span className="font-semibold text-slate-100 text-sm sm:text-base">
                  {goal.title}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {getCategoryBadge(goal.category)}
                  <span className="text-xs px-2 py-1 bg-slate-700/80 text-slate-300 rounded-md font-mono">
                    {goal.progress}%
                  </span>
                  {onUpdateGoal && (
                    <button
                      type="button"
                      onClick={() => openEditForm(goal)}
                      className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-700/70 transition-colors cursor-pointer"
                      title="تعديل الهدف"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDeleteGoal && (
                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-700/70 transition-colors cursor-pointer"
                      title="حذف الهدف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* شريط التقدم */}
              <div className="w-full bg-slate-700/60 h-2.5 rounded-full overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 h-full rounded-full transition-all duration-700"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2 mt-2 text-xs text-slate-400">
                <span>
                  الموعد المستهدف:{' '}
                  <strong className="text-slate-300 font-mono">{goal.targetDate}</strong>
                </span>
                <div className="flex items-center gap-3">
                  {goal.associatedProject && (
                    <span className="text-indigo-400/95">
                      {PROJECT_LABELS[goal.associatedProject] || `مشروع معتمد • ${goal.associatedProject}`}
                    </span>
                  )}
                  {onUpdateGoalProgress && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={goal.progress}
                        onChange={(e) => onUpdateGoalProgress(goal.id, Number(e.target.value))}
                        aria-label={`تحديث التقدم للهدف ${goal.title}`}
                        className="w-20 h-1 accent-cyan-400 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateGoalProgress(goal.id, Math.min(100, goal.progress + 5))
                        }
                        className="px-1.5 py-0.5 rounded bg-slate-700/80 hover:bg-slate-700 text-cyan-300 text-[10px] font-mono cursor-pointer"
                      >
                        +5%
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
