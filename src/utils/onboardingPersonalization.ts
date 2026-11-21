import type {
  DashboardLayoutEntry,
  DashboardSectionId,
  DigitalTwinProfile,
  OnboardingFocusArea,
} from '../types';
import { DEFAULT_DASHBOARD_LAYOUT } from '../data/dashboardDefaults';

export const ONBOARDING_STORAGE_KEY = 'hasCompletedOnboarding';

export interface OnboardingChoices {
  name: string;
  preferredTimePeriod: 'morning' | 'evening';
  focusAreas: OnboardingFocusArea[];
}

export const FOCUS_AREA_LABELS: Record<OnboardingFocusArea, string> = {
  work: 'العمل والإنتاجية',
  worship: 'العبادة والأذكار',
  health: 'الصحة والتوازن',
};

export function hasUserCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export function buildPersonalizedWorkspaceFromOnboarding(
  choices: OnboardingChoices,
  currentProfile: DigitalTwinProfile,
  currentLayout: DashboardLayoutEntry[]
): {
  profile: DigitalTwinProfile;
  dashboardLayout: DashboardLayoutEntry[];
  quranNotificationsEnabled: boolean;
} {
  const cleanName = choices.name.trim() || currentProfile.name || 'مستخدم';
  const focusAreas = Array.from(new Set(choices.focusAreas)).slice(0, 3);
  const isMorning = choices.preferredTimePeriod === 'morning';

  const peakEnergy = isMorning
    ? 'صباحي (6:00 ص - 11:30 ص) — ذروة التركيز في الصباح الباكر'
    : 'مسائي (4:00 م - 10:30 م) — ذروة التركيز في المساء والهدوء';

  const areaLabels = focusAreas.map((a) => FOCUS_AREA_LABELS[a]).join('، ');
  const workStyle = areaLabels
    ? `${isMorning ? 'نمط صباحي نشط' : 'نمط مسائي مركز'} • أولوية: ${areaLabels}`.slice(0, 300)
    : currentProfile.workStyle;

  const updatedProfile: DigitalTwinProfile = {
    ...currentProfile,
    name: cleanName.slice(0, 120),
    peakEnergy,
    workStyle,
    preferredTimePeriod: choices.preferredTimePeriod,
    focusAreas,
    onboardingCompleted: true,
  };

  // Reorder dashboard sections dynamically based on selected focus areas
  const hasWorship = focusAreas.includes('worship');
  const hasHealth = focusAreas.includes('health');
  const hasWork = focusAreas.includes('work');

  const priorityOrder: DashboardSectionId[] = ['twin_avatar'];

  if (hasWorship) {
    priorityOrder.push('quran_tracker');
  }
  if (hasHealth) {
    priorityOrder.push('mental_state', 'burnout_banner');
  }
  if (hasWork) {
    priorityOrder.push(
      'priorities_and_schedule',
      'current_block',
      'weekly_goal_chart',
      'long_term_goals'
    );
  }

  // Append remaining built-in sections in their natural order without duplicates
  const seenIds = new Set<string>(priorityOrder);
  const remainingBuiltins: DashboardSectionId[] = [];
  for (const entry of DEFAULT_DASHBOARD_LAYOUT) {
    if (!seenIds.has(entry.id)) {
      seenIds.add(entry.id);
      remainingBuiltins.push(entry.id as DashboardSectionId);
    }
  }

  const orderedBuiltins: DashboardLayoutEntry[] = [...priorityOrder, ...remainingBuiltins].map(
    (id) => ({
      id,
      isCustom: false,
      visible: true,
    })
  );

  // Preserve any existing custom widgets at the end
  const customEntries = (currentLayout || []).filter(
    (entry) => entry.isCustom && !seenIds.has(entry.id)
  );

  return {
    profile: updatedProfile,
    dashboardLayout: [...orderedBuiltins, ...customEntries],
    quranNotificationsEnabled: hasWorship ? true : true,
  };
}
