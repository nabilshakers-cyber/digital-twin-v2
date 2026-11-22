import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Sparkles, 
  Flame, 
  Split, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trash2, 
  Edit3, 
  Grid, 
  List, 
  LayoutGrid, 
  AlertCircle,
  Tag,
  ChevronDown,
  ChevronUp,
  Zap,
  Check,
  FileText,
  CalendarClock,
  Wand2,
  Loader2,
  X,
  Bell,
  RefreshCw,
  ArrowLeftRight,
  Undo2,
  MapPin,
  FileSpreadsheet,
} from 'lucide-react';
import { Task, Priority, TaskCategory, TaskStatus, SavedLocation, TaskLocationReminder, TaskTag, TaskTagColor } from '../types';
import { FRIENDLY_AI_CONNECTION_ERROR } from '../utils/api';
import { evaluateTaskUrgency } from '../utils/reminderEngine';
import {
  getSmartReschedulingSuggestions,
  getTomorrowDateString,
} from '../utils/burnoutEngine';
import { formatDistanceArabic } from '../utils/geofencing';
import {
  getTagStyleByColor,
  getTagStyleForName,
  mergeAvailableTags,
  normalizeTagName,
  TASK_TAG_COLOR_OPTIONS,
} from '../utils/taskTags';
import { useScheduledReminders } from '../utils/localNotifications';
import { ReminderPickerTarget, ReminderTimePickerModal } from './ReminderTimePickerModal';
import { LocationPickerModal } from './LocationPickerModal';
import { CsvTaskImportModal } from './CsvTaskImportModal';
import { broadcastCloseAllModals } from '../utils/modalCoordinator';
import { SwipeableTaskCard, SwipeOpenSide } from './SwipeableTaskCard';

interface TasksHubViewProps {
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: Partial<Task>) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onOpenTaskBreakdown: (task: Task) => void;
  onStartFocus: (task: Task) => void;
  onOpenQuickAdd: () => void;
  onOpenContextualBriefing: (task: Task) => void;
  onPostponeTask: (taskId: string) => void;
  onAutoClassifyTasks?: (tasksToClassify: Task[]) => Promise<{ count: number; summary: string }>;
  onImportTasks?: (
    importedTasks: Partial<Task>[],
    options?: { autoCreateTags?: boolean; discoveredTags?: string[] }
  ) => void;
  savedLocations?: SavedLocation[];
  locationTrackingEnabled?: boolean;
  onSaveLocation?: (loc: SavedLocation) => void;
  customTags?: TaskTag[];
  onCreateCustomTag?: (name: string, color?: TaskTagColor) => TaskTag | null;
  onDeleteCustomTag?: (tagId: string) => void;
}

