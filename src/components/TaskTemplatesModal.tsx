import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookmarkPlus,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Copy,
  Edit3,
  Layers,
  ListPlus,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  Priority,
  RecurrenceFrequency,
  Task,
  TaskCategory,
  TaskRecurrence,
  TaskTag,
  TaskTemplate,
  TaskTemplateColor,
  TaskTemplateItem,
} from '../types';
import { useModalScrollLock } from '../utils/modalCoordinator';
import { getTodayLocalISO, formatRecurrenceLabelAr, normalizeRecurrence } from '../utils/taskRecurrence';
import { getTomorrowDateString } from '../utils/burnoutEngine';
import { getTagStyleForName, mergeAvailableTags, normalizeTagName } from '../utils/taskTags';
import {
  ApplyTemplateOptions,
  DEFAULT_TASK_TEMPLATES,
  sanitizeTaskTemplate,
  sanitizeTemplateItem,
  taskToTemplateItem,
  TEMPLATE_COLOR_KEYS,
  TEMPLATE_ICON_OPTIONS,
  TEMPLATE_STYLE_MAP,
} from '../utils/taskTemplates';

export interface TaskTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: TaskTemplate[];
  tasks: Task[];
  customTags: TaskTag[];
  initialDraftTasks?: Task[] | null;
  onCreateTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt'> & { id?: string }) => TaskTemplate;
  onUpdateTemplate: (template: TaskTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onApplyTemplate: (template: TaskTemplate, options: ApplyTemplateOptions) => number;
}

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  work: 'عمل',
  personal: 'شخصي',
  health: 'صحة',
  study: 'تعلم',
  urgent: 'طارئ',
};

const PRIORITY_BADGES: Record<Priority, { label: string; cls: string }> = {
  high: { label: 'عالية', cls: 'bg-rose-950/70 text-rose-300 border-rose-800/60' },
  medium: { label: 'متوسطة', cls: 'bg-amber-950/70 text-amber-300 border-amber-800/60' },
  low: { label: 'منخفضة', cls: 'bg-slate-800 text-slate-300 border-slate-700' },
};

