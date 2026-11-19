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

const TASK_CLASSIFICATION_CACHE_KEY = 'digital_twin_task_classify_cache_v1';
const TASK_CLASSIFICATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const TASK_CLASSIFICATION_CACHE_MAX_ENTRIES = 500;

interface CachedTaskClassification {
  category: TaskCategory;
  priority: Priority;
  reason?: string;
  cachedAt: number;
}

const normalizeTaskTitleKey = (title: string): string =>
  title.trim().replace(/\s+/g, ' ').toLowerCase();

function readTaskClassificationCache(): Record<string, CachedTaskClassification> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TASK_CLASSIFICATION_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const now = Date.now();
    const cleaned: Record<string, CachedTaskClassification> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      const item = entry as Partial<CachedTaskClassification> | null;
      if (
        item &&
        typeof item.category === 'string' &&
        typeof item.priority === 'string' &&
        typeof item.cachedAt === 'number' &&
        now - item.cachedAt <= TASK_CLASSIFICATION_CACHE_TTL_MS
      ) {
        cleaned[key] = {
          category: item.category as TaskCategory,
          priority: item.priority as Priority,
          reason: typeof item.reason === 'string' ? item.reason : undefined,
          cachedAt: item.cachedAt,
        };
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeTaskClassificationCache(
  cache: Record<string, CachedTaskClassification>
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const entries = Object.entries(cache)
      .sort((a, b) => b[1].cachedAt - a[1].cachedAt)
      .slice(0, TASK_CLASSIFICATION_CACHE_MAX_ENTRIES);
    localStorage.setItem(
      TASK_CLASSIFICATION_CACHE_KEY,
      JSON.stringify(Object.fromEntries(entries))
    );
  } catch {
    // Ignore storage quota or private mode errors
  }
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
  const inputTasks = Array.isArray(params.tasks) ? params.tasks : [];
  if (inputTasks.length === 0) {
    return { classifications: [], summary: 'لا توجد مهام غير مصنفة.' };
  }

  const cache = readTaskClassificationCache();
  const cachedById = new Map<
    string,
    { id: string; category: TaskCategory; priority: Priority; reason?: string }
  >();
  const seenUncachedTitles = new Set<string>();
  const uniqueTasksToRequest: Task[] = [];

  for (const task of inputTasks) {
    const titleKey = normalizeTaskTitleKey(task.title || '');
    const cached = titleKey ? cache[titleKey] : undefined;
    if (cached) {
      cachedById.set(task.id, {
        id: task.id,
        category: cached.category,
        priority: cached.priority,
        reason: cached.reason,
      });
    } else {
      if (!titleKey || !seenUncachedTitles.has(titleKey)) {
        if (titleKey) seenUncachedTitles.add(titleKey);
        uniqueTasksToRequest.push(task);
      }
    }
  }

  if (uniqueTasksToRequest.length === 0) {
    const classifications = inputTasks
      .map((t) => cachedById.get(t.id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    return {
      classifications,
      summary: `تم تصنيف ${classifications.length} مهمة من الذاكرة المؤقتة مباشرة دون الحاجة لطلبات API جديدة.`,
    };
  }

  const apiResult = await postJson<{
    classifications: {
      id: string;
      category: TaskCategory;
      priority: Priority;
      reason?: string;
    }[];
    summary: string;
  }>(
    '/api/twin/classify-tasks',
    {
      ...params,
      tasks: uniqueTasksToRequest,
    },
    'فشل التصنيف التلقائي للمهام عبر Gemini'
  );

  const requestedById = new Map(uniqueTasksToRequest.map((t) => [t.id, t]));
  const apiClassificationsById = new Map<
    string,
    { id: string; category: TaskCategory; priority: Priority; reason?: string }
  >();
  const now = Date.now();

  for (const item of apiResult.classifications || []) {
    apiClassificationsById.set(item.id, item);
    const matchedTask = requestedById.get(item.id);
    const titleKey = matchedTask ? normalizeTaskTitleKey(matchedTask.title || '') : '';
    if (titleKey) {
      cache[titleKey] = {
        category: item.category,
        priority: item.priority,
        reason: item.reason,
        cachedAt: now,
      };
    }
  }

  writeTaskClassificationCache(cache);

  const mergedClassifications: {
    id: string;
    category: TaskCategory;
    priority: Priority;
    reason?: string;
  }[] = [];

  for (const task of inputTasks) {
    const fromCache = cachedById.get(task.id);
    if (fromCache) {
      mergedClassifications.push(fromCache);
      continue;
    }
    const fromApiById = apiClassificationsById.get(task.id);
    if (fromApiById) {
      mergedClassifications.push(fromApiById);
      continue;
    }
    const titleKey = normalizeTaskTitleKey(task.title || '');
    const fromUpdatedCache = titleKey ? cache[titleKey] : undefined;
    if (fromUpdatedCache) {
      mergedClassifications.push({
        id: task.id,
        category: fromUpdatedCache.category,
        priority: fromUpdatedCache.priority,
        reason: fromUpdatedCache.reason,
      });
    }
  }

  return {
    classifications: mergedClassifications,
    summary:
      cachedById.size > 0
        ? `${apiResult.summary} (تم استرجاع ${cachedById.size} مهام من الذاكرة المؤقتة)`
        : apiResult.summary,
  };
}
