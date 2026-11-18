import { DailyAdhkarState, DigitalTwinProfile, Task, TimeBlock } from '../types';
import {
  analyzeTomorrowEnergyLoad,
  isEndOfDayWindow,
  TomorrowEnergyAnalysis,
} from './burnoutEngine';

export type ReminderUrgency = 'overdue' | 'due_soon' | 'gentle' | 'energy_warning';

export interface SmartReminder {
  id: string;
  sourceType: 'task' | 'schedule' | 'adhkar' | 'energy_overload';
  task?: Task;
  block?: TimeBlock;
  adhkarPeriod?: 'morning' | 'evening';
  energyAnalysis?: TomorrowEnergyAnalysis;
  title: string;
  urgency: ReminderUrgency;
  timeLabel: string;
  minutesDelta: number; // negative = overdue, positive = remaining
  priorityScore: number;
}

export const ADHKAR_STORAGE_KEY = 'digital_twin_daily_adhkar_v1';

export const getTodayIso = (now: Date): string => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const loadInitialAdhkarState = (now: Date = new Date()): DailyAdhkarState => {
  const today = getTodayIso(now);
  try {
    const raw = localStorage.getItem(ADHKAR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyAdhkarState;
      if (parsed.date === today) {
        return parsed;
      }
      return {
        date: today,
        morningCompleted: false,
        eveningCompleted: false,
        totalFullDaysCompleted: Number(parsed.totalFullDaysCompleted) || 0,
        lastCountedFullDay: parsed.lastCountedFullDay,
      };
    }
  } catch {
    // ignore storage read errors
  }
  return {
    date: today,
    morningCompleted: false,
    eveningCompleted: false,
    totalFullDaysCompleted: 0,
  };
};

export const computeNextAdhkarState = (
  prev: DailyAdhkarState,
  period: 'morning' | 'evening',
  now: Date = new Date()
): DailyAdhkarState => {
  const today = getTodayIso(now);
  const nowTime = now.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const base: DailyAdhkarState =
    prev.date === today
      ? prev
      : {
          date: today,
          morningCompleted: false,
          eveningCompleted: false,
          totalFullDaysCompleted: prev.totalFullDaysCompleted,
          lastCountedFullDay: prev.lastCountedFullDay,
        };

  const nextMorning =
    period === 'morning' ? !base.morningCompleted : base.morningCompleted;
  const nextEvening =
    period === 'evening' ? !base.eveningCompleted : base.eveningCompleted;

  const bothCompletedNow = nextMorning && nextEvening;
  const wasCountedToday = base.lastCountedFullDay === today;

  let nextTotal = base.totalFullDaysCompleted;
  let nextLastCounted = base.lastCountedFullDay;

  if (bothCompletedNow && !wasCountedToday) {
    nextTotal += 1;
    nextLastCounted = today;
  } else if (!bothCompletedNow && wasCountedToday) {
    nextTotal = Math.max(0, nextTotal - 1);
    nextLastCounted = undefined;
  }

  return {
    ...base,
    morningCompleted: nextMorning,
    eveningCompleted: nextEvening,
    morningCompletedAt:
      period === 'morning'
        ? nextMorning
          ? nowTime
          : undefined
        : base.morningCompletedAt,
    eveningCompletedAt:
      period === 'evening'
        ? nextEvening
          ? nowTime
          : undefined
        : base.eveningCompletedAt,
    totalFullDaysCompleted: nextTotal,
    lastCountedFullDay: nextLastCounted,
  };
};

const parseTaskTargetDate = (dueDate: string, dueTime?: string): Date | null => {
  const dateParts = dueDate.split('-').map(Number);
  if (dateParts.length !== 3 || dateParts.some(Number.isNaN)) return null;

  const [year, month, day] = dateParts;
  if (dueTime && /^\d{2}:\d{2}$/.test(dueTime)) {
    const [hours, minutes] = dueTime.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  }
  // If only date is provided without time, set target to end of workday (18:00)
  return new Date(year, month - 1, day, 18, 0, 0, 0);
};

export const formatArabicDelta = (minutesDelta: number): string => {
  const absMins = Math.abs(Math.round(minutesDelta));

  if (minutesDelta < 0) {
    if (absMins < 60) {
      return `متأخر منذ ${absMins <= 1 ? 'دقيقة' : `${absMins} دقيقة`}`;
    }
    const hours = Math.floor(absMins / 60);
    if (hours < 24) {
      return `متأخر منذ ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : `${hours} ساعات`}`;
    }
    const days = Math.floor(hours / 24);
    return `متأخر منذ ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : `${days} أيام`}`;
  }

  if (absMins <= 1) return 'مستحق الآن';
  if (absMins < 60) return `متبقي ${absMins} دقيقة`;
  const hours = Math.floor(absMins / 60);
  const remMins = absMins % 60;
  if (hours < 24) {
    return remMins > 0 ? `متبقي ${hours} س و ${remMins} د` : `متبقي ${hours} ساعة`;
  }
  return 'مستحق قريباً';
};

