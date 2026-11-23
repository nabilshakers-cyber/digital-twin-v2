import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Edit3,
  MapPin,
  Plus,
  Repeat,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  Priority,
  RecurrenceFrequency,
  SavedLocation,
  SubTask,
  Task,
  TaskCategory,
  TaskLocationReminder,
  TaskRecurrence,
  TaskStatus,
  TaskTag,
  TaskTagColor,
} from '../types';
import { formatDistanceArabic } from '../utils/geofencing';
import { useModalScrollLock } from '../utils/modalCoordinator';
import {
  calculateNextRecurrenceDate,
  formatRecurrenceLabelAr,
  getTodayLocalISO,
  normalizeRecurrence,
  WEEKDAY_OPTIONS_AR,
  WORKWEEK_DAYS,
} from '../utils/taskRecurrence';
import {
  getTagStyleByColor,
  mergeAvailableTags,
  normalizeTagName,
  TASK_TAG_COLOR_OPTIONS,
} from '../utils/taskTags';

interface TaskEditModalProps {
  isOpen: boolean;
  taskToEdit: Task | null;
  tasks: Task[];
  savedLocations: SavedLocation[];
  locationTrackingEnabled: boolean;
  customTags: TaskTag[];
  onClose: () => void;
  onSaveNewTask: (newTask: Partial<Task>) => void;
  onUpdateTask: (updatedTask: Task) => void;
  onOpenLocationPicker?: () => void;
  newlyCreatedLocationId?: string | null;
  onCreateCustomTag?: (name: string, color?: TaskTagColor) => TaskTag | null;
  onDeleteCustomTag?: (tagId: string) => void;
}

