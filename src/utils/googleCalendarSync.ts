import { onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from '../firebase';
import { TimeBlock } from '../types';
import { toLocalIsoDate } from './calendarUtils';

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events'] as const;

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_CALENDAR_EVENTS_ENDPOINT =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const GCAL_LINKS_STORAGE_KEY = 'digital_twin_gcal_event_links_v1';

interface TokenClientConfig {
  client_id: string;
  scope: string;
  prompt?: string;
  callback: (response: {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  }) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
}

interface GisWindow {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: TokenClientConfig) => {
          requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
        };
        revoke: (token: string, done?: () => void) => void;
      };
    };
  };
}

// In-memory access token cache ONLY (never stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;
let gisLoaderPromise: Promise<void> | null = null;
const authListeners = new Set<() => void>();

function notifyAuthListeners(): void {
  authListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}

// Clear cached access token when user signs out
let hadFirebaseSession = false;
if (typeof window !== 'undefined') {
  try {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        hadFirebaseSession = true;
      } else if (hadFirebaseSession) {
        hadFirebaseSession = false;
        cachedAccessToken = null;
        cachedTokenExpiresAt = 0;
        notifyAuthListeners();
      }
    });
  } catch {
    // ignore auth listener init issues
  }
}

export function subscribeGoogleCalendarAuth(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export function getGoogleCalendarAccessToken(): string | null {
  if (!cachedAccessToken) return null;
  if (Date.now() >= cachedTokenExpiresAt - 30_000) {
    cachedAccessToken = null;
    cachedTokenExpiresAt = 0;
    return null;
  }
  return cachedAccessToken;
}

export function isGoogleCalendarConnected(): boolean {
  return Boolean(getGoogleCalendarAccessToken());
}

export function clearGoogleCalendarToken(): void {
  const tokenToRevoke = cachedAccessToken;
  cachedAccessToken = null;
  cachedTokenExpiresAt = 0;
  notifyAuthListeners();

  if (tokenToRevoke && typeof window !== 'undefined') {
    const g = (window as unknown as GisWindow).google;
    try {
      g?.accounts?.oauth2?.revoke(tokenToRevoke, () => {});
    } catch {
      // ignore revoke errors
    }
  }
}

function loadGoogleIdentityServicesScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services متاح فقط داخل المتصفح.'));
  }

  const g = (window as unknown as GisWindow).google;
  if (g?.accounts?.oauth2?.initTokenClient) {
    return Promise.resolve();
  }

  if (gisLoaderPromise) return gisLoaderPromise;

  gisLoaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`
    );

    const checkReady = () => {
      const gw = (window as unknown as GisWindow).google;
      if (gw?.accounts?.oauth2?.initTokenClient) {
        resolve();
        return true;
      }
      return false;
    };

    if (existing) {
      if (checkReady()) return;
      existing.addEventListener('load', () => {
        if (!checkReady()) {
          gisLoaderPromise = null;
          reject(new Error('تعذر تهيئة Google Identity Services.'));
        }
      });
      existing.addEventListener('error', () => {
        gisLoaderPromise = null;
        reject(new Error('تعذر تحميل مكتبة Google Identity Services. تأكد من الاتصال بالإنترنت.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!checkReady()) {
        gisLoaderPromise = null;
        reject(new Error('تعذر تهيئة Google Identity Services.'));
      }
    };
    script.onerror = () => {
      gisLoaderPromise = null;
      reject(new Error('تعذر تحميل مكتبة Google Identity Services. تأكد من الاتصال بالإنترنت.'));
    };
    document.head.appendChild(script);
  });

  return gisLoaderPromise;
}

/**
 * Authenticates the user via Google Identity Services (OAuth 2.0 Token Client)
 * and caches the returned Calendar access token strictly in memory.
 */
export async function connectGoogleCalendarWithGIS(
  promptMode: 'consent' | 'select_account' | '' = 'select_account'
): Promise<string> {
  await loadGoogleIdentityServicesScript();

  const clientId = firebaseConfig.oAuthClientId;
  if (!clientId) {
    throw new Error('معرّف عميل OAuth غير متوفر في إعدادات التطبيق.');
  }

  const g = (window as unknown as GisWindow).google;
  const oauth2 = g?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('خدمة Google Identity Services غير جاهزة حالياً.');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES.join(' '),
      callback: (resp) => {
        if (settled) return;
        settled = true;
        if (resp.error || !resp.access_token) {
          reject(
            new Error(
              resp.error_description ||
                resp.error ||
                'تم إلغاء التفويض أو تعذر الحصول على إذن الوصول لتقويم Google.'
            )
          );
          return;
        }
        const expiresInSec = Number(resp.expires_in) || 3500;
        cachedAccessToken = resp.access_token;
        cachedTokenExpiresAt = Date.now() + expiresInSec * 1000;
        notifyAuthListeners();
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        if (err?.type === 'popup_closed') {
          reject(new Error('تم إغلاق نافذة تسجيل الدخول قبل إكمال ربط التقويم.'));
          return;
        }
        if (err?.type === 'popup_failed_to_open') {
          reject(
            new Error(
              'منع المتصفح فتح نافذة تسجيل الدخول عبر Google. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.'
            )
          );
          return;
        }
        reject(new Error(err?.message || 'تعذر فتح نافذة المصادقة مع Google.'));
      },
    });

    tokenClient.requestAccessToken({ prompt: promptMode });
  });
}

// Non-secret blockId -> googleEventId link registry
function readEventLinksMap(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(GCAL_LINKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeEventLinksMap(map: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(GCAL_LINKS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function getLinkedGoogleEventId(block: TimeBlock): string | undefined {
  if (block.googleEventId) return block.googleEventId;
  const map = readEventLinksMap();
  return map[block.id];
}

export interface GoogleCalendarApiEvent {
  id: string;
  summary?: string;
  description?: string;
  status?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

export interface ParsedGoogleEvent {
  googleEventId: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  updated?: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseGoogleDateTimeToLocal(
  isoDateTime: string
): { date: string; time: string } {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) {
    const today = toLocalIsoDate(new Date());
    return { date: today, time: '09:00' };
  }
  return {
    date: toLocalIsoDate(d),
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function parseGoogleEvent(ev: GoogleCalendarApiEvent): ParsedGoogleEvent | null {
  if (!ev.id || ev.status === 'cancelled') return null;

  let date = toLocalIsoDate(new Date());
  let startTime = '09:00';
  let endTime = '10:00';

  if (ev.start?.dateTime) {
    const parsedStart = parseGoogleDateTimeToLocal(ev.start.dateTime);
    date = parsedStart.date;
    startTime = parsedStart.time;
    if (ev.end?.dateTime) {
      const parsedEnd = parseGoogleDateTimeToLocal(ev.end.dateTime);
      endTime = parsedEnd.date === parsedStart.date ? parsedEnd.time : '23:59';
    }
  } else if (ev.start?.date) {
    // All-day event
    date = ev.start.date;
    startTime = '08:00';
    endTime = '09:00';
  }

  return {
    googleEventId: ev.id,
    title: (ev.summary || 'موعد من Google Calendar').trim(),
    description: (ev.description || '').trim(),
    date,
    startTime,
    endTime,
    updated: ev.updated,
  };
}

function buildLocalDateTimeRfc3339(dateIso: string, hhmm: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const local = new Date(
    y || new Date().getFullYear(),
    (m || 1) - 1,
    d || 1,
    Number.isFinite(hh) ? hh : 9,
    Number.isFinite(mm) ? mm : 0,
    0
  );

  const offsetMin = -local.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const offH = pad2(Math.floor(absMin / 60));
  const offM = pad2(absMin % 60);

  return `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}T${pad2(
    local.getHours()
  )}:${pad2(local.getMinutes())}:00${sign}${offH}:${offM}`;
}

async function authorizedCalendarFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getGoogleCalendarAccessToken();
  if (!token) {
    throw new Error('انتهت جلسة Google Calendar. يرجى إعادة ربط حساب Google.');
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    cachedTokenExpiresAt = 0;
    notifyAuthListeners();
    throw new Error('انتهت صلاحية تصريح Google Calendar. يرجى تسجيل الدخول عبر Google مجدداً.');
  }

  return res;
}

export async function fetchGoogleCalendarEvents(
  windowStartIso: string,
  windowEndIso: string
): Promise<ParsedGoogleEvent[]> {
  const timeMin = new Date(`${windowStartIso}T00:00:00`).toISOString();
  const timeMax = new Date(`${windowEndIso}T23:59:59`).toISOString();

  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    timeMin,
    timeMax,
  });

  const res = await authorizedCalendarFetch(
    `${GOOGLE_CALENDAR_EVENTS_ENDPOINT}?${params.toString()}`,
    { method: 'GET' }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'تعذر قراءة المواعيد من Google Calendar.');
  }

  const items: GoogleCalendarApiEvent[] = Array.isArray(data.items) ? data.items : [];
  return items
    .map(parseGoogleEvent)
    .filter((ev): ev is ParsedGoogleEvent => Boolean(ev));
}

export interface CalendarSyncPlan {
  importedBlocks: TimeBlock[];
  updatedLocalBlocks: TimeBlock[];
  localLinkUpdates: { blockId: string; googleEventId: string }[];
  toCreateOnGoogle: TimeBlock[];
  toUpdateOnGoogle: { block: TimeBlock; googleEventId: string }[];
}

export function buildCalendarSyncPlan(
  localSchedule: TimeBlock[],
  googleEvents: ParsedGoogleEvent[],
  windowStartIso: string,
  windowEndIso: string
): CalendarSyncPlan {
  const linksMap = readEventLinksMap();
  const todayIso = toLocalIsoDate(new Date());

  const googleById = new Map(googleEvents.map((ev) => [ev.googleEventId, ev]));
  const localByGoogleId = new Map<string, TimeBlock>();
  const localSignatureSet = new Map<string, TimeBlock>();

  const makeSignature = (title: string, date: string, startTime: string) =>
    `${title.trim().toLowerCase()}|${date}|${startTime}`;

  for (const block of localSchedule) {
    const linkedId = block.googleEventId || linksMap[block.id];
    if (linkedId) {
      localByGoogleId.set(linkedId, block);
    }
    const effectiveDate = block.date || todayIso;
    localSignatureSet.set(
      makeSignature(block.title, effectiveDate, block.startTime),
      block
    );
  }

  const importedBlocks: TimeBlock[] = [];
  const updatedLocalBlocks: TimeBlock[] = [];
  const localLinkUpdates: { blockId: string; googleEventId: string }[] = [];

  for (const gEv of googleEvents) {
    const linkedLocal = localByGoogleId.get(gEv.googleEventId);
    if (linkedLocal) {
      // Check if remote details differ from local
      const localDate = linkedLocal.date || todayIso;
      const changed =
        linkedLocal.title !== gEv.title ||
        localDate !== gEv.date ||
        linkedLocal.startTime !== gEv.startTime ||
        linkedLocal.endTime !== gEv.endTime;
      if (
        changed &&
        gEv.updated &&
        (!linkedLocal.googleCalendarUpdated || gEv.updated > linkedLocal.googleCalendarUpdated)
      ) {
        updatedLocalBlocks.push({
          ...linkedLocal,
          title: gEv.title,
          description: gEv.description || linkedLocal.description,
          date: gEv.date,
          startTime: gEv.startTime,
          endTime: gEv.endTime,
          googleEventId: gEv.googleEventId,
          googleCalendarUpdated: gEv.updated,
        });
      }
      continue;
    }

    const sigMatch = localSignatureSet.get(
      makeSignature(gEv.title, gEv.date, gEv.startTime)
    );
    if (sigMatch) {
      localLinkUpdates.push({ blockId: sigMatch.id, googleEventId: gEv.googleEventId });
      continue;
    }

    importedBlocks.push({
      id: `gcal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: gEv.title,
      description: gEv.description,
      date: gEv.date,
      startTime: gEv.startTime,
      endTime: gEv.endTime,
      category: 'meeting',
      priority: 'medium',
      isFixed: true,
      isCompleted: false,
      googleEventId: gEv.googleEventId,
      googleCalendarUpdated: gEv.updated,
    });
  }

  // Persist newly discovered signature links
  if (localLinkUpdates.length > 0) {
    const nextLinks = { ...linksMap };
    for (const pair of localLinkUpdates) {
      nextLinks[pair.blockId] = pair.googleEventId;
    }
    writeEventLinksMap(nextLinks);
  }

  // Determine which local schedule blocks need to be created or updated ON Google Calendar
  const toCreateOnGoogle: TimeBlock[] = [];
  const toUpdateOnGoogle: { block: TimeBlock; googleEventId: string }[] = [];

  for (const block of localSchedule) {
    const effectiveDate = block.date || todayIso;
    if (effectiveDate < windowStartIso || effectiveDate > windowEndIso) {
      continue;
    }

    const linkedId = block.googleEventId || linksMap[block.id];
    const matchedSignature = localLinkUpdates.find((u) => u.blockId === block.id)?.googleEventId;
    const resolvedGoogleId = linkedId || matchedSignature;

    if (!resolvedGoogleId) {
      // Check if an identical event already exists on Google Calendar
      const alreadyOnGoogle = googleEvents.some(
        (g) =>
          makeSignature(g.title, g.date, g.startTime) ===
          makeSignature(block.title, effectiveDate, block.startTime)
      );
      if (!alreadyOnGoogle) {
        toCreateOnGoogle.push({ ...block, date: effectiveDate });
      }
    } else {
      const remote = googleById.get(resolvedGoogleId);
      if (remote) {
        const differs =
          remote.title !== block.title.trim() ||
          remote.date !== effectiveDate ||
          remote.startTime !== block.startTime ||
          remote.endTime !== block.endTime;
        // Only push update to Google if not already overwritten from Google in this cycle
        const wasUpdatedFromRemote = updatedLocalBlocks.some((u) => u.id === block.id);
        if (differs && !wasUpdatedFromRemote) {
          toUpdateOnGoogle.push({
            block: { ...block, date: effectiveDate },
            googleEventId: resolvedGoogleId,
          });
        }
      }
    }
  }

  return {
    importedBlocks,
    updatedLocalBlocks,
    localLinkUpdates,
    toCreateOnGoogle,
    toUpdateOnGoogle,
  };
}