export const evaluateTaskUrgency = (
  task: Task,
  now: Date = new Date()
): { urgency: ReminderUrgency; timeLabel: string; minutesDelta: number } | null => {
  if (task.status === 'completed' || !task.dueDate) return null;

  const todayIso = getTodayIso(now);
  const target = parseTaskTargetDate(task.dueDate, task.dueTime);
  if (!target) return null;

  const diffMinutes = Math.round((target.getTime() - now.getTime()) / 60000);

  // Past due date (yesterday or earlier)
  if (task.dueDate < todayIso) {
    return {
      urgency: 'overdue',
      timeLabel: formatArabicDelta(diffMinutes),
      minutesDelta: diffMinutes,
    };
  }

  // Due today
  if (task.dueDate === todayIso) {
    if (task.dueTime) {
      if (diffMinutes < 0) {
        return {
          urgency: 'overdue',
          timeLabel: formatArabicDelta(diffMinutes),
          minutesDelta: diffMinutes,
        };
      }
      // Approaching within 90 minutes
      if (diffMinutes <= 90) {
        return {
          urgency: 'due_soon',
          timeLabel: formatArabicDelta(diffMinutes),
          minutesDelta: diffMinutes,
        };
      }
    } else if (diffMinutes <= 180) {
      // No specific dueTime, approaching end of workday
      return {
        urgency: diffMinutes < 0 ? 'overdue' : 'due_soon',
        timeLabel: diffMinutes < 0 ? 'تجاوز موعد اليوم' : 'مستحق اليوم',
        minutesDelta: diffMinutes,
      };
    }
  }

  return null;
};

