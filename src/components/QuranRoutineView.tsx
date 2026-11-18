import React, { useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { QuranRoutineItem } from '../types';

interface QuranRoutineViewProps {
  items: QuranRoutineItem[];
  onToggleItem: (id: string) => void;
  onAddItem?: (item: Omit<QuranRoutineItem, 'id'>) => void;
  onDeleteItem?: (id: string) => void;
  onResetDaily?: () => void;
}

const TYPE_CONFIG: Record<
  QuranRoutineItem['type'],
  { label: string; badgeClass: string }
> = {
  review: {
    label: 'مراجعة',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  reading: {
    label: 'تلاوة وورد',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  memorization: {
    label: 'حفظ وتثبيت',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  },
};

export const QuranRoutineView: React.FC<QuranRoutineViewProps> = ({
  items,
  onToggleItem,
  onAddItem,
  onDeleteItem,
  onResetDaily,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [type, setType] = useState<QuranRoutineItem['type']>('review');
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [timeSlot, setTimeSlot] = useState('بعد صلاة الفجر');

  const completedCount = items.filter((item) => item.completed).length;
  const progressPercent =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const maxStreak = items.reduce((max, item) => Math.max(max, item.streak), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetAmount.trim() || !onAddItem) return;

    onAddItem({
      type,
      title: title.trim(),
      targetAmount: targetAmount.trim(),
      timeSlot: timeSlot.trim() || 'بعد صلاة الفجر',
      completed: false,
      streak: 0,
    });

    setTitle('');
    setTargetAmount('');
    setTimeSlot('بعد صلاة الفجر');
    setIsAdding(false);
  };

  return (
    <section
      aria-label="الورد والروتين القرآني اليومي"
      className="bg-gradient-to-br from-slate-900 via-[#0d1924] to-slate-900 border border-emerald-900/50 rounded-2xl p-5 shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <BookOpenCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white">
                الورد والروتين القرآني اليومي
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                {completedCount} من {items.length} مكتمل ({progressPercent}%)
              </span>
              {maxStreak > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/50">
                  <Flame className="w-3 h-3 text-amber-400" />
                  أطول استمرارية: {maxStreak} يوم
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تنظيم المراجعة والتلاوة والحفظ في الأوقات المباركة مع تتبع الاستمرارية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {onResetDaily && completedCount > 0 && (
            <button
              type="button"
              onClick={onResetDaily}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
              title="بدء يوم جديد مع الحفاظ على عداد الاستمرارية"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>يوم جديد</span>
            </button>
          )}
          {onAddItem && (
            <button
              type="button"
              onClick={() => setIsAdding((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة ورد</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Add Form */}
      {isAdding && onAddItem && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-950/70 rounded-xl border border-emerald-800/50 p-4 space-y-3 animate-fadeIn"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">النوع</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuranRoutineItem['type'])}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="review">مراجعة</option>
                <option value="reading">تلاوة وورد</option>
                <option value="memorization">حفظ وتثبيت</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">الوقت المقترح</label>
              <input
                type="text"
                placeholder="مثال: بعد صلاة الفجر"
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">عنوان الورد *</label>
              <input
                type="text"
                required
                placeholder="مثال: مراجعة الجزء الأول"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">المقدار المستهدف *</label>
              <input
                type="text"
                required
                placeholder="مثال: حزب واحد أو سورة البقرة - آل عمران"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              حفظ الورد
            </button>
          </div>
        </form>
      )}

      {/* Items List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const conf = TYPE_CONFIG[item.type] || TYPE_CONFIG.reading;

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                item.completed
                  ? 'bg-emerald-950/25 border-emerald-700/50'
                  : 'bg-slate-800/60 border-slate-700/60 hover:border-emerald-700/50'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${conf.badgeClass}`}
                  >
                    {conf.label}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-900/90 text-amber-300 border border-slate-700/70 font-mono">
                      <Flame className="w-3 h-3 text-amber-400" />
                      {item.streak} يوم
                    </span>
                    {onDeleteItem && (
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-900/70 transition-colors cursor-pointer"
                        title="حذف الورد"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h4
                    className={`text-sm font-bold ${
                      item.completed ? 'line-through text-emerald-200/70' : 'text-slate-100'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">{item.targetAmount}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-700/50">
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  {item.timeSlot}
                </span>

                <button
                  type="button"
                  onClick={() => onToggleItem(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    item.completed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-900 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700 hover:border-emerald-500'
                  }`}
                >
                  {item.completed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تم الإنجاز</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5" />
                      <span>إتمام</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
