export type Priority = 'high' | 'medium' | 'low';

export type TaskCategory = 'work' | 'personal' | 'health' | 'study' | 'urgent';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface SubTask {
  id: string;
  title: string;
  estimatedMinutes?: number;
  completed: boolean;
  focusTip?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: Priority;
  status: TaskStatus;
  estimatedMinutes?: number;
  dueDate?: string;
  dueTime?: string;
  energyRequired: 'high' | 'medium' | 'low';
  subtasks?: SubTask[];
  isTopPriority?: boolean;
  createdAt: string;
  completedAt?: string;
  goalId?: string;
  suggestedPostpone?: boolean;
  isUnclassified?: boolean;
}

export interface TimeBlock {
  id: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:30"
  title: string;
  description?: string;
  category: 'deep_work' | 'meeting' | 'routine' | 'health' | 'personal' | 'review';
  priority?: Priority;
  energyLevel?: 'high' | 'medium' | 'low';
  relatedTaskId?: string;
  isCompleted?: boolean;
  isFixed?: boolean;
  iconName?: string;
  date?: string; // YYYY-MM-DD (Gregorian ISO, mapped to Hijri automatically)
}

export interface DigitalTwinProfile {
  name: string;
  role: string;
  avatarSeed?: string;
  tone: 'disciplined' | 'encouraging' | 'analytical' | 'calm' | 'humorous';
  peakEnergy: string;
  workStyle: string;
  mainGoals: string;
  rules: string;
  dailyWorkHoursTarget: number;
  weeklyCompletionGoalRate?: number;
  dailyEnergyLevel?: 'low' | 'medium' | 'high';
  endOfDayOverloadAlertEnabled?: boolean;
  endOfDayAlertTime?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'twin';
  content: string;
  timestamp: string;
  isVoiceNote?: boolean;
  voiceDurationSeconds?: number;
  voiceSummary?: string;
  extractedTasks?: Partial<Task>[];
  extractedEvents?: Partial<TimeBlock>[];
  suggestedGoals?: Partial<LongTermGoal>[];
  tasksImported?: boolean;
  goalsImported?: boolean;
  suggestedAction?: {
    type:
      | 'create_task'
      | 'open_schedule'
      | 'open_tasks'
      | 'start_focus'
      | 'breakdown_task'
      | 'optimize_schedule'
      | 'none';
    label: string;
    taskId?: string;
    payload?: any;
  };
}

export interface DailyBriefing {
  headline: string;
  mainAdvice: string;
  topPriorities: string[];
  energyQuote: string;
  syncScore?: number;
  generatedAt: string;
  type: 'morning' | 'evening';
}

export interface LongTermGoal {
  id: string;
  title: string;
  category: 'work' | 'personal' | 'learning' | 'health';
  progress: number; // 0 - 100
  targetDate: string;
  associatedProject?: string;
}

export interface ContextualBriefing {
  taskId: string;
  summary: string;
  keyNotes: string[];
  suggestedAction: string;
}

export interface BurnoutEvaluation {
  isOverloaded: boolean;
  message: string;
  recommendedAction: string;
}

export interface QuranRoutineItem {
  id: string;
  type: 'review' | 'reading' | 'memorization';
  title: string;
  targetAmount: string;
  completed: boolean;
  timeSlot: string;
  streak: number;
  quickLink?: string; // رابط فتح المصحف الرقمي أو التطبيق
}

export interface DailyAdhkarState {
  date: string;
  morningCompleted: boolean;
  eveningCompleted: boolean;
  totalFullDaysCompleted: number;
  lastCountedFullDay?: string;
  morningCompletedAt?: string;
  eveningCompletedAt?: string;
}

export type DashboardSectionId =
  | 'mental_state'
  | 'quran_tracker'
  | 'phone_apps'
  | 'twin_avatar'
  | 'burnout_banner'
  | 'current_block'
  | 'priorities_and_schedule'
  | 'weekly_goal_chart'
  | 'productivity_stats'
  | 'long_term_goals';

export interface DashboardLayoutEntry {
  id: string; // either a DashboardSectionId or a CustomDashboardWidget id
  isCustom?: boolean;
  visible: boolean;
}

export type CustomWidgetKind = 'note' | 'checklist' | 'counter' | 'links';

export type CustomWidgetColor = 'cyan' | 'emerald' | 'amber' | 'indigo' | 'rose';

export interface CustomWidgetItem {
  id: string;
  text: string;
  done?: boolean;
  url?: string;
}

export interface CustomDashboardWidget {
  id: string;
  kind: CustomWidgetKind;
  title: string;
  icon: string;
  color: CustomWidgetColor;
  content?: string;
  items?: CustomWidgetItem[];
  count?: number;
  target?: number;
  unit?: string;
  createdAt: string;
}

export interface PhoneAppShortcut {
  id: string;
  name: string;
  icon: string;
  deepLink: string;
  fallbackUrl?: string;
  note?: string;
}

export interface PhoneAppList {
  id: string;
  title: string;
  icon: string;
  color: CustomWidgetColor;
  apps: PhoneAppShortcut[];
}


