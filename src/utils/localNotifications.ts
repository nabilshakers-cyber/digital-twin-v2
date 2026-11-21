import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Schedule } from '@capacitor/local-notifications';
import { playToneForLocalCategory } from './notificationTones';

export type ReminderItemCategory = 'quran' | 'adhkar' | 'task';

export interface ScheduledLocalReminder {
  id: number;
  itemKey: string;
  title: string;
  body: string;
  scheduledAt: string; // ISO timestamp
  timeHHMM: string; // "HH:MM"
  dateISO: string; // "YYYY-MM-DD"
  repeatDaily: boolean;
  category: ReminderItemCategory;
}

export interface ScheduleReminderOptions {
  id?: number | string;
  itemKey?: string;
  repeatDaily?: boolean;
  category?: ReminderItemCategory;
}

export interface ScheduleReminderObjectParams extends ScheduleReminderOptions {
  title: string;
  body: string;
  date: Date;
}

const STORAGE_KEY = 'digital_twin_scheduled_reminders_v1';
const REMINDER_CHANNEL_ID = 'digital_twin_reminders';
const REMINDERS_UPDATED_EVENT = 'digital-twin:reminders-updated';
export const NOTIFICATION_DENIED_EVENT = 'digital-twin:notification-permission-denied';
export const NOTIFICATION_DENIED_ALERT_MESSAGE =
  'لن تتمكن من استلام التذكيرات. يرجى تفعيل الإشعارات من إعدادات الهاتف.';

function notifyPermissionDenied(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_DENIED_EVENT));
  }
}

const webFallbackTimers = new Map<number, number>();
let channelInitialized = false;
let listenersInitialized = false;

export function hashReminderKeyToId(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Positive 31-bit signed int (Android requirement: 1 .. 2147483647)
  const positive = (hash >>> 0) % 2147483000;
  return positive + 1;
}

export function resolveReminderId(idOrKey: number | string): number {
  if (typeof idOrKey === 'number' && Number.isFinite(idOrKey)) {
    const intVal = Math.abs(Math.trunc(idOrKey)) % 2147483000;
    return intVal > 0 ? intVal : 1;
  }
  return hashReminderKeyToId(String(idOrKey));
}

function readStoredReminders(): Record<string, ScheduledLocalReminder> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ScheduledLocalReminder>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredReminders(map: Record<string, ScheduledLocalReminder>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDERS_UPDATED_EVENT));
  }
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

async function ensureAndroidChannel(): Promise<void> {
  if (channelInitialized) return;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    channelInitialized = true;
    return;
  }
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'تذكيرات التوأم الرقمي',
      description: 'تنبيهات ورد القرآن والأذكار والمهام اليومية',
      importance: 5,
      visibility: 1,
      lights: true,
      vibration: true,
    });
    channelInitialized = true;
  } catch (err) {
    console.warn('Failed to create notification channel:', err);
  }
}

function registerWebFallbackTimer(reminder: ScheduledLocalReminder): void {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return;

  const existingTimer = webFallbackTimers.get(reminder.id);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
    webFallbackTimers.delete(reminder.id);
  }

  const targetMs = new Date(reminder.scheduledAt).getTime();
  const delayMs = targetMs - Date.now();
  // Avoid setTimeout 32-bit overflow (~24.8 days)
  if (delayMs <= 0 || delayMs > 2_000_000_000) return;

  const timerId = window.setTimeout(() => {
    webFallbackTimers.delete(reminder.id);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(reminder.title, {
          body: reminder.body,
          tag: reminder.itemKey,
          dir: 'rtl',
          lang: 'ar',
        });
      } catch {
        // ignore browser notification failure
      }
    }

    try {
      const soundPref = localStorage.getItem('digital_twin_sound_enabled_v1');
      if (soundPref !== 'false') {
        playToneForLocalCategory(reminder.category);
      }
    } catch {
      playToneForLocalCategory(reminder.category);
    }

    if (reminder.repeatDaily) {
      const nextDate = new Date(targetMs + 24 * 60 * 60 * 1000);
      const nextReminder: ScheduledLocalReminder = {
        ...reminder,
        scheduledAt: nextDate.toISOString(),
        dateISO: formatDateISO(nextDate),
      };
      const map = readStoredReminders();
      map[reminder.itemKey] = nextReminder;
      writeStoredReminders(map);
      registerWebFallbackTimer(nextReminder);
    } else {
      const map = readStoredReminders();
      if (map[reminder.itemKey]) {
        delete map[reminder.itemKey];
        writeStoredReminders(map);
      }
    }
  }, delayMs);

  webFallbackTimers.set(reminder.id, timerId);
}

