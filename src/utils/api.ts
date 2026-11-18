import {
  DigitalTwinProfile,
  Task,
  TaskCategory,
  Priority,
  TimeBlock,
  ChatMessage,
  DailyBriefing,
  LongTermGoal,
  ContextualBriefing,
  QuranRoutineItem,
  DailyAdhkarState,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface DigitalAssistantResponse {
  reply: string;
  suggestedTasks: Partial<Task>[];
  suggestedEvents: Partial<TimeBlock>[];
  suggestedGoals: Partial<LongTermGoal>[];
  suggestedAction?: {
    type: 'start_focus' | 'optimize_schedule' | 'open_schedule' | 'open_tasks' | 'none';
    label: string;
    taskId?: string;
  };
}

export async function askDigitalAssistant(params: {
  message: string;
  history: ChatMessage[];
  profile: DigitalTwinProfile;
  tasks: Task[];
  schedule: TimeBlock[];
  goals?: LongTermGoal[];
  quranRoutine?: QuranRoutineItem[];
  adhkarState?: DailyAdhkarState;
  currentDate?: string;
}): Promise<DigitalAssistantResponse> {
  const res = await fetch(`${API_BASE}/api/twin/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل الاتصال بالمساعد الرقمي AI');
  }
  return res.json();
}

export async function askTwinChat(params: {
  message: string;
  history: ChatMessage[];
  profile: DigitalTwinProfile;
  tasks: Task[];
  schedule: TimeBlock[];
  context?: string;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/api/twin/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل الاتصال بالتوأم الرقمي');
  }
  const data = await res.json();
  return data.reply;
}

export async function optimizeScheduleWithAI(params: {
  tasks: Task[];
  fixedEvents: TimeBlock[];
  profile: DigitalTwinProfile;
  date?: string;
  targetWorkHours?: number;
}): Promise<{
  summary: string;
  energyStrategy: string;
  timeBlocks: TimeBlock[];
  topPriorities: string[];
  warnings?: string[];
}> {
  const res = await fetch(`${API_BASE}/api/twin/optimize-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل تحسين الجدول الزمني');
  }
  return res.json();
}

export async function breakdownTaskWithAI(params: {
  taskTitle: string;
  taskDescription?: string;
  estimatedHours?: string;
  profile: DigitalTwinProfile;
}): Promise<{
  breakdownOverview: string;
  quickWinTip: string;
  subtasks: {
    title: string;
    estimatedMinutes: number;
    difficulty: 'easy' | 'medium' | 'hard';
    focusTip?: string;
  }[];
}> {
  const res = await fetch(`${API_BASE}/api/twin/breakdown-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل تفكيك المهمة');
  }
  return res.json();
}

export async function parseQuickEntryWithAI(params: {
  naturalText: string;
  currentDate?: string;
}): Promise<{
  extractedTasks: Partial<Task>[];
  extractedEvents: Partial<TimeBlock>[];
  twinComment: string;
}> {
  const res = await fetch(`${API_BASE}/api/twin/parse-quick-entry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل معالجة النص الذكي');
  }
  return res.json();
}

export async function generateBriefingWithAI(params: {
  type: 'morning' | 'evening';
  profile: DigitalTwinProfile;
  tasks: Task[];
  completedTasks: Task[];
  schedule: TimeBlock[];
}): Promise<DailyBriefing> {
  const res = await fetch(`${API_BASE}/api/twin/briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل توليد التقرير');
  }
  const data = await res.json();
  return {
    ...data,
    generatedAt: new Date().toISOString(),
    type: params.type,
  };
}

export async function processVoiceNoteWithAI(params: {
  audioBase64: string;
  mimeType: string;
  profile: DigitalTwinProfile;
  tasks: Task[];
  schedule: TimeBlock[];
  currentDate?: string;
}): Promise<{
  transcript: string;
  summary: string;
  twinReply: string;
  extractedTasks: Partial<Task>[];
  extractedEvents: Partial<TimeBlock>[];
}> {
  const res = await fetch(`${API_BASE}/api/twin/voice-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل تفريغ وتحليل الملاحظة الصوتية');
  }
  return res.json();
}

export async function generateContextualBriefingWithAI(params: {
  task: Task;
  profile: DigitalTwinProfile;
  schedule: TimeBlock[];
  goals: LongTermGoal[];
}): Promise<ContextualBriefing> {
  const res = await fetch(`${API_BASE}/api/twin/contextual-briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل توليد الموجز السياقي للمهمة');
  }
  return res.json();
}

export async function classifyTasksWithAI(params: {
  tasks: Task[];
  profile?: DigitalTwinProfile;
}): Promise<{
  classifications: {
    id: string;
    category: TaskCategory;
    priority: Priority;
    reason?: string;
  }[];
  summary: string;
}> {
  const res = await fetch(`${API_BASE}/api/twin/classify-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل التصنيف التلقائي للمهام عبر Gemini');
  }
  return res.json();
}