export const TasksHubView: React.FC<TasksHubViewProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleSubtask,
  onOpenTaskBreakdown,
  onStartFocus,
  onOpenQuickAdd,
  onOpenContextualBriefing,
  onPostponeTask,
  onAutoClassifyTasks,
  onImportTasks,
  savedLocations = [],
  locationTrackingEnabled = false,
  onSaveLocation,
  customTags = [],
  onCreateCustomTag,
  onDeleteCustomTag,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'eisenhower'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [reminderTarget, setReminderTarget] = useState<ReminderPickerTarget | null>(null);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvImportSuccessMsg, setCsvImportSuccessMsg] = useState<string | null>(null);
  const scheduledReminders = useScheduledReminders();

  const openTaskReminderPicker = (task: Task) => {
    broadcastCloseAllModals('reminder-time-picker');
    setReminderTarget({
      itemKey: `task:${task.id}`,
      title: task.title,
      notificationTitle: `✅ تذكير بمهمة: ${task.title}`,
      notificationBody: task.description?.trim() || 'حان الوقت للبدء أو متابعة هذه المهمة.',
      category: 'task',
      defaultTime: task.dueTime && /^\d{2}:\d{2}$/.test(task.dueTime) ? task.dueTime : undefined,
      defaultDate: task.dueDate || undefined,
      defaultRepeatDaily: false,
    });
  };

  // Manual new / edit task state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newCategory, setNewCategory] = useState<TaskCategory>('work');
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo');
  const [newMinutes, setNewMinutes] = useState<number>(30);
  const [newDueDate, setNewDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newDueTime, setNewDueTime] = useState<string>('');
  const [newSubtasks, setNewSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [draftSubtaskTitle, setDraftSubtaskTitle] = useState('');
  const [newIsUnclassified, setNewIsUnclassified] = useState(false);
  const [newLocationId, setNewLocationId] = useState<string>('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [draftCustomTagName, setDraftCustomTagName] = useState<string>('');
  const [draftCustomTagColor, setDraftCustomTagColor] = useState<TaskTagColor>('cyan');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Auto-classify state
  const [isAutoClassifying, setIsAutoClassifying] = useState(false);
  const [classifySuccessMsg, setClassifySuccessMsg] = useState<string | null>(null);
  const [classifyErrorMsg, setClassifyErrorMsg] = useState<string | null>(null);
  const [canRetryClassify, setCanRetryClassify] = useState(false);

  // Swipe actions & inline card editing state
  const [activeSwipe, setActiveSwipe] = useState<{
    taskId: string;
    side: SwipeOpenSide;
  } | null>(null);
  const [inlineEditingTaskId, setInlineEditingTaskId] = useState<string | null>(null);
  const [deletedUndoTask, setDeletedUndoTask] = useState<Task | null>(null);
  const undoTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleQuickPriorityChange = (task: Task, nextPriority: Priority) => {
    onUpdateTask({
      ...task,
      priority: nextPriority,
      energyRequired:
        nextPriority === 'high' ? 'high' : nextPriority === 'low' ? 'low' : 'medium',
      isTopPriority: !task.isUnclassified && nextPriority === 'high',
      isUnclassified: false,
    });
  };

  const handleQuickDeleteTask = (task: Task) => {
    setDeletedUndoTask(task);
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setDeletedUndoTask(null);
      undoTimerRef.current = null;
    }, 7000);
    if (inlineEditingTaskId === task.id) {
      setInlineEditingTaskId(null);
    }
    if (activeSwipe?.taskId === task.id) {
      setActiveSwipe(null);
    }
    onDeleteTask(task.id);
  };

  const handleUndoDelete = () => {
    if (!deletedUndoTask) return;
    const taskToRestore = deletedUndoTask;
    setDeletedUndoTask(null);
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    onAddTask({
      title: taskToRestore.title,
      description: taskToRestore.description,
      priority: taskToRestore.priority,
      category: taskToRestore.category,
      estimatedMinutes: taskToRestore.estimatedMinutes,
      dueDate: taskToRestore.dueDate,
      dueTime: taskToRestore.dueTime,
      status: taskToRestore.status,
      energyRequired: taskToRestore.energyRequired,
      subtasks: taskToRestore.subtasks,
      isUnclassified: taskToRestore.isUnclassified,
      tags: taskToRestore.tags,
      locationReminder: taskToRestore.locationReminder,
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAddTaskForm = () => {
    setEditingTaskId(null);
    setNewTitle('');
    setNewDescription('');
    setNewPriority('medium');
    setNewCategory('work');
    setNewStatus('todo');
    setNewMinutes(30);
    setNewDueDate(new Date().toISOString().split('T')[0]);
    setNewDueTime('');
    setNewSubtasks([]);
    setDraftSubtaskTitle('');
    setNewIsUnclassified(false);
    setNewLocationId('');
    setNewTags([]);
    setDraftCustomTagName('');
    setTitleError(null);
    setIsFormOpen((v) => (editingTaskId ? true : !v));
  };

  const closeTaskForm = () => {
    setIsFormOpen(false);
    setEditingTaskId(null);
    setNewTitle('');
    setNewDescription('');
    setNewDueTime('');
    setNewSubtasks([]);
    setDraftSubtaskTitle('');
    setNewIsUnclassified(false);
    setNewLocationId('');
    setNewTags([]);
    setDraftCustomTagName('');
    setTitleError(null);
  };

  const toggleFormTag = (tagName: string) => {
    const clean = normalizeTagName(tagName);
    if (!clean) return;
    setNewTags((prev) => {
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
    setNewTags((prev) => {
      if (prev.some((t) => t.toLowerCase() === clean.toLowerCase())) return prev;
      if (prev.length >= 15) return prev;
      return [...prev, clean];
    });
    setDraftCustomTagName('');
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setTitleError('يرجى كتابة عنوان المهمة أولاً.');
      return;
    }
    setTitleError(null);

    const matchedLocation = newLocationId
      ? savedLocations.find((loc) => loc.id === newLocationId)
      : undefined;
    const builtLocationReminder: TaskLocationReminder | undefined = matchedLocation
      ? {
          locationId: matchedLocation.id,
          locationName: matchedLocation.name,
          lat: matchedLocation.lat,
          lng: matchedLocation.lng,
          radiusMeters: matchedLocation.radiusMeters,
          enabled: true,
          triggerOn: 'arrive',
        }
      : undefined;

    if (editingTaskId) {
      const existing = tasks.find((t) => t.id === editingTaskId);
      if (existing) {
        onUpdateTask({
          ...existing,
          title: newTitle.trim(),
          description: newDescription.trim(),
          priority: newPriority,
          category: newCategory,
          status: newStatus,
          estimatedMinutes: Number(newMinutes) || 30,
          dueDate: newDueDate || undefined,
          dueTime: newDueTime || undefined,
          energyRequired: newPriority === 'high' ? 'high' : newPriority === 'low' ? 'low' : 'medium',
          isTopPriority: !newIsUnclassified && newPriority === 'high',
          isUnclassified: newIsUnclassified,
          subtasks: newSubtasks,
          tags: newTags,
          locationReminder: builtLocationReminder,
          completedAt:
            newStatus === 'completed'
              ? existing.completedAt || new Date().toISOString()
              : undefined,
        });
      }
    } else {
      onAddTask({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        category: newCategory,
        estimatedMinutes: Number(newMinutes) || 30,
        dueDate: newDueDate,
        dueTime: newDueTime || undefined,
        status: newStatus,
        energyRequired: newPriority === 'high' ? 'high' : 'medium',
        createdAt: new Date().toISOString(),
        subtasks: newSubtasks,
        tags: newTags,
        isUnclassified: newIsUnclassified,
        locationReminder: builtLocationReminder,
      });
    }

    closeTaskForm();
  };

  const unclassifiedTasks = tasks.filter(
    (t) => t.status !== 'completed' && (t.isUnclassified || !t.category || !t.priority)
  );

  const handleAutoClassifyClick = async () => {
    if (!onAutoClassifyTasks || isAutoClassifying) return;
    setClassifyErrorMsg(null);
    setCanRetryClassify(false);
    setClassifySuccessMsg(null);

    const targets =
      unclassifiedTasks.length > 0
        ? unclassifiedTasks
        : tasks.filter((t) => t.status !== 'completed');

    if (targets.length === 0) {
      setClassifyErrorMsg('لا توجد مهام نشطة لتصنيفها حالياً.');
      return;
    }

    setIsAutoClassifying(true);
    try {
      const res = await onAutoClassifyTasks(targets);
      setClassifySuccessMsg(
        `تم تصنيف ${res.count} مهمة عبر Gemini API بنجاح: ${res.summary}`
      );
    } catch (err: any) {
      console.error('[TasksHubView] handleAutoClassifyClick failed:', err);
      setCanRetryClassify(true);
      setClassifyErrorMsg(FRIENDLY_AI_CONNECTION_ERROR);
    } finally {
      setIsAutoClassifying(false);
    }
  };

  const normalizeSearchText = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');

  // Filter tasks and enrich with smart rescheduling suggestions
  const tomorrowStr = getTomorrowDateString();
  const tasksWithSuggestions = getSmartReschedulingSuggestions(tasks);
  const normalizedQuery = normalizeSearchText(searchQuery);
  const availableTags = mergeAvailableTags(tasks, customTags);

  const filteredTasks = tasksWithSuggestions
    .filter((task) => {
      const normalizedTitle = normalizeSearchText(task.title);
      const normalizedDesc = task.description ? normalizeSearchText(task.description) : '';
      const matchesTagQuery = Boolean(
        task.tags?.some((tg) => normalizeSearchText(tg).includes(normalizedQuery))
      );
      const matchesSearch =
        !normalizedQuery ||
        normalizedTitle.includes(normalizedQuery) ||
        normalizedDesc.includes(normalizedQuery) ||
        matchesTagQuery;
      const matchesCategory =
        categoryFilter === 'all'
          ? true
          : categoryFilter === 'unclassified'
          ? Boolean(task.isUnclassified || !task.category || !task.priority)
          : task.category === categoryFilter && !task.isUnclassified;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesTagFilter =
        tagFilter === 'all' ||
        Boolean(
          task.tags?.some(
            (tg) => normalizeTagName(tg).toLowerCase() === normalizeTagName(tagFilter).toLowerCase()
          )
        );
      return matchesSearch && matchesCategory && matchesPriority && matchesTagFilter;
    })
    .sort((a, b) => {
      if (!normalizedQuery) return 0;
      const aTitle = normalizeSearchText(a.title);
      const bTitle = normalizeSearchText(b.title);
      const aStarts = aTitle.startsWith(normalizedQuery) ? 2 : aTitle.includes(normalizedQuery) ? 1 : 0;
      const bStarts = bTitle.startsWith(normalizedQuery) ? 2 : bTitle.includes(normalizedQuery) ? 1 : 0;
      return bStarts - aStarts;
    });

  const getPriorityBadge = (p: Priority) => {
    if (p === 'high') return <span className="px-2 py-0.5 rounded-md bg-rose-950/70 text-rose-300 border border-rose-800/60 text-[11px] font-medium">عاجل وهام</span>;
    if (p === 'medium') return <span className="px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-800/60 text-[11px] font-medium">متوسط الأولوية</span>;
    return <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium">أولوية منخفضة</span>;
  };

  const getCategoryBadge = (c: TaskCategory) => {
    const labels: Record<TaskCategory, { label: string; color: string }> = {
      work: { label: 'عمل ومشاريع', color: 'bg-blue-950/70 text-blue-300 border-blue-800/60' },
      personal: { label: 'شخصي وعائلي', color: 'bg-purple-950/70 text-purple-300 border-purple-800/60' },
      health: { label: 'صحة ولياقة', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60' },
      study: { label: 'تعلم وتطوير', color: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60' },
      urgent: { label: 'طارئ', color: 'bg-rose-950/70 text-rose-300 border-rose-800/60' },
    };
    const conf = labels[c] || labels.work;
    return <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${conf.color}`}>{conf.label}</span>;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      
      {/* Header Controls: Top Instant Search Bar, Quick Actions, Filters & View Toggles */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-3.5 shadow-lg">
        {/* Top Full-Width Instant Title Search Bar */}
        <div role="search" className="relative flex items-center">
          <Search
            className={`w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
              normalizedQuery ? 'text-cyan-400' : 'text-slate-400'
            }`}
          />
          <input
            type="text"
            aria-label="البحث الفوري في عناوين المهام"
            placeholder="ابحث باسم أو عنوان المهمة لتصفية النتائج فورياً..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) {
                setSearchQuery('');
              }
            }}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pr-10 pl-28 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-all"
          />

          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {normalizedQuery && (
              <span className="px-2 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-[11px] font-bold">
                {filteredTasks.length} / {tasks.length}
              </span>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="مسح البحث"
                aria-label="مسح نص البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-slate-400">
            {normalizedQuery
              ? `عرض ${filteredTasks.length} مهمة مطابقة من إجمالي ${tasks.length}`
              : `إجمالي المهام: ${tasks.length} (${tasks.filter((t) => t.status !== 'completed').length} نشطة)`}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onAutoClassifyTasks && (
              <button
                type="button"
                id="btn-auto-classify-tasks"
                disabled={isAutoClassifying}
                onClick={handleAutoClassifyClick}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                title="إرسال المهام غير المصنفة إلى Gemini API لتحديد التصنيف والأولوية تلقائياً"
              >
                {isAutoClassifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التصنيف...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>تصنيف تلقائي</span>
                    {unclassifiedTasks.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-950/50 text-[10px] font-mono">
                        {unclassifiedTasks.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            )}

            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>إدخال ذكي بالذكاء الاصطناعي</span>
            </button>

            <button
              onClick={openAddTaskForm}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>مهمة يدوية</span>
            </button>

            <button
              type="button"
              id="btn-open-csv-import"
              onClick={() => {
                broadcastCloseAllModals('csv-import-modal');
                setIsCsvImportOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 text-xs font-semibold transition-all cursor-pointer"
              title="استيراد مهام من ملف CSV أو تصديرها"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>استيراد CSV</span>
            </button>
          </div>
        </div>

        {/* CSV Import Success Banner */}
        {csvImportSuccessMsg && (
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-200 flex items-center justify-between gap-2 animate-fadeIn">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{csvImportSuccessMsg}</span>
            </span>
            <button
              type="button"
              onClick={() => setCsvImportSuccessMsg(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Auto-Classify Feedback Banners */}
        {classifySuccessMsg && (
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-xs text-emerald-200 flex items-center justify-between gap-2 animate-fadeIn">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{classifySuccessMsg}</span>
            </span>
            <button
              type="button"
              onClick={() => setClassifySuccessMsg(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {classifyErrorMsg && (
          <div className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{classifyErrorMsg}</span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {canRetryClassify && (
                <button
                  type="button"
                  disabled={isAutoClassifying}
                  onClick={() => void handleAutoClassifyClick()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>إعادة المحاولة</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setClassifyErrorMsg(null);
                  setCanRetryClassify(false);
                }}
                className="text-rose-300 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Filters & View switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="تصفية حسب التصنيف"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 text-xs cursor-pointer"
            >
              <option value="all">جميع التصنيفات</option>
              <option value="unclassified">غير مصنفة</option>
              <option value="work">عمل ومشاريع</option>
              <option value="personal">شخصي وعائلي</option>
              <option value="health">صحة ولياقة</option>
              <option value="study">تعلم وتطوير</option>
              <option value="urgent">طارئ</option>
            </select>

            {/* Priority filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="تصفية حسب الأولوية"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 text-xs cursor-pointer"
            >
              <option value="all">جميع الأولويات</option>
              <option value="high">عاجل وهام</option>
              <option value="medium">متوسط</option>
              <option value="low">منخفض</option>
            </select>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>قائمة</span>
            </button>

            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === 'kanban' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>أعمدة (كانبان)</span>
            </button>

            <button
              onClick={() => setViewMode('eisenhower')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === 'eisenhower' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>مصفوفة أيزنهاور</span>
            </button>
          </div>
        </div>

        {/* Tag / Label Quick Filter Chips */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-800/60 text-[11px]">
            <span className="text-slate-400 font-semibold flex items-center gap-1 ml-1">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>الوسوم:</span>
            </span>
            <button
              type="button"
              onClick={() => setTagFilter('all')}
              className={`px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                tagFilter === 'all'
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              الكل ({tasks.length})
            </button>
            {availableTags.map((tg) => {
              const count = tasks.filter((t) =>
                t.tags?.some((x) => normalizeTagName(x).toLowerCase() === tg.name.toLowerCase())
              ).length;
              const style = getTagStyleByColor(tg.color);
              const isSelected =
                tagFilter !== 'all' &&
                normalizeTagName(tagFilter).toLowerCase() === tg.name.toLowerCase();
              return (
                <button
                  key={tg.id}
                  type="button"
                  onClick={() => setTagFilter(isSelected ? 'all' : tg.name)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? style.selectedClass
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`} />
                  <span>{tg.name}</span>
                  <span className="opacity-70 font-mono text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Task Add / Edit Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveTask}
          noValidate
          className="bg-slate-900 rounded-2xl border border-cyan-800/60 p-5 space-y-4 shadow-xl animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              {editingTaskId ? (
                <>
                  <Edit3 className="w-4 h-4 text-cyan-400" />
                  <span>تعديل المهمة</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>إنشاء مهمة جديدة</span>
                </>
              )}
            </h4>
            <button
              type="button"
              onClick={closeTaskForm}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">عنوان المهمة *</label>
              <input
                type="text"
                placeholder="مثال: إنهاء مسودة الاتفاقية وإرسالها للمدير"
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (titleError && e.target.value.trim()) {
                    setTitleError(null);
                  }
                }}
                aria-invalid={Boolean(titleError)}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none transition-colors ${
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

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">التفاصيل والملاحظات (اختياري)</label>
              <textarea
                rows={2}
                placeholder="تفاصيل إضافية أو روابط وملاحظات مساعدة..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newIsUnclassified}
                  onChange={(e) => setNewIsUnclassified(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500"
                />
                <span>إبقاء المهمة غير مصنفة (ليتم تصنيفها تلقائياً عبر زر «تصنيف تلقائي»)</span>
              </label>
            </div>

            {!newIsUnclassified && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">التصنيف</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
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
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
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
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="todo">قيد الانتظار</option>
                <option value="in_progress">جاري العمل الآن</option>
                <option value="completed">مكتملة</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الوقت المتوقع (بالدقائق)</label>
              <input
                type="number"
                min={5}
                max={480}
                value={newMinutes}
                onChange={(e) => setNewMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">تاريخ الاستحقاق</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">وقت الاستحقاق (للتنبيه الذكي)</label>
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Optional Location-Based Reminder Selector */}
            <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-slate-800/70">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>التذكير عند الوصول لموقع جغرافي (اختياري)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={newLocationId}
                  onChange={(e) => setNewLocationId(e.target.value)}
                  aria-label="اختيار موقع التذكير الجغرافي"
                  className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">بدون تذكير جغرافي</option>
                  {savedLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      عند الوصول إلى: {loc.name} (نطاق {formatDistanceArabic(loc.radiusMeters)})
                    </option>
                  ))}
                </select>

                {onSaveLocation && (
                  <button
                    type="button"
                    onClick={() => setLocationPickerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>+ إضافة موقع جديد على الخريطة</span>
                  </button>
                )}
              </div>
              {newLocationId && !locationTrackingEnabled && (
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
                {newTags.length > 0 && (
                  <span className="text-[11px] text-cyan-300 font-medium">
                    تم تحديد {newTags.length} وسوم
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {mergeAvailableTags(
                  [...tasks, { id: 'draft', title: '', category: 'work', priority: 'medium', status: 'todo', energyRequired: 'medium', createdAt: '', tags: newTags }],
                  customTags
                ).map((tg) => {
                  const isSelected = newTags.some(
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
                            setNewTags((prev) =>
                              prev.filter((t) => t.toLowerCase() !== tg.name.toLowerCase())
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
                الخطوات الفرعية (اختياري)
              </label>
              {newSubtasks.length > 0 && (
                <div className="space-y-1.5">
                  {newSubtasks.map((st, idx) => (
                    <div key={st.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) =>
                          setNewSubtasks((prev) =>
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
                          setNewSubtasks((prev) => prev.filter((_, rIdx) => rIdx !== idx))
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
                      setNewSubtasks((prev) => [
                        ...prev,
                        { id: `sub-${Date.now()}`, title: draftSubtaskTitle.trim(), completed: false },
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
                    setNewSubtasks((prev) => [
                      ...prev,
                      { id: `sub-${Date.now()}`, title: draftSubtaskTitle.trim(), completed: false },
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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={closeTaskForm}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 cursor-pointer"
            >
              {editingTaskId ? 'حفظ التعديلات' : 'حفظ وإدراج المهمة'}
            </button>
          </div>
        </form>
      )}

      {/* Undo Deleted Task Toast Banner */}
      {deletedUndoTask && (
        <div className="px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-rose-800/60 text-xs text-slate-200 flex items-center justify-between gap-3 shadow-lg animate-fadeIn">
          <span className="truncate">
            تم حذف المهمة: <strong className="text-white">{deletedUndoTask.title}</strong>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndoDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold cursor-pointer"
            >
              <Undo2 className="w-3 h-3" />
              <span>تراجع</span>
            </button>
            <button
              type="button"
              onClick={() => setDeletedUndoTask(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
              title="إغلاق"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Subtle Swipe Hint for List / Kanban */}
      {(viewMode === 'list' || viewMode === 'kanban') && filteredTasks.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/70 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>اسحب أي بطاقة مهمة يميناً أو يساراً للتعديل السريع أو تغيير الأولوية أو الحذف</span>
          </span>
        </div>
      )}

      {/* VIEW 1: Standard List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-10 text-center">
              <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-slate-300 font-medium">لم يتم العثور على مهام تطابق هذا البحث أو الفلتر</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setPriorityFilter('all');
                  setTagFilter('all');
                }}
                className="mt-3 text-xs text-cyan-400 hover:underline cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const isExpanded = expandedTaskIds.has(task.id);
              const subtasks = task.subtasks || [];
              const completedSubtasks = subtasks.filter((s) => s.completed).length;
              const urgencyInfo = evaluateTaskUrgency(task);

              const wrapperThemeClass = isCompleted
                ? 'bg-slate-950 border-slate-800/60 opacity-70'
                : urgencyInfo?.urgency === 'overdue'
                ? 'bg-slate-950 border-rose-800/60 hover:border-rose-700 shadow-md'
                : urgencyInfo?.urgency === 'due_soon'
                ? 'bg-slate-950 border-amber-800/50 hover:border-amber-700 shadow-md'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700 shadow-md';

              const foregroundThemeClass = isCompleted
                ? 'bg-slate-900'
                : urgencyInfo?.urgency === 'overdue'
                ? 'bg-[#1a111a]'
                : urgencyInfo?.urgency === 'due_soon'
                ? 'bg-[#181512]'
                : 'bg-slate-900';

              const isSwipeOpen = activeSwipe?.taskId === task.id;
              const openSide: SwipeOpenSide = isSwipeOpen ? activeSwipe.side : 'left';

              return (
                <SwipeableTaskCard
                  key={task.id}
                  task={task}
                  isOpen={isSwipeOpen}
                  openSide={openSide}
                  onOpenSwipe={(side) => setActiveSwipe({ taskId: task.id, side })}
                  onCloseSwipe={() =>
                    setActiveSwipe((prev) => (prev?.taskId === task.id ? null : prev))
                  }
                  isEditingInline={inlineEditingTaskId === task.id}
                  onStartInlineEdit={() => {
                    setActiveSwipe(null);
                    setInlineEditingTaskId(task.id);
                  }}
                  onCancelInlineEdit={() => setInlineEditingTaskId(null)}
                  onSaveInlineEdit={(updatedTask) => {
                    onUpdateTask(updatedTask);
                    setInlineEditingTaskId(null);
                  }}
                  onChangePriority={(nextPriority) =>
                    handleQuickPriorityChange(task, nextPriority)
                  }
                  onDelete={() => handleQuickDeleteTask(task)}
                  savedLocations={savedLocations}
                  customTags={customTags}
                  onCreateCustomTag={onCreateCustomTag}
                  wrapperClassName={`rounded-2xl border transition-all duration-200 ${wrapperThemeClass}`}
                  foregroundClassName={foregroundThemeClass}
                >
                  <div className="p-4 flex items-start justify-between gap-3">
                    
                    {/* Checkbox and Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                        title={isCompleted ? 'إعادة المهمة' : 'تحديد كمكتمل'}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
                        ) : (
                          <Circle className="w-5 h-5 hover:scale-110 transition-transform" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`text-sm font-bold text-slate-100 truncate ${
                              isCompleted ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {task.title}
                          </h4>
                          {urgencyInfo && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                urgencyInfo.urgency === 'overdue'
                                  ? 'bg-rose-950/90 text-rose-300 border-rose-700/70'
                                  : 'bg-amber-950/90 text-amber-300 border-amber-700/70'
                              }`}
                            >
                              {urgencyInfo.timeLabel}
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                          {task.isUnclassified ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-dashed border-slate-600 text-[11px] font-medium">
                              غير مصنفة (بانتظار التصنيف التلقائي)
                            </span>
                          ) : (
                            <>
                              {getPriorityBadge(task.priority)}
                              {getCategoryBadge(task.category)}
                            </>
                          )}

                          {(task.tags || []).map((tagName) => {
                            const tagStyle = getTagStyleForName(tagName, customTags);
                            return (
                              <button
                                key={tagName}
                                type="button"
                                onClick={() =>
                                  setTagFilter(
                                    tagFilter.toLowerCase() === tagName.toLowerCase()
                                      ? 'all'
                                      : tagName
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold cursor-pointer hover:brightness-110 transition-all ${tagStyle.badgeClass}`}
                                title={`تصفية حسب وسم: ${tagName}`}
                              >
                                <Tag className="w-2.5 h-2.5 shrink-0" />
                                <span>{tagName}</span>
                              </button>
                            );
                          })}

                          {task.estimatedMinutes && (
                            <span className="flex items-center gap-1 text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md text-[11px]">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              {task.estimatedMinutes} دقيقة
                            </span>
                          )}

                          {task.dueTime && (
                            <span className="flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md text-[11px] font-mono">
                              الاستحقاق: {task.dueTime}
                            </span>
                          )}

                          {task.locationReminder?.enabled && (
                            <span
                              className="flex items-center gap-1 text-cyan-200 bg-cyan-950/80 border border-cyan-700/60 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                              title={`تذكير جغرافي عند الوصول إلى ${task.locationReminder.locationName}`}
                            >
                              <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span>
                                {task.locationReminder.locationName} •{' '}
                                {formatDistanceArabic(task.locationReminder.radiusMeters)}
                              </span>
                            </span>
                          )}

                          {task.suggestedPostpone && (!task.dueDate || task.dueDate < tomorrowStr) && (
                            <span className="flex items-center gap-1 text-indigo-300 bg-indigo-950/70 border border-indigo-800/60 px-2 py-0.5 rounded-md text-[11px] font-medium">
                              <CalendarClock className="w-3 h-3" />
                              مقترحة للتأجيل
                            </span>
                          )}

                          {subtasks.length > 0 && (
                            <button
                              onClick={() => toggleExpand(task.id)}
                              className="flex items-center gap-1 text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded-md text-[11px] font-medium"
                            >
                              <span>الخطوات ({completedSubtasks}/{subtasks.length})</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions toolbar */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.suggestedPostpone && (!task.dueDate || task.dueDate < tomorrowStr) && (
                        <button
                          onClick={() => onPostponeTask(task.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-800/70 text-xs font-medium transition-all cursor-pointer"
                          title="تأجيل المهمة للغد لتخفيف العبء المعرفي"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">تأجيل للغد</span>
                        </button>
                      )}

                      {/* Contextual Briefing Button */}
                      <button
                        onClick={() => onOpenContextualBriefing(task)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/70 text-xs font-medium transition-all cursor-pointer"
                        title="عرض الموجز السياقي للمهمة"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">موجز سياقي</span>
                      </button>

                      {/* AI Breakdown Button */}
                      <button
                        onClick={() => onOpenTaskBreakdown(task)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
                        title="تفكيك المهمة إلى خطوات أصغر مع التوأم"
                      >
                        <Split className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">تفكيك ذكي</span>
                      </button>

                      {/* Start Focus Session */}
                      <button
                        onClick={() => onStartFocus(task)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer"
                        title="بدء جلسة تركيز"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">تركيز</span>
                      </button>

                      {/* Local Reminder Bell */}
                      {(() => {
                        const taskReminder = scheduledReminders[`task:${task.id}`];
                        return (
                          <button
                            type="button"
                            onClick={() => openTaskReminderPicker(task)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              taskReminder
                                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/30'
                                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border-slate-700'
                            }`}
                            title={
                              taskReminder
                                ? `تنبيه مجدول الساعة ${taskReminder.timeHHMM} — اضغط للتعديل أو الإلغاء`
                                : 'ضبط منبه تذكير لهذه المهمة'
                            }
                          >
                            <Bell className="w-3.5 h-3.5" />
                            {taskReminder && (
                              <span className="font-mono text-[11px]">{taskReminder.timeHHMM}</span>
                            )}
                          </button>
                        );
                      })()}

                      {/* Inline Edit Task */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSwipe(null);
                          setInlineEditingTaskId(task.id);
                        }}
                        className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-all cursor-pointer"
                        title="تعديل المهمة مباشرة"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Quick Toggle Swipe Actions Tray (accessible for desktop/keyboard) */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSwipe((prev) =>
                            prev?.taskId === task.id ? null : { taskId: task.id, side: 'left' }
                          )
                        }
                        className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                          isSwipeOpen
                            ? 'bg-cyan-600 text-white border-cyan-400'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 border-slate-700'
                        }`}
                        title={isSwipeOpen ? 'إغلاق الإجراءات السريعة' : 'فتح الإجراءات السريعة'}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleQuickDeleteTask(task)}
                        className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 transition-all cursor-pointer"
                        title="حذف المهمة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>

                  {/* Subtasks Accordion Section */}
                  {subtasks.length > 0 && isExpanded && (
                    <div className="bg-slate-950/60 border-t border-slate-800/80 p-3.5 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-400">
                        الخطوات التنفيذية المفككة:
                      </div>
                      <div className="space-y-1.5">
                        {subtasks.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs"
                          >
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={sub.completed}
                                onChange={() => onToggleSubtask(task.id, sub.id)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                              />
                              <span className={`text-slate-200 ${sub.completed ? 'line-through text-slate-500' : ''}`}>
                                {sub.title}
                              </span>
                            </label>

                            {sub.estimatedMinutes && (
                              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                {sub.estimatedMinutes} د
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SwipeableTaskCard>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: Kanban Columns */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Column 1: Todo */}
          <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                قيد الانتظار ({filteredTasks.filter((t) => t.status === 'todo').length})
              </h4>
            </div>

            <div className="space-y-2.5">
              {filteredTasks
                .filter((t) => t.status === 'todo')
                .map((task) => {
                  const isSwipeOpen = activeSwipe?.taskId === task.id;
                  return (
                    <SwipeableTaskCard
                      key={task.id}
                      task={task}
                      compact
                      isOpen={isSwipeOpen}
                      openSide={isSwipeOpen ? activeSwipe.side : 'left'}
                      onOpenSwipe={(side) => setActiveSwipe({ taskId: task.id, side })}
                      onCloseSwipe={() =>
                        setActiveSwipe((prev) => (prev?.taskId === task.id ? null : prev))
                      }
                      isEditingInline={inlineEditingTaskId === task.id}
                      onStartInlineEdit={() => {
                        setActiveSwipe(null);
                        setInlineEditingTaskId(task.id);
                      }}
                      onCancelInlineEdit={() => setInlineEditingTaskId(null)}
                      onSaveInlineEdit={(updatedTask) => {
                        onUpdateTask(updatedTask);
                        setInlineEditingTaskId(null);
                      }}
                      onChangePriority={(nextPriority) =>
                        handleQuickPriorityChange(task, nextPriority)
                      }
                      onDelete={() => handleQuickDeleteTask(task)}
                      savedLocations={savedLocations}
                      customTags={customTags}
                      onCreateCustomTag={onCreateCustomTag}
                      wrapperClassName="rounded-xl border border-slate-800 bg-slate-950"
                      foregroundClassName="bg-slate-950 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-xs font-semibold text-slate-200">{task.title}</h5>
                        <button
                          onClick={() => onUpdateTask({ ...task, status: 'in_progress' })}
                          className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 cursor-pointer shrink-0"
                        >
                          بدء
                        </button>
                      </div>
                      {(task.tags?.length || 0) > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {task.tags?.map((tg) => {
                            const st = getTagStyleForName(tg, customTags);
                            return (
                              <span
                                key={tg}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${st.badgeClass}`}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {tg}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {task.locationReminder?.enabled && (
                        <div className="inline-flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{task.locationReminder.locationName}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px]">
                        {getPriorityBadge(task.priority)}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openTaskReminderPicker(task)}
                            className={`flex items-center gap-1 cursor-pointer ${
                              scheduledReminders[`task:${task.id}`]
                                ? 'text-cyan-300 font-semibold'
                                : 'text-slate-400 hover:text-amber-300'
                            }`}
                            title="ضبط منبه للمهمة"
                          >
                            <Bell className="w-3 h-3" />
                            {scheduledReminders[`task:${task.id}`]?.timeHHMM || 'تنبيه'}
                          </button>
                          <button onClick={() => onStartFocus(task)} className="text-amber-400 flex items-center gap-1 cursor-pointer">
                            <Flame className="w-3 h-3" /> تركيز
                          </button>
                        </div>
                      </div>
                    </SwipeableTaskCard>
                  );
                })}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="bg-slate-900/70 rounded-2xl border border-cyan-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                جاري العمل الآن ({filteredTasks.filter((t) => t.status === 'in_progress').length})
              </h4>
            </div>

            <div className="space-y-2.5">
              {filteredTasks
                .filter((t) => t.status === 'in_progress')
                .map((task) => {
                  const isSwipeOpen = activeSwipe?.taskId === task.id;
                  return (
                    <SwipeableTaskCard
                      key={task.id}
                      task={task}
                      compact
                      isOpen={isSwipeOpen}
                      openSide={isSwipeOpen ? activeSwipe.side : 'left'}
                      onOpenSwipe={(side) => setActiveSwipe({ taskId: task.id, side })}
                      onCloseSwipe={() =>
                        setActiveSwipe((prev) => (prev?.taskId === task.id ? null : prev))
                      }
                      isEditingInline={inlineEditingTaskId === task.id}
                      onStartInlineEdit={() => {
                        setActiveSwipe(null);
                        setInlineEditingTaskId(task.id);
                      }}
                      onCancelInlineEdit={() => setInlineEditingTaskId(null)}
                      onSaveInlineEdit={(updatedTask) => {
                        onUpdateTask(updatedTask);
                        setInlineEditingTaskId(null);
                      }}
                      onChangePriority={(nextPriority) =>
                        handleQuickPriorityChange(task, nextPriority)
                      }
                      onDelete={() => handleQuickDeleteTask(task)}
                      savedLocations={savedLocations}
                      customTags={customTags}
                      onCreateCustomTag={onCreateCustomTag}
                      wrapperClassName="rounded-xl border border-cyan-800/60 bg-slate-950"
                      foregroundClassName="bg-slate-950 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-xs font-semibold text-slate-100">{task.title}</h5>
                        <button
                          onClick={() => onToggleTask(task.id)}
                          className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-pointer shrink-0"
                        >
                          إكمال
                        </button>
                      </div>
                      {(task.tags?.length || 0) > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {task.tags?.map((tg) => {
                            const st = getTagStyleForName(tg, customTags);
                            return (
                              <span
                                key={tg}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${st.badgeClass}`}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {tg}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {task.locationReminder?.enabled && (
                        <div className="inline-flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{task.locationReminder.locationName}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px]">
                        {getPriorityBadge(task.priority)}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openTaskReminderPicker(task)}
                            className={`flex items-center gap-1 cursor-pointer ${
                              scheduledReminders[`task:${task.id}`]
                                ? 'text-cyan-300 font-semibold'
                                : 'text-slate-400 hover:text-amber-300'
                            }`}
                            title="ضبط منبه للمهمة"
                          >
                            <Bell className="w-3 h-3" />
                            {scheduledReminders[`task:${task.id}`]?.timeHHMM || 'تنبيه'}
                          </button>
                          <button onClick={() => onStartFocus(task)} className="text-amber-400 flex items-center gap-1 font-bold cursor-pointer">
                            <Flame className="w-3 h-3" /> استمرار
                          </button>
                        </div>
                      </div>
                    </SwipeableTaskCard>
                  );
                })}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                المكتملة ({filteredTasks.filter((t) => t.status === 'completed').length})
              </h4>
            </div>

            <div className="space-y-2.5">
              {filteredTasks
                .filter((t) => t.status === 'completed')
                .map((task) => {
                  const isSwipeOpen = activeSwipe?.taskId === task.id;
                  return (
                    <SwipeableTaskCard
                      key={task.id}
                      task={task}
                      compact
                      isOpen={isSwipeOpen}
                      openSide={isSwipeOpen ? activeSwipe.side : 'left'}
                      onOpenSwipe={(side) => setActiveSwipe({ taskId: task.id, side })}
                      onCloseSwipe={() =>
                        setActiveSwipe((prev) => (prev?.taskId === task.id ? null : prev))
                      }
                      isEditingInline={inlineEditingTaskId === task.id}
                      onStartInlineEdit={() => {
                        setActiveSwipe(null);
                        setInlineEditingTaskId(task.id);
                      }}
                      onCancelInlineEdit={() => setInlineEditingTaskId(null)}
                      onSaveInlineEdit={(updatedTask) => {
                        onUpdateTask(updatedTask);
                        setInlineEditingTaskId(null);
                      }}
                      onChangePriority={(nextPriority) =>
                        handleQuickPriorityChange(task, nextPriority)
                      }
                      onDelete={() => handleQuickDeleteTask(task)}
                      savedLocations={savedLocations}
                      customTags={customTags}
                      onCreateCustomTag={onCreateCustomTag}
                      wrapperClassName="rounded-xl border border-slate-800/80 bg-slate-950 opacity-75"
                      foregroundClassName="bg-slate-950 p-3"
                    >
                      <h5 className="text-xs font-medium line-through text-slate-400">{task.title}</h5>
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => onToggleTask(task.id)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          إعادة فتح
                        </button>
                      </div>
                    </SwipeableTaskCard>
                  );
                })}
            </div>
          </div>

        </div>
      )}

      {/* VIEW 3: Eisenhower Matrix */}
      {viewMode === 'eisenhower' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Quadrant 1: Urgent & Important (Do First) */}
          <div className="bg-gradient-to-br from-rose-950/30 to-slate-900 rounded-2xl border border-rose-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-rose-800/40 pb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-rose-400" />
                <h4 className="text-xs font-bold text-rose-300">مهم وعاجل (افعله فوراً)</h4>
              </div>
              <span className="text-[11px] text-rose-400 font-semibold">
                {filteredTasks.filter((t) => t.priority === 'high' && t.status !== 'completed').length} مهام
              </span>
            </div>

            <div className="space-y-2">
              {filteredTasks
                .filter((t) => t.priority === 'high' && t.status !== 'completed')
                .map((t) => (
                  <div key={t.id} className="bg-slate-950 border border-rose-900/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-200 font-medium truncate">{t.title}</span>
                    <button onClick={() => onStartFocus(t)} className="p-1 rounded bg-amber-500 text-slate-950 text-xs font-bold shrink-0">
                      <Flame className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Quadrant 2: Important, Not Urgent (Schedule / Deep Work) */}
          <div className="bg-gradient-to-br from-cyan-950/30 to-slate-900 rounded-2xl border border-cyan-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-cyan-800/40 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-cyan-300">مهم وغير عاجل (جدوله وركّز عليه)</h4>
              </div>
              <span className="text-[11px] text-cyan-400 font-semibold">
                {filteredTasks.filter((t) => t.priority === 'medium' && t.status !== 'completed').length} مهام
              </span>
            </div>

            <div className="space-y-2">
              {filteredTasks
                .filter((t) => t.priority === 'medium' && t.status !== 'completed')
                .map((t) => (
                  <div key={t.id} className="bg-slate-950 border border-cyan-900/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-200 font-medium truncate">{t.title}</span>
                    <button onClick={() => onOpenTaskBreakdown(t)} className="p-1 rounded bg-slate-800 text-cyan-400 text-xs shrink-0">
                      <Split className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Quadrant 3: Urgent, Not Important (Delegate / Batch) */}
          <div className="bg-gradient-to-br from-amber-950/20 to-slate-900 rounded-2xl border border-amber-800/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-800/30 pb-2">
              <h4 className="text-xs font-bold text-amber-300">عاجل وغير مهم (بسّطه أو فوّضه)</h4>
              <span className="text-[11px] text-amber-400 font-semibold">
                {filteredTasks.filter((t) => t.category === 'urgent' && t.priority !== 'high' && t.status !== 'completed').length} مهام
              </span>
            </div>
            <div className="space-y-2">
              {filteredTasks
                .filter((t) => t.category === 'urgent' && t.priority !== 'high' && t.status !== 'completed')
                .map((t) => (
                  <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 truncate">
                    {t.title}
                  </div>
                ))}
            </div>
          </div>

          {/* Quadrant 4: Not Urgent & Not Important (Eliminate / Defer) */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-400">غير عاجل وغير مهم (تجنبه أو أجّله)</h4>
              <span className="text-[11px] text-slate-400 font-semibold">
                {filteredTasks.filter((t) => t.priority === 'low' && t.status !== 'completed').length} مهام
              </span>
            </div>
            <div className="space-y-2">
              {filteredTasks
                .filter((t) => t.priority === 'low' && t.status !== 'completed')
                .map((t) => (
                  <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-400 truncate">
                    {t.title}
                  </div>
                ))}
            </div>
          </div>

        </div>
      )}

      <ReminderTimePickerModal
        target={reminderTarget}
        existingReminder={
          reminderTarget ? scheduledReminders[reminderTarget.itemKey] : undefined
        }
        onClose={() => setReminderTarget(null)}
      />

      {onSaveLocation && (
        <LocationPickerModal
          isOpen={locationPickerOpen}
          onClose={() => setLocationPickerOpen(false)}
          onSave={(loc) => {
            onSaveLocation(loc);
            setNewLocationId(loc.id);
          }}
        />
      )}

      <CsvTaskImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        existingTasks={tasks}
        customTags={customTags}
        onImportTasks={(importedTasks, options) => {
          if (onImportTasks) {
            onImportTasks(importedTasks, options);
          } else {
            importedTasks.forEach((t) => onAddTask(t));
          }
          setCsvImportSuccessMsg(
            `تم استيراد ${importedTasks.length} مهمة من ملف CSV وإضافتها إلى مهامك بنجاح.`
          );
        }}
      />

    </div>
  );
};
