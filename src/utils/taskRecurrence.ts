import type { RecurrenceFrequency, Task, TaskRecurrence } from '../types';

export const WEEKDAY_OPTIONS_AR: ReadonlyArray<{
  value: number;
  short: string;
  full: string;
}> = [
  { value: 0, short: 'أحد', full: 'الأحد' },
  { value: 1, short: 'إثنين', full: 'الإثنين' },
  { value: 2, short: 'ثلاثاء', full: 'الثلاثاء' },
  { value: 3, short: 'أربعاء', full: 'الأربعاء' },
  { value: 4, short: 'خميس', full: 'الخميس' },
  { value: 5, short: 'جمعة', full: 'الجمعة' },
  { value: 6, short: 'سبت', full: 'السبت' },
];

export const WORKWEEK_DAYS = [0, 1, 2, 3, 4];

export function formatLocalDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayLocalISO(referenceDate: Date = new Date()): string {
  return formatLocalDateISO(referenceDate);
}

export function parseLocalDateISO(iso: string | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [yStr, mStr, dStr] = iso.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function normalizeRecurrence(
  raw: Partial<TaskRecurrence> | undefined
): TaskRecurrence | undefined {
  if (!raw || !raw.enabled) return undefined;

  const validFreq: ReadonlySet<RecurrenceFrequency> = new Set([
    'daily',
    'weekly',
    'monthly',
  ]);
  const frequency: RecurrenceFrequency = validFreq.has(
    raw.frequency as RecurrenceFrequency
  )
    ? (raw.frequency as RecurrenceFrequency)
    : 'daily';

  const rawInterval = Number(raw.interval);
  const interval = Number.isFinite(rawInterval)
    ? Math.max(1, Math.min(365, Math.round(rawInterval)))
    : 1;

  const cleanedDays =
    frequency === 'weekly' && Array.isArray(raw.daysOfWeek)
      ? Array.from(
          new Set(
            raw.daysOfWeek
              .map((d) => Number(d))
              .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          )
        ).sort((a, b) => a - b)
      : undefined;

  const cleanedEndDate =
    raw.endDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.endDate)
      ? raw.endDate
      : undefined;

  const cleaned: TaskRecurrence = {
    enabled: true,
    frequency,
    interval,
    ...(cleanedDays && cleanedDays.length > 0 ? { daysOfWeek: cleanedDays } : {}),
    ...(cleanedEndDate ? { endDate: cleanedEndDate } : {}),
    ...(raw.seriesId ? { seriesId: String(raw.seriesId).slice(0, 128) } : {}),
    ...(raw.occurrenceCount && Number(raw.occurrenceCount) >= 1
      ? { occurrenceCount: Math.max(1, Math.round(Number(raw.occurrenceCount))) }
      : {}),
    ...(raw.regeneratedNextId
      ? { regeneratedNextId: String(raw.regeneratedNextId).slice(0, 128) }
      : {}),
  };

  return cleaned;
}

