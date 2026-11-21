import React, { useState } from 'react';
import {
  Sparkles,
  Flame,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ArrowUpRight,
  Split,
  Zap,
  Coffee,
  Users,
  CheckSquare,
  Play,
  FileText,
  CalendarClock,
  LayoutGrid,
  Plus,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Edit3,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  DigitalTwinProfile,
  Task,
  TimeBlock,
  LongTermGoal,
  QuranRoutineItem,
  DailyAdhkarState,
  DashboardLayoutEntry,
  CustomDashboardWidget,
  PhoneAppList,
  PhoneAppShortcut,
} from '../types';
import { TwinAvatarWidget } from './TwinAvatarWidget';
import { MentalStateSummaryCard } from './MentalStateSummaryCard';
import { ProductivityStatsPanel } from './ProductivityStatsPanel';
import { WeeklyGoalComparisonChart } from './WeeklyGoalComparisonChart';
import { LongTermGoalsView } from './LongTermGoalsView';
import { QuranTrackerView } from './QuranTrackerView';
import { PhoneAppsLauncherView } from './PhoneAppsLauncherView';
import { CustomDashboardWidgetCard } from './CustomDashboardWidgetCard';
import { DashboardCustomizerModal } from './DashboardCustomizerModal';
import { VoiceCommandPanel } from './VoiceCommandPanel';
import { evaluateTaskUrgency } from '../utils/reminderEngine';
import {
  evaluateCognitiveLoad,
  getSmartReschedulingSuggestions,
  getTomorrowDateString,
} from '../utils/burnoutEngine';
import { initialGoals, initialQuranRoutine } from '../data/initialData';
import {
  BUILTIN_DASHBOARD_SECTIONS,
  DEFAULT_DASHBOARD_LAYOUT,
  INITIAL_PHONE_APP_LISTS,
} from '../data/dashboardDefaults';
import { getDualDateInfo } from '../utils/calendarUtils';
import { broadcastCloseAllModals, useModalCloseListener } from '../utils/modalCoordinator';

