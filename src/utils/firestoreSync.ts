import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CustomDashboardWidget,
  DailyAdhkarState,
  DashboardLayoutEntry,
  DigitalTwinProfile,
  LongTermGoal,
  PhoneAppList,
  QuranRoutineItem,
  Task,
  TimeBlock,
} from '../types';

export interface LocalWorkspaceSnapshot {
  profile: DigitalTwinProfile;
  tasks: Task[];
  schedule: TimeBlock[];
  goals: LongTermGoal[];
  quranRoutine: QuranRoutineItem[];
  adhkarState: DailyAdhkarState;
  customWidgets: CustomDashboardWidget[];
  dashboardLayout: DashboardLayoutEntry[];
  phoneAppLists: PhoneAppList[];
  quranNotificationsEnabled: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
  autoDndEnabled: boolean;
}

export interface WorkspaceSettingsPayload {
  profile: DigitalTwinProfile;
  dashboardLayout: DashboardLayoutEntry[];
  adhkarState: DailyAdhkarState;
  quranNotificationsEnabled: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
  autoDndEnabled: boolean;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function sanitizeDocId(rawId: string, prefix: string): string {
  const cleaned = (rawId || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  if (cleaned && VALID_ID_RE.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function trunc(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val : fallback;
  return str.slice(0, maxLen);
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeProfile(p: DigitalTwinProfile): DigitalTwinProfile {
  const validTones = new Set(['disciplined', 'encouraging', 'analytical', 'calm', 'humorous']);
  const validEnergyLevels = new Set(['low', 'medium', 'high']);
  const sanitized: DigitalTwinProfile = {
    name: trunc(p.name, 120, 'مستخدم') || 'مستخدم',
    role: trunc(p.role, 200, 'عضو') || 'عضو',
    tone: validTones.has(p.tone) ? p.tone : 'disciplined',
    peakEnergy: trunc(p.peakEnergy, 200, 'صباحي'),
    workStyle: trunc(p.workStyle, 300, 'تركيز عميق'),
    mainGoals: trunc(p.mainGoals, 1500, ''),
    rules: trunc(p.rules, 2000, ''),
    dailyWorkHoursTarget: clampNum(p.dailyWorkHoursTarget, 1, 24, 7),
    weeklyCompletionGoalRate: clampNum(p.weeklyCompletionGoalRate ?? 85, 10, 100, 85),
  };
  if (p.avatarSeed) {
    sanitized.avatarSeed = trunc(p.avatarSeed, 128);
  }
  if (p.dailyEnergyLevel && validEnergyLevels.has(p.dailyEnergyLevel)) {
    sanitized.dailyEnergyLevel = p.dailyEnergyLevel;
  }
  if (p.endOfDayOverloadAlertEnabled !== undefined) {
    sanitized.endOfDayOverloadAlertEnabled = Boolean(p.endOfDayOverloadAlertEnabled);
  }
  if (p.endOfDayAlertTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.endOfDayAlertTime)) {
    sanitized.endOfDayAlertTime = p.endOfDayAlertTime;
  }
  return sanitized;
}

function sanitizeAdhkar(a: DailyAdhkarState): DailyAdhkarState {
  const sanitized: DailyAdhkarState = {
    date: trunc(a.date, 32, new Date().toISOString().split('T')[0]),
    morningCompleted: Boolean(a.morningCompleted),
    eveningCompleted: Boolean(a.eveningCompleted),
    totalFullDaysCompleted: clampNum(a.totalFullDaysCompleted, 0, 100000, 0),
  };
  if (a.lastCountedFullDay) sanitized.lastCountedFullDay = trunc(a.lastCountedFullDay, 32);
  if (a.morningCompletedAt) sanitized.morningCompletedAt = trunc(a.morningCompletedAt, 64);
  if (a.eveningCompletedAt) sanitized.eveningCompletedAt = trunc(a.eveningCompletedAt, 64);
  return sanitized;
}

function sanitizeLayout(layout: DashboardLayoutEntry[]): DashboardLayoutEntry[] {
  return (Array.isArray(layout) ? layout : []).slice(0, 60).map((entry) => ({
    id: trunc(entry.id, 128, 'mental_state'),
    isCustom: Boolean(entry.isCustom),
    visible: Boolean(entry.visible),
  }));
}

function serializeTask(uid: string, task: Task, includeCreatedAt: boolean) {
  const id = sanitizeDocId(task.id, 'task');
  const validCat = new Set(['work', 'personal', 'health', 'study', 'urgent']);
  const validPrio = new Set(['high', 'medium', 'low']);
  const validStatus = new Set(['todo', 'in_progress', 'completed']);

  const payload: Record<string, unknown> = {
    id,
    ownerId: uid,
    title: trunc(task.title, 300, 'مهمة').trim() || 'مهمة',
    category: validCat.has(task.category) ? task.category : 'work',
    priority: validPrio.has(task.priority) ? task.priority : 'medium',
    status: validStatus.has(task.status) ? task.status : 'todo',
    energyRequired: validPrio.has(task.energyRequired) ? task.energyRequired : 'medium',
    clientCreatedAt: trunc(task.createdAt, 64, new Date().toISOString()),
    updatedAt: serverTimestamp(),
  };

  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  if (task.description !== undefined) {
    payload.description = trunc(task.description, 2000);
  }
  if (task.estimatedMinutes !== undefined && Number(task.estimatedMinutes) > 0) {
    payload.estimatedMinutes = Math.round(clampNum(task.estimatedMinutes, 1, 1440, 30));
  }
  if (task.dueDate) {
    payload.dueDate = trunc(task.dueDate, 32);
  }
  if (task.dueTime) {
    payload.dueTime = trunc(task.dueTime, 16);
  }
  if (Array.isArray(task.subtasks)) {
    payload.subtasks = task.subtasks.slice(0, 50).map((st) => ({
      id: trunc(st.id, 128, `st-${Date.now()}`),
      title: trunc(st.title, 300, 'خطوة'),
      completed: Boolean(st.completed),
      ...(st.estimatedMinutes ? { estimatedMinutes: Math.round(clampNum(st.estimatedMinutes, 1, 1440, 15)) } : {}),
      ...(st.focusTip ? { focusTip: trunc(st.focusTip, 500) } : {}),
    }));
  }
  if (task.isTopPriority !== undefined) {
    payload.isTopPriority = Boolean(task.isTopPriority);
  }
  if (task.isUnclassified !== undefined) {
    payload.isUnclassified = Boolean(task.isUnclassified);
  }
  if (task.completedAt) {
    payload.completedAt = trunc(task.completedAt, 64);
  }
  if (task.goalId) {
    payload.goalId = trunc(task.goalId, 128);
  }

  return { id, payload };
}

function serializeScheduleBlock(uid: string, block: TimeBlock, includeCreatedAt: boolean) {
  const id = sanitizeDocId(block.id, 'block');
  const validCat = new Set(['deep_work', 'meeting', 'routine', 'health', 'personal', 'review']);
  const validPrio = new Set(['high', 'medium', 'low']);

  const payload: Record<string, unknown> = {
    id,
    ownerId: uid,
    startTime: trunc(block.startTime, 16, '09:00').padEnd(3, '0'),
    endTime: trunc(block.endTime, 16, '10:00').padEnd(3, '0'),
    title: trunc(block.title, 300, 'موعد').trim() || 'موعد',
    category: validCat.has(block.category) ? block.category : 'deep_work',
    updatedAt: serverTimestamp(),
  };

  if (includeCreatedAt) payload.createdAt = serverTimestamp();
  if (block.description !== undefined) payload.description = trunc(block.description, 1500);
  if (block.priority && validPrio.has(block.priority)) payload.priority = block.priority;
  if (block.energyLevel && validPrio.has(block.energyLevel)) payload.energyLevel = block.energyLevel;
  if (block.relatedTaskId) payload.relatedTaskId = trunc(block.relatedTaskId, 128);
  if (block.isCompleted !== undefined) payload.isCompleted = Boolean(block.isCompleted);
  if (block.isFixed !== undefined) payload.isFixed = Boolean(block.isFixed);
  if (block.iconName) payload.iconName = trunc(block.iconName, 64);
  if (block.date) payload.date = trunc(block.date, 32);

  return { id, payload };
}

function serializeGoal(uid: string, goal: LongTermGoal, includeCreatedAt: boolean) {
  const id = sanitizeDocId(goal.id, 'goal');
  const validCat = new Set(['work', 'personal', 'learning', 'health']);

  const payload: Record<string, unknown> = {
    id,
    ownerId: uid,
    title: trunc(goal.title, 300, 'هدف').trim() || 'هدف',
    category: validCat.has(goal.category) ? goal.category : 'work',
    progress: clampNum(goal.progress, 0, 100, 0),
    targetDate: trunc(goal.targetDate, 32, '2026-12-31'),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) payload.createdAt = serverTimestamp();
  if (goal.associatedProject) payload.associatedProject = trunc(goal.associatedProject, 128);

  return { id, payload };
}

function serializeQuranItem(uid: string, item: QuranRoutineItem, includeCreatedAt: boolean) {
  const id = sanitizeDocId(item.id, 'qr');
  const validTypes = new Set(['review', 'reading', 'memorization']);

  const payload: Record<string, unknown> = {
    id,
    ownerId: uid,
    type: validTypes.has(item.type) ? item.type : 'review',
    title: trunc(item.title, 240, 'ورد قرآني').trim() || 'ورد قرآني',
    targetAmount: trunc(item.targetAmount, 240, 'حزب').trim() || 'حزب',
    completed: Boolean(item.completed),
    timeSlot: trunc(item.timeSlot, 120, 'اليوم'),
    streak: clampNum(item.streak, 0, 100000, 0),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) payload.createdAt = serverTimestamp();
  if (item.quickLink) payload.quickLink = trunc(item.quickLink, 500);

  return { id, payload };
}

function serializeCustomWidget(uid: string, widget: CustomDashboardWidget, includeCreatedAt: boolean) {
  const id = sanitizeDocId(widget.id, 'cw');
  const validKinds = new Set(['note', 'checklist', 'counter', 'links']);
  const validColors = new Set(['cyan', 'emerald', 'amber', 'indigo', 'rose']);

  const payload: Record<string, unknown> = {
    id,
    ownerId: uid,
    kind: validKinds.has(widget.kind) ? widget.kind : 'note',
    title: trunc(widget.title, 200, 'مكون').trim() || 'مكون',
    icon: trunc(widget.icon, 32, '🧩') || '🧩',
    color: validColors.has(widget.color) ? widget.color : 'cyan',
    clientCreatedAt: trunc(widget.createdAt, 64, new Date().toISOString()),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) payload.createdAt = serverTimestamp();
  if (widget.content !== undefined) payload.content = trunc(widget.content, 2000);
  if (Array.isArray(widget.items)) {
    payload.items = widget.items.slice(0, 50).map((it) => ({
      id: trunc(it.id, 128, `cwi-${Date.now()}`),
      text: trunc(it.text, 300, 'عنصر'),
      done: Boolean(it.done),
      ...(it.url ? { url: trunc(it.url, 500) } : {}),
    }));
  }
  if (widget.count !== undefined) payload.count = clampNum(widget.count, 0, 100000, 0);
  if (widget.target !== undefined) payload.target = clampNum(widget.target, 1, 100000, 1);
  if (widget.unit !== undefined) payload.unit = trunc(widget.unit, 40, 'مرة');

  return { id, payload };
}

function serializePhoneAppList(uid: string, list: PhoneAppList, includeCreatedAt: boolean) {
  const id = sanitizeDocId(list.id, 'plist');
  const validColors = new Set(['cyan', 'emerald', 'amber', 'indigo', 'rose']);

  const payload: Record<string, unknown> = {
    id,
    ownerId: uid,
    title: trunc(list.title, 200, 'قائمة تطبيقات').trim() || 'قائمة تطبيقات',
    icon: trunc(list.icon, 32, '📱') || '📱',
    color: validColors.has(list.color) ? list.color : 'cyan',
    apps: (Array.isArray(list.apps) ? list.apps : []).slice(0, 50).map((app) => ({
      id: trunc(app.id, 128, `app-${Date.now()}`),
      name: trunc(app.name, 120, 'تطبيق'),
      icon: trunc(app.icon, 32, '📱'),
      deepLink: trunc(app.deepLink, 500, 'https://'),
      ...(app.fallbackUrl ? { fallbackUrl: trunc(app.fallbackUrl, 500) } : {}),
      ...(app.note ? { note: trunc(app.note, 200) } : {}),
    })),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) payload.createdAt = serverTimestamp();

  return { id, payload };
}

export async function ensureUserWorkspace(
  uid: string,
  localData: LocalWorkspaceSnapshot
): Promise<boolean> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      return false; // Already initialized in cloud; real-time listeners will pull cloud state
    }

    // Create parent workspace document FIRST so security rules exists() on subcollections passes
    await setDoc(userRef, {
      ownerId: uid,
      profile: sanitizeProfile(localData.profile),
      dashboardLayout: sanitizeLayout(localData.dashboardLayout),
      adhkarState: sanitizeAdhkar(localData.adhkarState),
      quranNotificationsEnabled: Boolean(localData.quranNotificationsEnabled),
      pushEnabled: Boolean(localData.pushEnabled),
      soundEnabled: Boolean(localData.soundEnabled),
      autoDndEnabled: Boolean(localData.autoDndEnabled),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Seed initial or local collections into Firestore in batch
    await pushCollectionsInBatch(uid, localData);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

async function pushCollectionsInBatch(uid: string, data: LocalWorkspaceSnapshot) {
  const batch = writeBatch(db);

  for (const t of data.tasks) {
    const { id, payload } = serializeTask(uid, t, true);
    batch.set(doc(db, 'users', uid, 'tasks', id), payload);
  }
  for (const b of data.schedule) {
    const { id, payload } = serializeScheduleBlock(uid, b, true);
    batch.set(doc(db, 'users', uid, 'schedule', id), payload);
  }
  for (const g of data.goals) {
    const { id, payload } = serializeGoal(uid, g, true);
    batch.set(doc(db, 'users', uid, 'goals', id), payload);
  }
  for (const q of data.quranRoutine) {
    const { id, payload } = serializeQuranItem(uid, q, true);
    batch.set(doc(db, 'users', uid, 'quranRoutine', id), payload);
  }
  for (const w of data.customWidgets) {
    const { id, payload } = serializeCustomWidget(uid, w, true);
    batch.set(doc(db, 'users', uid, 'customWidgets', id), payload);
  }
  for (const l of data.phoneAppLists) {
    const { id, payload } = serializePhoneAppList(uid, l, true);
    batch.set(doc(db, 'users', uid, 'phoneAppLists', id), payload);
  }

  await batch.commit();
}

export async function pushLocalSnapshotToCloud(
  uid: string,
  localData: LocalWorkspaceSnapshot
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        ownerId: uid,
        profile: sanitizeProfile(localData.profile),
        dashboardLayout: sanitizeLayout(localData.dashboardLayout),
        adhkarState: sanitizeAdhkar(localData.adhkarState),
        quranNotificationsEnabled: Boolean(localData.quranNotificationsEnabled),
        pushEnabled: Boolean(localData.pushEnabled),
        soundEnabled: Boolean(localData.soundEnabled),
        autoDndEnabled: Boolean(localData.autoDndEnabled),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        profile: sanitizeProfile(localData.profile),
        dashboardLayout: sanitizeLayout(localData.dashboardLayout),
        adhkarState: sanitizeAdhkar(localData.adhkarState),
        quranNotificationsEnabled: Boolean(localData.quranNotificationsEnabled),
        pushEnabled: Boolean(localData.pushEnabled),
        soundEnabled: Boolean(localData.soundEnabled),
        autoDndEnabled: Boolean(localData.autoDndEnabled),
        updatedAt: serverTimestamp(),
      });
    }

    // Replace subcollections cleanly
    const subcollections = [
      'tasks',
      'schedule',
      'goals',
      'quranRoutine',
      'customWidgets',
      'phoneAppLists',
    ] as const;

    const deleteBatch = writeBatch(db);
    let deleteCount = 0;
    for (const colName of subcollections) {
      const colSnap = await getDocs(collection(db, 'users', uid, colName));
      colSnap.forEach((docSnap) => {
        deleteBatch.delete(docSnap.ref);
        deleteCount += 1;
      });
    }
    if (deleteCount > 0) {
      await deleteBatch.commit();
    }

    await pushCollectionsInBatch(uid, localData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export interface CloudSyncCallbacks {
  onWorkspace: (settings: Partial<WorkspaceSettingsPayload>) => void;
  onTasks: (tasks: Task[]) => void;
  onSchedule: (schedule: TimeBlock[]) => void;
  onGoals: (goals: LongTermGoal[]) => void;
  onQuranRoutine: (items: QuranRoutineItem[]) => void;
  onCustomWidgets: (widgets: CustomDashboardWidget[]) => void;
  onPhoneAppLists: (lists: PhoneAppList[]) => void;
  onSyncedPulse: () => void;
  onError: (err: unknown) => void;
}

export function subscribeUserCloudData(
  uid: string,
  callbacks: CloudSyncCallbacks
): () => void {
  const unsubscribers: Unsubscribe[] = [];

  const userPath = `users/${uid}`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        callbacks.onWorkspace({
          profile: data.profile,
          dashboardLayout: data.dashboardLayout,
          adhkarState: data.adhkarState,
          quranNotificationsEnabled: data.quranNotificationsEnabled,
          pushEnabled: data.pushEnabled,
          soundEnabled: data.soundEnabled,
          autoDndEnabled: data.autoDndEnabled,
        });
        callbacks.onSyncedPulse();
      },
      (error) => {
        callbacks.onError(error);
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    )
  );

  const tasksPath = `users/${uid}/tasks`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', uid, 'tasks'),
      (snap) => {
        const list: Task[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            title: data.title,
            description: data.description || '',
            category: data.category,
            priority: data.priority,
            status: data.status,
            estimatedMinutes: data.estimatedMinutes,
            dueDate: data.dueDate,
            dueTime: data.dueTime,
            energyRequired: data.energyRequired || 'medium',
            subtasks: data.subtasks,
            isTopPriority: data.isTopPriority,
            isUnclassified: Boolean(data.isUnclassified),
            createdAt: data.clientCreatedAt || new Date().toISOString(),
            completedAt: data.completedAt,
            goalId: data.goalId,
          };
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callbacks.onTasks(list);
        callbacks.onSyncedPulse();
      },
      (error) => {
        callbacks.onError(error);
        handleFirestoreError(error, OperationType.LIST, tasksPath);
      }
    )
  );