export const TaskTemplatesModal: React.FC<TaskTemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  tasks,
  customTags,
  initialDraftTasks,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onApplyTemplate,
}) => {
  useModalScrollLock('task-templates-modal', isOpen);

  type ModalMode = 'browse' | 'apply' | 'edit';
  const [mode, setMode] = useState<ModalMode>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Apply mode state
  const [applyTarget, setApplyTarget] = useState<TaskTemplate | null>(null);
  const [applyDueDate, setApplyDueDate] = useState<string>(getTodayLocalISO());
  const [applySelectedIds, setApplySelectedIds] = useState<Set<string>>(new Set());
  const [applyExtraTag, setApplyExtraTag] = useState('');
  const [applyIncludeSubtasks, setApplyIncludeSubtasks] = useState(true);

  // Edit / Create mode state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
  const [editingUsageCount, setEditingUsageCount] = useState<number>(0);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftIcon, setDraftIcon] = useState('📋');
  const [draftColor, setDraftColor] = useState<TaskTemplateColor>('cyan');
  const [draftDefaultCategory, setDraftDefaultCategory] = useState<TaskCategory>('work');
  const [draftItems, setDraftItems] = useState<TaskTemplateItem[]>([]);
  const [quickNewItemTitle, setQuickNewItemTitle] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showImportFromTasks, setShowImportFromTasks] = useState(false);
  const [importTaskFilter, setImportTaskFilter] = useState('');
  const [selectedExistingTaskIds, setSelectedExistingTaskIds] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const availableTags = useMemo(() => mergeAvailableTags(tasks, customTags), [tasks, customTags]);

  // Reset modal state on open
  useEffect(() => {
    if (!isOpen) return;
    setConfirmDeleteId(null);
    setFormError(null);
    setSearchQuery('');

    if (initialDraftTasks && initialDraftTasks.length > 0) {
      const converted = initialDraftTasks.slice(0, 40).map((t, idx) => taskToTemplateItem(t, idx));
      setEditingTemplateId(null);
      setEditingCreatedAt(null);
      setEditingUsageCount(0);
      setDraftName('');
      setDraftDescription('');
      setDraftIcon('📋');
      setDraftColor('cyan');
      setDraftDefaultCategory(initialDraftTasks[0]?.category || 'work');
      setDraftItems(converted);
      setQuickNewItemTitle('');
      setExpandedItemId(converted[0]?.id || null);
      setShowImportFromTasks(false);
      setMode('edit');
    } else {
      setMode('browse');
      setApplyTarget(null);
    }
  }, [isOpen, initialDraftTasks]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const missingStarterTemplates = useMemo(() => {
    const existingIds = new Set(templates.map((t) => t.id));
    const existingNames = new Set(templates.map((t) => t.name.trim().toLowerCase()));
    return DEFAULT_TASK_TEMPLATES.filter(
      (starter) =>
        !existingIds.has(starter.id) &&
        !existingNames.has(starter.name.trim().toLowerCase())
    );
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(q) ||
        (tpl.description || '').toLowerCase().includes(q) ||
        tpl.items.some((it) => it.title.toLowerCase().includes(q))
    );
  }, [templates, searchQuery]);

  const importableTasks = useMemo(() => {
    const q = importTaskFilter.trim().toLowerCase();
    const list = tasks.filter((t) => t.status !== 'completed');
    const source = list.length > 0 ? list : tasks;
    if (!q) return source.slice(0, 40);
    return source
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.tags || []).some((tg) => tg.toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [tasks, importTaskFilter]);

  if (!isOpen) return null;

  const openApplyMode = (tpl: TaskTemplate) => {
    setApplyTarget(tpl);
    setApplyDueDate(getTodayLocalISO());
    setApplySelectedIds(new Set(tpl.items.map((it) => it.id)));
    setApplyExtraTag('');
    setApplyIncludeSubtasks(true);
    setConfirmDeleteId(null);
    setMode('apply');
  };

  const openCreateMode = () => {
    setEditingTemplateId(null);
    setEditingCreatedAt(null);
    setEditingUsageCount(0);
    setDraftName('');
    setDraftDescription('');
    setDraftIcon('📋');
    setDraftColor('cyan');
    setDraftDefaultCategory('work');
    setDraftItems([]);
    setQuickNewItemTitle('');
    setExpandedItemId(null);
    setShowImportFromTasks(false);
    setSelectedExistingTaskIds(new Set());
    setFormError(null);
    setMode('edit');
  };

  const openEditMode = (tpl: TaskTemplate) => {
    const clean = sanitizeTaskTemplate(tpl);
    setEditingTemplateId(clean.id);
    setEditingCreatedAt(clean.createdAt);
    setEditingUsageCount(clean.usageCount || 0);
    setDraftName(clean.name);
    setDraftDescription(clean.description || '');
    setDraftIcon(clean.icon);
    setDraftColor(clean.color);
    setDraftDefaultCategory(clean.defaultCategory);
    setDraftItems(clean.items);
    setQuickNewItemTitle('');
    setExpandedItemId(null);
    setShowImportFromTasks(false);
    setSelectedExistingTaskIds(new Set());
    setFormError(null);
    setMode('edit');
  };

  const handleDuplicateTemplate = (tpl: TaskTemplate) => {
    onCreateTemplate({
      name: `${tpl.name} (نسخة)`,
      description: tpl.description,
      icon: tpl.icon,
      color: tpl.color,
      defaultCategory: tpl.defaultCategory,
      items: tpl.items.map((it, idx) => ({
        ...it,
        id: `tpl-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      })),
      usageCount: 0,
    });
  };

  const handleAddStarterTemplate = (starter: TaskTemplate) => {
    onCreateTemplate({
      id: starter.id,
      name: starter.name,
      description: starter.description,
      icon: starter.icon,
      color: starter.color,
      defaultCategory: starter.defaultCategory,
      items: starter.items,
      usageCount: 0,
    });
  };

  const handleAddDraftItem = () => {
    const cleanTitle = quickNewItemTitle.trim();
    if (!cleanTitle) return;
    if (draftItems.length >= 40) {
      setFormError('الحد الأقصى 40 مهمة داخل القالب الواحد.');
      return;
    }
    const newItem = sanitizeTemplateItem(
      {
        id: `tpl-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        category: draftDefaultCategory,
        priority: 'medium',
        estimatedMinutes: 30,
        energyRequired: 'medium',
      },
      draftDefaultCategory,
      draftItems.length
    );
    setDraftItems((prev) => [...prev, newItem]);
    setQuickNewItemTitle('');
    setFormError(null);
  };

  const handleUpdateDraftItem = (itemId: string, patch: Partial<TaskTemplateItem>) => {
    setDraftItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it))
    );
  };

  const handleMoveDraftItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draftItems.length) return;
    setDraftItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleRemoveDraftItem = (itemId: string) => {
    setDraftItems((prev) => prev.filter((it) => it.id !== itemId));
    if (expandedItemId === itemId) setExpandedItemId(null);
  };

  const handleImportSelectedExistingTasks = () => {
    const picked = tasks.filter((t) => selectedExistingTaskIds.has(t.id));
    if (picked.length === 0) return;
    const remainingSlots = Math.max(0, 40 - draftItems.length);
    const converted = picked
      .slice(0, remainingSlots)
      .map((t, idx) => taskToTemplateItem(t, draftItems.length + idx));
    setDraftItems((prev) => [...prev, ...converted]);
    if (!draftName.trim() && picked[0]) {
      setDraftName(`قالب ${CATEGORY_LABELS[picked[0].category] || 'مهام'}`);
    }
    setSelectedExistingTaskIds(new Set());
    setShowImportFromTasks(false);
    setFormError(null);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) {
      setFormError('يرجى إدخال اسم واضح للقالب.');
      return;
    }
    if (draftItems.length === 0) {
      setFormError('أضف مهمة واحدة على الأقل داخل القالب.');
      return;
    }

    const sanitized = sanitizeTaskTemplate({
      id: editingTemplateId || undefined,
      name: draftName.trim(),
      description: draftDescription.trim() || undefined,
      icon: draftIcon,
      color: draftColor,
      defaultCategory: draftDefaultCategory,
      items: draftItems,
      createdAt: editingCreatedAt || new Date().toISOString(),
      usageCount: editingUsageCount,
    });

    if (editingTemplateId) {
      onUpdateTemplate(sanitized);
    } else {
      onCreateTemplate({
        name: sanitized.name,
        description: sanitized.description,
        icon: sanitized.icon,
        color: sanitized.color,
        defaultCategory: sanitized.defaultCategory,
        items: sanitized.items,
        usageCount: 0,
      });
    }
    setMode('browse');
  };

  const handleConfirmApply = () => {
    if (!applyTarget) return;
    const selectedIds = Array.from(applySelectedIds);
    if (selectedIds.length === 0) return;
    onApplyTemplate(applyTarget, {
      dueDate: applyDueDate,
      selectedItemIds: selectedIds,
      extraTag: applyExtraTag.trim() || undefined,
      includeSubtasks: applyIncludeSubtasks,
    });
    onClose();
  };

  const toggleDraftItemTag = (item: TaskTemplateItem, tagName: string) => {
    const clean = normalizeTagName(tagName);
    if (!clean) return;
    const current = item.tags || [];
    const exists = current.some((t) => t.toLowerCase() === clean.toLowerCase());
    const nextTags = exists
      ? current.filter((t) => t.toLowerCase() !== clean.toLowerCase())
      : [...current, clean].slice(0, 15);
    handleUpdateDraftItem(item.id, { tags: nextTags });
  };

  const setDraftItemRecurrenceFrequency = (
    item: TaskTemplateItem,
    freq: 'none' | RecurrenceFrequency
  ) => {
    if (freq === 'none') {
      handleUpdateDraftItem(item.id, { recurrence: undefined });
      return;
    }
    const nextRec: TaskRecurrence = normalizeRecurrence({
      enabled: true,
      frequency: freq,
      interval: item.recurrence?.interval || 1,
      daysOfWeek: freq === 'weekly' ? item.recurrence?.daysOfWeek : undefined,
    })!;
    handleUpdateDraftItem(item.id, { recurrence: nextRec });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-templates-modal-title"
        className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        dir="rtl"
      >
        {/* Sticky Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <h2
                id="task-templates-modal-title"
                className="text-base sm:text-lg font-extrabold text-white truncate"
              >
                {mode === 'browse'
                  ? 'قوالب المهام الجاهزة والمخصصة'
                  : mode === 'apply' && applyTarget
                    ? `تطبيق قالب: ${applyTarget.icon} ${applyTarget.name}`
                    : editingTemplateId
                      ? 'تعديل قالب المهام'
                      : 'إنشاء قالب مهام جديد'}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {mode === 'browse'
                  ? 'احفظ مجموعات مهامك المتكررة (تسوق، سفر، روتين عمل) وأضفها دفعة واحدة'
                  : mode === 'apply'
                    ? 'اختر المهام وتاريخ الاستحقاق لإضافتها جميعاً في خطوة واحدة'
                    : 'حدد اسم القالب والأيقونة وقائمة المهام المتكررة بداخله'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mode === 'browse' ? (
              <button
                type="button"
                id="btn-new-task-template"
                onClick={openCreateMode}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>قالب جديد</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('browse');
                  setFormError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>كل القوالب</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              aria-label="إغلاق نافذة القوالب"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* ===================== BROWSE MODE ===================== */}
          {mode === 'browse' && (
            <>
              {/* Search bar */}
              {templates.length > 0 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث داخل القوالب أو أسماء المهام المحفوظة..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-9 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Saved Templates Grid */}
              {filteredTemplates.length === 0 ? (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center mx-auto">
                    <Layers className="w-6 h-6 text-indigo-300" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {searchQuery
                      ? 'لا توجد قوالب مطابقة لبحثك'
                      : 'لا توجد قوالب محفوظة بعد'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {searchQuery
                      ? 'جرّب كلمات أخرى أو أنشئ قالباً جديداً لقائمتك.'
                      : 'أنشئ قالباً مخصصاً أو أضف أحد القوالب المقترحة أدناه لتوليد مهامك المتكررة دفعة واحدة.'}
                  </p>
                  {!searchQuery && (
                    <button
                      type="button"
                      onClick={openCreateMode}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إنشاء أول قالب مخصص</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates.map((tpl) => {
                    const style = TEMPLATE_STYLE_MAP[tpl.color] || TEMPLATE_STYLE_MAP.cyan;
                    const totalMinutes = tpl.items.reduce(
                      (sum, it) => sum + (it.estimatedMinutes || 30),
                      0
                    );
                    const isDeleting = confirmDeleteId === tpl.id;

                    return (
                      <div
                        key={tpl.id}
                        className={`bg-slate-950/85 rounded-2xl border p-4 flex flex-col justify-between gap-3.5 transition-all ${style.cardBorderClass}`}
                      >
                        <div className="space-y-3">
                          {/* Card Top */}
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-xl shrink-0 ${style.iconBgClass}`}
                              >
                                {tpl.icon}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-extrabold text-white truncate">
                                  {tpl.name}
                                </h3>
                                {tpl.description && (
                                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                                    {tpl.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${style.badgeClass}`}
                            >
                              {CATEGORY_LABELS[tpl.defaultCategory] || 'مهام'}
                            </span>
                          </div>

                          {/* Meta Badges */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                              <CheckSquare className="w-3 h-3 text-cyan-400" />
                              {tpl.items.length} مهام
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                              <Clock className="w-3 h-3 text-amber-400" />
                              {totalMinutes} د إجمالاً
                            </span>
                            {(tpl.usageCount || 0) > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/50 border border-indigo-800/50 text-indigo-300">
                                <Sparkles className="w-3 h-3" />
                                استُخدم {tpl.usageCount}×
                              </span>
                            )}
                          </div>

                          {/* Preview Items */}
                          <div className="bg-slate-900/70 rounded-xl border border-slate-800/80 p-2.5 space-y-1.5 max-h-40 overflow-y-auto">
                            {tpl.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 text-xs text-slate-200"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      item.priority === 'high'
                                        ? 'bg-rose-400'
                                        : item.priority === 'medium'
                                          ? 'bg-amber-400'
                                          : 'bg-slate-500'
                                    }`}
                                  />
                                  <span className="truncate">{item.title}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-400">
                                  {item.recurrence?.enabled && (
                                    <span title={formatRecurrenceLabelAr(item.recurrence)}>
                                      <Repeat className="w-3 h-3 text-indigo-400" />
                                    </span>
                                  )}
                                  {item.subtasks && item.subtasks.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                      +{item.subtasks.length} خطوات
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openApplyMode(tpl)}
                            disabled={tpl.items.length === 0}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-cyan-600/20 cursor-pointer"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                            <span>إضافة دفعة واحدة</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditMode(tpl)}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 cursor-pointer"
                              title="تعديل القالب"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateTemplate(tpl)}
                              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-indigo-300 border border-slate-800 cursor-pointer"
                              title="نسخ القالب"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {isDeleting ? (
                              <div className="flex items-center gap-1 bg-rose-950/70 border border-rose-700/60 rounded-xl px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteTemplate(tpl.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="text-[11px] font-bold text-rose-300 hover:text-rose-200 cursor-pointer"
                                >
                                  حذف
                                </button>
                                <span className="text-slate-600">|</span>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-[11px] text-slate-300 hover:text-white cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(tpl.id)}
                                className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 cursor-pointer"
                                title="حذف القالب"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Starter Suggestions Section (shown if any starter template is not yet in user's library) */}
              {missingStarterTemplates.length > 0 && !searchQuery && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-slate-200">
                        قوالب مقترحة جاهزة لإضافتها إلى مكتبتك
                      </h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {missingStarterTemplates.map((starter) => (
                      <div
                        key={starter.id}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{starter.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-100 truncate">
                              {starter.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {starter.items.length} مهام جاهزة
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddStarterTemplate(starter)}
                          className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-500/50 text-[11px] font-semibold text-indigo-200 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>حفظ في قوالبي</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===================== APPLY BATCH MODE ===================== */}
          {mode === 'apply' && applyTarget && (
            <div className="space-y-4">
              {/* Config Controls */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>تاريخ استحقاق المهام المضافة</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setApplyDueDate(getTodayLocalISO())}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        applyDueDate === getTodayLocalISO()
                          ? 'bg-cyan-600/25 border-cyan-500 text-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      اليوم
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyDueDate(getTomorrowDateString())}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        applyDueDate === getTomorrowDateString()
                          ? 'bg-cyan-600/25 border-cyan-500 text-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      غداً
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyDueDate('')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        applyDueDate === ''
                          ? 'bg-cyan-600/25 border-cyan-500 text-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      بدون تاريخ
                    </button>
                    <input
                      type="date"
                      value={applyDueDate}
                      onChange={(e) => setApplyDueDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-purple-400" />
                    <span>وسم إضافي لجميع مهام هذه الدفعة (اختياري)</span>
                  </label>
                  <input
                    type="text"
                    value={applyExtraTag}
                    onChange={(e) => setApplyExtraTag(e.target.value)}
                    placeholder="مثال: رحلة_مكة أو مقاضي_الأسبوع..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  {availableTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {availableTags.slice(0, 6).map((tg) => (
                        <button
                          key={tg.id}
                          type="button"
                          onClick={() =>
                            setApplyExtraTag((prev) =>
                              prev.trim().toLowerCase() === tg.name.toLowerCase() ? '' : tg.name
                            )
                          }
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-medium cursor-pointer ${
                            applyExtraTag.trim().toLowerCase() === tg.name.toLowerCase()
                              ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          #{tg.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Selection Checklist */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-200">
                    اختر المهام المطلوب إضافتها ({applySelectedIds.size} / {applyTarget.items.length})
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyIncludeSubtasks}
                        onChange={(e) => setApplyIncludeSubtasks(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-900 text-cyan-500"
                      />
                      <span>تضمين الخطوات الفرعية</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (applySelectedIds.size === applyTarget.items.length) {
                          setApplySelectedIds(new Set());
                        } else {
                          setApplySelectedIds(new Set(applyTarget.items.map((it) => it.id)));
                        }
                      }}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      {applySelectedIds.size === applyTarget.items.length
                        ? 'إلغاء تحديد الكل'
                        : 'تحديد الكل'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {applyTarget.items.map((item) => {
                    const checked = applySelectedIds.has(item.id);
                    const prio = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.medium;
                    return (
                      <div
                        key={item.id}
                        onClick={() =>
                          setApplySelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          checked
                            ? 'bg-slate-900 border-cyan-500/50'
                            : 'bg-slate-950/60 border-slate-800/70 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              checked
                                ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                : 'border-slate-600 bg-slate-900'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-100">
                              {item.title}
                            </div>
                            {item.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {item.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] ${prio.cls}`}>
                                {prio.label}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                {CATEGORY_LABELS[item.category]}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {item.estimatedMinutes || 30} د
                              </span>
                              {item.dueTime && (
                                <span className="text-[10px] text-cyan-300 font-mono">
                                  {item.dueTime}
                                </span>
                              )}
                              {item.recurrence?.enabled && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-700/50 text-indigo-300 text-[10px]">
                                  <Repeat className="w-2.5 h-2.5" />
                                  {formatRecurrenceLabelAr(item.recurrence)}
                                </span>
                              )}
                              {item.tags?.map((tg) => {
                                const st = getTagStyleForName(tg, customTags);
                                return (
                                  <span
                                    key={tg}
                                    className={`px-1.5 py-0.5 rounded border text-[10px] ${st.badgeClass}`}
                                  >
                                    #{tg}
                                  </span>
                                );
                              })}
                            </div>
                            {applyIncludeSubtasks && item.subtasks && item.subtasks.length > 0 && (
                              <div className="mt-1.5 text-[10px] text-slate-400">
                                الخطوات: {item.subtasks.join(' • ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===================== CREATE / EDIT MODE ===================== */}
          {mode === 'edit' && (
            <form id="task-template-editor-form" onSubmit={handleSaveTemplate} className="space-y-4">
              {formError && (
                <div className="bg-rose-950/60 border border-rose-700/60 text-rose-200 rounded-xl p-3 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      اسم القالب *
                    </label>
                    <input
                      type="text"
                      required
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="مثال: قائمة تسوق السوبرماركت، تحضير السفر..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      التصنيف الافتراضي لمهام القالب
                    </label>
                    <select
                      value={draftDefaultCategory}
                      onChange={(e) => setDraftDefaultCategory(e.target.value as TaskCategory)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="work">عمل ومشاريع</option>
                      <option value="personal">شخصي وعائلي</option>
                      <option value="health">صحة ولياقة</option>
                      <option value="study">تعلم وتطوير</option>
                      <option value="urgent">طارئ</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    وصف مختصر (اختياري)
                  </label>
                  <input
                    type="text"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="متى يُستخدم هذا القالب أو ما الذي يتضمنه؟"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      الأيقونة
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATE_ICON_OPTIONS.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setDraftIcon(ic)}
                          className={`w-9 h-9 rounded-xl border text-base flex items-center justify-center cursor-pointer transition-all ${
                            draftIcon === ic
                              ? 'bg-indigo-600/30 border-indigo-400 scale-105'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      لون البطاقة
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_COLOR_KEYS.map((clr) => {
                        const st = TEMPLATE_STYLE_MAP[clr];
                        return (
                          <button
                            key={clr}
                            type="button"
                            onClick={() => setDraftColor(clr)}
                            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                              draftColor === clr
                                ? st.badgeClass
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${st.dotClass}`} />
                            <span>{st.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Items Builder */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      مهام القالب ({draftItems.length} / 40)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      أضف المهام يدوياً أو استوردها من مهامك الحالية
                    </p>
                  </div>

                  {tasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowImportFromTasks((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/50 text-xs font-semibold cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>
                        {showImportFromTasks ? 'إخفاء الاستيراد' : 'استيراد من مهامك الحالية'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Collapsible picker to import existing tasks into template */}
                {showImportFromTasks && (
                  <div className="bg-slate-900/90 border border-cyan-800/40 rounded-xl p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={importTaskFilter}
                        onChange={(e) => setImportTaskFilter(e.target.value)}
                        placeholder="تصفية مهامك الحالية..."
                        className="flex-1 min-w-[160px] bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleImportSelectedExistingTasks}
                        disabled={selectedExistingTaskIds.size === 0}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                      >
                        إضافة المحدد ({selectedExistingTaskIds.size})
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {importableTasks.map((tk) => {
                        const picked = selectedExistingTaskIds.has(tk.id);
                        return (
                          <button
                            key={tk.id}
                            type="button"
                            onClick={() =>
                              setSelectedExistingTaskIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(tk.id)) next.delete(tk.id);
                                else next.add(tk.id);
                                return next;
                              })
                            }
                            className={`w-full text-right px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer ${
                              picked
                                ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-100'
                                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="truncate">{tk.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {CATEGORY_LABELS[tk.category]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Add Item Row */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickNewItemTitle}
                    onChange={(e) => setQuickNewItemTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDraftItem();
                      }
                    }}
                    placeholder="اكتب عنوان مهمة جديدة ثم اضغط Enter أو إضافة..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddDraftItem}
                    disabled={!quickNewItemTitle.trim() || draftItems.length >= 40}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة</span>
                  </button>
                </div>

                {/* Draft Items List */}
                {draftItems.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    لا توجد مهام داخل القالب بعد — أضف أول مهمة من الحقل أعلاه.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draftItems.map((item, idx) => {
                      const isExpanded = expandedItemId === item.id;
                      const prio = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.medium;
                      return (
                        <div
                          key={item.id}
                          className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-500 w-5 text-center shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) =>
                                handleUpdateDraftItem(item.id, { title: e.target.value })
                              }
                              className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none"
                            />
                            <span
                              className={`hidden sm:inline-flex px-2 py-0.5 rounded border text-[10px] shrink-0 ${prio.cls}`}
                            >
                              {prio.label}
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedItemId(isExpanded ? null : item.id)
                                }
                                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                                  isExpanded
                                    ? 'bg-cyan-950/60 border-cyan-600/60 text-cyan-200'
                                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                تفاصيل
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDraftItem(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                title="تحريك لأعلى"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDraftItem(idx, 1)}
                                disabled={idx === draftItems.length - 1}
                                className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                title="تحريك لأسفل"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftItem(item.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                                title="حذف من القالب"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Item Details */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  الأولوية
                                </label>
                                <select
                                  value={item.priority}
                                  onChange={(e) => {
                                    const p = e.target.value as Priority;
                                    handleUpdateDraftItem(item.id, {
                                      priority: p,
                                      energyRequired: p,
                                    });
                                  }}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                                >
                                  <option value="high">عالية</option>
                                  <option value="medium">متوسطة</option>
                                  <option value="low">منخفضة</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  التصنيف
                                </label>
                                <select
                                  value={item.category}
                                  onChange={(e) =>
                                    handleUpdateDraftItem(item.id, {
                                      category: e.target.value as TaskCategory,
                                    })
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                                >
                                  <option value="work">عمل</option>
                                  <option value="personal">شخصي</option>
                                  <option value="health">صحة</option>
                                  <option value="study">تعلم</option>
                                  <option value="urgent">طارئ</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  المدة التقديرية (د)
                                </label>
                                <input
                                  type="number"
                                  min={5}
                                  max={480}
                                  step={5}
                                  value={item.estimatedMinutes || 30}
                                  onChange={(e) =>
                                    handleUpdateDraftItem(item.id, {
                                      estimatedMinutes: Math.max(
                                        5,
                                        Math.min(480, Number(e.target.value) || 30)
                                      ),
                                    })
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  التكرار التلقائي
                                </label>
                                <select
                                  value={item.recurrence?.enabled ? item.recurrence.frequency : 'none'}
                                  onChange={(e) =>
                                    setDraftItemRecurrenceFrequency(
                                      item,
                                      e.target.value as 'none' | RecurrenceFrequency
                                    )
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                                >
                                  <option value="none">بدون تكرار</option>
                                  <option value="daily">يومي</option>
                                  <option value="weekly">أسبوعي</option>
                                  <option value="monthly">شهري</option>
                                </select>
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  الخطوات الفرعية (افصل بينها بفاصلة أو سطر جديد)
                                </label>
                                <input
                                  type="text"
                                  value={(item.subtasks || []).join('، ')}
                                  onChange={(e) => {
                                    const list = e.target.value
                                      .split(/[،,\n]+/)
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                      .slice(0, 30);
                                    handleUpdateDraftItem(item.id, { subtasks: list });
                                  }}
                                  placeholder="مثال: خطوة 1، خطوة 2، خطوة 3"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  وقت مقترح + ملاحظة
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="time"
                                    value={item.dueTime || ''}
                                    onChange={(e) =>
                                      handleUpdateDraftItem(item.id, {
                                        dueTime: e.target.value || undefined,
                                      })
                                    }
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                                  />
                                  <input
                                    type="text"
                                    value={item.description || ''}
                                    onChange={(e) =>
                                      handleUpdateDraftItem(item.id, {
                                        description: e.target.value,
                                      })
                                    }
                                    placeholder="وصف أو ملاحظة مختصرة..."
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                                  />
                                </div>
                              </div>

                              {availableTags.length > 0 && (
                                <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-1 pt-1">
                                  <span className="text-[10px] text-slate-400 ml-1">الوسوم:</span>
                                  {availableTags.slice(0, 10).map((tg) => {
                                    const active = Boolean(
                                      item.tags?.some(
                                        (x) => x.toLowerCase() === tg.name.toLowerCase()
                                      )
                                    );
                                    const st = getTagStyleForName(tg.name, customTags);
                                    return (
                                      <button
                                        key={tg.id}
                                        type="button"
                                        onClick={() => toggleDraftItemTag(item, tg.name)}
                                        className={`px-2 py-0.5 rounded-md border text-[10px] cursor-pointer ${
                                          active
                                            ? st.badgeClass
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                                        }`}
                                      >
                                        #{tg.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {mode === 'browse' && (
            <>
              <span className="text-[11px] text-slate-400">
                {templates.length} قوالب محفوظة • تتم المزامنة تلقائياً مع السحابة
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                إغلاق
              </button>
            </>
          )}

          {mode === 'apply' && applyTarget && (
            <>
              <button
                type="button"
                onClick={() => setMode('browse')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                رجوع
              </button>
              <button
                type="button"
                id="btn-confirm-apply-template"
                disabled={applySelectedIds.size === 0}
                onClick={handleConfirmApply}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <ListPlus className="w-4 h-4" />
                <span>إضافة {applySelectedIds.size} مهام دفعة واحدة</span>
              </button>
            </>
          )}

          {mode === 'edit' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('browse');
                  setFormError(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="task-template-editor-form"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{editingTemplateId ? 'حفظ تعديلات القالب' : 'حفظ القالب الجديد'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
