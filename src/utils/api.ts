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
const DEFAULT_BACKEND_URL = 'https://digital-twin-v2-o9dw.onrender.com';

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

  const envBase = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_BASE ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (envBase) return envBase;

  const buildTimeBase =
    typeof __APP_BACKEND_URL__ === 'string' ? __APP_BACKEND_URL__.trim().replace(/\/$/, '') : '';
  return buildTimeBase || DEFAULT_BACKEND_URL;
}

export interface FetchServerOptions {
  timeoutMs?: number;
  retryOnColdStart?: boolean;
  onWaitingForWakeup?: (info: { attempt: number; elapsedMs: number; status?: number }) => void;
}

const DEFAULT_API_TIMEOUT_MS = 60_000;
const COLD_START_RETRY_DELAY_MS = 3_500;

function sleepWithAbort(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Diagnostic Fetch wrapper for communicating with the backend server.
 * Waits up to 60 seconds (with cold-start retries on 502/503/504 or waking sockets)
 * and logs HTTP status, Content-Type, response preview, and network/CORS failures.
 */
export async function fetchServerJson<T>(
  endpoint: string,
  init: RequestInit,
  fallbackError: string,
  options?: FetchServerOptions
): Promise<T> {
  const apiBase = resolveApiBase();
  const url = `${apiBase}${endpoint}`;
  const isNative = isCapacitorNativeRuntime();
  const totalTimeoutMs = options?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const retryOnColdStart = options?.retryOnColdStart ?? true;
  const externalSignal = init.signal;

  const mergedHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers || {}),
  };

  const baseRequestInit: RequestInit = {
    ...init,
    mode: apiBase ? 'cors' : init.mode,
    headers: mergedHeaders,
  };

  console.info('[API Request]', {
    method: baseRequestInit.method || 'GET',
    url,
    origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
    isCapacitorNative: isNative,
    timeoutMs: totalTimeoutMs,
  });

  const startedAt = Date.now();
  let attempt = 0;

  while (true) {
    attempt += 1;

    if (externalSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const elapsedMs = Date.now() - startedAt;
    const remainingMs = totalTimeoutMs - elapsedMs;
    if (remainingMs <= 0) {
      throw new Error(
        `استغرق الخادم أكثر من ${Math.round(totalTimeoutMs / 1000)} ثانية للاستجابة. يرجى المحاولة مرة أخرى.`
      );
    }

    const attemptController = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => {
      attemptController.abort();
    };
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      attemptController.abort();
    }, remainingMs);

    let res: Response | null = null;
    try {
      res = await fetch(url, {
        ...baseRequestInit,
        signal: attemptController.signal,
      });
    } catch (networkErr: unknown) {
      clearTimeout(timeoutTimer);
      externalSignal?.removeEventListener('abort', onExternalAbort);

      if (externalSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      if (timedOut) {
        console.error('[API Fetch Error - Timeout (60s)]', {
          url,
          elapsedMs: Date.now() - startedAt,
          attempt,
        });
        throw new Error(
          `انتهت مهلة الاتصال بالمساعد (${Math.round(totalTimeoutMs / 1000)} ثانية). قد يكون الخادم لا يزال قيد التشغيل، يرجى المحاولة مجدداً.`
        );
      }

      const timeLeftAfterErr = totalTimeoutMs - (Date.now() - startedAt);
      if (retryOnColdStart && timeLeftAfterErr > COLD_START_RETRY_DELAY_MS + 1000) {
        console.warn('[API Cold Start / Network Retry]', {
          url,
          attempt,
          elapsedMs: Date.now() - startedAt,
          errorMessage: networkErr instanceof Error ? networkErr.message : String(networkErr),
        });
        options?.onWaitingForWakeup?.({
          attempt,
          elapsedMs: Date.now() - startedAt,
        });
        await sleepWithAbort(COLD_START_RETRY_DELAY_MS, externalSignal);
        continue;
      }

      // Final failure — log full diagnostic info
      console.error('[API Fetch Error - Network / Possible CORS Failure]', {
        url,
        method: baseRequestInit.method || 'GET',
        origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
        isCapacitorNative: isNative,
        attempt,
        elapsedMs: Date.now() - startedAt,
        errorName: networkErr instanceof Error ? networkErr.name : typeof networkErr,
        errorMessage: networkErr instanceof Error ? networkErr.message : String(networkErr),
        rawError: networkErr,
      });

      // Only retry relative endpoint on non-native web (on Capacitor native, relative /api/* hits local index.html)
      if (apiBase && !isNative) {
        try {
          res = await fetch(endpoint, { ...baseRequestInit, signal: externalSignal });
        } catch (retryErr: unknown) {
          console.error('[API Fetch Retry Error]', { endpoint, retryErr });
          throw new Error(
            `تعذر الاتصال بالخادم (${url}). قد يكون السبب حجب CORS أو انقطاع الشبكة: ${
              networkErr instanceof Error ? networkErr.message : String(networkErr)
            }`
          );
        }
      } else {
        throw new Error(
          `فشل الاتصال بخادم المساعد (${url}). السبب المحتمل: انتهاء مهلة سكون الخادم أو حجب CORS أو عدم توفر الشبكة (${
            networkErr instanceof Error ? networkErr.message : String(networkErr)
          }).`
        );
      }
    } finally {
      clearTimeout(timeoutTimer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }

    if (!res) {
      throw new Error(fallbackError);
    }

    // Cold-start gateway statuses (Render sleep/boot returns 502/503/504 while spinning up)
    const isWakeupStatus = res.status === 502 || res.status === 503 || res.status === 504;
    const remainingAfterRes = totalTimeoutMs - (Date.now() - startedAt);
    if (
      isWakeupStatus &&
      retryOnColdStart &&
      remainingAfterRes > COLD_START_RETRY_DELAY_MS + 1000
    ) {
      console.warn('[API Cold Start - Server Waking Up]', {
        url,
        status: res.status,
        attempt,
        elapsedMs: Date.now() - startedAt,
      });
      options?.onWaitingForWakeup?.({
        attempt,
        elapsedMs: Date.now() - startedAt,
        status: res.status,
      });
      await sleepWithAbort(COLD_START_RETRY_DELAY_MS, externalSignal);
      continue;
    }

    const rawText = await res.text();
    const trimmed = rawText.trimStart();
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    // Detect HTML returned instead of JSON (404 page, proxy/gateway error, or auth redirect)
    if (
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<html') ||
      trimmed.startsWith('<') ||
      (contentType.includes('text/html') && !contentType.includes('application/json'))
    ) {
      // Some hosting gateways return a 5xx HTML "Service Starting / Loading" page during cold start
      if (
        res.status >= 500 &&
        retryOnColdStart &&
        totalTimeoutMs - (Date.now() - startedAt) > COLD_START_RETRY_DELAY_MS + 1000
      ) {
        console.warn('[API Cold Start - HTML Boot Page Retry]', {
          url,
          status: res.status,
          attempt,
          elapsedMs: Date.now() - startedAt,
        });
        options?.onWaitingForWakeup?.({
          attempt,
          elapsedMs: Date.now() - startedAt,
          status: res.status,
        });
        await sleepWithAbort(COLD_START_RETRY_DELAY_MS, externalSignal);
        continue;
      }

      const diagnosis =
        res.status === 404
          ? '404 Not Found — المسار غير موجود على الخادم'
          : res.redirected
          ? `Redirected (${res.status}) — تم التحويل لصفحة HTML (${res.url})`
          : res.status >= 500
          ? `Server/Gateway Error (${res.status} ${res.statusText})`
          : `HTML Response (${res.status} ${res.statusText})`;

      console.error('[API Fetch Error - HTML Returned Instead of JSON]', {
        diagnosis,
        requestUrl: url,
        responseUrl: res.url,
        status: res.status,
        statusText: res.statusText,
        redirected: res.redirected,
        contentType,
        bodyPreview: rawText.slice(0, 500),
      });

      throw new Error(
        `استجاب الخادم بصفحة HTML بدلاً من JSON [${diagnosis}] على الرابط: ${url}`
      );
    }

    let data: any = {};
    if (trimmed) {
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[API Fetch Error - Invalid JSON]', {
          requestUrl: url,
          status: res.status,
          statusText: res.statusText,
          contentType,
          bodyPreview: rawText.slice(0, 500),
          parseErr,
        });
        throw new Error(`${fallbackError} (HTTP ${res.status})`);
      }
    }

    if (!res.ok) {
      console.error('[API Fetch Error - HTTP Status]', {
        requestUrl: url,
        status: res.status,
        statusText: res.statusText,
        contentType,
        data,
      });
      throw new Error(data?.error || `${fallbackError} (HTTP ${res.status})`);
    }

    return data as T;
  }
}

