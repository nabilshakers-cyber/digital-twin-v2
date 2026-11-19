import React, { useState, useEffect } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { 
  defaultProfile, 
  defaultTasks, 
  defaultSchedule,
  initialGoals,
  initialQuranRoutine
} from './data/initialData';
import { 
  DigitalTwinProfile, 
  Task, 
  TimeBlock,
  LongTermGoal,
  ContextualBriefing,
  QuranRoutineItem,
  DailyAdhkarState,
  DashboardLayoutEntry,
  CustomDashboardWidget,
  PhoneAppList,
  PhoneAppShortcut
} from './types';
import { DEFAULT_DASHBOARD_LAYOUT, INITIAL_PHONE_APP_LISTS } from './data/dashboardDefaults';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { TasksHubView } from './components/TasksHubView';
import { ScheduleView } from './components/ScheduleView';
import { FocusModeModal } from './components/FocusModeModal';
import { TwinChatDrawer } from './components/TwinChatDrawer';
import { SmartQuickAddModal } from './components/SmartQuickAddModal';
import { TaskBreakdownModal } from './components/TaskBreakdownModal';
import { TwinProfileModal } from './components/TwinProfileModal';
import { DailyBriefingModal } from './components/DailyBriefingModal';
import { ContextualBriefingModal } from './components/ContextualBriefingModal';
import { SmartReminderToasts } from './components/SmartReminderToasts';
import { OfflineIndicator } from './components/OfflineIndicator';
import { classifyTasksWithAI, optimizeScheduleWithAI } from './utils/api';
import { soundEngine } from './utils/audioSynth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  getSavedLocalAuthUser,
  signInInApp,
  signOutUser,
  type AppAuthUser,
} from './firebase';
import {
  deleteCustomWidgetDoc,
  deleteGoalDoc,
  deletePhoneAppListDoc,
  deleteQuranDoc,
  deleteScheduleBlockDoc,
  deleteTaskDoc,
  ensureUserWorkspace,
  pushLocalSnapshotToCloud,
  replaceScheduleCollection,
  resetQuranRoutineDocs,
  sanitizeDocId,
  subscribeUserCloudData,
  syncWorkspaceFields,
  upsertCustomWidgetDoc,
  upsertGoalDoc,
  upsertPhoneAppListDoc,
  upsertQuranDoc,
  upsertScheduleBlockDoc,
  upsertTaskDoc,
  type LocalWorkspaceSnapshot,
} from './utils/firestoreSync';
import {
  ADHKAR_STORAGE_KEY,
  buildTomorrowEnergyAlertReminder,
  computeNextAdhkarState,
  generateSmartReminders,
  getPushPermission,
  loadInitialAdhkarState,
  requestPushPermission,
  sendBrowserNotification,
  SmartReminder,
} from './utils/reminderEngine';
import {
  analyzeTomorrowEnergyLoad,
  getSmartReschedulingSuggestions,
  getTomorrowDateString,
  TomorrowEnergyAnalysis,
} from './utils/burnoutEngine';
import confetti from 'canvas-confetti';

const STORAGE_KEYS = {
  PROFILE: 'digital_twin_profile_v1',
  TASKS: 'digital_twin_tasks_v1',
  SCHEDULE: 'digital_twin_schedule_v1',
  SNOOZED: 'digital_twin_snoozed_v1',
  PUSH_ENABLED: 'digital_twin_push_enabled_v1',
  SOUND_ENABLED: 'digital_twin_sound_enabled_v1',
  AUTO_DND: 'digital_twin_auto_dnd_v1',
  GOALS: 'digital_twin_goals_v2',
  QURAN_ROUTINE: 'digital_twin_quran_routine_v7',
  QURAN_NOTIFICATIONS: 'digital_twin_quran_notifications_v1',
  DASHBOARD_LAYOUT: 'digital_twin_dashboard_layout_v1',
  CUSTOM_WIDGETS: 'digital_twin_custom_widgets_v1',
  PHONE_APP_LISTS: 'digital_twin_phone_app_lists_v1',
};

