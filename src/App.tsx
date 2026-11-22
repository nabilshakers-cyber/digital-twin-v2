import React, { useState, useEffect } from 'react';
import { BellOff, Bot, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
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
  PhoneAppShortcut,
  SavedLocation,
  TaskTag,
  TaskTagColor
} from './types';
import { DEFAULT_TASK_TAGS, normalizeTagName } from './utils/taskTags';
import { DEFAULT_DASHBOARD_LAYOUT, INITIAL_PHONE_APP_LISTS } from './data/dashboardDefaults';
import { normalizeLegacyPhoneAppIcon } from './components/PhoneAppIcon';
import { Navbar, type AppNavTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { TasksHubView } from './components/TasksHubView';
import { ScheduleView } from './components/ScheduleView';
import { NotificationsView } from './components/NotificationsView';
import { FocusModeModal } from './components/FocusModeModal';
import { TwinChatDrawer } from './components/TwinChatDrawer';
import { SmartQuickAddModal } from './components/SmartQuickAddModal';
import { TaskBreakdownModal } from './components/TaskBreakdownModal';
import { TwinProfileModal } from './components/TwinProfileModal';
import { DailyBriefingModal } from './components/DailyBriefingModal';
import { ContextualBriefingModal } from './components/ContextualBriefingModal';
import { SmartReminderToasts } from './components/SmartReminderToasts';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  classifyTasksWithAI,
  FRIENDLY_AI_CONNECTION_ERROR,
  optimizeScheduleWithAI,
} from './utils/api';
import { soundEngine } from './utils/audioSynth';
import { playToneForReminder } from './utils/notificationTones';
import { broadcastCloseAllModals, useModalCloseListener } from './utils/modalCoordinator';
import {
  cancelReminder,
  initializeLocalNotifications,
  NOTIFICATION_DENIED_ALERT_MESSAGE,
  NOTIFICATION_DENIED_EVENT,
  requestLocalNotificationPermissions,
  sendLocationArrivalNotification,
} from './utils/localNotifications';
import {
  buildSimulatedLocationMatches,
  evaluateGeofenceArrivals,
  formatGeolocationErrorArabic,
  GeoCoordinates,
  isGeolocationSupported,
  requestCurrentCoordinates,
} from './utils/geofencing';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import {
  buildPersonalizedWorkspaceFromOnboarding,
  hasUserCompletedOnboarding,
  markOnboardingCompleted,
  type OnboardingChoices,
} from './utils/onboardingPersonalization';
import {
  auth,
  clearLocalAuthUser,
  signInWithGoogle,
  signOutUser,
  toAppAuthUser,
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
  buildLocationArrivalReminders,
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
  SAVED_LOCATIONS: 'digital_twin_saved_locations_v1',
  LOCATION_TRACKING: 'digital_twin_location_tracking_v1',
  CUSTOM_TAGS: 'digital_twin_custom_tags_v1',
  TWIN_TOP_MIGRATED: 'digital_twin_twin_top_migrated_v1',
  TWIN_TOP_CLOUD_MIGRATED: 'digital_twin_twin_top_cloud_migrated_v1',
};

const SWIPEABLE_TABS: ReadonlyArray<{
  id: AppNavTab;
  label: string;
}> = [
  { id: 'dashboard', label: 'الرئيسية' },
  { id: 'tasks', label: 'المهام' },
  { id: 'schedule', label: 'الجدول' },
  { id: 'focus', label: 'التركيز' },
  { id: 'notifications', label: 'الإشعارات' },
  { id: 'settings', label: 'الإعدادات' },
];

