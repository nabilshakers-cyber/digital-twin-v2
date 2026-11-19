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

declare const __APP_BACKEND_URL__: string | undefined;

export const API_BASE_OVERRIDE_KEY = 'digital_twin_api_base_url_v1';
const DEFAULT_CLOUD_RUN_URL =
  'https://ais-pre-vxsnbmcn3cmjpgboeostti-53047493298.europe-west2.run.app';

export function isCapacitorNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  if (win.Capacitor?.isNativePlatform?.()) return true;
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
    return true;
  }
  if (
    window.location.hostname === 'localhost' &&
    !window.location.port &&
    !import.meta.env.DEV
  ) {
    return true;
  }
  return false;
}

export function resolveApiBase(): string {
  if (!isCapacitorNativeRuntime()) {
    return '';
  }

  try {
    const manualOverride = localStorage.getItem(API_BASE_OVERRIDE_KEY);
    if (manualOverride && manualOverride.trim()) {
      return manualOverride.trim().replace(/\/$/, '');
    }
  } catch {
    // ignore storage access issues
  }

  const envBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (envBase) return envBase;

  const buildTimeBase =
    typeof __APP_BACKEND_URL__ === 'string' ? __APP_BACKEND_URL__.trim().replace(/\/$/, '') : '';
  return buildTimeBase || DEFAULT_CLOUD_RUN_URL;
}

async function postJson<T>(
  endpoint: string,
  payload: unknown,
  fallbackError: string
): Promise<T> {
  const apiBase = resolveApiBase();
  const url = `${apiBase}${endpoint}`;
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  };

  let res: Response;
  try {
    res = await fetch(url, requestInit);
  } catch {
    if (apiBase) {
      try {
        res = await fetch(endpoint, requestInit);
      } catch {
        throw new Error(
          'تعذر الوصول إلى خادم المساعد الرقمي. تأكد من اتصال الإنترنت ومن عنوان الخادم في الإعدادات.'
        );
      }
    } else {
      throw new Error(
        'تعذر الوصول إلى خادم المساعد الرقمي. تأكد من اتصال الإنترنت ومن عنوان الخادم في الإعدادات.'
      );
    }
  }

  const rawText = await res.text();
  const trimmed = rawText.trimStart();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  // Guard against HTML fallback pages (e.g. <!doctype html>) returned instead of JSON
  if (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<') ||
    (contentType.includes('text/html') && !contentType.includes('application/json'))
  ) {
    throw new Error(
      'استجاب الخادم بصفحة HTML بدلاً من JSON. يرجى التحقق من رابط خادم API في تبويب «تطبيق أندرويد» داخل الإعدادات.'
    );
  }

  let data: any = {};
  if (trimmed) {
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(fallbackError);
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || fallbackError);
  }

  return data as T;
}

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
  return postJson<DigitalAssistantResponse>(
    '/api/twin/assistant',
    params,
    'فشل الاتصال بالمساعد الرقمي AI'
  );
}

export async function askTwinChat(params: {
  message: string;
  history: ChatMessage[];
  profile: DigitalTwinProfile;
  tasks: Task[];
  schedule: TimeBlock[];
  context?: string;
}): Promise<string> {
  const data = await postJson<{ reply: string }>(
    '/api/twin/chat',
    params,
    'فشل الاتصال بالتوأم الرقمي'
  );
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
  return postJson(
    '/api/twin/optimize-schedule',
    params,
    'فشل تحسين الجدول الزمني'
  );
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
  return postJson(
    '/api/twin/breakdown-task',
    params,
    'فشل تفكيك المهمة'
  );
}

export async function parseQuickEntryWithAI(params: {
  naturalText: string;
  currentDate?: string;
}): Promise<{
  extractedTasks: Partial<Task>[];
  extractedEvents: Partial<TimeBlock>[];
  twinComment: string;
}> {
  return postJson(
    '/api/twin/parse-quick-entry',
    params,
    'فشل معالجة النص الذكي'
  );
}

export async function generateBriefingWithAI(params: {
  type: 'morning' | 'evening';
  profile: DigitalTwinProfile;
  tasks: Task[];
  completedTasks: Task[];
  schedule: TimeBlock[];
}): Promise<DailyBriefing> {
  const data = await postJson<Omit<DailyBriefing, 'generatedAt' | 'type'>>(
    '/api/twin/briefing',
    params,
    'فشل توليد التقرير'
  );
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
  return postJson(
    '/api/twin/voice-note',
    params,
    'فشل تفريغ وتحليل الملاحظة الصوتية'
  );
}

export async function generateContextualBriefingWithAI(params: {
  task: Task;
  profile: DigitalTwinProfile;
  schedule: TimeBlock[];
  goals: LongTermGoal[];
}): Promise<ContextualBriefing> {
  return postJson(
    '/api/twin/contextual-briefing',
    params,
    'فشل توليد الموجز السياقي للمهمة'
  );
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
  return postJson(
    '/api/twin/classify-tasks',
    params,
    'فشل التصنيف التلقائي للمهام عبر Gemini'
  );
}