export default function App() {
  // 1. Core State with Local Storage persistence
  const [profile, setProfile] = useState<DigitalTwinProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return saved ? JSON.parse(saved) : defaultProfile;
    } catch {
      return defaultProfile;
    }
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      return saved ? JSON.parse(saved) : defaultTasks;
    } catch {
      return defaultTasks;
    }
  });

  const [schedule, setSchedule] = useState<TimeBlock[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
      return saved ? JSON.parse(saved) : defaultSchedule;
    } catch {
      return defaultSchedule;
    }
  });

  const [goals, setGoals] = useState<LongTermGoal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GOALS);
      return saved ? JSON.parse(saved) : initialGoals;
    } catch {
      return initialGoals;
    }
  });

  const [quranRoutine, setQuranRoutine] = useState<QuranRoutineItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QURAN_ROUTINE);
      return saved ? JSON.parse(saved) : initialQuranRoutine;
    } catch {
      return initialQuranRoutine;
    }
  });

  const [adhkarState, setAdhkarState] = useState<DailyAdhkarState>(() =>
    loadInitialAdhkarState()
  );

  const [quranNotificationsEnabled, setQuranNotificationsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QURAN_NOTIFICATIONS);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [customWidgets, setCustomWidgets] = useState<CustomDashboardWidget[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_WIDGETS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayoutEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DASHBOARD_LAYOUT);
      if (!saved) return DEFAULT_DASHBOARD_LAYOUT;
      const parsed: DashboardLayoutEntry[] = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_DASHBOARD_LAYOUT;
      const existingIds = new Set(parsed.map((item) => item.id));
      const missingBuiltins = DEFAULT_DASHBOARD_LAYOUT.filter((b) => !existingIds.has(b.id));
      return [...parsed, ...missingBuiltins];
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
  });

  const [phoneAppLists, setPhoneAppLists] = useState<PhoneAppList[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PHONE_APP_LISTS);
      return saved ? JSON.parse(saved) : INITIAL_PHONE_APP_LISTS;
    } catch {
      return INITIAL_PHONE_APP_LISTS;
    }
  });

  // 2. Navigation Tab state
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'tasks' | 'schedule' | 'focus'>('dashboard');
  const [scheduleFocusDate, setScheduleFocusDate] = useState<string | undefined>();

  // 3. Modals & Overlays
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<'profile' | 'widgets' | 'cloud' | 'android'>('profile');
  const [isFocusOpen, setIsFocusOpen] = useState(false);

  // 3.5 Local / Firebase Auth & Cloud Sync State
  const [authUser, setAuthUser] = useState<AppAuthUser | null>(() => getSavedLocalAuthUser());
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [asyncCloudError, setAsyncCloudError] = useState<unknown>(null);
  if (asyncCloudError) {
    throw asyncCloudError;
  }
  const [focusTask, setFocusTask] = useState<Task | undefined>();
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [breakdownTask, setBreakdownTask] = useState<Task | undefined>();
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [briefingType, setBriefingType] = useState<'morning' | 'evening'>('morning');
  const [isContextualBriefingOpen, setIsContextualBriefingOpen] = useState(false);
  const [contextualBriefingTask, setContextualBriefingTask] = useState<Task | undefined>();
  const [contextualBriefingsCache, setContextualBriefingsCache] = useState<
    Record<string, ContextualBriefing>
  >({});

  // 4. AI Schedule Optimization state
  const [isOptimizingSchedule, setIsOptimizingSchedule] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    summary: string;
    energyStrategy: string;
    topPriorities: string[];
    warnings?: string[];
  } | null>(null);

  // 5. Smart Reminders & Push Notifications state
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [snoozedMap, setSnoozedMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SNOOZED);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [dismissedToastIds, setDismissedToastIds] = useState<Set<string>>(() => new Set());
  const [testToasts, setTestToasts] = useState<SmartReminder[]>([]);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getPushPermission()
  );
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PUSH_ENABLED);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [autoDndEnabled, setAutoDndEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTO_DND);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [manualDnd, setManualDnd] = useState<boolean>(false);
  const [isFocusSessionRunning, setIsFocusSessionRunning] = useState<boolean>(false);
  const isDndActive = manualDnd || (autoDndEnabled && isFocusSessionRunning);
  const notifiedIdsRef = React.useRef<Set<string>>(new Set());

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to save profile to localStorage', e);
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.warn('Failed to save tasks to localStorage', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(schedule));
    } catch (e) {
      console.warn('Failed to save schedule to localStorage', e);
    }
  }, [schedule]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SNOOZED, JSON.stringify(snoozedMap));
    } catch {
      // ignore
    }
  }, [snoozedMap]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PUSH_ENABLED, JSON.stringify(pushEnabled));
    } catch {
      // ignore
    }
  }, [pushEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, JSON.stringify(soundEnabled));
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_DND, JSON.stringify(autoDndEnabled));
    } catch {
      // ignore
    }
  }, [autoDndEnabled]);

  // Keep latest local snapshot ref for initial cloud workspace migration
  const latestSnapshotRef = React.useRef<LocalWorkspaceSnapshot>({
    profile,
    tasks,
    schedule,
    goals,
    quranRoutine,
    adhkarState,
    customWidgets,
    dashboardLayout,
    phoneAppLists,
    quranNotificationsEnabled,
    pushEnabled,
    soundEnabled,
    autoDndEnabled,
  });

  latestSnapshotRef.current = {
    profile,
    tasks,
    schedule,
    goals,
    quranRoutine,
    adhkarState,
    customWidgets,
    dashboardLayout,
    phoneAppLists,
    quranNotificationsEnabled,
    pushEnabled,
    soundEnabled,
    autoDndEnabled,
  };

  // Firebase Auth listener (preserves in-app local session when not signed in via Firebase)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setAuthUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName,
          email: fbUser.email,
          photoURL: fbUser.photoURL,
          mode: 'firebase',
        });
      } else {
        const localUser = getSavedLocalAuthUser();
        setAuthUser(localUser);
        setCloudSyncStatus('local');
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore real-time synchronization (active only when signed in with Firebase Auth)
  useEffect(() => {
    if (!authReady || !authUser || authUser.mode !== 'firebase' || !auth.currentUser) return;

    let cancelled = false;
    let unsubCloud: (() => void) | undefined;

    const initSync = async () => {
      setCloudSyncStatus('syncing');
      try {
        await ensureUserWorkspace(authUser.uid, latestSnapshotRef.current);
        if (cancelled) return;

        unsubCloud = subscribeUserCloudData(authUser.uid, {
          onWorkspace: (ws) => {
            if (ws.profile) setProfile(ws.profile);
            if (Array.isArray(ws.dashboardLayout) && ws.dashboardLayout.length > 0) {
              const existingIds = new Set(ws.dashboardLayout.map((item) => item.id));
              const missingBuiltins = DEFAULT_DASHBOARD_LAYOUT.filter(
                (b) => !existingIds.has(b.id)
              );
              setDashboardLayout([...ws.dashboardLayout, ...missingBuiltins]);
            }
            if (ws.adhkarState) setAdhkarState(ws.adhkarState);
            if (typeof ws.quranNotificationsEnabled === 'boolean') {
              setQuranNotificationsEnabled(ws.quranNotificationsEnabled);
            }
            if (typeof ws.pushEnabled === 'boolean') setPushEnabled(ws.pushEnabled);
            if (typeof ws.soundEnabled === 'boolean') setSoundEnabled(ws.soundEnabled);
            if (typeof ws.autoDndEnabled === 'boolean') setAutoDndEnabled(ws.autoDndEnabled);
          },
          onTasks: (cloudTasks) => setTasks(cloudTasks),
          onSchedule: (cloudSchedule) => setSchedule(cloudSchedule),
          onGoals: (cloudGoals) => setGoals(cloudGoals),
          onQuranRoutine: (cloudQuran) => setQuranRoutine(cloudQuran),
          onCustomWidgets: (cloudWidgets) => setCustomWidgets(cloudWidgets),
          onPhoneAppLists: (cloudLists) => setPhoneAppLists(cloudLists),
          onSyncedPulse: () => {
            setCloudSyncStatus('synced');
            setLastSyncedAt(
              new Date().toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit',
              })
            );
          },
          onError: (err) => {
            setCloudSyncStatus('error');
            setAsyncCloudError(err);
          },
        });
      } catch (err) {
        if (!cancelled) {
          setCloudSyncStatus('error');
          setAsyncCloudError(err);
        }
      }
    };

    initSync();

    return () => {
      cancelled = true;
      if (unsubCloud) unsubCloud();
    };
  }, [authReady, authUser]);

  const runCloudMutation = async (fn: (uid: string) => Promise<void>) => {
    if (!authUser || authUser.mode !== 'firebase' || !auth.currentUser) return;
    setCloudSyncStatus('syncing');
    try {
      await fn(authUser.uid);
      setCloudSyncStatus('synced');
      setLastSyncedAt(
        new Date().toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    } catch (err) {
      setCloudSyncStatus('error');
      setAsyncCloudError(err);
    }
  };

  // Single-modal mutex helpers so mobile overlays never stack or overlap
  const closeAllModals = () => {
    setIsChatOpen(false);
    setIsQuickAddOpen(false);
    setIsProfileOpen(false);
    setIsFocusOpen(false);
    setIsBreakdownOpen(false);
    setIsBriefingOpen(false);
    setIsContextualBriefingOpen(false);
    setCurrentTab((prev) => (prev === 'focus' ? 'dashboard' : prev));
  };

  const openChatModal = (prompt?: string) => {
    closeAllModals();
    setChatInitialPrompt(prompt);
    setIsChatOpen(true);
  };

  const openQuickAddModal = () => {
    closeAllModals();
    setIsQuickAddOpen(true);
  };

  const openProfileModal = (tab: 'profile' | 'widgets' | 'cloud' | 'android' = 'profile') => {
    closeAllModals();
    setProfileInitialTab(tab);
    setIsProfileOpen(true);
  };

  const openFocusModal = (task?: Task) => {
    closeAllModals();
    setFocusTask(task);
    setIsFocusOpen(true);
  };

  const openBreakdownModal = (task: Task) => {
    closeAllModals();
    setBreakdownTask(task);
    setIsBreakdownOpen(true);
  };

  const openBriefingModal = (type: 'morning' | 'evening') => {
    closeAllModals();
    setBriefingType(type);
    setIsBriefingOpen(true);
  };

  const openContextualBriefingModal = (task: Task) => {
    closeAllModals();
    setContextualBriefingTask(task);
    setIsContextualBriefingOpen(true);
  };

  const handleNavigateTab = (tab: 'dashboard' | 'tasks' | 'schedule' | 'focus') => {
    closeAllModals();
    if (tab === 'focus') {
      setIsFocusOpen(true);
    }
    setCurrentTab(tab);
  };

  const handleSignIn = async (
    displayName?: string,
    email?: string,
    preferCloudPopup = false
  ) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await signInInApp(
        displayName || profile.name,
        email,
        preferCloudPopup
      );
      setAuthUser(user);
      setCloudSyncStatus(user.mode === 'local' ? 'local' : 'syncing');
    } catch (err: any) {
      console.error('Sign-In failed:', err);
      setAuthError(err?.message || 'تعذر تسجيل الدخول.');
      openProfileModal('cloud');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOutUser();
      setAuthUser(null);
      setCloudSyncStatus('local');
      setAuthError(null);
      closeAllModals();
      setCurrentTab('dashboard');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePushLocalToCloud = async () => {
    if (!authUser || authUser.mode !== 'firebase' || !auth.currentUser) return;
    await runCloudMutation((uid) => pushLocalSnapshotToCloud(uid, latestSnapshotRef.current));
  };

  // Poll every 30 seconds for approaching/overdue reminders
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const smartReminders = React.useMemo(
    () =>
      generateSmartReminders(
        tasks,
        schedule,
        snoozedMap,
        dismissedIds,
        new Date(nowTick),
        adhkarState,
        quranNotificationsEnabled,
        profile
      ),
    [tasks, schedule, snoozedMap, dismissedIds, nowTick, adhkarState, quranNotificationsEnabled, profile]
  );

  // Trigger browser push notification & subtle chime for newly surfaced urgent reminders (suppressed in DND)
  useEffect(() => {
    if (isDndActive) return;

    const newlyTriggered: SmartReminder[] = [];
    for (const rem of smartReminders) {
      const notifyKey = `${rem.id}:${rem.urgency}`;
      if (!notifiedIdsRef.current.has(notifyKey)) {
        notifiedIdsRef.current.add(notifyKey);
        newlyTriggered.push(rem);
      }
    }

    if (newlyTriggered.length > 0) {
      const primary = newlyTriggered[0];
      if (pushEnabled && pushPermission === 'granted') {
        const pushTitle =
          primary.urgency === 'energy_warning'
            ? '⚡ تنبيه نهاية اليوم: مهام الغد تتجاوز طاقتك'
            : primary.urgency === 'gentle'
            ? '🤲 تذكير لطيف بأذكار اليوم'
            : primary.urgency === 'overdue'
            ? '⏰ مهمة متأخرة عن الموعد'
            : '🔔 تذكير بموعد قريب';
        sendBrowserNotification(
          pushTitle,
          `${primary.title} (${primary.timeLabel})`,
          primary.id
        );
      }
      if (soundEnabled) {
        soundEngine.playChime(primary.urgency !== 'overdue' && primary.urgency !== 'energy_warning');
      }
    }
  }, [smartReminders, pushEnabled, pushPermission, soundEnabled, isDndActive]);

  const visibleToasts = React.useMemo(() => {
    if (isDndActive) return [];
    const activeAutoToasts = smartReminders.filter((r) => !dismissedToastIds.has(r.id));
    return [...testToasts, ...activeAutoToasts];
  }, [smartReminders, dismissedToastIds, testToasts, isDndActive]);

  // Compute live sync score
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const completedBlocks = schedule.filter((b) => b.isCompleted);
  const totalItems = tasks.length + schedule.length;
  const totalCompleted = completedTasks.length + completedBlocks.length;
  const syncScore = totalItems > 0 ? Math.min(100, Math.round((totalCompleted / totalItems) * 85) + 15) : 90;

  // Handlers for Tasks
  const handleToggleTask = (taskId: string) => {
    let updatedTask: Task | null = null;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const willBeCompleted = t.status !== 'completed';
          if (willBeCompleted) {
            soundEngine.playChime(true);
            confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
          }
          updatedTask = {
            ...t,
            status: willBeCompleted ? 'completed' : 'todo',
            completedAt: willBeCompleted ? new Date().toISOString() : '',
          };
          return updatedTask;
        }
        return t;
      })
    );
    if (updatedTask) {
      const target = updatedTask;
      void runCloudMutation((uid) => upsertTaskDoc(uid, target, false));
    }
  };

  const handleAddTask = (newTask: Partial<Task>) => {
    const task: Task = {
      id: `task-${Date.now()}`,
      title: newTask.title || 'مهمة جديدة',
      description: newTask.description || '',
      category: newTask.category || 'work',
      priority: newTask.priority || 'medium',
      status: newTask.status || 'todo',
      estimatedMinutes: newTask.estimatedMinutes || 30,
      dueDate: newTask.dueDate,
      dueTime: newTask.dueTime,
      energyRequired: newTask.energyRequired || 'medium',
      createdAt: new Date().toISOString(),
      subtasks: newTask.subtasks || [],
      isTopPriority: !newTask.isUnclassified && newTask.priority === 'high',
      isUnclassified: Boolean(newTask.isUnclassified),
    };
    setTasks((prev) => [task, ...prev]);
    soundEngine.playChime(true);
    void runCloudMutation((uid) => upsertTaskDoc(uid, task, true));
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    void runCloudMutation((uid) => upsertTaskDoc(uid, updatedTask, false));
  };

  const handleAutoClassifyTasks = async (
    tasksToClassify: Task[]
  ): Promise<{ count: number; summary: string }> => {
    const result = await classifyTasksWithAI({ tasks: tasksToClassify, profile });
    const classMap = new Map(result.classifications.map((c) => [c.id, c]));
    const updatedList: Task[] = [];

    setTasks((prev) =>
      prev.map((t) => {
        const matched = classMap.get(t.id);
        if (!matched) return t;
        const nextPriority = matched.priority || t.priority;
        const nextCategory = matched.category || t.category;
        const updated: Task = {
          ...t,
          category: nextCategory,
          priority: nextPriority,
          energyRequired:
            nextPriority === 'high' ? 'high' : nextPriority === 'low' ? 'low' : 'medium',
          isTopPriority: nextPriority === 'high',
          isUnclassified: false,
        };
        updatedList.push(updated);
        return updated;
      })
    );

    if (updatedList.length > 0) {
      soundEngine.playChime(true);
      confetti({ particleCount: 55, spread: 65 });
      void runCloudMutation(async (uid) => {
        for (const t of updatedList) {
          await upsertTaskDoc(uid, t, false);
        }
      });
    }

    return { count: updatedList.length, summary: result.summary };
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    void runCloudMutation((uid) => deleteTaskDoc(uid, taskId));
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    let updatedTask: Task | null = null;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId && t.subtasks) {
          const updatedSubtasks = t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          );
          const allCompleted = updatedSubtasks.every((st) => st.completed);
          updatedTask = {
            ...t,
            subtasks: updatedSubtasks,
            status: allCompleted ? 'completed' : t.status,
          };
          return updatedTask;
        }
        return t;
      })
    );
    if (updatedTask) {
      const target = updatedTask;
      void runCloudMutation((uid) => upsertTaskDoc(uid, target, false));
    }
  };

  const handleApplySubtasks = (taskId: string, subtasks: any[]) => {
    let updatedTask: Task | null = null;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          updatedTask = { ...t, subtasks };
          return updatedTask;
        }
        return t;
      })
    );
    if (updatedTask) {
      const target = updatedTask;
      void runCloudMutation((uid) => upsertTaskDoc(uid, target, false));
    }
  };

  const handlePostponeTask = (taskId: string) => {
    const tomorrowStr = getTomorrowDateString();
    let updatedTask: Task | null = null;
    const removedBlockIds: string[] = [];

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          updatedTask = { ...t, dueDate: tomorrowStr, isTopPriority: false };
          return updatedTask;
        }
        return t;
      })
    );
    setSchedule((prev) =>
      prev.filter((b) => {
        const shouldRemove = b.relatedTaskId === taskId && !b.isFixed && !b.isCompleted;
        if (shouldRemove) removedBlockIds.push(b.id);
        return !shouldRemove;
      })
    );
    soundEngine.playChime(true);

    void runCloudMutation(async (uid) => {
      if (updatedTask) await upsertTaskDoc(uid, updatedTask, false);
      for (const bid of removedBlockIds) {
        await deleteScheduleBlockDoc(uid, bid);
      }
    });
  };

  const handlePostponeAllSuggested = () => {
    const tomorrowStr = getTomorrowDateString();
    const suggestedIds = new Set(
      getSmartReschedulingSuggestions(tasks)
        .filter((t) => t.suggestedPostpone && (!t.dueDate || t.dueDate < tomorrowStr))
        .map((t) => t.id)
    );
    if (suggestedIds.size === 0) return;

    const updatedTasksList: Task[] = [];
    const removedBlockIds: string[] = [];

    setTasks((prev) =>
      prev.map((t) => {
        if (suggestedIds.has(t.id)) {
          const next = { ...t, dueDate: tomorrowStr, isTopPriority: false };
          updatedTasksList.push(next);
          return next;
        }
        return t;
      })
    );
    setSchedule((prev) =>
      prev.filter((b) => {
        const shouldRemove =
          Boolean(b.relatedTaskId && suggestedIds.has(b.relatedTaskId) && !b.isFixed && !b.isCompleted);
        if (shouldRemove) removedBlockIds.push(b.id);
        return !shouldRemove;
      })
    );
    soundEngine.playChime(true);

    void runCloudMutation(async (uid) => {
      for (const t of updatedTasksList) await upsertTaskDoc(uid, t, false);
      for (const bid of removedBlockIds) await deleteScheduleBlockDoc(uid, bid);
    });
  };

  // Handlers for Schedule
  const handleToggleScheduleBlock = (blockId: string) => {
    let updatedBlock: TimeBlock | null = null;
    setSchedule((prev) =>
      prev.map((b) => {
        if (b.id === blockId) {
          const willBeCompleted = !b.isCompleted;
          if (willBeCompleted) {
            soundEngine.playChime(true);
          }
          updatedBlock = { ...b, isCompleted: willBeCompleted };
          return updatedBlock;
        }
        return b;
      })
    );
    if (updatedBlock) {
      const target = updatedBlock;
      void runCloudMutation((uid) => upsertScheduleBlockDoc(uid, target, false));
    }
  };

  const handleAddScheduleBlock = (newBlock: Partial<TimeBlock>) => {
    const block: TimeBlock = {
      id: `block-${Date.now()}`,
      startTime: newBlock.startTime || '10:00',
      endTime: newBlock.endTime || '11:00',
      title: newBlock.title || 'موعد جديد',
      description: newBlock.description || '',
      category: newBlock.category || 'deep_work',
      priority: newBlock.priority || 'medium',
      isFixed: newBlock.isFixed || false,
      isCompleted: false,
      relatedTaskId: newBlock.relatedTaskId,
      date: newBlock.date,
    };
    setSchedule((prev) => [...prev, block]);
    void runCloudMutation((uid) => upsertScheduleBlockDoc(uid, block, true));
  };

  const handleDeleteScheduleBlock = (blockId: string) => {
    setSchedule((prev) => prev.filter((b) => b.id !== blockId));
    void runCloudMutation((uid) => deleteScheduleBlockDoc(uid, blockId));
  };

  const handleUpdateScheduleBlock = (updatedBlock: TimeBlock) => {
    setSchedule((prev) => prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)));
    soundEngine.playChime(true);
    void runCloudMutation((uid) => upsertScheduleBlockDoc(uid, updatedBlock, false));
  };

  // AI Auto-Schedule Optimizer
  const handleOptimizeSchedule = async () => {
    setIsOptimizingSchedule(true);
    try {
      const fixedEvents = schedule.filter((b) => b.isFixed);
      const pendingTasks = tasks.filter((t) => t.status !== 'completed');

      const data = await optimizeScheduleWithAI({
        tasks: pendingTasks,
        fixedEvents,
        profile,
        targetWorkHours: profile.dailyWorkHoursTarget || 7,
      });

      if (data.timeBlocks && data.timeBlocks.length > 0) {
        const oldIds = schedule.map((b) => b.id);
        const sanitizedBlocks = data.timeBlocks.map((b, idx) => ({
          ...b,
          id: sanitizeDocId(b.id || `opt-${Date.now()}-${idx}`, 'opt'),
        }));
        setSchedule(sanitizedBlocks);
        setOptimizationResult({
          summary: data.summary,
          energyStrategy: data.energyStrategy,
          topPriorities: data.topPriorities,
          warnings: data.warnings,
        });
        soundEngine.playChime(true);
        confetti({ particleCount: 70, spread: 80 });
        void runCloudMutation((uid) => replaceScheduleCollection(uid, oldIds, sanitizedBlocks));
      }
    } catch (e: any) {
      console.error(e);
      setAuthError('تعذر تحسين الجدول حالياً: ' + (e.message || 'خطأ في الاتصال بالذكاء الاصطناعي'));
    } finally {
      setIsOptimizingSchedule(false);
    }
  };

  // Natural Language Smart Add Callback
  const handleAddExtracted = (extractedTasks: Partial<Task>[], extractedEvents: Partial<TimeBlock>[]) => {
    let createdTasks: Task[] = [];
    let createdEvents: TimeBlock[] = [];

    if (extractedTasks.length > 0) {
      createdTasks = extractedTasks.map((et, idx) => ({
        id: `task-ext-${Date.now()}-${idx}`,
        title: et.title || 'مهمة مستخرجة',
        description: et.description || '',
        category: (et.category as any) || 'work',
        priority: (et.priority as any) || 'medium',
        status: 'todo',
        estimatedMinutes: et.estimatedMinutes || 30,
        dueDate: et.dueDate || new Date().toISOString().split('T')[0],
        dueTime: et.dueTime,
        energyRequired: et.priority === 'high' ? 'high' : 'medium',
        createdAt: new Date().toISOString(),
        isTopPriority: et.priority === 'high',
      }));
      setTasks((prev) => [...createdTasks, ...prev]);
    }

    if (extractedEvents.length > 0) {
      createdEvents = extractedEvents.map((ee, idx) => ({
        id: `block-ext-${Date.now()}-${idx}`,
        startTime: ee.startTime || '12:00',
        endTime: ee.endTime || '13:00',
        title: ee.title || 'موعد مستخرج',
        category: (ee.category as any) || 'meeting',
        priority: 'medium',
        isFixed: true,
        isCompleted: false,
      }));
      setSchedule((prev) => [...prev, ...createdEvents]);
    }

    if (createdTasks.length > 0 || createdEvents.length > 0) {
      void runCloudMutation(async (uid) => {
        for (const t of createdTasks) await upsertTaskDoc(uid, t, true);
        for (const b of createdEvents) await upsertScheduleBlockDoc(uid, b, true);
      });
    }
  };

  // Long-Term Goals Handlers & Sync
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    } catch {
      // ignore
    }
  }, [goals]);

  const handleAddGoal = (newGoal: Omit<LongTermGoal, 'id'>) => {
    const goal: LongTermGoal = {
      id: `goal-${Date.now()}`,
      ...newGoal,
    };
    setGoals((prev) => [goal, ...prev]);
    soundEngine.playChime(true);
    void runCloudMutation((uid) => upsertGoalDoc(uid, goal, true));
  };

  const handleUpdateGoalProgress = (goalId: string, progress: number) => {
    let updatedGoal: LongTermGoal | null = null;
    const clamped = Math.max(0, Math.min(100, progress));
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalId) {
          updatedGoal = { ...g, progress: clamped };
          return updatedGoal;
        }
        return g;
      })
    );
    if (updatedGoal) {
      const target = updatedGoal;
      void runCloudMutation((uid) => upsertGoalDoc(uid, target, false));
    }
  };

  const handleUpdateGoal = (updatedGoal: LongTermGoal) => {
    setGoals((prev) => prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g)));
    soundEngine.playChime(true);
    void runCloudMutation((uid) => upsertGoalDoc(uid, updatedGoal, false));
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    void runCloudMutation((uid) => deleteGoalDoc(uid, goalId));
  };

  // Quran Routine Handlers & Sync
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.QURAN_ROUTINE, JSON.stringify(quranRoutine));
    } catch {
      // ignore
    }
  }, [quranRoutine]);

  const handleToggleQuranRoutine = (id: string) => {
    let updatedItem: QuranRoutineItem | null = null;
    setQuranRoutine((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const willComplete = !item.completed;
        if (willComplete) {
          soundEngine.playChime(true);
        }
        updatedItem = {
          ...item,
          completed: willComplete,
          streak: willComplete ? item.streak + 1 : Math.max(0, item.streak - 1),
        };
        return updatedItem;
      })
    );
    if (updatedItem) {
      const target = updatedItem;
      void runCloudMutation((uid) => upsertQuranDoc(uid, target, false));
    }
  };

  const handleAddQuranRoutine = (newItem: Omit<QuranRoutineItem, 'id'>) => {
    const item: QuranRoutineItem = {
      id: `qr-${Date.now()}`,
      ...newItem,
    };
    setQuranRoutine((prev) => [...prev, item]);
    soundEngine.playChime(true);
    void runCloudMutation((uid) => upsertQuranDoc(uid, item, true));
  };

  const handleDeleteQuranRoutine = (id: string) => {
    setQuranRoutine((prev) => prev.filter((item) => item.id !== id));
    void runCloudMutation((uid) => deleteQuranDoc(uid, id));
  };

  const handleUpdateQuranRoutine = (updatedItem: QuranRoutineItem) => {
    setQuranRoutine((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    soundEngine.playChime(true);
    void runCloudMutation((uid) => upsertQuranDoc(uid, updatedItem, false));
  };

  const handleResetDailyQuranRoutine = () => {
    const nextList = quranRoutine.map((item) => ({ ...item, completed: false }));
    setQuranRoutine(nextList);
    void runCloudMutation((uid) => resetQuranRoutineDocs(uid, nextList));
  };

  // Dashboard Layout & Custom Widgets Sync and Handlers
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DASHBOARD_LAYOUT, JSON.stringify(dashboardLayout));
    } catch {
      // ignore
    }
  }, [dashboardLayout]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_WIDGETS, JSON.stringify(customWidgets));
    } catch {
      // ignore
    }
  }, [customWidgets]);

  const handleToggleWidgetVisibility = (id: string) => {
    const nextLayout = dashboardLayout.map((entry) =>
      entry.id === id ? { ...entry, visible: !entry.visible } : entry
    );
    setDashboardLayout(nextLayout);
    void runCloudMutation((uid) => syncWorkspaceFields(uid, { dashboardLayout: nextLayout }));
  };

  const handleMoveLayoutEntry = (id: string, direction: 'up' | 'down') => {
    const index = dashboardLayout.findIndex((e) => e.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= dashboardLayout.length) return;
    const nextLayout = [...dashboardLayout];
    const [moved] = nextLayout.splice(index, 1);
    nextLayout.splice(targetIndex, 0, moved);
    setDashboardLayout(nextLayout);
    void runCloudMutation((uid) => syncWorkspaceFields(uid, { dashboardLayout: nextLayout }));
  };

  const handleResetDashboardLayout = () => {
    const customEntries: DashboardLayoutEntry[] = customWidgets.map((w) => ({
      id: w.id,
      isCustom: true,
      visible: true,
    }));
    const nextLayout = [...DEFAULT_DASHBOARD_LAYOUT, ...customEntries];
    setDashboardLayout(nextLayout);
    void runCloudMutation((uid) => syncWorkspaceFields(uid, { dashboardLayout: nextLayout }));
  };

  const handleAddCustomWidget = (newWidget: Omit<CustomDashboardWidget, 'id' | 'createdAt'>) => {
    const widget: CustomDashboardWidget = {
      id: `cw-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...newWidget,
    };
    const nextLayout = [{ id: widget.id, isCustom: true, visible: true }, ...dashboardLayout];
    setCustomWidgets((prev) => [widget, ...prev]);
    setDashboardLayout(nextLayout);
    soundEngine.playChime(true);
    void runCloudMutation(async (uid) => {
      await upsertCustomWidgetDoc(uid, widget, true);
      await syncWorkspaceFields(uid, { dashboardLayout: nextLayout });
    });
  };

  const handleUpdateCustomWidget = (updatedWidget: CustomDashboardWidget) => {
    setCustomWidgets((prev) => prev.map((w) => (w.id === updatedWidget.id ? updatedWidget : w)));
    void runCloudMutation((uid) => upsertCustomWidgetDoc(uid, updatedWidget, false));
  };

  const handleDeleteCustomWidget = (widgetId: string) => {
    const nextLayout = dashboardLayout.filter((entry) => entry.id !== widgetId);
    setCustomWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    setDashboardLayout(nextLayout);
    void runCloudMutation(async (uid) => {
      await deleteCustomWidgetDoc(uid, widgetId);
      await syncWorkspaceFields(uid, { dashboardLayout: nextLayout });
    });
  };

  // Phone App Lists Sync and Handlers
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PHONE_APP_LISTS, JSON.stringify(phoneAppLists));
    } catch {
      // ignore
    }
  }, [phoneAppLists]);

  const handleAddPhoneAppList = (newList: Omit<PhoneAppList, 'id'>) => {
    const list: PhoneAppList = {
      id: `plist-${Date.now()}`,
      ...newList,
    };
    setPhoneAppLists((prev) => [...prev, list]);
    soundEngine.playChime(true);
    void runCloudMutation((uid) => upsertPhoneAppListDoc(uid, list, true));
  };

  const handleUpdatePhoneAppList = (updatedList: PhoneAppList) => {
    setPhoneAppLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)));
    void runCloudMutation((uid) => upsertPhoneAppListDoc(uid, updatedList, false));
  };

  const handleDeletePhoneAppList = (listId: string) => {
    setPhoneAppLists((prev) => prev.filter((l) => l.id !== listId));
    void runCloudMutation((uid) => deletePhoneAppListDoc(uid, listId));
  };

  const handleAddPhoneAppToList = (listId: string, newApp: Omit<PhoneAppShortcut, 'id'>) => {
    const app: PhoneAppShortcut = {
      id: `papp-${Date.now()}`,
      ...newApp,
    };
    let updatedList: PhoneAppList | null = null;
    setPhoneAppLists((prev) =>
      prev.map((l) => {
        if (l.id === listId) {
          updatedList = { ...l, apps: [...l.apps, app] };
          return updatedList;
        }
        return l;
      })
    );
    soundEngine.playChime(true);
    if (updatedList) {
      const target = updatedList;
      void runCloudMutation((uid) => upsertPhoneAppListDoc(uid, target, false));
    }
  };

  const handleUpdatePhoneAppInList = (listId: string, updatedApp: PhoneAppShortcut) => {
    let updatedList: PhoneAppList | null = null;
    setPhoneAppLists((prev) =>
      prev.map((l) => {
        if (l.id === listId) {
          updatedList = {
            ...l,
            apps: l.apps.map((a) => (a.id === updatedApp.id ? updatedApp : a)),
          };
          return updatedList;
        }
        return l;
      })
    );
    if (updatedList) {
      const target = updatedList;
      void runCloudMutation((uid) => upsertPhoneAppListDoc(uid, target, false));
    }
  };

  const handleDeletePhoneAppFromList = (listId: string, appId: string) => {
    let updatedList: PhoneAppList | null = null;
    setPhoneAppLists((prev) =>
      prev.map((l) => {
        if (l.id === listId) {
          updatedList = { ...l, apps: l.apps.filter((a) => a.id !== appId) };
          return updatedList;
        }
        return l;
      })
    );
    if (updatedList) {
      const target = updatedList;
      void runCloudMutation((uid) => upsertPhoneAppListDoc(uid, target, false));
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(ADHKAR_STORAGE_KEY, JSON.stringify(adhkarState));
    } catch {
      // ignore
    }
  }, [adhkarState]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.QURAN_NOTIFICATIONS,
        JSON.stringify(quranNotificationsEnabled)
      );
    } catch {
      // ignore
    }
  }, [quranNotificationsEnabled]);

  const handleToggleAdhkar = (period: 'morning' | 'evening') => {
    const next = computeNextAdhkarState(adhkarState, period);
    const becameDone =
      period === 'morning' ? next.morningCompleted : next.eveningCompleted;
    if (becameDone) {
      soundEngine.playChime(true);
    }
    setAdhkarState(next);
    void runCloudMutation((uid) => syncWorkspaceFields(uid, { adhkarState: next }));
  };

  // Data Export / Import / Reset
  const handleExportData = () => {
    const bundle = {
      profile,
      tasks,
      schedule,
      goals,
      quranRoutine,
      customWidgets,
      dashboardLayout,
      phoneAppLists,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digital-twin-${profile.name || 'backup'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const nextSnapshot: LocalWorkspaceSnapshot = {
          ...latestSnapshotRef.current,
          ...(parsed.profile ? { profile: parsed.profile } : {}),
          ...(parsed.tasks ? { tasks: parsed.tasks } : {}),
          ...(parsed.schedule ? { schedule: parsed.schedule } : {}),
          ...(parsed.goals ? { goals: parsed.goals } : {}),
          ...(parsed.quranRoutine ? { quranRoutine: parsed.quranRoutine } : {}),
          ...(parsed.customWidgets ? { customWidgets: parsed.customWidgets } : {}),
          ...(parsed.dashboardLayout ? { dashboardLayout: parsed.dashboardLayout } : {}),
          ...(parsed.phoneAppLists ? { phoneAppLists: parsed.phoneAppLists } : {}),
        };
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.schedule) setSchedule(parsed.schedule);
        if (parsed.goals) setGoals(parsed.goals);
        if (parsed.quranRoutine) setQuranRoutine(parsed.quranRoutine);
        if (parsed.customWidgets) setCustomWidgets(parsed.customWidgets);
        if (parsed.dashboardLayout) setDashboardLayout(parsed.dashboardLayout);
        if (parsed.phoneAppLists) setPhoneAppLists(parsed.phoneAppLists);
        soundEngine.playChime(true);
        void runCloudMutation((uid) => pushLocalSnapshotToCloud(uid, nextSnapshot));
      } catch {
        setAuthError('ملف النسخة الاحتياطية غير صالح.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في استعادة الإعدادات والبيانات الافتراضية؟')) {
      const resetSnapshot: LocalWorkspaceSnapshot = {
        profile: defaultProfile,
        tasks: defaultTasks,
        schedule: defaultSchedule,
        goals: initialGoals,
        quranRoutine: initialQuranRoutine,
        adhkarState: loadInitialAdhkarState(),
        customWidgets: [],
        dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
        phoneAppLists: INITIAL_PHONE_APP_LISTS,
        quranNotificationsEnabled: true,
        pushEnabled: true,
        soundEnabled: true,
        autoDndEnabled: true,
      };
      setProfile(defaultProfile);
      setTasks(defaultTasks);
      setSchedule(defaultSchedule);
      setGoals(initialGoals);
      setQuranRoutine(initialQuranRoutine);
      setCustomWidgets([]);
      setDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
      setPhoneAppLists(INITIAL_PHONE_APP_LISTS);
      localStorage.clear();
      void runCloudMutation((uid) => pushLocalSnapshotToCloud(uid, resetSnapshot));
    }
  };

  // Reminder Actions
  const handleEnablePush = async () => {
    const perm = await requestPushPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      setPushEnabled(true);
      sendBrowserNotification(
        'تم تفعيل تنبيهات التوأم الرقمي',
        'ستصلك إشعارات فورية للمهام القريبة أو المتأخرة.'
      );
    }
  };

  const handleCompleteReminder = (reminder: SmartReminder) => {
    if (reminder.id.startsWith('test:')) {
      setTestToasts((prev) => prev.filter((t) => t.id !== reminder.id));
      soundEngine.playChime(true);
      return;
    }
    if (reminder.sourceType === 'adhkar' && reminder.adhkarPeriod) {
      handleToggleAdhkar(reminder.adhkarPeriod);
      return;
    }
    if (reminder.sourceType === 'task' && reminder.task) {
      handleToggleTask(reminder.task.id);
    } else if (reminder.sourceType === 'schedule' && reminder.block) {
      handleToggleScheduleBlock(reminder.block.id);
    }
  };

  const handleSnoozeReminder = (reminderId: string, minutes: number) => {
    if (reminderId.startsWith('test:')) {
      setTestToasts((prev) => prev.filter((t) => t.id !== reminderId));
      return;
    }
    const until = Date.now() + minutes * 60000;
    setSnoozedMap((prev) => ({ ...prev, [reminderId]: until }));
  };

  const handleDismissReminder = (reminderId: string) => {
    if (reminderId.startsWith('test:')) {
      setTestToasts((prev) => prev.filter((t) => t.id !== reminderId));
      return;
    }
    setDismissedIds((prev) => new Set(prev).add(reminderId));
  };

  const handleDismissToast = (reminderId: string) => {
    if (reminderId.startsWith('test:')) {
      setTestToasts((prev) => prev.filter((t) => t.id !== reminderId));
      return;
    }
    setDismissedToastIds((prev) => new Set(prev).add(reminderId));
  };

  const handleTestAlert = () => {
    if (isDndActive) return;

    const sampleTask = tasks.find((t) => t.status !== 'completed');
    const testId = `test:${Date.now()}`;
    const testReminder: SmartReminder = {
      id: testId,
      sourceType: 'task',
      task: sampleTask,
      title: sampleTask ? sampleTask.title : 'تنبيه تجريبي ذكي من نسختك الرقمية',
      urgency: 'due_soon',
      timeLabel: 'تنبيه تجريبي فوري',
      minutesDelta: 10,
      priorityScore: 999,
    };
    setTestToasts((prev) => [testReminder, ...prev]);

    if (pushEnabled && pushPermission === 'granted') {
      sendBrowserNotification('🔔 تنبيه تجريبي ذكي', testReminder.title, testId);
    }
    if (soundEnabled) {
      soundEngine.playChime(true);
    }
  };

  const handleTriggerTomorrowEnergyCheck = (overrideProfile?: DigitalTwinProfile) => {
    const activeProfile = overrideProfile || profile;
    const analysis = analyzeTomorrowEnergyLoad(tasks, schedule, activeProfile);
    const manualId = `test:eod-${Date.now()}`;
    const reminder = buildTomorrowEnergyAlertReminder(analysis, manualId);
    setTestToasts((prev) => [reminder, ...prev]);

    if (pushEnabled && pushPermission === 'granted') {
      sendBrowserNotification(
        analysis.isOverloaded
          ? '⚡ تنبيه نهاية اليوم: مهام الغد تتجاوز طاقتك'
          : '✅ فحص طاقة الغد: الجدول متوازن',
        reminder.title,
        manualId
      );
    }
    if (soundEnabled) {
      soundEngine.playChime(!analysis.isOverloaded);
    }
  };

  const handleReviewTomorrowSchedule = () => {
    setScheduleFocusDate(getTomorrowDateString());
    handleNavigateTab('schedule');
  };

  const handleRebalanceTomorrowWithTwin = (analysis: TomorrowEnergyAnalysis) => {
    openChatModal(
      `تحليل جدول الغد (${analysis.tomorrowIso}) يظهر ضغطاً زائداً بنسبة ${analysis.usagePercent}% (${analysis.totalHours} ساعة، ${analysis.totalItemsCount} مهام/مواعيد) مقارنة بمستوى طاقتي المخصص (${analysis.capacity.label} - بحد ${analysis.capacity.maxHours} ساعة). ساعدني في تخفيف الجدول وترحيل المهام غير العاجلة.`
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={handleNavigateTab}
        profile={profile}
        onOpenQuickAdd={openQuickAddModal}
        onOpenChat={() => openChatModal(undefined)}
        onOpenProfile={() => openProfileModal('profile')}
        onOpenBriefing={(type) => openBriefingModal(type)}
        syncScore={syncScore}
        reminders={smartReminders}
        pushPermission={pushPermission}
        pushEnabled={pushEnabled}
        soundEnabled={soundEnabled}
        onEnablePush={handleEnablePush}
        onTogglePushEnabled={() => {
          const next = !pushEnabled;
          setPushEnabled(next);
          void runCloudMutation((uid) => syncWorkspaceFields(uid, { pushEnabled: next }));
        }}
        onToggleSound={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          void runCloudMutation((uid) => syncWorkspaceFields(uid, { soundEnabled: next }));
        }}
        onTestAlert={handleTestAlert}
        onCompleteReminder={handleCompleteReminder}
        onSnoozeReminder={handleSnoozeReminder}
        onDismissReminder={handleDismissReminder}
        onStartFocus={(task) => openFocusModal(task)}
        isDndActive={isDndActive}
        autoDndEnabled={autoDndEnabled}
        manualDnd={manualDnd}
        onToggleAutoDnd={() => {
          const next = !autoDndEnabled;
          setAutoDndEnabled(next);
          void runCloudMutation((uid) => syncWorkspaceFields(uid, { autoDndEnabled: next }));
        }}
        onToggleManualDnd={() => setManualDnd((v) => !v)}
        authUser={authUser}
        authLoading={authLoading}
        cloudSyncStatus={cloudSyncStatus}
        onSignIn={() => handleSignIn(profile.name, undefined, false)}
        onOpenCloudSettings={() => openProfileModal('cloud')}
        onReviewTomorrowSchedule={handleReviewTomorrowSchedule}
        onRebalanceWithTwin={handleRebalanceTomorrowWithTwin}
        onCheckTomorrowEnergy={() => handleTriggerTomorrowEnergyCheck()}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            profile={profile}
            tasks={tasks}
            schedule={schedule}
            onToggleTask={handleToggleTask}
            onToggleScheduleBlock={handleToggleScheduleBlock}
            onStartFocus={(task) => openFocusModal(task)}
            onOpenTaskBreakdown={(task) => openBreakdownModal(task)}
            onOpenChat={(prompt) => openChatModal(prompt)}
            onOpenQuickAdd={openQuickAddModal}
            onOpenBriefing={(type) => openBriefingModal(type)}
            onNavigateTab={handleNavigateTab}
            goals={goals}
            onAddGoal={handleAddGoal}
            onUpdateGoal={handleUpdateGoal}
            onUpdateGoalProgress={handleUpdateGoalProgress}
            onDeleteGoal={handleDeleteGoal}
            onOpenContextualBriefing={(task) => openContextualBriefingModal(task)}
            onPostponeTask={handlePostponeTask}
            onPostponeAllSuggested={handlePostponeAllSuggested}
            quranRoutine={quranRoutine}
            onToggleQuranRoutine={handleToggleQuranRoutine}
            onAddQuranRoutine={handleAddQuranRoutine}
            onUpdateQuranRoutine={handleUpdateQuranRoutine}
            onDeleteQuranRoutine={handleDeleteQuranRoutine}
            onResetDailyQuranRoutine={handleResetDailyQuranRoutine}
            adhkarState={adhkarState}
            onToggleAdhkar={handleToggleAdhkar}
            quranNotificationsEnabled={quranNotificationsEnabled}
            onToggleQuranNotifications={() => {
              const next = !quranNotificationsEnabled;
              setQuranNotificationsEnabled(next);
              void runCloudMutation((uid) =>
                syncWorkspaceFields(uid, { quranNotificationsEnabled: next })
              );
            }}
            onOpenProfile={() => openProfileModal('profile')}
            dashboardLayout={dashboardLayout}
            customWidgets={customWidgets}
            onToggleWidgetVisibility={handleToggleWidgetVisibility}
            onMoveLayoutEntry={handleMoveLayoutEntry}
            onResetDashboardLayout={handleResetDashboardLayout}
            onAddCustomWidget={handleAddCustomWidget}
            onUpdateCustomWidget={handleUpdateCustomWidget}
            onDeleteCustomWidget={handleDeleteCustomWidget}
            phoneAppLists={phoneAppLists}
            onAddPhoneAppList={handleAddPhoneAppList}
            onUpdatePhoneAppList={handleUpdatePhoneAppList}
            onDeletePhoneAppList={handleDeletePhoneAppList}
            onAddPhoneAppToList={handleAddPhoneAppToList}
            onUpdatePhoneAppInList={handleUpdatePhoneAppInList}
            onDeletePhoneAppFromList={handleDeletePhoneAppFromList}
            onAddExtracted={handleAddExtracted}
          />
        )}

        {currentTab === 'tasks' && (
          <TasksHubView
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onToggleSubtask={handleToggleSubtask}
            onOpenTaskBreakdown={(task) => openBreakdownModal(task)}
            onStartFocus={(task) => openFocusModal(task)}
            onOpenQuickAdd={openQuickAddModal}
            onOpenContextualBriefing={(task) => openContextualBriefingModal(task)}
            onPostponeTask={handlePostponeTask}
            onAutoClassifyTasks={handleAutoClassifyTasks}
          />
        )}

        {currentTab === 'schedule' && (
          <ScheduleView
            schedule={schedule}
            tasks={tasks}
            profile={profile}
            onToggleScheduleBlock={handleToggleScheduleBlock}
            onAddScheduleBlock={handleAddScheduleBlock}
            onUpdateScheduleBlock={handleUpdateScheduleBlock}
            onDeleteScheduleBlock={handleDeleteScheduleBlock}
            onOptimizeSchedule={handleOptimizeSchedule}
            onStartFocus={(task) => openFocusModal(task)}
            onPostponeTask={handlePostponeTask}
            onPostponeAllSuggested={handlePostponeAllSuggested}
            isOptimizing={isOptimizingSchedule}
            optimizationResult={optimizationResult}
            initialSelectedDate={scheduleFocusDate}
            onOpenProfileSettings={() => openProfileModal('profile')}
          />
        )}

        {currentTab === 'focus' && (
          <div className="py-10 text-center space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => openFocusModal(tasks.find((t) => t.status !== 'completed'))}
                className="px-8 py-4 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-lg shadow-xl shadow-amber-500/20 hover:scale-105 transition-transform cursor-pointer"
              >
                🔥 دخول غرفة التركيز العميق الآن
              </button>
              <button
                type="button"
                onClick={() => {
                  closeAllModals();
                  setCurrentTab('dashboard');
                }}
                className="px-6 py-4 rounded-3xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                الرجوع للواجهة الأساسية
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Focus Mode Overlay */}
      <FocusModeModal
        isOpen={isFocusOpen || currentTab === 'focus'}
        onClose={() => {
          setIsFocusOpen(false);
          if (currentTab === 'focus') setCurrentTab('dashboard');
        }}
        onReturnToDashboard={() => {
          closeAllModals();
          setCurrentTab('dashboard');
        }}
        initialTask={focusTask}
        tasks={tasks}
        profile={profile}
        onToggleSubtask={handleToggleSubtask}
        onCompleteTask={(taskId) => {
          handleToggleTask(taskId);
        }}
        autoDndEnabled={autoDndEnabled}
        onToggleAutoDnd={() => setAutoDndEnabled((v) => !v)}
        isDndActive={isDndActive}
        onFocusRunningChange={setIsFocusSessionRunning}
      />

      {/* Twin Chat Drawer */}
      <TwinChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        profile={profile}
        tasks={tasks}
        schedule={schedule}
        goals={goals}
        quranRoutine={quranRoutine}
        adhkarState={adhkarState}
        initialPrompt={chatInitialPrompt}
        onStartFocus={(task) => openFocusModal(task)}
        onNavigateTab={handleNavigateTab}
        onAddExtractedTasks={handleAddExtracted}
        onAddGoal={handleAddGoal}
        onOptimizeSchedule={handleOptimizeSchedule}
      />

      {/* Smart Quick Add Modal */}
      <SmartQuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAddExtracted={handleAddExtracted}
      />

      {/* Task Decomposition / Breakdown Modal */}
      <TaskBreakdownModal
        isOpen={isBreakdownOpen}
        onClose={() => {
          setIsBreakdownOpen(false);
          setBreakdownTask(undefined);
        }}
        task={breakdownTask}
        profile={profile}
        onApplySubtasks={handleApplySubtasks}
      />

      {/* Twin Persona / App Settings & Custom Widgets Modal */}
      <TwinProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onSaveProfile={(newProf) => {
          setProfile(newProf);
          void runCloudMutation((uid) => syncWorkspaceFields(uid, { profile: newProf }));
        }}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onResetData={handleResetData}
        customWidgets={customWidgets}
        dashboardLayout={dashboardLayout}
        onAddCustomWidget={handleAddCustomWidget}
        onUpdateCustomWidget={handleUpdateCustomWidget}
        onDeleteCustomWidget={handleDeleteCustomWidget}
        onToggleWidgetVisibility={handleToggleWidgetVisibility}
        initialTab={profileInitialTab}
        authUser={authUser}
        authLoading={authLoading}
        cloudSyncStatus={cloudSyncStatus}
        lastSyncedAt={lastSyncedAt}
        authError={authError}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onPushLocalToCloud={handlePushLocalToCloud}
        tasks={tasks}
        schedule={schedule}
        onTriggerTomorrowEnergyCheck={handleTriggerTomorrowEnergyCheck}
      />

      {/* Morning Kickoff & Evening Debrief Modal */}
      <DailyBriefingModal
        isOpen={isBriefingOpen}
        onClose={() => setIsBriefingOpen(false)}
        type={briefingType}
        profile={profile}
        tasks={tasks}
        schedule={schedule}
      />

      {/* Contextual Pre-Task Briefing Modal */}
      <ContextualBriefingModal
        isOpen={isContextualBriefingOpen}
        onClose={() => {
          setIsContextualBriefingOpen(false);
          setContextualBriefingTask(undefined);
        }}
        task={contextualBriefingTask}
        profile={profile}
        schedule={schedule}
        goals={goals}
        cachedBriefing={
          contextualBriefingTask ? contextualBriefingsCache[contextualBriefingTask.id] : undefined
        }
        onSaveBriefing={(briefing) =>
          setContextualBriefingsCache((prev) => ({ ...prev, [briefing.taskId]: briefing }))
        }
        onStartFocus={(task) => openFocusModal(task)}
        onOpenBreakdown={(task) => openBreakdownModal(task)}
      />

      {/* Smart Floating Reminder Toasts */}
      <SmartReminderToasts
        toasts={visibleToasts}
        onDismissToast={handleDismissToast}
        onSnooze={handleSnoozeReminder}
        onComplete={handleCompleteReminder}
        onStartFocus={(task) => openFocusModal(task)}
        onReviewTomorrowSchedule={handleReviewTomorrowSchedule}
        onRebalanceWithTwin={handleRebalanceTomorrowWithTwin}
      />

      {/* Floating Digital AI Assistant Button */}
      {!isChatOpen && !isFocusOpen && currentTab !== 'focus' && (
        <button
          type="button"
          id="fab-ai-assistant"
          onClick={() => openChatModal(undefined)}
          className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-30 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-emerald-600 hover:from-cyan-500 hover:via-indigo-500 hover:to-emerald-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/25 border border-cyan-300/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="التحدث مع المساعد الرقمي AI"
        >
          <span className="relative flex items-center justify-center">
            <Bot className="w-5 h-5" />
            <Sparkles className="w-3 h-3 text-amber-300 absolute -top-1.5 -right-1.5" />
          </span>
          <span>المساعد AI</span>
        </button>
      )}

      {/* Offline Status Indicator */}
      <OfflineIndicator />

    </div>
  );
}