async function postJson<T>(
  endpoint: string,
  payload: unknown,
  fallbackError: string,
  requestOptions?: FetchServerOptions & { signal?: AbortSignal }
): Promise<T> {
  const { signal, ...fetchOptions } = requestOptions || {};
  return fetchServerJson<T>(
    endpoint,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
    fallbackError,
    fetchOptions
  );
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

export async function askDigitalAssistant(
  params: {
    message: string;
    history: ChatMessage[];
    profile: DigitalTwinProfile;
    tasks: Task[];
    schedule: TimeBlock[];
    goals?: LongTermGoal[];
    quranRoutine?: QuranRoutineItem[];
    adhkarState?: DailyAdhkarState;
    currentDate?: string;
  },
  requestOptions?: FetchServerOptions & { signal?: AbortSignal }
): Promise<DigitalAssistantResponse> {
  return postJson<DigitalAssistantResponse>(
    '/api/twin/assistant',
    params,
    'فشل الاتصال بالمساعد الرقمي AI',
    { timeoutMs: 60_000, retryOnColdStart: true, ...requestOptions }
  );
}

export async function askTwinChat(
  params: {
    message: string;
    history: ChatMessage[];
    profile: DigitalTwinProfile;
    tasks: Task[];
    schedule: TimeBlock[];
    context?: string;
  },
  requestOptions?: FetchServerOptions & { signal?: AbortSignal }
): Promise<string> {
  const data = await postJson<{ reply: string }>(
    '/api/twin/chat',
    params,
    'فشل الاتصال بالتوأم الرقمي',
    { timeoutMs: 60_000, retryOnColdStart: true, ...requestOptions }
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

export async function processVoiceNoteWithAI(
  params: {
    audioBase64: string;
    mimeType: string;
    profile: DigitalTwinProfile;
    tasks: Task[];
    schedule: TimeBlock[];
    currentDate?: string;
  },
  requestOptions?: FetchServerOptions & { signal?: AbortSignal }
): Promise<{
  transcript: string;
  summary: string;
  twinReply: string;
  extractedTasks: Partial<Task>[];
  extractedEvents: Partial<TimeBlock>[];
}> {
  return postJson(
    '/api/twin/voice-note',
    params,
    'فشل تفريغ وتحليل الملاحظة الصوتية',
    { timeoutMs: 60_000, retryOnColdStart: true, ...requestOptions }
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
