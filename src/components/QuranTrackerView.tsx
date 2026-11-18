import React, { useEffect, useState } from 'react';
import { Award, BookOpen, CheckCircle2, Edit3, Moon, Plus, RotateCcw, Sparkles, Sun, Trash2 } from 'lucide-react';
import { DailyAdhkarState, QuranRoutineItem } from '../types';
import {
  ADHKAR_STORAGE_KEY,
  computeNextAdhkarState,
  loadInitialAdhkarState,
} from '../utils/reminderEngine';
import { AdhkarInteractiveModal } from './AdhkarInteractiveModal';

interface Props {
  initialItems: QuranRoutineItem[];
  onToggleItem?: (id: string) => void;
  onAddItem?: (item: Omit<QuranRoutineItem, 'id'>) => void;
  onUpdateItem?: (item: QuranRoutineItem) => void;
  onDeleteItem?: (id: string) => void;
  onResetDaily?: () => void;
  adhkarState?: DailyAdhkarState;
  onToggleAdhkar?: (period: 'morning' | 'evening') => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
}

export const QuranTrackerView: React.FC<Props> = ({
  initialItems,
  onToggleItem,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onResetDaily,
  adhkarState: controlledAdhkar,
  onToggleAdhkar,
  notificationsEnabled: controlledNotifications,
  onToggleNotifications,
}) => {
  const [localItems, setLocalItems] = useState<QuranRoutineItem[]>(initialItems);
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [type, setType] = useState<QuranRoutineItem['type']>('review');
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [timeSlot, setTimeSlot] = useState('الفجر (بعد الصلاة مباشرة)');
  const [quickLink, setQuickLink] = useState('https://tarteel.ai/');
  const [streak, setStreak] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeAdhkarModal, setActiveAdhkarModal] = useState<'morning' | 'evening' | null>(null);

  const notificationsEnabled =
    controlledNotifications !== undefined ? controlledNotifications : localNotificationsEnabled;

  const [localAdhkar, setLocalAdhkar] = useState<DailyAdhkarState>(() =>
    loadInitialAdhkarState()
  );

  useEffect(() => {
    if (controlledAdhkar) return;
    try {
      localStorage.setItem(ADHKAR_STORAGE_KEY, JSON.stringify(localAdhkar));
    } catch {
      // ignore storage write errors
    }
  }, [localAdhkar, controlledAdhkar]);

  const adhkar = controlledAdhkar || localAdhkar;
  const isControlled = Boolean(onToggleItem);
  const items = isControlled ? initialItems : localItems;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const toggleItem = (id: string) => {
    if (onToggleItem) {
      onToggleItem(id);
      return;
    }
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextState = !item.completed;
          return {
            ...item,
            completed: nextState,
            streak: nextState ? item.streak + 1 : Math.max(0, item.streak - 1),
          };
        }
        return item;
      })
    );
  };

  const handleToggleAdhkar = (period: 'morning' | 'evening') => {
    const wasDone =
      period === 'morning' ? adhkar.morningCompleted : adhkar.eveningCompleted;

    if (onToggleAdhkar) {
      onToggleAdhkar(period);
    } else {
      setLocalAdhkar((prev) => computeNextAdhkarState(prev, period));
    }

    if (!wasDone) {
      showToast(
        period === 'morning'
          ? '✨ تقبّل الله منك أذكار الصباح وحفظك في يومك!'
          : '🌙 تقبّل الله منك أذكار المساء وأدام عليك السكينة!'
      );
    }
  };

  const handleEnsureAdhkarCompleted = (period: 'morning' | 'evening') => {
    const alreadyDone =
      period === 'morning' ? adhkar.morningCompleted : adhkar.eveningCompleted;
    if (!alreadyDone) {
      handleToggleAdhkar(period);
    }
  };

  const handleToggleNotifications = () => {
    const nextEnabled = !notificationsEnabled;
    if (onToggleNotifications) {
      onToggleNotifications();
    } else {
      setLocalNotificationsEnabled(nextEnabled);
    }
    showToast(
      nextEnabled
        ? 'تم تفعيل تنبيهات وإشعارات الورد بنجاح'
        : 'تم كتم تنبيهات الورد القرآني مؤقتاً'
    );
  };

  const openAddForm = () => {
    setEditingItemId(null);
    setType('review');
    setTitle('');
    setTargetAmount('');
    setTimeSlot('الفجر (بعد الصلاة مباشرة)');
    setQuickLink('https://tarteel.ai/');
    setStreak(0);
    setIsFormOpen((v) => (editingItemId ? true : !v));
  };

  const openEditForm = (item: QuranRoutineItem) => {
    setEditingItemId(item.id);
    setType(item.type);
    setTitle(item.title);
    setTargetAmount(item.targetAmount);
    setTimeSlot(item.timeSlot);
    setQuickLink(item.quickLink || 'https://tarteel.ai/');
    setStreak(item.streak);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingItemId(null);
    setTitle('');
    setTargetAmount('');
    setTimeSlot('الفجر (بعد الصلاة مباشرة)');
    setQuickLink('https://tarteel.ai/');
    setStreak(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetAmount.trim()) return;

    if (editingItemId) {
      const existing = items.find((it) => it.id === editingItemId);
      const updatedItem: QuranRoutineItem = {
        id: editingItemId,
        type,
        title: title.trim(),
        targetAmount: targetAmount.trim(),
        timeSlot: timeSlot.trim() || 'الفجر (بعد الصلاة مباشرة)',
        completed: existing?.completed ?? false,
        streak: Math.max(0, Number(streak) || 0),
        quickLink: quickLink.trim() || 'https://tarteel.ai/',
      };
      if (onUpdateItem) {
        onUpdateItem(updatedItem);
      } else {
        setLocalItems((prev) => prev.map((it) => (it.id === editingItemId ? updatedItem : it)));
      }
      showToast('تم تحديث الورد بنجاح');
    } else {
      const newItem: Omit<QuranRoutineItem, 'id'> = {
        type,
        title: title.trim(),
        targetAmount: targetAmount.trim(),
        timeSlot: timeSlot.trim() || 'الفجر (بعد الصلاة مباشرة)',
        completed: false,
        streak: Math.max(0, Number(streak) || 0),
        quickLink: quickLink.trim() || 'https://tarteel.ai/',
      };
      if (onAddItem) {
        onAddItem(newItem);
      } else {
        setLocalItems((prev) => [...prev, { id: `qr-${Date.now()}`, ...newItem }]);
      }
    }

    closeForm();
  };

  const handleDeleteLocalOrControlled = (id: string) => {
    if (onDeleteItem) {
      onDeleteItem(id);
    } else {
      setLocalItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const completedCount = items.filter((i) => i.completed).length;
  const progressPercentage =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const adhkarCompletedToday =
    (adhkar.morningCompleted ? 1 : 0) + (adhkar.eveningCompleted ? 1 : 0);
  const allAdhkarDoneToday = adhkar.morningCompleted && adhkar.eveningCompleted;

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl mb-6 relative">
      {/* تنبيه عائم عند نسخ الورد أو إتمام الأذكار */}
      {toastMessage && (
        <div className="fixed sm:absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400/40 z-50 animate-fadeIn max-w-[90vw] text-center">
          {toastMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span>📖</span> جدول تعاهد القرآن والمراجعة (مرتبط بمنصة ترتيل الذكية)
          </h3>
          <p className="text-xs text-slate-400">
            &quot;تعاهدوا هذا القرآن، فوالذي نفس محمد بيده لَهو أشد تفلّتاً من الإبل في عقلها&quot;
          </p>
        </div>

        {/* لوحة التحكم والإعدادات السريعة للتنبيهات */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="btn-quran-toggle-notifications"
            onClick={handleToggleNotifications}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              notificationsEnabled
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}
          >
            <span>🔔</span> {notificationsEnabled ? 'التنبيهات مفعلة' : 'التنبيهات معطلة'}
          </button>

          <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <span>ميزان الإنجاز:</span>
            <span className="text-sm font-mono">{progressPercentage}%</span>
          </div>

          {onResetDaily && completedCount > 0 && (
            <button
              type="button"
              onClick={onResetDaily}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
              title="بدء يوم جديد مع الحفاظ على أيام التثبيت"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>يوم جديد</span>
            </button>
          )}

          <button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة ورد</span>
          </button>
        </div>
      </div>

      {/* شريط التقدم الكلي */}
      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mb-5">
        <div
          className="bg-gradient-to-r from-emerald-600 to-cyan-400 h-full transition-all duration-700"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-950/70 rounded-xl border border-emerald-800/50 p-4 mb-4 space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-emerald-300">
              {editingItemId ? 'تعديل الورد القرآني' : 'إضافة ورد قرآني جديد'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">النوع</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuranRoutineItem['type'])}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="review">مراجعة</option>
                <option value="reading">تلاوة وقراءة</option>
                <option value="memorization">حفظ وتثبيت</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">الموعد</label>
              <input
                type="text"
                placeholder="مثال: الفجر (بعد الصلاة مباشرة)"
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
                placeholder="مثال: المراجعة اليومية الكبرى"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">القدر المستهدف *</label>
              <input
                type="text"
                required
                placeholder="مثال: حزبين من تثبيت الحفظ"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">رابط المنصة / المصحف (اختياري)</label>
              <input
                type="url"
                placeholder="https://tarteel.ai/"
                value={quickLink}
                onChange={(e) => setQuickLink(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">أيام التثبيت المتواصلة</label>
              <input
                type="number"
                min={0}
                value={streak}
                onChange={(e) => setStreak(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={closeForm}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              {editingItemId ? 'حفظ التعديلات' : 'حفظ الورد'}
            </button>
          </div>
        </form>
      )}

      {/* قائمة المهام والورود اليومية */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            لا توجد أوراد مضافة حالياً. اضغط &quot;إضافة ورد&quot; لإضافة وردك اليومي.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                item.completed
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-slate-600'
              }`}
            >
              <div
                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                onClick={() => toggleItem(item.id)}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                    item.completed
                      ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                      : 'border-slate-600 bg-slate-900'
                  }`}
                >
                  {item.completed && '✓'}
                </div>
                <div className="min-w-0">
                  <h4
                    className={`font-semibold text-sm ${
                      item.completed ? 'line-through text-emerald-300/70' : 'text-white'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-500/30">
                      {item.targetAmount}
                    </span>
                    <span className="text-slate-400">| الموعد: {item.timeSlot}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 flex-wrap">
                <span className="text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg font-mono">
                  🔥 {item.streak} أيام تثبيت
                </span>

                {/* زر الانتقال المباشر لموقع ترتيل */}
                <a
                  href={item.quickLink || 'https://tarteel.ai/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm cursor-pointer"
                  title="فتح منصة ترتيل للمراجعة والتثبيت الذكي"
                >
                  <span>🎙️</span> فتح موقع ترتيل
                </a>

                <button
                  type="button"
                  onClick={() => openEditForm(item)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="تعديل الورد"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteLocalOrControlled(item.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="حذف الورد"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* قسم أذكار اليوم (تصميم متجاوب ببطاقات جانبية وتأثيرات ذهبية عند الاكتمال) */}
      <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>🤲</span> أذكار اليوم
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              اضغط على أذكار الصباح أو المساء لقراءة الأذكار التفاعلية كاملة بتسلسل أذكاري أو التتبع السريع
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-300 flex items-center gap-1.5">
              <span>إنجاز اليوم:</span>
              <span
                className={`font-mono font-bold ${
                  allAdhkarDoneToday ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                {adhkarCompletedToday}/2
              </span>
            </div>

            <div
              id="adhkar-full-days-counter"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all duration-500 ${
                allAdhkarDoneToday
                  ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/15 border-amber-400/60 text-amber-200 shadow-md shadow-amber-500/15'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span>أيام إتمام جميع الأذكار:</span>
              <span className="text-sm font-mono font-bold text-amber-200">
                {adhkar.totalFullDaysCompleted}
              </span>
            </div>
          </div>
        </div>

        {/* بطاقتا الصباح والمساء جنباً إلى جنب */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* أذكار الصباح */}
          <div
            role="button"
            tabIndex={0}
            id="btn-adhkar-morning"
            onClick={() => setActiveAdhkarModal('morning')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveAdhkarModal('morning');
              }
            }}
            className={`group relative overflow-hidden p-4 rounded-2xl border text-right transition-all duration-500 cursor-pointer flex items-center justify-between gap-3 ${
              adhkar.morningCompleted
                ? 'bg-gradient-to-br from-amber-500/25 via-yellow-500/10 to-amber-950/35 border-amber-400/70 text-amber-100 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/30 scale-[1.01]'
                : 'bg-slate-800/60 border-slate-700/60 hover:border-amber-500/40 hover:bg-slate-800/90 text-slate-200'
            }`}
          >
            {adhkar.morningCompleted && (
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 via-yellow-300/10 to-transparent pointer-events-none" />
            )}
            <div className="relative flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 transition-all duration-500 ${
                  adhkar.morningCompleted
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-500 border-amber-300 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'bg-slate-900 border-slate-700 text-amber-400 group-hover:border-amber-500/50'
                }`}
              >
                <Sun className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h5
                  className={`font-bold text-sm transition-colors duration-300 flex items-center gap-1.5 ${
                    adhkar.morningCompleted ? 'text-amber-200' : 'text-white'
                  }`}
                >
                  <span>أذكار الصباح</span>
                  <BookOpen className="w-3.5 h-3.5 opacity-70" />
                </h5>
                <p
                  className={`text-xs mt-0.5 transition-colors duration-300 ${
                    adhkar.morningCompleted ? 'text-amber-300/90' : 'text-slate-400'
                  }`}
                >
                  {adhkar.morningCompleted && adhkar.morningCompletedAt
                    ? `أُنجزت الساعة ${adhkar.morningCompletedAt} — اضغط للمراجعة`
                    : 'اضغط لفتح الأذكار التفاعلية كاملة'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleAdhkar('morning');
              }}
              title={
                adhkar.morningCompleted
                  ? 'إلغاء تحديد الاكتمال السريع'
                  : 'تحديد كمكتملة مباشرة'
              }
              className={`relative px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 border transition-all duration-500 cursor-pointer ${
                adhkar.morningCompleted
                  ? 'bg-amber-400/20 border-amber-300/60 text-amber-200 shadow-inner hover:bg-amber-400/30'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-200'
              }`}
            >
              {adhkar.morningCompleted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>مكتملة ✨</span>
                </>
              ) : (
                <span>إتمام</span>
              )}
            </button>
          </div>

          {/* أذكار المساء */}
          <div
            role="button"
            tabIndex={0}
            id="btn-adhkar-evening"
            onClick={() => setActiveAdhkarModal('evening')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveAdhkarModal('evening');
              }
            }}
            className={`group relative overflow-hidden p-4 rounded-2xl border text-right transition-all duration-500 cursor-pointer flex items-center justify-between gap-3 ${
              adhkar.eveningCompleted
                ? 'bg-gradient-to-br from-amber-500/25 via-yellow-500/10 to-amber-950/35 border-amber-400/70 text-amber-100 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/30 scale-[1.01]'
                : 'bg-slate-800/60 border-slate-700/60 hover:border-amber-500/40 hover:bg-slate-800/90 text-slate-200'
            }`}
          >
            {adhkar.eveningCompleted && (
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 via-yellow-300/10 to-transparent pointer-events-none" />
            )}
            <div className="relative flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 transition-all duration-500 ${
                  adhkar.eveningCompleted
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-500 border-amber-300 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'bg-slate-900 border-slate-700 text-indigo-400 group-hover:border-amber-500/50'
                }`}
              >
                <Moon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h5
                  className={`font-bold text-sm transition-colors duration-300 flex items-center gap-1.5 ${
                    adhkar.eveningCompleted ? 'text-amber-200' : 'text-white'
                  }`}
                >
                  <span>أذكار المساء</span>
                  <BookOpen className="w-3.5 h-3.5 opacity-70" />
                </h5>
                <p
                  className={`text-xs mt-0.5 transition-colors duration-300 ${
                    adhkar.eveningCompleted ? 'text-amber-300/90' : 'text-slate-400'
                  }`}
                >
                  {adhkar.eveningCompleted && adhkar.eveningCompletedAt
                    ? `أُنجزت الساعة ${adhkar.eveningCompletedAt} — اضغط للمراجعة`
                    : 'اضغط لفتح الأذكار التفاعلية كاملة'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleAdhkar('evening');
              }}
              title={
                adhkar.eveningCompleted
                  ? 'إلغاء تحديد الاكتمال السريع'
                  : 'تحديد كمكتملة مباشرة'
              }
              className={`relative px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 border transition-all duration-500 cursor-pointer ${
                adhkar.eveningCompleted
                  ? 'bg-amber-400/20 border-amber-300/60 text-amber-200 shadow-inner hover:bg-amber-400/30'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-200'
              }`}
            >
              {adhkar.eveningCompleted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>مكتملة ✨</span>
                </>
              ) : (
                <span>إتمام</span>
              )}
            </button>
          </div>
        </div>

        {allAdhkarDoneToday && (
          <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-emerald-500/10 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2 shadow-md shadow-amber-500/5 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              بارك الله لك! أتممت أذكار الصباح والمساء كاملة اليوم، وتم تسجيل هذا اليوم في سجل الإنجاز الذهبي.
            </span>
          </div>
        )}
      </div>

      {/* نافذة الأذكار التفاعلية الكاملة (مرتبة كتطبيق أذكاري) */}
      <AdhkarInteractiveModal
        isOpen={activeAdhkarModal !== null}
        period={activeAdhkarModal}
        isPeriodCompleted={
          activeAdhkarModal === 'morning'
            ? adhkar.morningCompleted
            : activeAdhkarModal === 'evening'
            ? adhkar.eveningCompleted
            : false
        }
        onClose={() => setActiveAdhkarModal(null)}
        onCompletePeriod={handleEnsureAdhkarCompleted}
      />
    </div>
  );
};