function shouldIgnoreSwipeTarget(
  target: EventTarget | null,
  container: HTMLElement | null
): boolean {
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) {
    return false;
  }
  if (
    target.closest(
      'input, textarea, select, option, button, [role="dialog"], .recharts-wrapper, .recharts-surface, [data-no-swipe="true"]'
    )
  ) {
    return true;
  }
  let current: HTMLElement | null =
    target instanceof HTMLElement ? target : target.parentElement;
  while (current && current !== container) {
    const style = window.getComputedStyle(current);
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      current.scrollWidth > current.clientWidth + 4
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function mergeAndPromoteTwinLayout(
  layout: DashboardLayoutEntry[],
  migrationKey: string
): { merged: DashboardLayoutEntry[]; didPromote: boolean } {
  const existingIds = new Set(layout.map((item) => item.id));
  const missingBuiltins = DEFAULT_DASHBOARD_LAYOUT.filter((b) => !existingIds.has(b.id));
  const combined = [...layout, ...missingBuiltins];

  let alreadyMigrated = false;
  try {
    alreadyMigrated = localStorage.getItem(migrationKey) === '1';
  } catch {
    alreadyMigrated = false;
  }

  if (alreadyMigrated) {
    return { merged: combined, didPromote: false };
  }

  try {
    localStorage.setItem(migrationKey, '1');
  } catch {
    // ignore storage quota errors
  }

  const twinEntry = combined.find((item) => item.id === 'twin_avatar');
  const promotedTwin: DashboardLayoutEntry = twinEntry
    ? { ...twinEntry, visible: true }
    : { id: 'twin_avatar', isCustom: false, visible: true };
  const withoutTwin = combined.filter((item) => item.id !== 'twin_avatar');

  return {
    merged: [promotedTwin, ...withoutTwin],
    didPromote: true,
  };
}

function normalizePhoneAppLists(lists: PhoneAppList[]): PhoneAppList[] {
  return lists.map((list) => ({
    ...list,
    apps: (list.apps || []).map((app) => ({
      ...app,
      icon: normalizeLegacyPhoneAppIcon(app),
    })),
  }));
}

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
      if (!saved) {
        try {
          localStorage.setItem(STORAGE_KEYS.TWIN_TOP_MIGRATED, '1');
        } catch {
          // ignore
        }
        return DEFAULT_DASHBOARD_LAYOUT;
      }
      const parsed: DashboardLayoutEntry[] = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_DASHBOARD_LAYOUT;
      return mergeAndPromoteTwinLayout(parsed, STORAGE_KEYS.TWIN_TOP_MIGRATED).merged;
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
  });

  const [phoneAppLists, setPhoneAppLists] = useState<PhoneAppList[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PHONE_APP_LISTS);
      return normalizePhoneAppLists(saved ? JSON.parse(saved) : INITIAL_PHONE_APP_LISTS);
    } catch {
      return INITIAL_PHONE_APP_LISTS;
    }
  });

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SAVED_LOCATIONS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Explicit, revocable opt-in consent for location monitoring (default: false)
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOCATION_TRACKING);
      return saved !== null ? JSON.parse(saved) === true : false;
    } catch {
      return false;
    }
  });

  const [customTags, setCustomTags] = useState<TaskTag[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_TAGS);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : DEFAULT_TASK_TAGS;
    } catch {
      return DEFAULT_TASK_TAGS;
    }
  });

  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  // 2. Navigation Tab state (synced with URL hash routes e.g. #/notifications)
  const parseTabFromHash = (): AppNavTab => {
    if (typeof window === 'undefined') return 'dashboard';
    const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
    if (
      raw === 'tasks' ||
      raw === 'schedule' ||
      raw === 'focus' ||
      raw === 'notifications' ||
      raw === 'settings' ||
      raw === 'dashboard'
    ) {
      return raw;
    }
    return 'dashboard';
  };

  const [currentTab, setCurrentTab] = useState<AppNavTab>(() => parseTabFromHash());
  const [scheduleFocusDate, setScheduleFocusDate] = useState<string | undefined>();

  // 3. Modals & Overlays
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<'profile' | 'widgets' | 'cloud' | 'android'>('profile');
  const [isFocusOpen, setIsFocusOpen] = useState(false);

  // 3.5 Firebase Auth, First-Run Onboarding & Cloud Sync State
  const [authUser, setAuthUser] = useState<AppAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() =>
    hasUserCompletedOnboarding()
  );
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
  const [optimizeScheduleError, setOptimizeScheduleError] = useState<string | null>(null);
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
  const [showNotificationDeniedBanner, setShowNotificationDeniedBanner] = useState<boolean>(
    () => getPushPermission() === 'denied'
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

  // 5.5 Location-Based Geofencing Reminders State
  const [locationReminders, setLocationReminders] = useState<SmartReminder[]>([]);
  const [currentGeoCoords, setCurrentGeoCoords] = useState<GeoCoordinates | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoChecking, setGeoChecking] = useState(false);
  const [geoDistances, setGeoDistances] = useState<Record<string, number>>({});
  const insideLocationIdsRef = React.useRef<Set<string>>(new Set());
  const locationCooldownRef = React.useRef<Record<string, number>>({});
  const tasksRef = React.useRef(tasks);
  tasksRef.current = tasks;
  const savedLocationsRef = React.useRef(savedLocations);
  savedLocationsRef.current = savedLocations;
  const isDndActiveRef = React.useRef(isDndActive);
  isDndActiveRef.current = isDndActive;
  const pushEnabledRef = React.useRef(pushEnabled);
  pushEnabledRef.current = pushEnabled;
  const soundEnabledRef = React.useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to save profile to localStorage', e);
    }
  }, [profile]);

  // Apply Comfortable Night Reading Mode class on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle(
      'comfort-reading-mode',
      Boolean(profile.comfortReadingMode)
    );
  }, [profile.comfortReadingMode]);

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_LOCATIONS, JSON.stringify(savedLocations));
    } catch {
      // ignore
    }
  }, [savedLocations]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.LOCATION_TRACKING,
        JSON.stringify(locationTrackingEnabled)
      );
    } catch {
      // ignore
    }
  }, [locationTrackingEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_TAGS, JSON.stringify(customTags));
    } catch {
      // ignore
    }
  }, [customTags]);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

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
    savedLocations,
    locationTrackingEnabled,
    customTags,
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
    savedLocations,
    locationTrackingEnabled,
    customTags,
    quranNotificationsEnabled,
    pushEnabled,
    soundEnabled,
    autoDndEnabled,
  };

  // Firebase Auth listener (enforces strict Firebase session before accessing the app)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        clearLocalAuthUser();
        setAuthUser(toAppAuthUser(fbUser));
      } else {
        setAuthUser(null);
        setCloudSyncStatus('local');
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore real-time synchronization (active when signed in & verified with Firebase Auth)
  useEffect(() => {
    if (
      !authReady ||
      !authUser ||
      !authUser.emailVerified ||
      !auth.currentUser
    ) {
      return;
    }

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
              const { merged, didPromote } = mergeAndPromoteTwinLayout(
                ws.dashboardLayout,
                STORAGE_KEYS.TWIN_TOP_CLOUD_MIGRATED
              );
              setDashboardLayout(merged);
              if (didPromote) {
                void syncWorkspaceFields(authUser.uid, { dashboardLayout: merged });
              }
            }
            if (ws.adhkarState) setAdhkarState(ws.adhkarState);
            if (Array.isArray(ws.savedLocations)) setSavedLocations(ws.savedLocations);
            if (typeof ws.locationTrackingEnabled === 'boolean') {
              setLocationTrackingEnabled(ws.locationTrackingEnabled);
            }
            if (Array.isArray(ws.customTags)) {
              setCustomTags(ws.customTags);
            }
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
          onPhoneAppLists: (cloudLists) => setPhoneAppLists(normalizePhoneAppLists(cloudLists)),
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
    if (!authUser || !authUser.emailVerified || !auth.currentUser) return;
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
  const closeAllModals = (broadcast = true) => {
    setIsChatOpen(false);
    setIsQuickAddOpen(false);
    setIsFocusOpen(false);
    setIsBreakdownOpen(false);
    setIsBriefingOpen(false);
    setIsContextualBriefingOpen(false);
    if (broadcast) {
      broadcastCloseAllModals('app');
    }
  };

  useModalCloseListener('app', () => {
    closeAllModals(false);
  });

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
    setCurrentTab('settings');
    if (typeof window !== 'undefined') {
      const targetHash = '#/settings';
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
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

  const handleNavigateTab = (tab: AppNavTab) => {
    closeAllModals();
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      const targetHash = `#/${tab}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const tabFromHash = parseTabFromHash();
      closeAllModals();
      setCurrentTab(tabFromHash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      setAuthUser(user);
      setCloudSyncStatus('syncing');
    } catch (err: any) {
      console.error('Sign-In failed:', err);
      setAuthError(err?.message || 'تعذر تسجيل الدخول.');
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
      setLastSyncedAt(null);
      setAuthError(null);
      closeAllModals();
      setCurrentTab('dashboard');

      // Reset user-scoped local caches (preserve hasCompletedOnboarding so onboarding shows only once)
      try {
        localStorage.removeItem(STORAGE_KEYS.PROFILE);
        localStorage.removeItem(STORAGE_KEYS.TASKS);
        localStorage.removeItem(STORAGE_KEYS.SCHEDULE);
        localStorage.removeItem(STORAGE_KEYS.GOALS);
        localStorage.removeItem(STORAGE_KEYS.QURAN_ROUTINE);
        localStorage.removeItem(STORAGE_KEYS.CUSTOM_WIDGETS);
        localStorage.removeItem(STORAGE_KEYS.DASHBOARD_LAYOUT);
        localStorage.removeItem(STORAGE_KEYS.PHONE_APP_LISTS);
        localStorage.removeItem(STORAGE_KEYS.SAVED_LOCATIONS);
        localStorage.removeItem(STORAGE_KEYS.LOCATION_TRACKING);
        localStorage.removeItem(STORAGE_KEYS.CUSTOM_TAGS);
        localStorage.removeItem(ADHKAR_STORAGE_KEY);
      } catch {
        // ignore storage cleanup errors
      }
      setProfile(defaultProfile);
      setTasks(defaultTasks);
      setSchedule(defaultSchedule);
      setGoals(initialGoals);
      setQuranRoutine(initialQuranRoutine);
      setCustomWidgets([]);
      setDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
      setPhoneAppLists(INITIAL_PHONE_APP_LISTS);
      setSavedLocations([]);
      setLocationTrackingEnabled(false);
      setCustomTags(DEFAULT_TASK_TAGS);
      setLocationReminders([]);
      setCurrentGeoCoords(null);
      setGeoError(null);
      setGeoDistances({});
      insideLocationIdsRef.current = new Set();
      locationCooldownRef.current = {};
      setAdhkarState(loadInitialAdhkarState());
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCompleteOnboarding = (choices: OnboardingChoices) => {
    const {
      profile: nextProfile,
      dashboardLayout: nextLayout,
      quranNotificationsEnabled: nextQuranNotif,
    } = buildPersonalizedWorkspaceFromOnboarding(choices, profile, dashboardLayout);

    setProfile(nextProfile);
    setDashboardLayout(nextLayout);
    setQuranNotificationsEnabled(nextQuranNotif);
    markOnboardingCompleted();
    setHasCompletedOnboarding(true);

    void runCloudMutation(async (uid) => {
      await ensureUserWorkspace(uid, {
        ...latestSnapshotRef.current,
        profile: nextProfile,
        dashboardLayout: nextLayout,
        quranNotificationsEnabled: nextQuranNotif,
      });
      await syncWorkspaceFields(uid, {
        profile: nextProfile,
        dashboardLayout: nextLayout,
        quranNotificationsEnabled: nextQuranNotif,
      });
    });
  };

  const handlePushLocalToCloud = async () => {
    if (!authUser || !authUser.emailVerified || !auth.currentUser) return;
    await runCloudMutation((uid) => pushLocalSnapshotToCloud(uid, latestSnapshotRef.current));
  };

  // Request Capacitor LocalNotifications permissions on startup and restore reminder timers
  useEffect(() => {
    let active = true;
    void initializeLocalNotifications().then((status) => {
      if (!active) return;
      if (status === 'denied') {
        setPushPermission('denied');
        setShowNotificationDeniedBanner(true);
      } else if (status === 'granted') {
        setPushPermission('granted');
        setShowNotificationDeniedBanner(false);
      }
    });

    const handleDeniedEvent = () => {
      setPushPermission('denied');
      setShowNotificationDeniedBanner(true);
    };
    window.addEventListener(NOTIFICATION_DENIED_EVENT, handleDeniedEvent);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATION_DENIED_EVENT, handleDeniedEvent);
    };
  }, []);

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

  const activeLocationReminders = React.useMemo(() => {
    const nowMs = Date.now();
    const incompleteTaskIds = new Set(
      tasks.filter((t) => t.status !== 'completed').map((t) => t.id)
    );
    return locationReminders.filter((rem) => {
      if (dismissedIds.has(rem.id)) return false;
      const snoozeUntil = snoozedMap[rem.id];
      if (snoozeUntil && snoozeUntil > nowMs) return false;
      if (rem.task && !incompleteTaskIds.has(rem.task.id)) return false;
      return true;
    });
  }, [locationReminders, tasks, dismissedIds, snoozedMap]);

  const allReminders = React.useMemo(
    () =>
      [...activeLocationReminders, ...smartReminders].sort(
        (a, b) => b.priorityScore - a.priorityScore
      ),
    [activeLocationReminders, smartReminders]
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
        playToneForReminder(primary);
      }
    }
  }, [smartReminders, pushEnabled, pushPermission, soundEnabled, isDndActive]);

  const visibleToasts = React.useMemo(() => {
    if (isDndActive) return [];
    const activeAutoToasts = allReminders.filter((r) => !dismissedToastIds.has(r.id));
    return [...testToasts, ...activeAutoToasts];
  }, [allReminders, dismissedToastIds, testToasts, isDndActive]);

  // Evaluate GPS coordinates against geofenced saved locations & incomplete tasks
  const processGeoCoords = React.useCallback((coords: GeoCoordinates) => {
    const {
      newMatches,
      nextInsideLocationIds,
      nextCooldownMap,
      locationDistances,
    } = evaluateGeofenceArrivals({
      coords,
      tasks: tasksRef.current,
      savedLocations: savedLocationsRef.current,
      insideLocationIds: insideLocationIdsRef.current,
      cooldownMap: locationCooldownRef.current,
    });

    insideLocationIdsRef.current = nextInsideLocationIds;
    locationCooldownRef.current = nextCooldownMap;
    setCurrentGeoCoords(coords);
    setGeoDistances(locationDistances);
    setGeoError(null);

    if (newMatches.length > 0) {
      const generated = buildLocationArrivalReminders(newMatches);
      setLocationReminders((prev) => {
        const map = new Map<string, SmartReminder>();
        for (const item of generated) map.set(item.id, item);
        for (const existing of prev) {
          if (!map.has(existing.id)) map.set(existing.id, existing);
        }
        return Array.from(map.values());
      });
      setDismissedToastIds((prev) => {
        const next = new Set(prev);
        for (const g of generated) next.delete(g.id);
        return next;
      });

      if (!isDndActiveRef.current) {
        const primary = generated[0];
        if (soundEnabledRef.current) {
          playToneForReminder(primary);
        }
        if (pushEnabledRef.current) {
          void sendLocationArrivalNotification(
            `📍 تذكير موقع: ${primary.locationName || 'وصلت إلى الموقع'}`,
            `${primary.title} — ${primary.timeLabel}`,
            primary.id
          );
        }
      }
    }
  }, []);

  // Recompute distances when savedLocations changes if coords are known
  useEffect(() => {
    if (!currentGeoCoords || !locationTrackingEnabled) return;
    processGeoCoords(currentGeoCoords);
  }, [savedLocations, currentGeoCoords, locationTrackingEnabled, processGeoCoords]);

  // Opt-in real-time geolocation watcher (only runs when user explicitly enables locationTrackingEnabled)
  useEffect(() => {
    if (
      !authReady ||
      !authUser?.emailVerified ||
      !hasCompletedOnboarding ||
      !locationTrackingEnabled
    ) {
      setGeoError(null);
      return;
    }

    if (!isGeolocationSupported()) {
      setGeoError('المتصفح أو الجهاز لا يدعم خدمة تحديد الموقع الجغرافي.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        processGeoCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        setGeoError(formatGeolocationErrorArabic(err));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 20000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [
    authReady,
    authUser,
    hasCompletedOnboarding,
    locationTrackingEnabled,
    processGeoCoords,
  ]);

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
      ...(Array.isArray(newTask.tags) && newTask.tags.length > 0 ? { tags: newTask.tags } : {}),
      ...(newTask.locationReminder ? { locationReminder: newTask.locationReminder } : {}),
    };
    setTasks((prev) => [task, ...prev]);
    soundEngine.playChime(true);
    void runCloudMutation((uid) => upsertTaskDoc(uid, task, true));
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    void runCloudMutation((uid) => upsertTaskDoc(uid, updatedTask, false));
  };

  const handleCreateCustomTag = (
    rawName: string,
    color: TaskTagColor = 'cyan'
  ): TaskTag | null => {
    const clean = normalizeTagName(rawName);
    if (!clean) return null;
    const key = clean.toLowerCase();
    const existing = customTags.find(
      (t) => normalizeTagName(t.name).toLowerCase() === key
    );
    if (existing) return existing;

    const created: TaskTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: clean,
      color,
    };
    const nextTags = [...customTags, created].slice(0, 30);
    setCustomTags(nextTags);
    soundEngine.playChime(true);
    void runCloudMutation((uid) => syncWorkspaceFields(uid, { customTags: nextTags }));
    return created;
  };

  const handleDeleteCustomTag = (tagId: string) => {
    const target = customTags.find((t) => t.id === tagId);
    if (!target) return;

    const nextTags = customTags.filter((t) => t.id !== tagId);
    setCustomTags(nextTags);

    const targetKey = normalizeTagName(target.name).toLowerCase();
    const updatedTasks: Task[] = [];
    setTasks((prev) =>
      prev.map((task) => {
        if (
          !task.tags ||
          !task.tags.some((tg) => normalizeTagName(tg).toLowerCase() === targetKey)
        ) {
          return task;
        }
        const filteredTags = task.tags.filter(
          (tg) => normalizeTagName(tg).toLowerCase() !== targetKey
        );
        const updated: Task = { ...task, tags: filteredTags };
        updatedTasks.push(updated);
        return updated;
      })
    );

    void runCloudMutation(async (uid) => {
      await syncWorkspaceFields(uid, { customTags: nextTags });
      for (const ut of updatedTasks) {
        await upsertTaskDoc(uid, ut, false);
      }
    });
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
    void cancelReminder(`task:${taskId}`);
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

  const handleApplyGoogleCalendarSync = ({
    importedBlocks,
    updatedLocalBlocks,
    linkedResults = [],
  }: {
    importedBlocks: TimeBlock[];
    updatedLocalBlocks: TimeBlock[];
    linkedResults?: { blockId: string; googleEventId: string; updated?: string }[];
  }) => {
    const updatedMap = new Map(updatedLocalBlocks.map((b) => [b.id, b]));
    const linkMap = new Map(linkedResults.map((l) => [l.blockId, l]));

    setSchedule((prev) => {
      const next = prev.map((b) => {
        const updated = updatedMap.get(b.id);
        const link = linkMap.get(b.id);
        const merged = updated ? { ...updated } : { ...b };
        if (link) {
          merged.googleEventId = link.googleEventId;
          if (link.updated) merged.googleCalendarUpdated = link.updated;
        }
        return merged;
      });
      return [...next, ...importedBlocks];
    });

    if (importedBlocks.length > 0 || updatedLocalBlocks.length > 0) {
      soundEngine.playChime(true);
      void runCloudMutation(async (uid) => {
        for (const b of importedBlocks) {
          await upsertScheduleBlockDoc(uid, b, true);
        }
        for (const b of updatedLocalBlocks) {
          await upsertScheduleBlockDoc(uid, b, false);
        }
      });
    }
  };

  // AI Auto-Schedule Optimizer
  const handleOptimizeSchedule = async () => {
    setIsOptimizingSchedule(true);
    setOptimizeScheduleError(null);
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
      setOptimizeScheduleError(FRIENDLY_AI_CONNECTION_ERROR);
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
        ...(Array.isArray(et.tags) && et.tags.length > 0 ? { tags: et.tags } : {}),
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
    void cancelReminder(`quran:${id}`);
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
      icon: normalizeLegacyPhoneAppIcon({ ...newApp }),
    };
    const existingList = phoneAppLists.find((l) => l.id === listId);
    const updatedList = existingList
      ? { ...existingList, apps: [...existingList.apps, app] }
      : null;
    setPhoneAppLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, apps: [...l.apps, app] } : l))
    );
    soundEngine.playChime(true);
    if (updatedList) {
      void runCloudMutation((uid) => upsertPhoneAppListDoc(uid, updatedList, false));
    }
  };

  const handleUpdatePhoneAppInList = (listId: string, updatedApp: PhoneAppShortcut) => {
    const normalizedApp: PhoneAppShortcut = {
      ...updatedApp,
      icon: normalizeLegacyPhoneAppIcon(updatedApp),
    };
    const existingList = phoneAppLists.find((l) => l.id === listId);
    const updatedList = existingList
      ? {
          ...existingList,
          apps: existingList.apps.map((a) => (a.id === normalizedApp.id ? normalizedApp : a)),
        }
      : null;
    setPhoneAppLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, apps: l.apps.map((a) => (a.id === normalizedApp.id ? normalizedApp : a)) }
          : l
      )
    );
    soundEngine.playChime(true);
    if (updatedList) {
      void runCloudMutation((uid) => upsertPhoneAppListDoc(uid, updatedList, false));
    }
  };

  const handleDeletePhoneAppFromList = (listId: string, appId: string) => {
    const existingList = phoneAppLists.find((l) => l.id === listId);
    const updatedList = existingList
      ? { ...existingList, apps: existingList.apps.filter((a) => a.id !== appId) }
      : null;
    setPhoneAppLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, apps: l.apps.filter((a) => a.id !== appId) } : l
      )
    );
    if (updatedList) {
      void runCloudMutation((uid) => upsertPhoneAppListDoc(uid, updatedList, false));
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
      savedLocations,
      locationTrackingEnabled,
      customTags,
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
          ...(Array.isArray(parsed.savedLocations)
            ? { savedLocations: parsed.savedLocations }
            : {}),
          ...(typeof parsed.locationTrackingEnabled === 'boolean'
            ? { locationTrackingEnabled: parsed.locationTrackingEnabled }
            : {}),
          ...(Array.isArray(parsed.customTags)
            ? { customTags: parsed.customTags }
            : {}),
        };
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.schedule) setSchedule(parsed.schedule);
        if (parsed.goals) setGoals(parsed.goals);
        if (parsed.quranRoutine) setQuranRoutine(parsed.quranRoutine);
        if (parsed.customWidgets) setCustomWidgets(parsed.customWidgets);
        if (parsed.dashboardLayout) setDashboardLayout(parsed.dashboardLayout);
        if (parsed.phoneAppLists) setPhoneAppLists(parsed.phoneAppLists);
        if (Array.isArray(parsed.savedLocations)) setSavedLocations(parsed.savedLocations);
        if (typeof parsed.locationTrackingEnabled === 'boolean') {
          setLocationTrackingEnabled(parsed.locationTrackingEnabled);
        }
        if (Array.isArray(parsed.customTags)) {
          setCustomTags(parsed.customTags);
        }
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
        savedLocations: [],
        locationTrackingEnabled: false,
        customTags: DEFAULT_TASK_TAGS,
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
      setSavedLocations([]);
      setLocationTrackingEnabled(false);
      setCustomTags(DEFAULT_TASK_TAGS);
      setLocationReminders([]);
      setCurrentGeoCoords(null);
      setGeoDistances({});
      setGeoError(null);
      localStorage.clear();
      void runCloudMutation((uid) => pushLocalSnapshotToCloud(uid, resetSnapshot));
    }
  };

  // Reminder Actions
  const handleEnablePush = async () => {
    const localPerm = await requestLocalNotificationPermissions();
    const perm = await requestPushPermission();
    const effectivePerm: NotificationPermission | 'unsupported' =
      perm === 'denied' || localPerm === 'denied'
        ? 'denied'
        : perm === 'granted' || localPerm === 'granted'
          ? 'granted'
          : perm;
    setPushPermission(effectivePerm);
    if (effectivePerm === 'granted') {
      setPushEnabled(true);
      setShowNotificationDeniedBanner(false);
      sendBrowserNotification(
        'تم تفعيل تنبيهات التوأم الرقمي',
        'ستصلك إشعارات فورية للمهام القريبة أو المتأخرة.'
      );
    } else if (effectivePerm === 'denied') {
      setShowNotificationDeniedBanner(true);
    }
  };

  // Location & Geofencing Handlers
  const handleSaveLocation = (loc: SavedLocation) => {
    const nextLocations = savedLocations.some((l) => l.id === loc.id)
      ? savedLocations.map((l) => (l.id === loc.id ? loc : l))
      : [loc, ...savedLocations];

    setSavedLocations(nextLocations);

    const updatedLinkedTasks: Task[] = [];
    setTasks((prev) =>
      prev.map((t) => {
        if (t.locationReminder?.locationId === loc.id) {
          const updated: Task = {
            ...t,
            locationReminder: {
              ...t.locationReminder,
              locationName: loc.name,
              lat: loc.lat,
              lng: loc.lng,
              radiusMeters: loc.radiusMeters,
            },
          };
          updatedLinkedTasks.push(updated);
          return updated;
        }
        return t;
      })
    );

    soundEngine.playChime(true);
    void runCloudMutation(async (uid) => {
      await syncWorkspaceFields(uid, { savedLocations: nextLocations });
      for (const ut of updatedLinkedTasks) {
        await upsertTaskDoc(uid, ut, false);
      }
    });
  };

  const handleDeleteLocation = (locationId: string) => {
    const nextLocations = savedLocations.filter((l) => l.id !== locationId);
    setSavedLocations(nextLocations);

    const clearedTasks: Task[] = [];
    setTasks((prev) =>
      prev.map((t) => {
        if (t.locationReminder?.locationId === locationId) {
          const { locationReminder: _removed, ...rest } = t;
          const updated: Task = rest;
          clearedTasks.push(updated);
          return updated;
        }
        return t;
      })
    );

    setLocationReminders((prev) =>
      prev.filter((rem) => !rem.id.startsWith(`loc:${locationId}:`))
    );

    void runCloudMutation(async (uid) => {
      await syncWorkspaceFields(uid, { savedLocations: nextLocations });
      for (const ct of clearedTasks) {
        await upsertTaskDoc(uid, ct, false);
      }
    });
  };

  const handleCheckLocationNow = async () => {
    setGeoChecking(true);
    setGeoError(null);
    try {
      const coords = await requestCurrentCoordinates();
      processGeoCoords(coords);
    } catch (err: any) {
      setGeoError(err?.message || 'تعذر قراءة موقعك الحالي.');
    } finally {
      setGeoChecking(false);
    }
  };

  const handleToggleLocationTracking = () => {
    const next = !locationTrackingEnabled;
    setLocationTrackingEnabled(next);
    setGeoError(null);
    if (next) {
      void handleCheckLocationNow();
    } else {
      insideLocationIdsRef.current = new Set();
      setGeoDistances({});
    }
    void runCloudMutation((uid) =>
      syncWorkspaceFields(uid, { locationTrackingEnabled: next })
    );
  };

  const handleSimulateArrival = (loc: SavedLocation) => {
    const matches = buildSimulatedLocationMatches(loc, tasks);
    const nowTag = Date.now();
    const generated: SmartReminder[] =
      matches.length > 0
        ? buildLocationArrivalReminders(matches).map((rem, idx) => ({
            ...rem,
            id: `test:loc-${nowTag}-${idx}`,
          }))
        : [
            {
              id: `test:loc-${loc.id}-${nowTag}`,
              sourceType: 'location',
              locationName: loc.name,
              distanceMeters: Math.min(25, Math.max(5, Math.round(loc.radiusMeters * 0.15))),
              title: `تم محاكاة وصولك إلى «${loc.name}» — اربط مهامك بهذا الموقع لتظهر تلقائياً هنا`,
              urgency: 'location_arrival',
              timeLabel: `محاكاة الوصول • النطاق ${loc.radiusMeters} م`,
              minutesDelta: 0,
              priorityScore: 950,
            },
          ];

    setTestToasts((prev) => [...generated, ...prev]);

    if (!isDndActive) {
      const primary = generated[0];
      if (soundEnabled) {
        playToneForReminder(primary);
      }
      if (pushEnabled) {
        void sendLocationArrivalNotification(
          `📍 محاكاة الوصول: ${loc.name}`,
          primary.title,
          primary.id
        );
      }
    }
  };

  const handleCompleteReminder = (reminder: SmartReminder) => {
    if (reminder.id.startsWith('test:')) {
      setTestToasts((prev) => prev.filter((t) => t.id !== reminder.id));
      if (reminder.sourceType === 'location' && reminder.task) {
        handleToggleTask(reminder.task.id);
      } else {
        soundEngine.playChime(true);
      }
      return;
    }
    if (reminder.sourceType === 'adhkar' && reminder.adhkarPeriod) {
      handleToggleAdhkar(reminder.adhkarPeriod);
      return;
    }
    if ((reminder.sourceType === 'task' || reminder.sourceType === 'location') && reminder.task) {
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
      playToneForReminder(testReminder);
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
      playToneForReminder(reminder);
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

  // Horizontal swipe gesture navigation between الرئيسية, المهام, and الجدول
  const swipeStartRef = React.useRef<{
    x: number;
    y: number;
    time: number;
    lockedAxis: 'horizontal' | 'vertical' | null;
  } | null>(null);
  const [swipePreview, setSwipePreview] = useState<{
    targetLabel: string;
    side: 'left' | 'right';
    ready: boolean;
  } | null>(null);

  const activeSwipeIndex = SWIPEABLE_TABS.findIndex((t) => t.id === currentTab);
  const isSwipeNavigationEnabled =
    activeSwipeIndex !== -1 &&
    !isChatOpen &&
    !isQuickAddOpen &&
    !isFocusOpen &&
    !isBreakdownOpen &&
    !isBriefingOpen &&
    !isContextualBriefingOpen;

  const resolveSwipeTarget = (dx: number) => {
    if (activeSwipeIndex === -1) return null;
    const isRtl =
      typeof document === 'undefined' || document.documentElement.dir !== 'ltr';
    const step = isRtl ? (dx > 0 ? 1 : -1) : dx < 0 ? 1 : -1;
    const nextIndex = activeSwipeIndex + step;
    if (nextIndex < 0 || nextIndex >= SWIPEABLE_TABS.length) return null;
    return SWIPEABLE_TABS[nextIndex];
  };

  const handleMainTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (!isSwipeNavigationEnabled || e.touches.length !== 1) return;
    if (shouldIgnoreSwipeTarget(e.target, e.currentTarget)) return;
    const touch = e.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      lockedAxis: null,
    };
  };

  const handleMainTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    if (!start || e.touches.length !== 1 || !isSwipeNavigationEnabled) return;

    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;

    if (!start.lockedAxis) {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
        start.lockedAxis = 'vertical';
        setSwipePreview(null);
        return;
      }
      if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        start.lockedAxis = 'horizontal';
      } else {
        return;
      }
    }

    if (start.lockedAxis !== 'horizontal') return;

    const target = resolveSwipeTarget(dx);
    if (!target) {
      setSwipePreview(null);
      return;
    }

    setSwipePreview({
      targetLabel: target.label,
      side: dx > 0 ? 'right' : 'left',
      ready: Math.abs(dx) >= 60,
    });
  };

  const handleMainTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    setSwipePreview(null);

    if (
      !start ||
      start.lockedAxis !== 'horizontal' ||
      !isSwipeNavigationEnabled
    ) {
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Date.now() - start.time;

    if (
      Math.abs(dx) >= 60 &&
      Math.abs(dx) > Math.abs(dy) * 1.2 &&
      (elapsed < 850 || Math.abs(dx) >= 95)
    ) {
      const target = resolveSwipeTarget(dx);
      if (target) {
        handleNavigateTab(target.id);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }
  };

  const handleMainTouchCancel = () => {
    swipeStartRef.current = null;
    setSwipePreview(null);
  };

  if (!authReady) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col items-center justify-center p-6 gap-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
          <Bot className="w-7 h-7 text-cyan-400 animate-pulse" />
        </div>
        <p className="text-sm font-bold text-slate-300">جاري التحقق من جلسة الحساب...</p>
      </div>
    );
  }

  if (!authUser || !auth.currentUser || !authUser.emailVerified) {
    return (
      <AuthScreen
        unverifiedUser={authUser && !authUser.emailVerified ? authUser : null}
        onAuthSuccess={(user) => {
          setAuthUser(user);
          setAuthError(null);
        }}
        onSignOut={handleSignOut}
      />
    );
  }

  if (!hasCompletedOnboarding) {
    return (
      <OnboardingScreen
        initialName={
          authUser.displayName || (profile.name !== defaultProfile.name ? profile.name : '')
        }
        onComplete={handleCompleteOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

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
        reminders={allReminders}
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
        onSignIn={handleSignIn}
        onOpenCloudSettings={() => openProfileModal('cloud')}
        onReviewTomorrowSchedule={handleReviewTomorrowSchedule}
        onRebalanceWithTwin={handleRebalanceTomorrowWithTwin}
        onCheckTomorrowEnergy={() => handleTriggerTomorrowEnergyCheck()}
      />

      {/* Main View Container (supports horizontal swipe across all main views) */}
      <main
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
        onTouchCancel={handleMainTouchCancel}
        className={`relative flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-8 touch-pan-y transition-transform duration-150 ${
          swipePreview
            ? swipePreview.side === 'right'
              ? 'translate-x-3'
              : '-translate-x-3'
            : ''
        }`}
      >
        {/* Floating Swipe Direction Preview Pill */}
        {swipePreview && (
          <div
            aria-live="polite"
            className={`fixed top-20 z-40 px-3.5 py-2 rounded-2xl border shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-1.5 transition-all pointer-events-none ${
              swipePreview.side === 'right' ? 'right-4' : 'left-4'
            } ${
              swipePreview.ready
                ? 'bg-emerald-600/95 border-emerald-300 text-white scale-105'
                : 'bg-slate-900/90 border-cyan-500/50 text-cyan-200'
            }`}
          >
            {swipePreview.side === 'right' ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronLeft className="w-4 h-4 shrink-0" />
            )}
            <span>الانتقال إلى: {swipePreview.targetLabel}</span>
          </div>
        )}

        {showNotificationDeniedBanner && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-950/50 px-4 py-3 text-xs text-amber-100 flex items-center justify-between gap-3 shadow-lg animate-fadeIn"
          >
            <div className="flex items-start gap-2.5">
              <BellOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">
                {NOTIFICATION_DENIED_ALERT_MESSAGE}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowNotificationDeniedBanner(false)}
              className="p-1.5 rounded-lg text-amber-300 hover:bg-amber-900/50 shrink-0 cursor-pointer"
              title="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
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
            customTags={customTags}
            onCreateCustomTag={handleCreateCustomTag}
            onDeleteCustomTag={handleDeleteCustomTag}
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
            savedLocations={savedLocations}
            locationTrackingEnabled={locationTrackingEnabled}
            onSaveLocation={handleSaveLocation}
            customTags={customTags}
            onCreateCustomTag={handleCreateCustomTag}
            onDeleteCustomTag={handleDeleteCustomTag}
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
            optimizeError={optimizeScheduleError}
            onClearOptimizeError={() => setOptimizeScheduleError(null)}
          />
        )}

        {currentTab === 'notifications' && (
          <NotificationsView
            reminders={allReminders}
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
            onReviewTomorrowSchedule={handleReviewTomorrowSchedule}
            onRebalanceWithTwin={handleRebalanceTomorrowWithTwin}
            onCheckTomorrowEnergy={() => handleTriggerTomorrowEnergyCheck()}
            onBackToDashboard={() => handleNavigateTab('dashboard')}
            savedLocations={savedLocations}
            tasks={tasks}
            locationTrackingEnabled={locationTrackingEnabled}
            onToggleLocationTracking={handleToggleLocationTracking}
            onSaveLocation={handleSaveLocation}
            onDeleteLocation={handleDeleteLocation}
            onCheckLocationNow={handleCheckLocationNow}
            onSimulateArrival={handleSimulateArrival}
            currentGeoCoords={currentGeoCoords}
            geoDistances={geoDistances}
            geoError={geoError}
            geoChecking={geoChecking}
          />
        )}

        {currentTab === 'focus' && (
          <FocusModeModal
            embedded
            isOpen
            onClose={() => handleNavigateTab('dashboard')}
            onReturnToDashboard={() => handleNavigateTab('dashboard')}
            initialTask={focusTask}
            tasks={tasks}
            profile={profile}
            onUpdateProfile={(newProf) => {
              setProfile(newProf);
              void runCloudMutation((uid) => syncWorkspaceFields(uid, { profile: newProf }));
            }}
            onToggleSubtask={handleToggleSubtask}
            onCompleteTask={(taskId) => {
              handleToggleTask(taskId);
            }}
            autoDndEnabled={autoDndEnabled}
            onToggleAutoDnd={() => setAutoDndEnabled((v) => !v)}
            isDndActive={isDndActive}
            onFocusRunningChange={setIsFocusSessionRunning}
          />
        )}

        {currentTab === 'settings' && (
          <TwinProfileModal
            embedded
            isOpen
            onClose={() => handleNavigateTab('dashboard')}
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
            onApplyCalendarSync={handleApplyGoogleCalendarSync}
            soundEnabled={soundEnabled}
            onToggleSound={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              void runCloudMutation((uid) => syncWorkspaceFields(uid, { soundEnabled: next }));
            }}
            comfortReadingEnabled={Boolean(profile.comfortReadingMode)}
            onToggleComfortReading={() => {
              const nextProfile: DigitalTwinProfile = {
                ...profile,
                comfortReadingMode: !profile.comfortReadingMode,
              };
              setProfile(nextProfile);
              void runCloudMutation((uid) => syncWorkspaceFields(uid, { profile: nextProfile }));
            }}
          />
        )}
      </main>

      {/* Ad-hoc Focus Mode Overlay (when launched from a specific task while on another tab) */}
      <FocusModeModal
        isOpen={isFocusOpen && currentTab !== 'focus'}
        onClose={() => {
          setIsFocusOpen(false);
        }}
        onReturnToDashboard={() => {
          closeAllModals();
          handleNavigateTab('dashboard');
        }}
        initialTask={focusTask}
        tasks={tasks}
        profile={profile}
        onUpdateProfile={(newProf) => {
          setProfile(newProf);
          void runCloudMutation((uid) => syncWorkspaceFields(uid, { profile: newProf }));
        }}
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
          className="fixed bottom-20 left-4 md:bottom-6 md:left-6 z-30 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-emerald-600 hover:from-cyan-500 hover:via-indigo-500 hover:to-emerald-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/25 border border-cyan-300/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
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