/**
 * Request Local Notification permissions on Android (13+ POST_NOTIFICATIONS), iOS, or Web.
 * Safe to call at app startup.
 */
export async function requestLocalNotificationPermissions(): Promise<
  'granted' | 'denied' | 'prompt'
> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAndroidChannel();
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') {
        return 'granted';
      }
      if (current.display === 'denied') {
        notifyPermissionDenied();
        return 'denied';
      }
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display === 'granted') return 'granted';
      if (requested.display === 'denied') {
        notifyPermissionDenied();
        return 'denied';
      }
      return 'prompt';
    } catch (err) {
      console.warn('LocalNotifications.requestPermissions failed:', err);
      notifyPermissionDenied();
      return 'denied';
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') {
        notifyPermissionDenied();
        return 'denied';
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') return 'granted';
      if (perm === 'denied') {
        notifyPermissionDenied();
        return 'denied';
      }
      return 'prompt';
    } catch {
      notifyPermissionDenied();
      return 'denied';
    }
  }

  return 'denied';
}

/**
 * Initialize local notifications on app startup: requests permissions, creates Android channel,
 * restores web fallback timers if needed, and syncs delivered one-shot reminders.
 */
export async function initializeLocalNotifications(): Promise<
  'granted' | 'denied' | 'prompt'
> {
  const permissionStatus = await requestLocalNotificationPermissions();

  const stored = readStoredReminders();
  const now = Date.now();
  let changed = false;

  for (const [key, item] of Object.entries(stored)) {
    const atMs = new Date(item.scheduledAt).getTime();
    if (!item.repeatDaily && atMs < now - 60_000) {
      delete stored[key];
      changed = true;
    } else if (!Capacitor.isNativePlatform()) {
      if (item.repeatDaily && atMs <= now) {
        const next = new Date(atMs);
        while (next.getTime() <= now) {
          next.setDate(next.getDate() + 1);
        }
        stored[key] = {
          ...item,
          scheduledAt: next.toISOString(),
          dateISO: formatDateISO(next),
        };
        changed = true;
      }
      registerWebFallbackTimer(stored[key]);
    }
  }

  if (changed) {
    writeStoredReminders(stored);
  }

  if (Capacitor.isNativePlatform() && !listenersInitialized) {
    listenersInitialized = true;
    try {
      await LocalNotifications.addListener('localNotificationReceived', (notification) => {
        const itemKey = notification.extra?.itemKey as string | undefined;
        const notifCategory =
          (notification.extra?.category as ReminderItemCategory | undefined) || 'task';
        try {
          const soundPref = localStorage.getItem('digital_twin_sound_enabled_v1');
          if (soundPref !== 'false') {
            playToneForLocalCategory(notifCategory);
          }
        } catch {
          // ignore sound playback failure
        }
        if (!itemKey) return;
        const map = readStoredReminders();
        const entry = map[itemKey];
        if (entry && !entry.repeatDaily) {
          delete map[itemKey];
          writeStoredReminders(map);
        }
      });
    } catch {
      // ignore listener registration failures
    }
  }

  return permissionStatus;
}

/**
 * Schedule a local reminder using Capacitor LocalNotifications (with allowWhileIdle: true
 * so alarms fire reliably even when the app is closed or device is in Doze/background).
 * Supports both Android and iOS, plus a browser timer fallback on web.
 */