const RECURRENCE_FREQUENCY_OPTIONS: ReadonlyArray<{
  value: RecurrenceFrequency;
  label: string;
  unitLabel: string;
}> = [
  { value: 'daily', label: 'يومي', unitLabel: 'يوم' },
  { value: 'weekly', label: 'أسبوعي', unitLabel: 'أسبوع' },
  { value: 'monthly', label: 'شهري', unitLabel: 'شهر' },
];

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  isOpen,
  taskToEdit,
  tasks,
  savedLocations,
  locationTrackingEnabled,
  customTags,
  onClose,
  onSaveNewTask,
  onUpdateTask,
  onOpenLocationPicker,
  newlyCreatedLocationId,
  onCreateCustomTag,
  onDeleteCustomTag,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState<TaskCategory>('work');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);
  const [dueDate, setDueDate] = useState<string>(getTodayLocalISO());
  const [dueTime, setDueTime] = useState<string>('');
  const [isUnclassified, setIsUnclassified] = useState(false);
  const [locationId, setLocationId] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [draftCustomTagName, setDraftCustomTagName] = useState('');
  const [draftCustomTagColor, setDraftCustomTagColor] = useState<TaskTagColor>('cyan');
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [draftSubtaskTitle, setDraftSubtaskTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);

  // Recurrence state
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('daily');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');

  useModalScrollLock('task-edit-modal', isOpen);

  useEffect(() => {
    if (!isOpen) return;
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority || 'medium');
      setCategory(taskToEdit.category || 'work');
      setStatus(taskToEdit.status || 'todo');
      setEstimatedMinutes(taskToEdit.estimatedMinutes || 30);
      setDueDate(taskToEdit.dueDate || '');
      setDueTime(taskToEdit.dueTime || '');
      setIsUnclassified(Boolean(taskToEdit.isUnclassified));
      setLocationId(
        taskToEdit.locationReminder?.enabled ? taskToEdit.locationReminder.locationId : ''
      );
      setTags(taskToEdit.tags || []);
      setSubtasks(taskToEdit.subtasks || []);

      const normRec = normalizeRecurrence(taskToEdit.recurrence);
      if (normRec) {
        setRecurrenceEnabled(true);
        setRecurrenceFrequency(normRec.frequency);
        setRecurrenceInterval(normRec.interval);
        setRecurrenceDaysOfWeek(normRec.daysOfWeek || []);
        setRecurrenceEndDate(normRec.endDate || '');
      } else {
        setRecurrenceEnabled(false);
        setRecurrenceFrequency('daily');
        setRecurrenceInterval(1);
        setRecurrenceDaysOfWeek([]);
        setRecurrenceEndDate('');
      }
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('work');
      setStatus('todo');
      setEstimatedMinutes(30);
      setDueDate(getTodayLocalISO());
      setDueTime('');
      setIsUnclassified(false);
      setLocationId('');
      setTags([]);
      setSubtasks([]);
      setRecurrenceEnabled(false);
      setRecurrenceFrequency('daily');
      setRecurrenceInterval(1);
      setRecurrenceDaysOfWeek([]);
      setRecurrenceEndDate('');
    }
    setDraftCustomTagName('');
    setDraftSubtaskTitle('');
    setTitleError(null);
  }, [isOpen, taskToEdit]);

  useEffect(() => {
    if (isOpen && newlyCreatedLocationId) {
      setLocationId(newlyCreatedLocationId);
    }
  }, [isOpen, newlyCreatedLocationId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const draftRecurrence = useMemo<TaskRecurrence | undefined>(() => {
    if (!recurrenceEnabled) return undefined;
    return normalizeRecurrence({
      enabled: true,
      frequency: recurrenceFrequency,
      interval: recurrenceInterval,
      daysOfWeek: recurrenceFrequency === 'weekly' ? recurrenceDaysOfWeek : undefined,
      endDate: recurrenceEndDate || undefined,
      seriesId: taskToEdit?.recurrence?.seriesId,
      occurrenceCount: taskToEdit?.recurrence?.occurrenceCount,
      regeneratedNextId: taskToEdit?.recurrence?.regeneratedNextId,
    });
  }, [
    recurrenceEnabled,
    recurrenceFrequency,
    recurrenceInterval,
    recurrenceDaysOfWeek,
    recurrenceEndDate,
    taskToEdit,
  ]);

  const nextPreviewDueDate = useMemo(() => {
    if (!draftRecurrence) return null;
    return calculateNextRecurrenceDate(draftRecurrence, dueDate || undefined);
  }, [draftRecurrence, dueDate]);

  if (!isOpen) return null;

  const toggleFormTag = (tagName: string) => {
    const clean = normalizeTagName(tagName);
    if (!clean) return;
    setTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === clean.toLowerCase());
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== clean.toLowerCase());
      }
      if (prev.length >= 15) return prev;
      return [...prev, clean];
    });
  };

  const handleCreateAndAssignTag = () => {
    const clean = normalizeTagName(draftCustomTagName);
    if (!clean) return;
    if (onCreateCustomTag) {
      onCreateCustomTag(clean, draftCustomTagColor);
    }
    setTags((prev) => {
      if (prev.some((t) => t.toLowerCase() === clean.toLowerCase())) return prev;
      if (prev.length >= 15) return prev;
      return [...prev, clean];
    });
    setDraftCustomTagName('');
  };

  const toggleWeekday = (dayVal: number) => {
    setRecurrenceDaysOfWeek((prev) =>
      prev.includes(dayVal)
        ? prev.filter((d) => d !== dayVal)
        : [...prev, dayVal].sort((a, b) => a - b)
    );
  };

  const handleApplyWorkWeekPreset = () => {
    const alreadyExactWorkWeek =
      recurrenceDaysOfWeek.length === WORKWEEK_DAYS.length &&
      WORKWEEK_DAYS.every((d, i) => recurrenceDaysOfWeek[i] === d);
    setRecurrenceDaysOfWeek(alreadyExactWorkWeek ? [] : [...WORKWEEK_DAYS]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('يرجى كتابة عنوان المهمة أولاً.');
      return;
    }
    setTitleError(null);

    const matchedLocation = locationId
      ? savedLocations.find((loc) => loc.id === locationId)
      : undefined;

    let builtLocationReminder: TaskLocationReminder | undefined;
    if (matchedLocation) {
      builtLocationReminder = {
        locationId: matchedLocation.id,
        locationName: matchedLocation.name,
        lat: matchedLocation.lat,
        lng: matchedLocation.lng,
        radiusMeters: matchedLocation.radiusMeters,
        enabled: true,
        triggerOn: 'arrive',
        lastTriggeredAt:
          taskToEdit?.locationReminder?.locationId === matchedLocation.id
            ? taskToEdit.locationReminder.lastTriggeredAt
            : undefined,
      };
    } else if (locationId && taskToEdit?.locationReminder?.locationId === locationId) {
      builtLocationReminder = {
        ...taskToEdit.locationReminder,
        enabled: true,
      };
    }

    const cleanedSubtasks = subtasks
      .map((st) => ({ ...st, title: st.title.trim() }))
      .filter((st) => st.title.length > 0);

    if (taskToEdit) {
      onUpdateTask({
        ...taskToEdit,
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        status,
        estimatedMinutes: Number(estimatedMinutes) || 30,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        energyRequired:
          priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium',
        isTopPriority: !isUnclassified && priority === 'high',
        isUnclassified,
        subtasks: cleanedSubtasks,
        tags,
        locationReminder: builtLocationReminder,
        recurrence: draftRecurrence,
        completedAt:
          status === 'completed'
            ? taskToEdit.completedAt || new Date().toISOString()
            : undefined,
      });
    } else {
      onSaveNewTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        status,
        estimatedMinutes: Number(estimatedMinutes) || 30,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        energyRequired:
          priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium',
        createdAt: new Date().toISOString(),
        subtasks: cleanedSubtasks,
        tags,
        isUnclassified,
        locationReminder: builtLocationReminder,
        recurrence: draftRecurrence,
      });
    }

    onClose();
  };

  const activeUnitLabel =
    RECURRENCE_FREQUENCY_OPTIONS.find((opt) => opt.value === recurrenceFrequency)
      ?.unitLabel || 'يوم';

  return (
    <div
      data-no-swipe="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-edit-modal-title"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 rounded-3xl border border-cyan-800/60 shadow-2xl overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/95 shrink-0">
          <h3
            id="task-edit-modal-title"
            className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2"
          >
            {taskToEdit ? (
              <>
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>تعديل المهمة</span>
                {taskToEdit.recurrence?.occurrenceCount &&
                  taskToEdit.recurrence.occurrenceCount > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono">
                      تكرار #{taskToEdit.recurrence.occurrenceCount}
                    </span>
                  )}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>إنشاء مهمة جديدة</span>
              </>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="إغلاق نافذة المهمة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="task-edit-modal-form"
          onSubmit={handleSubmit}
          noValidate
          className="flex-1 overflow-y-auto p-5 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">
                عنوان المهمة *
              </label>
              <input
                type="text"
                autoFocus
                placeholder="مثال: مراجعة الأهداف الأسبوعية أو قراءة ورد اليوم"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError && e.target.value.trim()) {
                    setTitleError(null);
                  }
                }}
                aria-invalid={Boolean(titleError)}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none transition-colors ${
                  titleError
                    ? 'border-rose-500/80 focus:border-rose-400'
                    : 'border-slate-800 focus:border-cyan-500'
                }`}
              />
              {titleError && (
                <p
                  role="alert"
                  className="text-xs text-rose-300 bg-rose-950/50 border border-rose-700/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-semibold"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{titleError}</span>
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">
                التفاصيل والملاحظات (اختياري)
              </label>
              <textarea
                rows={2}
                placeholder="تفاصيل إضافية أو روابط وملاحظات مساعدة..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            {/* Unclassified checkbox */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isUnclassified}
                  onChange={(e) => setIsUnclassified(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500"
                />
                <span>
                  إبقاء المهمة غير مصنفة (ليتم تصنيفها تلقائياً عبر زر «تصنيف تلقائي»)
                </span>
              </label>
            </div>

            {!isUnclassified && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">التصنيف</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TaskCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="work">عمل ومشاريع</option>
                    <option value="personal">شخصي وعائلي</option>
                    <option value="health">صحة ولياقة</option>
                    <option value="study">تعلم وتطوير</option>
                    <option value="urgent">طارئ</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">الأولوية</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="high">عاجل وهام (قصوى)</option>
                    <option value="medium">متوسط الأولوية</option>
                    <option value="low">منخفض الأولوية</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="todo">قيد الانتظار</option>
                <option value="in_progress">جاري العمل الآن</option>
                <option value="completed">مكتملة</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                الوقت المتوقع (بالدقائق)
              </label>
              <input
                type="number"
                min={5}
                max={480}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                تاريخ الاستحقاق
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                وقت الاستحقاق (للتنبيه الذكي)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Recurring Task Configuration Section */}
            <div className="md:col-span-2 pt-3 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
                      recurrenceEnabled
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">
                      المهام المتكررة (تكرار تلقائي عند الإكمال)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      تُنشأ نسخة جديدة للموعد القادم فور تحديد المهمة كمكتملة
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-toggle-task-recurrence"
                  role="switch"
                  aria-checked={recurrenceEnabled}
                  onClick={() => setRecurrenceEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    recurrenceEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      recurrenceEnabled ? '-translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {recurrenceEnabled && (
                <div className="bg-slate-950/80 border border-emerald-800/40 rounded-2xl p-3.5 space-y-3 animate-fadeIn">
                  {/* Frequency & Interval row */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-7 space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300">
                        نمط التكرار
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {RECURRENCE_FREQUENCY_OPTIONS.map((opt) => {
                          const active = recurrenceFrequency === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRecurrenceFrequency(opt.value)}
                              className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                active
                                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-600/30'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sm:col-span-5 space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300">
                        يتكرر كل
                      </label>
                      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={recurrenceInterval}
                          onChange={(e) =>
                            setRecurrenceInterval(
                              Math.max(1, Math.min(365, Number(e.target.value) || 1))
                            )
                          }
                          aria-label="فترة التكرار"
                          className="w-14 bg-transparent text-xs font-bold text-emerald-300 focus:outline-none text-center font-mono"
                        />
                        <span className="text-xs text-slate-400">{activeUnitLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Weekday Picker for Weekly Frequency */}
                  {recurrenceFrequency === 'weekly' && (
                    <div className="space-y-2 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[11px] font-semibold text-slate-300">
                          أيام الأسبوع المحددة (اختياري)
                        </label>
                        <button
                          type="button"
                          onClick={handleApplyWorkWeekPreset}
                          className="text-[11px] text-cyan-300 hover:text-cyan-200 font-semibold cursor-pointer"
                        >
                          تحديد أيام العمل (أحد - خميس)
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_OPTIONS_AR.map((day) => {
                          const selected = recurrenceDaysOfWeek.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleWeekday(day.value)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                                selected
                                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                              }`}
                            >
                              {day.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Optional End Date */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <label className="text-[11px] text-slate-300">
                        تاريخ انتهاء التكرار (اختياري):
                      </label>
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        aria-label="تاريخ انتهاء التكرار"
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      {recurrenceEndDate && (
                        <button
                          type="button"
                          onClick={() => setRecurrenceEndDate('')}
                          className="text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
                          title="مسح تاريخ الانتهاء"
                        >
                          مسح
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Recurrence Preview */}
                  {draftRecurrence && (
                    <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{formatRecurrenceLabelAr(draftRecurrence)}</span>
                      </span>
                      <span className="text-emerald-300/90 font-mono">
                        {nextPreviewDueDate
                          ? `الموعد التالي بعد الإكمال: ${nextPreviewDueDate}`
                          : 'انتهت سلسلة التكرار (بعد تاريخ الانتهاء)'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Optional Location-Based Reminder Selector */}
            <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-slate-800/70">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>التذكير عند الوصول لموقع جغرافي (اختياري)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  aria-label="اختيار موقع التذكير الجغرافي"
                  className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">بدون تذكير جغرافي</option>
                  {savedLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      عند الوصول إلى: {loc.name} (نطاق{' '}
                      {formatDistanceArabic(loc.radiusMeters)})
                    </option>
                  ))}
                  {taskToEdit?.locationReminder &&
                    !savedLocations.some(
                      (l) => l.id === taskToEdit.locationReminder?.locationId
                    ) && (
                      <option value={taskToEdit.locationReminder.locationId}>
                        عند الوصول إلى: {taskToEdit.locationReminder.locationName} (نطاق{' '}
                        {formatDistanceArabic(taskToEdit.locationReminder.radiusMeters)})
                      </option>
                    )}
                </select>

                {onOpenLocationPicker && (
                  <button
                    type="button"
                    onClick={onOpenLocationPicker}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>+ إضافة موقع جديد على الخريطة</span>
                  </button>
                )}
              </div>
              {locationId && !locationTrackingEnabled && (
                <p className="text-[11px] text-amber-300/90">
                  ملاحظة: فعّل «مراقبة الموقع» من صفحة الإشعارات ليتم تنبيهك تلقائياً فور وصولك لهذا الموقع.
                </p>
              )}
            </div>

            {/* Custom Tags / Labels Section */}
            <div className="space-y-2 md:col-span-2 pt-2 border-t border-slate-800/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" />
                  <span>الوسوم والتصنيفات المخصصة (Tags / Labels)</span>
                </label>
                {tags.length > 0 && (
                  <span className="text-[11px] text-cyan-300 font-medium">
                    تم تحديد {tags.length} وسوم
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {mergeAvailableTags(
                  [
                    ...tasks,
                    {
                      id: 'draft',
                      title: '',
                      category: 'work',
                      priority: 'medium',
                      status: 'todo',
                      energyRequired: 'medium',
                      createdAt: '',
                      tags,
                    },
                  ],
                  customTags
                ).map((tg) => {
                  const isSelected = tags.some(
                    (t) => t.toLowerCase() === tg.name.toLowerCase()
                  );
                  const style = getTagStyleByColor(tg.color);
                  const isSavedInCatalog = customTags.some((c) => c.id === tg.id);
                  return (
                    <div
                      key={tg.id}
                      className={`inline-flex items-center rounded-lg border text-xs font-semibold transition-all ${
                        isSelected
                          ? style.selectedClass
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFormTag(tg.name)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 cursor-pointer"
                      >
                        <span className={`w-2 h-2 rounded-full ${style.dotClass}`} />
                        <span>{tg.name}</span>
                      </button>
                      {isSavedInCatalog && onDeleteCustomTag && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCustomTag(tg.id);
                            setTags((prev) =>
                              prev.filter(
                                (t) => t.toLowerCase() !== tg.name.toLowerCase()
                              )
                            );
                          }}
                          className="pl-1.5 pr-1 py-1 opacity-60 hover:opacity-100 hover:text-rose-300 cursor-pointer"
                          title={`حذف وسم ${tg.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="text"
                  value={draftCustomTagName}
                  onChange={(e) => setDraftCustomTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateAndAssignTag();
                    }
                  }}
                  placeholder="أنشئ وسماً جديداً (مثل: دراسة، مشروع التخرج، عائلة)..."
                  aria-label="اسم الوسم المخصص الجديد"
                  className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <div className="flex items-center gap-1" role="group" aria-label="لون الوسم">
                  {TASK_TAG_COLOR_OPTIONS.map((cOpt) => (
                    <button
                      key={cOpt.value}
                      type="button"
                      onClick={() => setDraftCustomTagColor(cOpt.value)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-transform cursor-pointer ${cOpt.dotClass} ${
                        draftCustomTagColor === cOpt.value
                          ? 'border-white scale-110 ring-2 ring-cyan-400/50'
                          : 'border-slate-900 opacity-70 hover:opacity-100'
                      }`}
                      title={cOpt.label}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCreateAndAssignTag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة وسم</span>
                </button>
              </div>
            </div>

            {/* Subtasks inline manager */}
            <div className="space-y-2 md:col-span-2 pt-2 border-t border-slate-800/70">
              <label className="text-xs font-semibold text-slate-300 block">
                الخطوات الفرعية (اختياري — تُعاد تصفيرها تلقائياً مع كل تكرار)
              </label>
              {subtasks.length > 0 && (
                <div className="space-y-1.5">
                  {subtasks.map((st, idx) => (
                    <div key={st.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) =>
                          setSubtasks((prev) =>
                            prev.map((row, rIdx) =>
                              rIdx === idx ? { ...row, title: e.target.value } : row
                            )
                          )
                        }
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSubtasks((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                        }
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 cursor-pointer"
                        title="حذف الخطوة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="أضف خطوة فرعية..."
                  value={draftSubtaskTitle}
                  onChange={(e) => setDraftSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!draftSubtaskTitle.trim()) return;
                      setSubtasks((prev) => [
                        ...prev,
                        {
                          id: `sub-${Date.now()}`,
                          title: draftSubtaskTitle.trim(),
                          completed: false,
                        },
                      ]);
                      setDraftSubtaskTitle('');
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!draftSubtaskTitle.trim()) return;
                    setSubtasks((prev) => [
                      ...prev,
                      {
                        id: `sub-${Date.now()}`,
                        title: draftSubtaskTitle.trim(),
                        completed: false,
                      },
                    ]);
                    setDraftSubtaskTitle('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  + خطوة
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-slate-900/95 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="task-edit-modal-form"
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{taskToEdit ? 'حفظ التعديلات' : 'حفظ وإدراج المهمة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