export const generateSmartReminders = (
  tasks: Task[],
  schedule: TimeBlock[],
  snoozedMap: Record<string, number>,
  dismissedIds: Set<string>,
  now: Date = new Date(),
  adhkarState?: DailyAdhkarState,
  adhkarNotificationsEnabled: boolean = true,
  profile?: DigitalTwinProfile
): SmartReminder[] => {
  const reminders: SmartReminder[] = [];
  const nowMs = now.getTime();
  const todayIso = getTodayIso(now);

  // 1. Evaluate Tasks
  for (const task of tasks) {
    const id = `task:${task.id}`;
    if (dismissedIds.has(id)) continue;
    const snoozeUntil = snoozedMap[id];
    if (snoozeUntil && snoozeUntil > nowMs) continue;

    const status = evaluateTaskUrgency(task, now);
    if (!status) continue;

    const priorityBonus = task.priority === 'high' ? 200 : task.priority === 'medium' ? 100 : 0;
    const urgencyBonus = status.urgency === 'overdue' ? 1000 : 500;

    reminders.push({
      id,
      sourceType: 'task',
      task,
      title: task.title,
      urgency: status.urgency,
      timeLabel: status.timeLabel,
      minutesDelta: status.minutesDelta,
      priorityScore: urgencyBonus + priorityBonus - status.minutesDelta,
    });
  }

  // 2. Evaluate Schedule Blocks for Today (approaching within 20 mins or recently missed)
  for (const block of schedule) {
    if (block.isCompleted) continue;
    const id = `block:${block.id}`;
    if (dismissedIds.has(id)) continue;
    const snoozeUntil = snoozedMap[id];
    if (snoozeUntil && snoozeUntil > nowMs) continue;

    const startTarget = parseTaskTargetDate(todayIso, block.startTime);
    const endTarget = parseTaskTargetDate(todayIso, block.endTime);
    if (!startTarget || !endTarget) continue;

    const minsToStart = Math.round((startTarget.getTime() - nowMs) / 60000);
    const minsSinceEnd = Math.round((nowMs - endTarget.getTime()) / 60000);

    if (minsToStart >= 0 && minsToStart <= 20) {
      reminders.push({
        id,
        sourceType: 'schedule',
        block,
        title: `موعد قادم: ${block.title}`,
        urgency: 'due_soon',
        timeLabel: minsToStart <= 1 ? 'يبدأ الآن' : `يبدأ خلال ${minsToStart} دقيقة`,
        minutesDelta: minsToStart,
        priorityScore: 450 - minsToStart,
      });
    } else if (minsSinceEnd > 0 && minsSinceEnd <= 180) {
      reminders.push({
        id,
        sourceType: 'schedule',
        block,
        title: `بلوك غير مكتمل: ${block.title}`,
        urgency: 'overdue',
        timeLabel: `انتهى وقته منذ ${minsSinceEnd < 60 ? `${minsSinceEnd} دقيقة` : `${Math.floor(minsSinceEnd / 60)} ساعة`}`,
        minutesDelta: -minsSinceEnd,
        priorityScore: 800 + minsSinceEnd,
      });
    }
  }

  // 3. Gentle Adhkar Reminders for Morning (04:00 - 11:59) & Evening (15:00 - 23:59)
  if (adhkarNotificationsEnabled && adhkarState && adhkarState.date === todayIso) {
    const currentHour = now.getHours();

    if (currentHour >= 4 && currentHour < 12 && !adhkarState.morningCompleted) {
      const id = `adhkar:morning:${todayIso}`;
      const snoozeUntil = snoozedMap[id];
      if (!dismissedIds.has(id) && !(snoozeUntil && snoozeUntil > nowMs)) {
        reminders.push({
          id,
          sourceType: 'adhkar',
          adhkarPeriod: 'morning',
          title: 'أذكار الصباح — حصنك المبارك لبداية يومك',
          urgency: 'gentle',
          timeLabel: 'تذكير صباحي لطيف',
          minutesDelta: 0,
          priorityScore: 420,
        });
      }
    }

    if (currentHour >= 15 && currentHour <= 23 && !adhkarState.eveningCompleted) {
      const id = `adhkar:evening:${todayIso}`;
      const snoozeUntil = snoozedMap[id];
      if (!dismissedIds.has(id) && !(snoozeUntil && snoozeUntil > nowMs)) {
        reminders.push({
          id,
          sourceType: 'adhkar',
          adhkarPeriod: 'evening',
          title: 'أذكار المساء — سكينة وطمأنينة لختام يومك',
          urgency: 'gentle',
          timeLabel: 'تذكير مسائي لطيف',
          minutesDelta: 0,
          priorityScore: 420,
        });
      }
    }
  }

  // 4. Optional End-of-Day Next-Day Energy Overload Alert
  if (profile?.endOfDayOverloadAlertEnabled && isEndOfDayWindow(profile, now)) {
    const analysis = analyzeTomorrowEnergyLoad(tasks, schedule, profile, now);
    if (analysis.isOverloaded) {
      const id = `eod-overload:${analysis.tomorrowIso}`;
      const snoozeUntil = snoozedMap[id];
      if (!dismissedIds.has(id) && !(snoozeUntil && snoozeUntil > nowMs)) {
        reminders.push({
          id,
          sourceType: 'energy_overload',
          energyAnalysis: analysis,
          title: `تنبيه نهاية اليوم: مهام الغد (${analysis.totalItemsCount}) تتجاوز مستوى طاقتك المخصص (${analysis.usagePercent}%)`,
          urgency: 'energy_warning',
          timeLabel: `${analysis.totalHours} س مجدولة مقابل حد ${analysis.capacity.maxHours} س`,
          minutesDelta: 0,
          priorityScore: 950,
        });
      }
    }
  }

  return reminders.sort((a, b) => b.priorityScore - a.priorityScore);
};

export const buildTomorrowEnergyAlertReminder = (
  analysis: TomorrowEnergyAnalysis,
  manualId?: string
): SmartReminder => ({
  id: manualId || `eod-overload:${analysis.tomorrowIso}`,
  sourceType: 'energy_overload',
  energyAnalysis: analysis,
  title: analysis.isOverloaded
    ? `تنبيه نهاية اليوم: مهام الغد (${analysis.totalItemsCount}) تتجاوز مستوى طاقتك المخصص (${analysis.usagePercent}%)`
    : `فحص جدول الغد: الحمل متوازن (${analysis.usagePercent}% من طاقتك المخصصة)`,
  urgency: 'energy_warning',
  timeLabel: `${analysis.totalHours} س مجدولة • الحد ${analysis.capacity.maxHours} س (${analysis.capacity.label})`,
  minutesDelta: 0,
  priorityScore: 950,
});

export const isPushSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getPushPermission = (): NotificationPermission | 'unsupported' => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestPushPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isPushSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

export const sendBrowserNotification = (
  title: string,
  body: string,
  tag?: string
): boolean => {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;
  try {
    const notif = new Notification(title, {
      body,
      tag,
      dir: 'rtl',
      lang: 'ar',
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch {
    return false;
  }
};