export async function scheduleReminder(
  titleOrParams: string | ScheduleReminderObjectParams,
  bodyArg?: string,
  dateArg?: Date,
  optionsArg?: ScheduleReminderOptions
): Promise<ScheduledLocalReminder> {
  const params: ScheduleReminderObjectParams =
    typeof titleOrParams === 'string'
      ? {
          title: titleOrParams,
          body: bodyArg || '',
          date: dateArg || new Date(Date.now() + 60_000),
          ...(optionsArg || {}),
        }
      : titleOrParams;

  const cleanTitle = params.title.trim() || 'تذكير التوأم الرقمي';
  const cleanBody = params.body.trim() || 'حان موعد التذكير المجدول.';
  const repeatDaily = Boolean(params.repeatDaily);
  const category: ReminderItemCategory = params.category || 'task';

  const targetDate = new Date(params.date.getTime());
  targetDate.setSeconds(0, 0);

  if (targetDate.getTime() <= Date.now()) {
    if (repeatDaily) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else {
      targetDate.setTime(Date.now() + 60_000);
    }
  }

  const itemKey =
    params.itemKey ||
    (params.id !== undefined ? String(params.id) : `rem:${cleanTitle}:${formatTimeHHMM(targetDate)}`);
  const numericId =
    params.id !== undefined ? resolveReminderId(params.id) : resolveReminderId(itemKey);

  const scheduledRecord: ScheduledLocalReminder = {
    id: numericId,
    itemKey,
    title: cleanTitle,
    body: cleanBody,
    scheduledAt: targetDate.toISOString(),
    timeHHMM: formatTimeHHMM(targetDate),
    dateISO: formatDateISO(targetDate),
    repeatDaily,
    category,
  };

  if (Capacitor.isNativePlatform()) {
    await requestLocalNotificationPermissions();
    await ensureAndroidChannel();

    try {
      await LocalNotifications.cancel({ notifications: [{ id: numericId }] });
    } catch {
      // ignore if not previously scheduled
    }

    // On Android & iOS:
    // - Repeating daily uses `on: { hour, minute }` with `allowWhileIdle: true`
    // - One-shot uses `at: targetDate` with `allowWhileIdle: true`
    const scheduleConfig: Schedule = repeatDaily
      ? {
          on: {
            hour: targetDate.getHours(),
            minute: targetDate.getMinutes(),
            second: 0,
          },
          repeats: true,
          allowWhileIdle: true,
        }
      : {
          at: targetDate,
          allowWhileIdle: true,
        };

    await LocalNotifications.schedule({
      notifications: [
        {
          id: numericId,
          title: cleanTitle,
          body: cleanBody,
          largeBody: cleanBody,
          schedule: scheduleConfig,
          channelId:
            Capacitor.getPlatform() === 'android' ? REMINDER_CHANNEL_ID : undefined,
          foreground: true,
          autoCancel: true,
          extra: {
            itemKey,
            category,
          },
        },
      ],
    });
  } else {
    // Request browser notification permission gently if in prompt state
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied') {
        notifyPermissionDenied();
      } else if (Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          if (perm === 'denied') {
            notifyPermissionDenied();
          }
        } catch {
          // ignore
        }
      }
    }
    registerWebFallbackTimer(scheduledRecord);
  }

  const map = readStoredReminders();
  map[itemKey] = scheduledRecord;
  writeStoredReminders(map);

  return scheduledRecord;
}

/**
 * Cancel a scheduled reminder by numeric ID or itemKey.
 */
export async function cancelReminder(idOrKey: number | string): Promise<void> {
  const map = readStoredReminders();
  let numericId: number;
  let keyToRemove: string | undefined;

  if (typeof idOrKey === 'string' && map[idOrKey]) {
    keyToRemove = idOrKey;
    numericId = map[idOrKey].id;
  } else {
    numericId = resolveReminderId(idOrKey);
    const matchedEntry = Object.entries(map).find(
      ([k, val]) => val.id === numericId || k === String(idOrKey)
    );
    if (matchedEntry) {
      keyToRemove = matchedEntry[0];
      numericId = matchedEntry[1].id;
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: numericId }] });
    } catch (err) {
      console.warn('LocalNotifications.cancel failed:', err);
    }
  }

  if (typeof window !== 'undefined') {
    const timer = webFallbackTimers.get(numericId);
    if (timer) {
      window.clearTimeout(timer);
      webFallbackTimers.delete(numericId);
    }
  }

  if (keyToRemove && map[keyToRemove]) {
    delete map[keyToRemove];
    writeStoredReminders(map);
  }
}

export function getScheduledReminder(itemKey: string): ScheduledLocalReminder | undefined {
  const map = readStoredReminders();
  const entry = map[itemKey];
  if (!entry) return undefined;
  if (!entry.repeatDaily && new Date(entry.scheduledAt).getTime() < Date.now() - 60_000) {
    return undefined;
  }
  return entry;
}

export function getAllScheduledReminders(): Record<string, ScheduledLocalReminder> {
  return readStoredReminders();
}

export function useScheduledReminders(): Record<string, ScheduledLocalReminder> {
  const [remindersMap, setRemindersMap] = useState<Record<string, ScheduledLocalReminder>>(() =>
    readStoredReminders()
  );

  useEffect(() => {
    const refresh = () => {
      setRemindersMap(readStoredReminders());
    };
    window.addEventListener(REMINDERS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(REMINDERS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return remindersMap;
}