function addDaysLocal(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonthsClampedLocal(date: Date, months: number): Date {
  const targetYear = date.getFullYear();
  const targetMonthIndex = date.getMonth() + months;
  const originalDay = date.getDate();

  const firstOfTarget = new Date(targetYear, targetMonthIndex, 1, 12, 0, 0, 0);
  const lastDayOfTargetMonth = new Date(
    firstOfTarget.getFullYear(),
    firstOfTarget.getMonth() + 1,
    0,
    12,
    0,
    0,
    0
  ).getDate();

  return new Date(
    firstOfTarget.getFullYear(),
    firstOfTarget.getMonth(),
    Math.min(originalDay, lastDayOfTargetMonth),
    12,
    0,
    0,
    0
  );
}

/**
 * Computes the next due date (YYYY-MM-DD) for a recurring task upon completion.
 * Advances from `max(currentDueDate, today)` so overdue recurring tasks schedule
 * cleanly in the future rather than repeating stale overdue dates.
 * Returns `null` if the computed date exceeds `recurrence.endDate`.
 */
export function calculateNextRecurrenceDate(
  recurrence: TaskRecurrence,
  currentDueDate?: string,
  referenceDate: Date = new Date()
): string | null {
  const normalized = normalizeRecurrence(recurrence);
  if (!normalized) return null;

  const todayISO = getTodayLocalISO(referenceDate);
  const anchorISO =
    currentDueDate &&
    parseLocalDateISO(currentDueDate) &&
    currentDueDate >= todayISO
      ? currentDueDate
      : todayISO;
  const anchorDate = parseLocalDateISO(anchorISO) || new Date();

  let nextDate: Date;

  if (normalized.frequency === 'daily') {
    nextDate = addDaysLocal(anchorDate, normalized.interval);
  } else if (normalized.frequency === 'weekly') {
    const selectedDays = normalized.daysOfWeek || [];
    if (selectedDays.length === 0) {
      nextDate = addDaysLocal(anchorDate, normalized.interval * 7);
    } else {
      const anchorDow = anchorDate.getDay();
      const laterInSameWeek = selectedDays.find((d) => d > anchorDow);
      if (laterInSameWeek !== undefined) {
        nextDate = addDaysLocal(anchorDate, laterInSameWeek - anchorDow);
      } else {
        // Jump to Sunday of anchor's week + (interval weeks) + earliest selected weekday
        const daysSinceSunday = anchorDow;
        const nextCycleSunday = addDaysLocal(
          anchorDate,
          normalized.interval * 7 - daysSinceSunday
        );
        nextDate = addDaysLocal(nextCycleSunday, selectedDays[0]);
      }
    }
  } else {
    // monthly
    nextDate = addMonthsClampedLocal(anchorDate, normalized.interval);
  }

  const nextISO = formatLocalDateISO(nextDate);
  if (normalized.endDate && nextISO > normalized.endDate) {
    return null;
  }

  return nextISO;
}

export function formatRecurrenceLabelAr(recurrence?: TaskRecurrence): string {
  const norm = normalizeRecurrence(recurrence);
  if (!norm) return '';

  if (norm.frequency === 'daily') {
    if (norm.interval === 1) return 'تكرار يومي';
    if (norm.interval === 2) return 'كل يومين';
    return `كل ${norm.interval} أيام`;
  }

  if (norm.frequency === 'weekly') {
    const days = norm.daysOfWeek || [];
    const isWorkWeek =
      days.length === WORKWEEK_DAYS.length &&
      WORKWEEK_DAYS.every((d, idx) => days[idx] === d);

    const freqPrefix =
      norm.interval === 1
        ? 'أسبوعياً'
        : norm.interval === 2
          ? 'كل أسبوعين'
          : `كل ${norm.interval} أسابيع`;

    if (days.length === 0) {
      return norm.interval === 1 ? 'تكرار أسبوعي' : freqPrefix;
    }
    if (isWorkWeek && norm.interval === 1) {
      return 'أيام العمل (أحد - خميس)';
    }
    const dayNames = days
      .map((d) => WEEKDAY_OPTIONS_AR.find((w) => w.value === d)?.short)
      .filter(Boolean)
      .join('، ');
    return `${freqPrefix} (${dayNames})`;
  }

  if (norm.interval === 1) return 'تكرار شهري';
  if (norm.interval === 2) return 'كل شهرين';
  return `كل ${norm.interval} أشهر`;
}

export interface RecurringGenerationResult {
  nextTask: Task;
  updatedCompletedTask: Task;
  nextDueDate: string;
}

/**
 * Generates the next recurring occurrence when a task transitions to `completed`.
 * Guards against duplicate generation using `recurrence.regeneratedNextId`.
 */
export function buildNextRecurringTask(
  completedTask: Task,
  referenceDate: Date = new Date()
): RecurringGenerationResult | null {
  const norm = normalizeRecurrence(completedTask.recurrence);
  if (!norm || norm.regeneratedNextId) {
    return null;
  }

  const nextDueDate = calculateNextRecurrenceDate(
    norm,
    completedTask.dueDate,
    referenceDate
  );
  if (!nextDueDate) {
    return null;
  }

  const nowMs = referenceDate.getTime();
  const suffix = Math.random().toString(36).slice(2, 6);
  const nextId = `task-${nowMs}-${suffix}`;
  const seriesId = norm.seriesId || completedTask.id;
  const currentOccurrence = norm.occurrenceCount || 1;

  const resetSubtasks = Array.isArray(completedTask.subtasks)
    ? completedTask.subtasks.map((st, idx) => ({
        ...st,
        id: `sub-${nowMs}-${idx}-${suffix}`,
        completed: false,
      }))
    : undefined;

  const nextLocationReminder = completedTask.locationReminder
    ? {
        ...completedTask.locationReminder,
        lastTriggeredAt: undefined,
      }
    : undefined;

  const nextTask: Task = {
    id: nextId,
    title: completedTask.title,
    description: completedTask.description || '',
    category: completedTask.category,
    priority: completedTask.priority,
    status: 'todo',
    estimatedMinutes: completedTask.estimatedMinutes,
    dueDate: nextDueDate,
    dueTime: completedTask.dueTime,
    energyRequired: completedTask.energyRequired,
    subtasks: resetSubtasks,
    tags: completedTask.tags ? [...completedTask.tags] : undefined,
    isTopPriority: completedTask.isTopPriority,
    isUnclassified: completedTask.isUnclassified,
    createdAt: referenceDate.toISOString(),
    goalId: completedTask.goalId,
    locationReminder: nextLocationReminder,
    recurrence: {
      enabled: true,
      frequency: norm.frequency,
      interval: norm.interval,
      ...(norm.daysOfWeek ? { daysOfWeek: [...norm.daysOfWeek] } : {}),
      ...(norm.endDate ? { endDate: norm.endDate } : {}),
      seriesId,
      occurrenceCount: currentOccurrence + 1,
    },
  };

  const updatedCompletedTask: Task = {
    ...completedTask,
    recurrence: {
      ...norm,
      seriesId,
      occurrenceCount: currentOccurrence,
      regeneratedNextId: nextId,
    },
  };

  return {
    nextTask,
    updatedCompletedTask,
    nextDueDate,
  };
}