  const schedulePath = `users/${uid}/schedule`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', uid, 'schedule'),
      (snap) => {
        const list: TimeBlock[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            startTime: data.startTime,
            endTime: data.endTime,
            title: data.title,
            description: data.description || '',
            category: data.category,
            priority: data.priority,
            energyLevel: data.energyLevel,
            relatedTaskId: data.relatedTaskId,
            isCompleted: Boolean(data.isCompleted),
            isFixed: Boolean(data.isFixed),
            iconName: data.iconName,
            date: data.date,
          };
        });
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));
        callbacks.onSchedule(list);
        callbacks.onSyncedPulse();
      },
      (error) => {
        callbacks.onError(error);
        handleFirestoreError(error, OperationType.LIST, schedulePath);
      }
    )
  );

  const goalsPath = `users/${uid}/goals`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', uid, 'goals'),
      (snap) => {
        const list: LongTermGoal[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            title: data.title,
            category: data.category,
            progress: Number(data.progress) || 0,
            targetDate: data.targetDate,
            associatedProject: data.associatedProject,
          };
        });
        callbacks.onGoals(list);
        callbacks.onSyncedPulse();
      },
      (error) => {
        callbacks.onError(error);
        handleFirestoreError(error, OperationType.LIST, goalsPath);
      }
    )
  );

  const quranPath = `users/${uid}/quranRoutine`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', uid, 'quranRoutine'),
      (snap) => {
        const list: QuranRoutineItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            type: data.type,
            title: data.title,
            targetAmount: data.targetAmount,
            completed: Boolean(data.completed),
            timeSlot: data.timeSlot,
            streak: Number(data.streak) || 0,
            quickLink: data.quickLink,
          };
        });
        callbacks.onQuranRoutine(list);
        callbacks.onSyncedPulse();
      },
      (error) => {
        callbacks.onError(error);
        handleFirestoreError(error, OperationType.LIST, quranPath);
      }
    )
  );

  const widgetsPath = `users/${uid}/customWidgets`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', uid, 'customWidgets'),
      (snap) => {
        const list: CustomDashboardWidget[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            kind: data.kind,
            title: data.title,
            icon: data.icon,
            color: data.color,
            content: data.content,
            items: data.items,
            count: data.count,
            target: data.target,
            unit: data.unit,
            createdAt: data.clientCreatedAt || new Date().toISOString(),
          };
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callbacks.onCustomWidgets(list);
        callbacks.onSyncedPulse();
      },
      (error) => {
        callbacks.onError(error);
        handleFirestoreError(error, OperationType.LIST, widgetsPath);
      }
    )
  );

  const phonePath = `users/${uid}/phoneAppLists`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'users', uid, 'phoneAppLists'),
      (snap) => {
        const list: PhoneAppList[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            title: data.title,
            icon: data.icon,
            color: data.color,
            apps: Array.isArray(data.apps) ? data.apps : [],
          };
        });
        callbacks.onPhoneAppLists(list);
        callbacks.onSyncedPulse();
      },
      (error) => {
        callbacks.onError(error);
        handleFirestoreError(error, OperationType.LIST, phonePath);
      }
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

