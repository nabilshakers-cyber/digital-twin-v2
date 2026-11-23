import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  Flame,
  Layers,
  Plus,
  Repeat,
  Tag,
  Trash2,
  X,
  MapPin,
} from 'lucide-react';
import {
  Priority,
  RecurrenceFrequency,
  SavedLocation,
  Task,
  TaskCategory,
  TaskRecurrence,
  TaskStatus,
  TaskLocationReminder,
  TaskTag,
  TaskTagColor,
} from '../types';
import { normalizeRecurrence } from '../utils/taskRecurrence';
import { getTagStyleForName, mergeAvailableTags, normalizeTagName } from '../utils/taskTags';

export type SwipeOpenSide = 'left' | 'right';

interface SwipeableTaskCardProps {
  task: Task;
  isOpen: boolean;
  openSide: SwipeOpenSide;
  onOpenSwipe: (side: SwipeOpenSide) => void;
  onCloseSwipe: () => void;
  isEditingInline: boolean;
  onStartInlineEdit: () => void;
  onOpenFullEditModal?: () => void;
  onCancelInlineEdit: () => void;
  onSaveInlineEdit: (updatedTask: Task) => void;
  onChangePriority: (priority: Priority) => void;
  onDelete: () => void;
  compact?: boolean;
  savedLocations?: SavedLocation[];
  customTags?: TaskTag[];
  onCreateCustomTag?: (name: string, color?: TaskTagColor) => TaskTag | null;
  wrapperClassName: string;
  foregroundClassName?: string;
  children: React.ReactNode;
}

type DragVisualState =
  | 'idle'
  | 'peek-left'
  | 'pull-left'
  | 'peek-right'
  | 'pull-right'
  | 'open-left'
  | 'open-right';

const PRIORITY_OPTIONS: ReadonlyArray<{
  value: Priority;
  label: string;
  activeClass: string;
  inactiveClass: string;
}> = [
  {
    value: 'high',
    label: 'عاجل',
    activeClass: 'bg-rose-600 text-white border-rose-400 shadow-sm shadow-rose-600/30',
    inactiveClass:
      'bg-rose-950/80 text-rose-300 border-rose-800/70 hover:bg-rose-900/90',
  },
  {
    value: 'medium',
    label: 'متوسط',
    activeClass: 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm shadow-amber-500/30',
    inactiveClass:
      'bg-amber-950/80 text-amber-300 border-amber-800/70 hover:bg-amber-900/90',
  },
  {
    value: 'low',
    label: 'منخفض',
    activeClass: 'bg-slate-600 text-white border-slate-400 shadow-sm',
    inactiveClass:
      'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700',
  },
];

function isInteractiveSwipeChild(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, option, label, [data-swipe-ignore="true"]'
    )
  );
}