interface DashboardViewProps {
  profile: DigitalTwinProfile;
  tasks: Task[];
  schedule: TimeBlock[];
  onToggleTask: (taskId: string) => void;
  onToggleScheduleBlock: (blockId: string) => void;
  onStartFocus: (task?: Task) => void;
  onOpenTaskBreakdown: (task: Task) => void;
  onOpenChat: (initialPrompt?: string) => void;
  onOpenQuickAdd: () => void;
  onOpenBriefing: (type: 'morning' | 'evening') => void;
  onNavigateTab: (tab: 'tasks' | 'schedule' | 'focus') => void;
  goals?: LongTermGoal[];
  onAddGoal: (goal: Omit<LongTermGoal, 'id'>) => void;
  onUpdateGoal?: (goal: LongTermGoal) => void;
  onUpdateGoalProgress: (goalId: string, progress: number) => void;
  onDeleteGoal: (goalId: string) => void;
  onOpenContextualBriefing: (task: Task) => void;
  onPostponeTask: (taskId: string) => void;
  onPostponeAllSuggested: () => void;
  quranRoutine?: QuranRoutineItem[];
  onToggleQuranRoutine: (id: string) => void;
  onAddQuranRoutine?: (item: Omit<QuranRoutineItem, 'id'>) => void;
  onUpdateQuranRoutine?: (item: QuranRoutineItem) => void;
  onDeleteQuranRoutine?: (id: string) => void;
  onResetDailyQuranRoutine?: () => void;
  adhkarState?: DailyAdhkarState;
  onToggleAdhkar?: (period: 'morning' | 'evening') => void;
  quranNotificationsEnabled?: boolean;
  onToggleQuranNotifications?: () => void;
  onOpenProfile?: () => void;
  dashboardLayout?: DashboardLayoutEntry[];
  customWidgets?: CustomDashboardWidget[];
  onToggleWidgetVisibility?: (id: string) => void;
  onMoveLayoutEntry?: (id: string, direction: 'up' | 'down') => void;
  onResetDashboardLayout?: () => void;
  onAddCustomWidget?: (widget: Omit<CustomDashboardWidget, 'id' | 'createdAt'>) => void;
  onUpdateCustomWidget?: (widget: CustomDashboardWidget) => void;
  onDeleteCustomWidget?: (widgetId: string) => void;
  phoneAppLists?: PhoneAppList[];
  onAddPhoneAppList?: (list: Omit<PhoneAppList, 'id'>) => void;
  onUpdatePhoneAppList?: (list: PhoneAppList) => void;
  onDeletePhoneAppList?: (listId: string) => void;
  onAddPhoneAppToList?: (listId: string, app: Omit<PhoneAppShortcut, 'id'>) => void;
  onUpdatePhoneAppInList?: (listId: string, app: PhoneAppShortcut) => void;
  onDeletePhoneAppFromList?: (listId: string, appId: string) => void;
  onAddExtracted?: (tasks: Partial<Task>[], events: Partial<TimeBlock>[]) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  tasks,
  schedule,
  onToggleTask,
  onToggleScheduleBlock,
  onStartFocus,
  onOpenTaskBreakdown,
  onOpenChat,
  onOpenQuickAdd,
  onOpenBriefing,
  onNavigateTab,
  goals = initialGoals,
  onAddGoal,
  onUpdateGoal,
  onUpdateGoalProgress,
  onDeleteGoal,
  onOpenContextualBriefing,
  onPostponeTask,
  onPostponeAllSuggested,
  quranRoutine = initialQuranRoutine,
  onToggleQuranRoutine,
  onAddQuranRoutine,
  onUpdateQuranRoutine,
  onDeleteQuranRoutine,
  onResetDailyQuranRoutine,
  adhkarState,
  onToggleAdhkar,
  quranNotificationsEnabled,
  onToggleQuranNotifications,
  onOpenProfile,
  dashboardLayout = DEFAULT_DASHBOARD_LAYOUT,
  customWidgets = [],
  onToggleWidgetVisibility,
  onMoveLayoutEntry,
  onResetDashboardLayout,
  onAddCustomWidget,
  onUpdateCustomWidget,
  onDeleteCustomWidget,
  phoneAppLists = INITIAL_PHONE_APP_LISTS,
  onAddPhoneAppList,
  onUpdatePhoneAppList,
  onDeletePhoneAppList,
  onAddPhoneAppToList,
  onUpdatePhoneAppInList,
  onDeletePhoneAppFromList,
  onAddExtracted,
}) => {
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerMode, setCustomizerMode] = useState<'create' | 'manage'>('manage');
  const [editingCustomWidget, setEditingCustomWidget] = useState<CustomDashboardWidget | null>(
    null
  );

  useModalCloseListener('customizer-modal', () => {
    setCustomizerOpen(false);
    setEditingCustomWidget(null);
  });

  const openCustomizerModal = (
    mode: 'create' | 'manage',
    widget: CustomDashboardWidget | null = null
  ) => {
    broadcastCloseAllModals('customizer-modal');
    setEditingCustomWidget(widget);
    setCustomizerMode(mode);
    setCustomizerOpen(true);
  };

  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const activeTopTasks = tasks.filter((t) => t.isTopPriority || t.priority === 'high');
  const burnoutStatus = evaluateCognitiveLoad(tasks);
  const [rescheduleFeedback, setRescheduleFeedback] = useState<string | null>(null);
  const tomorrowStr = getTomorrowDateString();
  const suggestedToPostpone = getSmartReschedulingSuggestions(tasks).filter(
    (t) => t.suggestedPostpone && (!t.dueDate || t.dueDate < tomorrowStr)
  );

  // Find currently active timeblock based on current time
  const now = new Date();
  const currentHours = now.getHours().toString().padStart(2, '0');
  const currentMinutes = now.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  const currentBlock =
    schedule.find((b) => b.startTime <= currentTimeStr && b.endTime >= currentTimeStr) ||
    schedule.find((b) => b.startTime > currentTimeStr) ||
    schedule[0];

  const hiddenEntries = dashboardLayout.filter((entry) => !entry.visible);

  const getSectionTitle = (entry: DashboardLayoutEntry): string => {
    if (entry.isCustom) {
      return customWidgets.find((w) => w.id === entry.id)?.title || 'مكون مخصص';
    }
    return BUILTIN_DASHBOARD_SECTIONS.find((s) => s.id === entry.id)?.label || entry.id;
  };

  const renderSectionContent = (entry: DashboardLayoutEntry): React.ReactNode => {
    if (entry.isCustom) {
      const widget = customWidgets.find((w) => w.id === entry.id);
      if (!widget || !onUpdateCustomWidget || !onDeleteCustomWidget) return null;
      return (
        <CustomDashboardWidgetCard
          widget={widget}
          onUpdateWidget={onUpdateCustomWidget}
          onEditWidget={(w) => openCustomizerModal('create', w)}
          onDeleteWidget={onDeleteCustomWidget}
        />
      );
    }

    switch (entry.id) {
      case 'mental_state':
        return (
          <MentalStateSummaryCard
            profile={profile}
            tasks={tasks}
            onStartFocus={onStartFocus}
            onOpenChat={onOpenChat}
            onNavigateTasks={() => onNavigateTab('tasks')}
          />
        );

      case 'quran_tracker': {
        const isWorshipPriority = Boolean(profile.focusAreas?.includes('worship'));
        const tracker = (
          <QuranTrackerView
            initialItems={quranRoutine}
            onToggleItem={onToggleQuranRoutine}
            onAddItem={onAddQuranRoutine}
            onUpdateItem={onUpdateQuranRoutine}
            onDeleteItem={onDeleteQuranRoutine}
            onResetDaily={onResetDailyQuranRoutine}
            adhkarState={adhkarState}
            onToggleAdhkar={onToggleAdhkar}
            notificationsEnabled={quranNotificationsEnabled}
            onToggleNotifications={onToggleQuranNotifications}
          />
        );
        if (!isWorshipPriority) return tracker;
        return (
          <div className="rounded-3xl p-1 bg-gradient-to-br from-emerald-500/40 via-cyan-500/20 to-emerald-700/30 shadow-xl shadow-emerald-950/40">
            <div className="flex items-center justify-between px-4 py-2 text-xs font-bold text-emerald-200">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>مُبرز في واجهتك الرئيسية: ويدجت الأذكار وتعاهد القرآن</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] text-emerald-200">
                مجال العبادة
              </span>
            </div>
            {tracker}
          </div>
        );
      }

      case 'phone_apps':
        if (
          !onAddPhoneAppList ||
          !onUpdatePhoneAppList ||
          !onDeletePhoneAppList ||
          !onAddPhoneAppToList ||
          !onUpdatePhoneAppInList ||
          !onDeletePhoneAppFromList
        ) {
          return null;
        }
        return (
          <PhoneAppsLauncherView
            lists={phoneAppLists}
            onAddList={onAddPhoneAppList}
            onUpdateList={onUpdatePhoneAppList}
            onDeleteList={onDeletePhoneAppList}
            onAddAppToList={onAddPhoneAppToList}
            onUpdateAppInList={onUpdatePhoneAppInList}
            onDeleteAppFromList={onDeletePhoneAppFromList}
          />
        );

      case 'twin_avatar':
        return (
          <TwinAvatarWidget
            profile={profile}
            tasks={tasks}
            completedTasksCount={completedTasks.length}
            totalTasksCount={tasks.length}
            onOpenChat={onOpenChat}
            onOpenBriefing={onOpenBriefing}
            onNavigateToSchedule={() => onNavigateTab('schedule')}
          />
        );

      case 'burnout_banner':
        return (
          <>
            {burnoutStatus.isOverloaded ? (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h4 className="font-bold text-amber-200">تنبيه الحمل المعرفي</h4>
                    <p className="text-xs sm:text-sm text-amber-300/90">{burnoutStatus.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="btn-dashboard-postpone-suggested"
                    onClick={() => {
                      onPostponeAllSuggested();
                      setRescheduleFeedback(
                        'تم تفعيل وضع إعادة التوزيع الذكي للجدول وتخفيف ضغط المهام الشاقة.'
                      );
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-md whitespace-nowrap cursor-pointer"
                  >
                    إعادة جدولة ذكية
                  </button>
                  <button
                    onClick={() => onNavigateTab('schedule')}
                    className="px-3 py-2 rounded-xl bg-slate-900/70 hover:bg-slate-800 text-amber-200 border border-amber-500/30 text-xs font-medium transition-all whitespace-nowrap cursor-pointer"
                  >
                    مراجعة الجدول
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800/80 text-emerald-300/90 px-4 py-2.5 rounded-xl text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span>✨</span>
                  <span>{burnoutStatus.message}</span>
                </div>
                {suggestedToPostpone.length > 0 && (
                  <button
                    id="btn-dashboard-postpone-suggested"
                    onClick={() => {
                      onPostponeAllSuggested();
                      setRescheduleFeedback(
                        'تم تأجيل المهام منخفضة الأولوية للغد للحفاظ على توازن جدولك.'
                      );
                    }}
                    className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-950 text-cyan-300 border border-slate-700 transition-all cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>تأجيل {suggestedToPostpone.length} مهام منخفضة للغد</span>
                  </button>
                )}
              </div>
            )}

            {rescheduleFeedback && (
              <div className="mt-3 bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-3 animate-fadeIn">
                <span>✅ {rescheduleFeedback}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onNavigateTab('schedule')}
                    className="text-cyan-300 hover:underline font-semibold cursor-pointer"
                  >
                    فتح الجدول الذكي
                  </button>
                  <button
                    onClick={() => setRescheduleFeedback(null)}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}
          </>
        );

      case 'current_block':
        if (!currentBlock) return null;
        return (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 rounded-2xl border border-indigo-800/40 p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider bg-indigo-900/60 px-2 py-0.5 rounded-full">
                    الكتلة الزمنية الحالية
                  </span>
                  <span className="text-xs text-slate-400">
                    {currentBlock.startTime} - {currentBlock.endTime}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">
                  {currentBlock.title}
                </h3>
                {currentBlock.description && (
                  <p className="text-xs text-slate-400 line-clamp-1">{currentBlock.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                id="btn-schedule-jump-focus"
                onClick={() => {
                  const related = tasks.find((t) => t.id === currentBlock.relatedTaskId);
                  onStartFocus(related);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>بدء التركيز في هذا البلوك</span>
              </button>

              <button
                onClick={() => onToggleScheduleBlock(currentBlock.id)}
                className={`p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  currentBlock.isCompleted
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title={currentBlock.isCompleted ? 'مكتمل' : 'تحديد كمكتمل'}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'priorities_and_schedule':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Top Priorities (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-slate-100">
                    أهم أولويات اليوم لا تقبل التأجيل
                  </h3>
                </div>
                <button
                  onClick={() => onNavigateTab('tasks')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>عرض كل المهام</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {activeTopTasks.length === 0 ? (
                  <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-8 text-center">
                    <CheckSquare className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-medium text-slate-200">
                      أحسنت! لا توجد أولويات عاجلة معلقة حالياً
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      نسختك الرقمية مستعدة لجدولة مهام جديدة
                    </p>
                    <button
                      onClick={onOpenQuickAdd}
                      className="mt-4 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      إضافة مهمة جديدة
                    </button>
                  </div>
                ) : (
                  activeTopTasks.slice(0, 3).map((task) => {
                    const isCompleted = task.status === 'completed';
                    const subtasksCount = task.subtasks?.length || 0;
                    const completedSubtasks =
                      task.subtasks?.filter((s) => s.completed).length || 0;
                    const urgencyInfo = evaluateTaskUrgency(task);

                    return (
                      <div
                        key={task.id}
                        className={`rounded-2xl border p-4 transition-all duration-200 ${
                          isCompleted
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                            : urgencyInfo?.urgency === 'overdue'
                            ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-700 shadow-md'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <button
                              onClick={() => onToggleTask(task.id)}
                              className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
                              ) : (
                                <Circle className="w-5 h-5 hover:scale-110 transition-transform" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <h4
                                className={`text-sm font-semibold text-slate-100 truncate ${
                                  isCompleted ? 'line-through text-slate-400' : ''
                                }`}
                              >
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                  {task.description}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px]">
                                <span className="px-2 py-0.5 rounded-md bg-rose-950/70 text-rose-300 border border-rose-800/60 font-medium">
                                  أولوية قصوى
                                </span>

                                {urgencyInfo && (
                                  <span
                                    className={`px-2 py-0.5 rounded-md border font-bold ${
                                      urgencyInfo.urgency === 'overdue'
                                        ? 'bg-rose-950 text-rose-300 border-rose-700/70'
                                        : 'bg-amber-950 text-amber-300 border-amber-700/70'
                                    }`}
                                  >
                                    {urgencyInfo.timeLabel}
                                  </span>
                                )}

                                {task.estimatedMinutes && (
                                  <span className="flex items-center gap-1 text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                                    <Clock className="w-3 h-3 text-cyan-400" />
                                    {task.estimatedMinutes} دقيقة
                                  </span>
                                )}

                                {subtasksCount > 0 && (
                                  <span className="text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                                    الخطوات: {completedSubtasks}/{subtasksCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => onOpenContextualBriefing(task)}
                              className="p-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/70 transition-all cursor-pointer"
                              title="الموجز السياقي للمهمة"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenTaskBreakdown(task)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700/80 transition-all cursor-pointer"
                              title="تفكيك المهمة مع التوأم الرقمي"
                            >
                              <Split className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onStartFocus(task)}
                              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 transition-all font-medium flex items-center gap-1 text-xs cursor-pointer"
                              title="بدء جلسة تركيز لهذه المهمة"
                            >
                              <Flame className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {subtasksCount > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/60">
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{
                                  width: `${(completedSubtasks / subtasksCount) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="bg-gradient-to-r from-slate-900 to-cyan-950/40 rounded-2xl border border-cyan-900/40 p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-cyan-300">قاعدة نسختك الرقمية لليوم</h5>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    &quot;
                    {profile.rules?.split('\n')[0] ||
                      'أنجز المهمة الأثقل ذهنياً في ساعات ذروة الصباح قبل فتح التشتت.'}
                    &quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Daily Timeline Flow Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="text-base font-bold text-slate-100">تسلسل الجدول اليومي</h3>
                    <p className="text-[11px] text-emerald-300/90">
                      {getDualDateInfo(now).hijriFull} • {getDualDateInfo(now).gregorianFull}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigateTab('schedule')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>التقويم والجدول الكامل</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-3">
                {schedule.slice(0, 5).map((block) => {
                  const isCompleted = block.isCompleted;

                  let catBadge = 'bg-slate-800 text-slate-300';
                  if (block.category === 'deep_work')
                    catBadge = 'bg-amber-950/80 text-amber-300 border-amber-800/60';
                  if (block.category === 'meeting')
                    catBadge = 'bg-blue-950/80 text-blue-300 border-blue-800/60';
                  if (block.category === 'health')
                    catBadge = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';

                  return (
                    <div
                      key={block.id}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                        isCompleted
                          ? 'bg-slate-950/50 border-slate-800/50 opacity-60'
                          : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={() => onToggleScheduleBlock(block.id)}
                          className="text-slate-400 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold text-slate-200 truncate ${
                              isCompleted ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {block.title}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {block.startTime} - {block.endTime}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-medium shrink-0 ${catBadge}`}
                      >
                        {block.category === 'deep_work' && 'تركيز عميق'}
                        {block.category === 'meeting' && 'اجتماع'}
                        {block.category === 'health' && 'صحة وراحة'}
                        {block.category === 'routine' && 'روتين'}
                        {block.category === 'review' && 'مراجعة'}
                        {block.category === 'personal' && 'شخصي'}
                      </span>
                    </div>
                  );
                })}

                <button
                  onClick={() => onNavigateTab('schedule')}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>إعادة تحسين وتوزيع اليوم مع التوأم</span>
                </button>
              </div>
            </div>
          </div>
        );

      case 'weekly_goal_chart':
        return (
          <WeeklyGoalComparisonChart
            tasks={tasks}
            profile={profile}
            onOpenProfile={onOpenProfile}
          />
        );

      case 'productivity_stats':
        return <ProductivityStatsPanel tasks={tasks} schedule={schedule} />;

      case 'long_term_goals':
        return (
          <LongTermGoalsView
            goals={goals}
            onAddGoal={onAddGoal}
            onUpdateGoal={onUpdateGoal}
            onUpdateGoalProgress={onUpdateGoalProgress}
            onDeleteGoal={onDeleteGoal}
          />
        );

      default:
        return null;
    }
  };

  const renderLayoutEntry = (entry: DashboardLayoutEntry, idx: number): React.ReactNode => {
    if (!entry.visible) return null;
    const content = renderSectionContent(entry);
    if (!content) return null;

    const customWidget = entry.isCustom
      ? customWidgets.find((w) => w.id === entry.id)
      : undefined;

    if (!isLayoutEditMode) {
      return <React.Fragment key={entry.id}>{content}</React.Fragment>;
    }

    return (
      <div
        key={entry.id}
        className="rounded-2xl border-2 border-dashed border-cyan-500/40 p-2 bg-cyan-950/10 space-y-2 transition-all"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-slate-800 text-xs">
          <div className="flex items-center gap-2 font-bold text-cyan-300">
            <span>{getSectionTitle(entry)}</span>
            {entry.isCustom && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                مخصص
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onMoveLayoutEntry && (
              <>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => onMoveLayoutEntry(entry.id, 'up')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 cursor-pointer disabled:cursor-not-allowed"
                  title="تحريك لأعلى"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === dashboardLayout.length - 1}
                  onClick={() => onMoveLayoutEntry(entry.id, 'down')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 cursor-pointer disabled:cursor-not-allowed"
                  title="تحريك لأسفل"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {customWidget && (
              <button
                type="button"
                onClick={() => openCustomizerModal('create', customWidget)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>تعديل</span>
              </button>
            )}

            {onToggleWidgetVisibility && (
              <button
                type="button"
                onClick={() => onToggleWidgetVisibility(entry.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-950 text-amber-300 cursor-pointer"
                title="إخفاء من اللوحة"
              >
                <EyeOff className="w-3 h-3" />
                <span>إخفاء</span>
              </button>
            )}

            {customWidget && onDeleteCustomWidget && (
              <button
                type="button"
                onClick={() => onDeleteCustomWidget(customWidget.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 cursor-pointer"
                title="حذف نهائي"
              >
                <Trash2 className="w-3 h-3" />
                <span>حذف</span>
              </button>
            )}
          </div>
        </div>

        {content}
      </div>
    );
  };

  const isTwinFirst =
    dashboardLayout[0]?.id === 'twin_avatar' && Boolean(dashboardLayout[0]?.visible);
  const remainingLayout = isTwinFirst ? dashboardLayout.slice(1) : dashboardLayout;
  const remainingOffset = isTwinFirst ? 1 : 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* بطاقة التوأم الرقمي في أعلى الصفحة */}
      {isTwinFirst && renderLayoutEntry(dashboardLayout[0], 0)}

      {/* شريط أدوات إدارة وإضافة وتعديل مكونات اللوحة */}
      <div className="bg-slate-900/75 border border-slate-800/90 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <LayoutGrid className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-semibold text-slate-200">لوحة التحكم المخصصة</span>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline">
            يمكنك إضافة مكونات جديدة أو تعديل وترتيب وحذف أي مكون
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onAddCustomWidget && (
            <button
              type="button"
              id="btn-add-custom-component"
              onClick={() => openCustomizerModal('create', null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مكون جديد</span>
            </button>
          )}

          {onToggleWidgetVisibility && (
            <button
              type="button"
              id="btn-manage-dashboard-components"
              onClick={() => openCustomizerModal('manage', null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>تخصيص المكونات</span>
            </button>
          )}

          <button
            type="button"
            id="btn-toggle-layout-edit-mode"
            onClick={() => setIsLayoutEditMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isLayoutEditMode
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isLayoutEditMode ? 'إنهاء تعديل اللوحة' : 'تعديل وترتيب سريع'}</span>
          </button>
        </div>
      </div>

      {/* Direct Voice Command Center (Web Speech API) */}
      {onAddExtracted && <VoiceCommandPanel onAddExtracted={onAddExtracted} />}

      {/* Render Dashboard Components in User Order */}
      {remainingLayout.map((entry, idx) => renderLayoutEntry(entry, idx + remainingOffset))}

      {/* Hidden components quick restore bar */}
      {hiddenEntries.length > 0 && onToggleWidgetVisibility && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-semibold">
              مكونات مخفية ({hiddenEntries.length}):
            </span>
            {hiddenEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onToggleWidgetVisibility(entry.id)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-700 transition-colors cursor-pointer"
              >
                + إعادة {getSectionTitle(entry)}
              </button>
            ))}
          </div>
          {onResetDashboardLayout && (
            <button
              type="button"
              onClick={onResetDashboardLayout}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الكل</span>
            </button>
          )}
        </div>
      )}

      {/* Customizer Modal */}
      {onToggleWidgetVisibility &&
        onMoveLayoutEntry &&
        onResetDashboardLayout &&
        onAddCustomWidget &&
        onUpdateCustomWidget &&
        onDeleteCustomWidget && (
          <DashboardCustomizerModal
            isOpen={customizerOpen}
            onClose={() => {
              setCustomizerOpen(false);
              setEditingCustomWidget(null);
            }}
            initialMode={customizerMode}
            editingWidget={editingCustomWidget}
            layout={dashboardLayout}
            customWidgets={customWidgets}
            onToggleVisibility={onToggleWidgetVisibility}
            onMoveEntry={onMoveLayoutEntry}
            onResetLayout={onResetDashboardLayout}
            onAddCustomWidget={onAddCustomWidget}
            onUpdateCustomWidget={onUpdateCustomWidget}
            onDeleteCustomWidget={onDeleteCustomWidget}
          />
        )}
    </div>
  );
};