/**
 * Creates and updates events on Google Calendar.
 * MUST only be called after explicit user confirmation in UI.
 */
export async function pushEventsToGoogleCalendar(
  toCreate: TimeBlock[],
  toUpdate: { block: TimeBlock; googleEventId: string }[]
): Promise<{
  createdCount: number;
  updatedCount: number;
  linkedResults: { blockId: string; googleEventId: string; updated?: string }[];
}> {
  const timeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC';
  const todayIso = toLocalIsoDate(new Date());
  const linksMap = readEventLinksMap();
  const linkedResults: { blockId: string; googleEventId: string; updated?: string }[] = [];

  let createdCount = 0;
  let updatedCount = 0;

  for (const block of toCreate) {
    const effectiveDate = block.date || todayIso;
    const endTime =
      block.endTime > block.startTime
        ? block.endTime
        : block.startTime === '23:30'
        ? '23:59'
        : `${pad2(Math.min(23, Number(block.startTime.split(':')[0] || 9) + 1))}:${
            block.startTime.split(':')[1] || '00'
          }`;

    const body = {
      summary: block.title,
      description: block.description || '',
      start: {
        dateTime: buildLocalDateTimeRfc3339(effectiveDate, block.startTime),
        timeZone,
      },
      end: {
        dateTime: buildLocalDateTimeRfc3339(effectiveDate, endTime),
        timeZone,
      },
    };

    const res = await authorizedCalendarFetch(GOOGLE_CALENDAR_EVENTS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const created = await res.json();
    if (!res.ok) {
      throw new Error(created?.error?.message || `تعذر إضافة الموعد "${block.title}" إلى Google Calendar.`);
    }

    if (created?.id) {
      linksMap[block.id] = created.id;
      linkedResults.push({
        blockId: block.id,
        googleEventId: created.id,
        updated: created.updated,
      });
      createdCount += 1;
    }
  }

  for (const item of toUpdate) {
    const effectiveDate = item.block.date || todayIso;
    const endTime =
      item.block.endTime > item.block.startTime
        ? item.block.endTime
        : item.block.startTime === '23:30'
        ? '23:59'
        : `${pad2(Math.min(23, Number(item.block.startTime.split(':')[0] || 9) + 1))}:${
            item.block.startTime.split(':')[1] || '00'
          }`;

    const body = {
      summary: item.block.title,
      description: item.block.description || '',
      start: {
        dateTime: buildLocalDateTimeRfc3339(effectiveDate, item.block.startTime),
        timeZone,
      },
      end: {
        dateTime: buildLocalDateTimeRfc3339(effectiveDate, endTime),
        timeZone,
      },
    };

    const res = await authorizedCalendarFetch(
      `${GOOGLE_CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(item.googleEventId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      }
    );
    const patched = await res.json();
    if (!res.ok) {
      throw new Error(
        patched?.error?.message || `تعذر تحديث الموعد "${item.block.title}" في Google Calendar.`
      );
    }

    linksMap[item.block.id] = item.googleEventId;
    linkedResults.push({
      blockId: item.block.id,
      googleEventId: item.googleEventId,
      updated: patched?.updated,
    });
    updatedCount += 1;
  }

  writeEventLinksMap(linksMap);

  return { createdCount, updatedCount, linkedResults };
}