export const SwipeableTaskCard: React.FC<SwipeableTaskCardProps> = ({
  task,
  isOpen,
  openSide,
  onOpenSwipe,
  onCloseSwipe,
  isEditingInline,
  onStartInlineEdit,
  onOpenFullEditModal,
  onCancelInlineEdit,
  onSaveInlineEdit,
  onChangePriority,
  onDelete,
  compact = false,
  savedLocations = [],
  customTags = [],
  onCreateCustomTag,
  wrapperClassName,
  foregroundClassName = '',
  children,
}) => {
  const [dragVisual, setDragVisual] = useState<DragVisualState>('idle');

  // Inline edit form state
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDescription, setDraftDescription] = useState(task.description || '');
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority);
  const [draftCategory, setDraftCategory] = useState<TaskCategory>(task.category);
  const [draftStatus, setDraftStatus] = useState<TaskStatus>(task.status);
  const [draftMinutes, setDraftMinutes] = useState<number>(task.estimatedMinutes || 30);
  const [draftDueDate, setDraftDueDate] = useState<string>(task.dueDate || '');
  const [draftDueTime, setDraftDueTime] = useState<string>(task.dueTime || '');
  const [draftLocationId, setDraftLocationId] = useState<string>(
    task.locationReminder?.enabled ? task.locationReminder.locationId : ''
  );
  const [draftRecurrenceFreq, setDraftRecurrenceFreq] = useState<'none' | RecurrenceFrequency>(
    task.recurrence?.enabled ? task.recurrence.frequency : 'none'
  );
  const [draftTags, setDraftTags] = useState<string[]>(task.tags || []);
  const [inlineNewTag, setInlineNewTag] = useState<string>('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditingInline) {
      setDraftTitle(task.title);
      setDraftDescription(task.description || '');
      setDraftPriority(task.priority);
      setDraftCategory(task.category);
      setDraftStatus(task.status);
      setDraftMinutes(task.estimatedMinutes || 30);
      setDraftDueDate(task.dueDate || '');
      setDraftDueTime(task.dueTime || '');
      setDraftLocationId(
        task.locationReminder?.enabled ? task.locationReminder.locationId : ''
      );
      setDraftRecurrenceFreq(
        task.recurrence?.enabled ? task.recurrence.frequency : 'none'
      );
      setDraftTags(task.tags || []);
      setInlineNewTag('');
      setInlineError(null);
    }
  }, [isEditingInline, task]);

  const toggleDraftTag = (tagName: string) => {
    const clean = normalizeTagName(tagName);
    if (!clean) return;
    setDraftTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === clean.toLowerCase());
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== clean.toLowerCase());
      }
      if (prev.length >= 15) return prev;
      return [...prev, clean];
    });
  };

  const handleAddInlineTag = () => {
    const clean = normalizeTagName(inlineNewTag);
    if (!clean) return;
    if (onCreateCustomTag) {
      onCreateCustomTag(clean);
    }
    setDraftTags((prev) => {
      if (prev.some((t) => t.toLowerCase() === clean.toLowerCase())) return prev;
      if (prev.length >= 15) return prev;
      return [...prev, clean];
    });
    setInlineNewTag('');
  };

  const gestureRef = useRef<{
    active: boolean;
    isMouse: boolean;
    startX: number;
    startY: number;
    lockedAxis: 'horizontal' | 'vertical' | null;
    wasOpen: boolean;
    initialSide: SwipeOpenSide;
  } | null>(null);

  const suppressNextClickRef = useRef(false);

  const resolveVisualForDrag = (
    dx: number,
    wasOpen: boolean,
    initialSide: SwipeOpenSide
  ): DragVisualState => {
    if (wasOpen) {
      if (initialSide === 'left') {
        return dx >= 26 ? 'idle' : 'open-left';
      }
      return dx <= -26 ? 'idle' : 'open-right';
    }

    if (dx <= -44) return 'pull-left';
    if (dx <= -12) return 'peek-left';
    if (dx >= 44) return 'pull-right';
    if (dx >= 12) return 'peek-right';
    return 'idle';
  };

  const finishGesture = (dx: number, dy: number) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    setDragVisual('idle');

    if (!g || g.lockedAxis !== 'horizontal') {
      return;
    }

    if (Math.abs(dx) > 10) {
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 80);
    }

    const strongHorizontal = Math.abs(dx) > Math.abs(dy) * 1.1;
    if (!strongHorizontal) return;

    if (g.wasOpen) {
      if (
        (g.initialSide === 'left' && dx >= 26) ||
        (g.initialSide === 'right' && dx <= -26)
      ) {
        onCloseSwipe();
      }
      return;
    }

    if (dx <= -44) {
      onOpenSwipe('left');
    } else if (dx >= 44) {
      onOpenSwipe('right');
    }
  };

  // Mouse drag listeners attached only while dragging with mouse
  useEffect(() => {
    const handleWindowMouseMove = (ev: MouseEvent) => {
      const g = gestureRef.current;
      if (!g || !g.active || !g.isMouse) return;

      const dx = ev.clientX - g.startX;
      const dy = ev.clientY - g.startY;

      if (!g.lockedAxis) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          g.lockedAxis = 'vertical';
          setDragVisual('idle');
          return;
        }
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.1) {
          g.lockedAxis = 'horizontal';
        } else {
          return;
        }
      }

      if (g.lockedAxis === 'horizontal') {
        setDragVisual(resolveVisualForDrag(dx, g.wasOpen, g.initialSide));
      }
    };

    const handleWindowMouseUp = (ev: MouseEvent) => {
      const g = gestureRef.current;
      if (!g || !g.active || !g.isMouse) return;
      const dx = ev.clientX - g.startX;
      const dy = ev.clientY - g.startY;
      finishGesture(dx, dy);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isEditingInline || e.touches.length !== 1) return;
    if (isInteractiveSwipeChild(e.target)) return;
    const t = e.touches[0];
    gestureRef.current = {
      active: true,
      isMouse: false,
      startX: t.clientX,
      startY: t.clientY,
      lockedAxis: null,
      wasOpen: isOpen,
      initialSide: openSide,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || !g.active || g.isMouse || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;

    if (!g.lockedAxis) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
        g.lockedAxis = 'vertical';
        setDragVisual('idle');
        return;
      }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        g.lockedAxis = 'horizontal';
      } else {
        return;
      }
    }

    if (g.lockedAxis === 'horizontal') {
      e.stopPropagation();
      setDragVisual(resolveVisualForDrag(dx, g.wasOpen, g.initialSide));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || !g.active || g.isMouse) return;
    const t = e.changedTouches[0];
    const dx = t ? t.clientX - g.startX : 0;
    const dy = t ? t.clientY - g.startY : 0;
    finishGesture(dx, dy);
  };

  const handleTouchCancel = () => {
    gestureRef.current = null;
    setDragVisual('idle');
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditingInline || e.button !== 0) return;
    if (isInteractiveSwipeChild(e.target)) return;
    gestureRef.current = {
      active: true,
      isMouse: true,
      startX: e.clientX,
      startY: e.clientY,
      lockedAxis: null,
      wasOpen: isOpen,
      initialSide: openSide,
    };
  };

  const effectiveVisual: DragVisualState = isEditingInline
    ? 'idle'
    : dragVisual !== 'idle'
    ? dragVisual
    : isOpen
    ? openSide === 'left'
      ? 'open-left'
      : 'open-right'
    : 'idle';

  const activeTraySide: SwipeOpenSide =
    effectiveVisual === 'peek-right' ||
    effectiveVisual === 'pull-right' ||
    effectiveVisual === 'open-right'
      ? 'right'
      : 'left';

  const isTrayVisible = !isEditingInline && effectiveVisual !== 'idle';

  const translateClass = (() => {
    switch (effectiveVisual) {
      case 'peek-left':
        return '-translate-x-8';
      case 'pull-left':
        return '-translate-x-24';
      case 'open-left':
        return compact ? '-translate-x-44' : '-translate-x-56';
      case 'peek-right':
        return 'translate-x-8';
      case 'pull-right':
        return 'translate-x-24';
      case 'open-right':
        return compact ? 'translate-x-44' : 'translate-x-56';
      default:
        return 'translate-x-0';
    }
  })();

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim()) {
      setInlineError('يرجى كتابة عنوان المهمة أولاً.');
      return;
    }
    setInlineError(null);

    let nextLocationReminder: TaskLocationReminder | undefined;
    if (draftLocationId) {
      const matched = savedLocations.find((loc) => loc.id === draftLocationId);
      if (matched) {
        nextLocationReminder = {
          locationId: matched.id,
          locationName: matched.name,
          lat: matched.lat,
          lng: matched.lng,
          radiusMeters: matched.radiusMeters,
          enabled: true,
          triggerOn: 'arrive',
          lastTriggeredAt: task.locationReminder?.lastTriggeredAt,
        };
      } else if (task.locationReminder && task.locationReminder.locationId === draftLocationId) {
        nextLocationReminder = {
          ...task.locationReminder,
          enabled: true,
        };
      }
    }

    const nextRecurrence: TaskRecurrence | undefined =
      draftRecurrenceFreq === 'none'
        ? undefined
        : normalizeRecurrence({
            ...(task.recurrence?.enabled ? task.recurrence : {}),
            enabled: true,
            frequency: draftRecurrenceFreq,
            interval:
              task.recurrence?.enabled && task.recurrence.frequency === draftRecurrenceFreq
                ? task.recurrence.interval || 1
                : 1,
            daysOfWeek:
              draftRecurrenceFreq === 'weekly' ? task.recurrence?.daysOfWeek : undefined,
          });

    onSaveInlineEdit({
      ...task,
      title: draftTitle.trim(),
      description: draftDescription.trim(),
      priority: draftPriority,
      category: draftCategory,
      status: draftStatus,
      estimatedMinutes: Number(draftMinutes) || 30,
      dueDate: draftDueDate || undefined,
      dueTime: draftDueTime || undefined,
      energyRequired:
        draftPriority === 'high' ? 'high' : draftPriority === 'low' ? 'low' : 'medium',
      isTopPriority: !task.isUnclassified && draftPriority === 'high',
      isUnclassified: false,
      tags: draftTags,
      locationReminder: nextLocationReminder,
      recurrence: nextRecurrence,
      completedAt:
        draftStatus === 'completed'
          ? task.completedAt || new Date().toISOString()
          : undefined,
    });
  };

  return (
    <div
      data-no-swipe="true"
      className={`relative overflow-hidden ${wrapperClassName}`}
    >
      {/* Revealed Swipe Actions Tray */}
      {isTrayVisible && (
        <div
          data-swipe-ignore="true"
          className={`absolute inset-y-0 ${
            activeTraySide === 'left' ? 'right-0' : 'left-0'
          } ${
            compact ? 'w-44 p-1.5 gap-1' : 'w-56 p-2 gap-1.5'
          } bg-slate-950/95 flex items-stretch z-0`}
        >
          {/* Quick Inline Edit */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCloseSwipe();
              onStartInlineEdit();
            }}
            className="flex-1 min-w-0 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white flex flex-col items-center justify-center gap-1 px-1.5 transition-colors cursor-pointer"
            title="تعديل المهمة مباشرة"
          >
            <Edit3 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span className={compact ? 'text-[10px] font-bold' : 'text-[11px] font-bold'}>
              تعديل
            </span>
          </button>

          {/* Quick Priority Selector */}
          <div
            className={`${
              compact ? 'w-16' : 'w-24'
            } shrink-0 flex flex-col justify-center gap-1`}
          >
            {!compact && (
              <span className="text-[9px] text-slate-400 font-semibold text-center leading-none flex items-center justify-center gap-0.5">
                <Layers className="w-2.5 h-2.5 text-amber-400" />
                <span>الأولوية</span>
              </span>
            )}
            {PRIORITY_OPTIONS.map((opt) => {
              const isSelected = task.priority === opt.value && !task.isUnclassified;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangePriority(opt.value);
                    onCloseSwipe();
                  }}
                  className={`w-full rounded-lg border px-1.5 ${
                    compact ? 'py-0.5 text-[9px]' : 'py-0.5 text-[10px]'
                  } font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    isSelected ? opt.activeClass : opt.inactiveClass
                  }`}
                  title={`تعيين الأولوية إلى ${opt.label}`}
                >
                  {opt.value === 'high' && !compact && <Flame className="w-2.5 h-2.5" />}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCloseSwipe();
              onDelete();
            }}
            className="flex-1 min-w-0 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white flex flex-col items-center justify-center gap-1 px-1.5 transition-colors cursor-pointer"
            title="حذف المهمة"
          >
            <Trash2 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span className={compact ? 'text-[10px] font-bold' : 'text-[11px] font-bold'}>
              حذف
            </span>
          </button>
        </div>
      )}

      {/* Foreground Card Content (slides horizontally or transforms into inline editor) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onClickCapture={(e) => {
          if (suppressNextClickRef.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onClick={(e) => {
          if (isOpen && !isEditingInline) {
            e.stopPropagation();
            onCloseSwipe();
          }
        }}
        className={`relative z-10 touch-pan-y transition-transform duration-200 ease-out ${
          isEditingInline ? 'select-text' : 'select-none'
        } ${translateClass} ${foregroundClassName}`}
      >
        {isEditingInline ? (
          <form
            onSubmit={handleInlineSubmit}
            noValidate
            data-swipe-ignore="true"
            className={`${compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'} bg-slate-900/95`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل سريع داخل البطاقة</span>
              </span>
              <div className="flex items-center gap-1.5">
                {onOpenFullEditModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onCancelInlineEdit();
                      onOpenFullEditModal();
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[10px] font-semibold cursor-pointer"
                  >
                    النافذة الكاملة
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCancelInlineEdit}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                  title="إلغاء التعديل"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                autoFocus
                value={draftTitle}
                onChange={(e) => {
                  setDraftTitle(e.target.value);
                  if (inlineError && e.target.value.trim()) {
                    setInlineError(null);
                  }
                }}
                placeholder="عنوان المهمة..."
                aria-label="عنوان المهمة"
                className={`w-full bg-slate-950 border rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none ${
                  inlineError
                    ? 'border-rose-500/80 focus:border-rose-400'
                    : 'border-slate-700 focus:border-cyan-500'
                }`}
              />
              {inlineError && (
                <p
                  role="alert"
                  className="text-[11px] text-rose-300 bg-rose-950/60 border border-rose-700/60 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold"
                >
                  <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>{inlineError}</span>
                </p>
              )}
            </div>

            {!compact && (
              <textarea
                rows={2}
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="ملاحظات إضافية (اختياري)..."
                aria-label="تفاصيل المهمة"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
              />
            )}

            {/* Quick Priority Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">الأولوية:</span>
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraftPriority(opt.value)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                    draftPriority === opt.value ? opt.activeClass : opt.inactiveClass
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value as TaskCategory)}
                aria-label="التصنيف"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="work">عمل ومشاريع</option>
                <option value="personal">شخصي وعائلي</option>
                <option value="health">صحة ولياقة</option>
                <option value="study">تعلم وتطوير</option>
                <option value="urgent">طارئ</option>
              </select>

              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as TaskStatus)}
                aria-label="الحالة"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="todo">قيد الانتظار</option>
                <option value="in_progress">جاري العمل</option>
                <option value="completed">مكتملة</option>
              </select>

              {!compact && (
                <>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={draftMinutes}
                    onChange={(e) => setDraftMinutes(Number(e.target.value))}
                    aria-label="المدة بالدقائق"
                    placeholder="دقائق"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                  />

                  <input
                    type="time"
                    value={draftDueTime}
                    onChange={(e) => setDraftDueTime(e.target.value)}
                    aria-label="وقت الاستحقاق"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </>
              )}
            </div>

            {!compact && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-400 shrink-0">التاريخ:</label>
                  <input
                    type="date"
                    value={draftDueDate}
                    onChange={(e) => setDraftDueDate(e.target.value)}
                    aria-label="تاريخ الاستحقاق"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {(savedLocations.length > 0 || task.locationReminder) && (
                  <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <select
                      value={draftLocationId}
                      onChange={(e) => setDraftLocationId(e.target.value)}
                      aria-label="تذكير الموقع الجغرافي"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">بدون تذكير موقع</option>
                      {savedLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          عند الوصول إلى: {loc.name} ({loc.radiusMeters}م)
                        </option>
                      ))}
                      {task.locationReminder &&
                        !savedLocations.some((l) => l.id === task.locationReminder?.locationId) && (
                          <option value={task.locationReminder.locationId}>
                            عند الوصول إلى: {task.locationReminder.locationName} (
                            {task.locationReminder.radiusMeters}م)
                          </option>
                        )}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-1.5 min-w-[160px]">
                  <Repeat className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <select
                    value={draftRecurrenceFreq}
                    onChange={(e) =>
                      setDraftRecurrenceFreq(e.target.value as 'none' | RecurrenceFrequency)
                    }
                    aria-label="التكرار التلقائي"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="none">بدون تكرار</option>
                    <option value="daily">تكرار يومي</option>
                    <option value="weekly">تكرار أسبوعي</option>
                    <option value="monthly">تكرار شهري</option>
                  </select>
                </div>
              </div>
            )}

            {/* Inline Tags Selector */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Tag className="w-3 h-3 text-cyan-400" />
                  <span>الوسوم:</span>
                </span>
                {mergeAvailableTags([{ ...task, tags: draftTags }], customTags).map((tagOpt) => {
                  const selected = draftTags.some(
                    (t) => t.toLowerCase() === tagOpt.name.toLowerCase()
                  );
                  const style = getTagStyleForName(tagOpt.name, customTags);
                  return (
                    <button
                      key={tagOpt.id}
                      type="button"
                      onClick={() => toggleDraftTag(tagOpt.name)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                        selected
                          ? style.selectedClass
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`} />
                      <span>{tagOpt.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={inlineNewTag}
                  onChange={(e) => setInlineNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInlineTag();
                    }
                  }}
                  placeholder="وسم مخصص جديد..."
                  aria-label="إضافة وسم جديد"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleAddInlineTag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onCancelInlineEdit}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold shadow-md shadow-cyan-600/20 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ</span>
              </button>
            </div>
          </form>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