export async function syncWorkspaceFields(
  uid: string,
  partial: Partial<WorkspaceSettingsPayload>
): Promise<void> {
  const path = `users/${uid}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (partial.profile) updatePayload.profile = sanitizeProfile(partial.profile);
  if (partial.dashboardLayout) updatePayload.dashboardLayout = sanitizeLayout(partial.dashboardLayout);
  if (partial.adhkarState) updatePayload.adhkarState = sanitizeAdhkar(partial.adhkarState);
  if (partial.quranNotificationsEnabled !== undefined) {
    updatePayload.quranNotificationsEnabled = Boolean(partial.quranNotificationsEnabled);
  }
  if (partial.pushEnabled !== undefined) updatePayload.pushEnabled = Boolean(partial.pushEnabled);
  if (partial.soundEnabled !== undefined) updatePayload.soundEnabled = Boolean(partial.soundEnabled);
  if (partial.autoDndEnabled !== undefined) {
    updatePayload.autoDndEnabled = Boolean(partial.autoDndEnabled);
  }

  try {
    await updateDoc(doc(db, 'users', uid), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertTaskDoc(uid: string, task: Task, isNew: boolean): Promise<void> {
  const { id, payload } = serializeTask(uid, task, isNew);
  const path = `users/${uid}/tasks/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'tasks', id), payload);
    } else {
      const updatePayload = { ...payload };
      delete updatePayload.id;
      delete updatePayload.ownerId;
      delete updatePayload.clientCreatedAt;
      await updateDoc(doc(db, 'users', uid, 'tasks', id), updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteTaskDoc(uid: string, taskId: string): Promise<void> {
  const id = sanitizeDocId(taskId, 'task');
  const path = `users/${uid}/tasks/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'tasks', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertScheduleBlockDoc(
  uid: string,
  block: TimeBlock,
  isNew: boolean
): Promise<void> {
  const { id, payload } = serializeScheduleBlock(uid, block, isNew);
  const path = `users/${uid}/schedule/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'schedule', id), payload);
    } else {
      const updatePayload = { ...payload };
      delete updatePayload.id;
      delete updatePayload.ownerId;
      await updateDoc(doc(db, 'users', uid, 'schedule', id), updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteScheduleBlockDoc(uid: string, blockId: string): Promise<void> {
  const id = sanitizeDocId(blockId, 'block');
  const path = `users/${uid}/schedule/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'schedule', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function replaceScheduleCollection(
  uid: string,
  existingIds: string[],
  newBlocks: TimeBlock[]
): Promise<void> {
  const path = `users/${uid}/schedule`;
  try {
    const batch = writeBatch(db);
    for (const oldId of existingIds) {
      batch.delete(doc(db, 'users', uid, 'schedule', sanitizeDocId(oldId, 'block')));
    }
    for (const b of newBlocks) {
      const { id, payload } = serializeScheduleBlock(uid, b, true);
      batch.set(doc(db, 'users', uid, 'schedule', id), payload);
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertGoalDoc(uid: string, goal: LongTermGoal, isNew: boolean): Promise<void> {
  const { id, payload } = serializeGoal(uid, goal, isNew);
  const path = `users/${uid}/goals/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'goals', id), payload);
    } else {
      const updatePayload = { ...payload };
      delete updatePayload.id;
      delete updatePayload.ownerId;
      await updateDoc(doc(db, 'users', uid, 'goals', id), updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteGoalDoc(uid: string, goalId: string): Promise<void> {
  const id = sanitizeDocId(goalId, 'goal');
  const path = `users/${uid}/goals/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'goals', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertQuranDoc(
  uid: string,
  item: QuranRoutineItem,
  isNew: boolean
): Promise<void> {
  const { id, payload } = serializeQuranItem(uid, item, isNew);
  const path = `users/${uid}/quranRoutine/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'quranRoutine', id), payload);
    } else {
      const updatePayload = { ...payload };
      delete updatePayload.id;
      delete updatePayload.ownerId;
      await updateDoc(doc(db, 'users', uid, 'quranRoutine', id), updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteQuranDoc(uid: string, itemId: string): Promise<void> {
  const id = sanitizeDocId(itemId, 'qr');
  const path = `users/${uid}/quranRoutine/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'quranRoutine', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function resetQuranRoutineDocs(uid: string, items: QuranRoutineItem[]): Promise<void> {
  const path = `users/${uid}/quranRoutine`;
  try {
    const batch = writeBatch(db);
    for (const item of items) {
      const id = sanitizeDocId(item.id, 'qr');
      batch.update(doc(db, 'users', uid, 'quranRoutine', id), {
        completed: false,
        streak: item.streak,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertCustomWidgetDoc(
  uid: string,
  widget: CustomDashboardWidget,
  isNew: boolean
): Promise<void> {
  const { id, payload } = serializeCustomWidget(uid, widget, isNew);
  const path = `users/${uid}/customWidgets/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'customWidgets', id), payload);
    } else {
      const updatePayload = { ...payload };
      delete updatePayload.id;
      delete updatePayload.ownerId;
      delete updatePayload.clientCreatedAt;
      await updateDoc(doc(db, 'users', uid, 'customWidgets', id), updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCustomWidgetDoc(uid: string, widgetId: string): Promise<void> {
  const id = sanitizeDocId(widgetId, 'cw');
  const path = `users/${uid}/customWidgets/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'customWidgets', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertPhoneAppListDoc(
  uid: string,
  list: PhoneAppList,
  isNew: boolean
): Promise<void> {
  const { id, payload } = serializePhoneAppList(uid, list, isNew);
  const path = `users/${uid}/phoneAppLists/${id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'phoneAppLists', id), payload);
    } else {
      const updatePayload = { ...payload };
      delete updatePayload.id;
      delete updatePayload.ownerId;
      await updateDoc(doc(db, 'users', uid, 'phoneAppLists', id), updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deletePhoneAppListDoc(uid: string, listId: string): Promise<void> {
  const id = sanitizeDocId(listId, 'plist');
  const path = `users/${uid}/phoneAppLists/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'phoneAppLists', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
