import { useEffect, useState } from 'react';
import { TaskCategory, TimeBlock } from '../types';
import { AlertToneId, soundEngine } from './audioSynth';
import { SmartReminder } from './reminderEngine';

export type AlertCategoryKey =
  | 'work'
  | 'adhkar_quran'
  | 'study'
  | 'health'
  | 'personal'
  | 'urgent';

export type CategoryTonePreferences = Record<AlertCategoryKey, AlertToneId>;

export interface AlertTonePreset {
  id: AlertToneId;
  label: string;
  description: string;
}

export interface AlertCategoryMeta {
  key: AlertCategoryKey;
  label: string;
  examples: string;
  badgeClass: string;
  defaultTone: AlertToneId;
}

const STORAGE_KEY = 'digital_twin_category_tones_v1';
const TONES_UPDATED_EVENT = 'digital-twin:category-tones-updated';

export const ALERT_TONE_PRESETS: AlertTonePreset[] = [
  {
    id: 'work_crisp',
    label: 'نغمة عمل واضحة',
    description: 'نغمة حازمة وسريعة لمهام العمل والاجتماعات',
  },
  {
    id: 'calm_spiritual',
    label: 'نسيم روحاني هادئ',
    description: 'رنين ناعم مريح مناسب للأذكار وورد القرآن',
  },
  {
    id: 'study_bell',
    label: 'رنين تركيز ودراسة',
    description: 'نغمة بلورية هادئة للتعلم والمطالعة',
  },
  {
    id: 'health_water',
    label: 'نغمة حيوية وصحة',
    description: 'تدرج لطيف ومنعش لتنبيهات الصحة والراحة',
  },
  {
    id: 'personal_warm',
    label: 'نغمة شخصية دافئة',
    description: 'نغمة خفيفة ودودة للمواعيد والمهام الشخصية',
  },
  {
    id: 'urgent_pulse',
    label: 'تنبيه عاجل متكرر',
    description: 'نبضة واضحة وعالية الانتباه للمهام العاجلة والمتأخرة',
  },
  {
    id: 'chime_classic',
    label: 'جرس رقمي متدرج',
    description: 'نغمة الجرس الكلاسيكية المتصاعدة',
  },
  {
    id: 'silent',
    label: 'صامت (بدون صوت)',
    description: 'إظهار التنبيه المرئي فقط دون إصدار صوت لهذه الفئة',
  },
];

export const ALERT_CATEGORY_CONFIGS: AlertCategoryMeta[] = [
  {
    key: 'work',
    label: 'العمل والاجتماعات',
    examples: 'مهام العمل، جلسات التركيز العميق، والاجتماعات',
    badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
    defaultTone: 'work_crisp',
  },
  {
    key: 'adhkar_quran',
    label: 'الأذكار وورد القرآن',
    examples: 'أذكار الصباح والمساء وورد التلاوة والحفظ اليومي',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    defaultTone: 'calm_spiritual',
  },
  {
    key: 'study',
    label: 'الدراسة والتعلّم',
    examples: 'المقررات، الدورات، والقراءة المعرفية',
    badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60',
    defaultTone: 'study_bell',
  },
  {
    key: 'health',
    label: 'الصحة والراحة',
    examples: 'التمارين، شرب الماء، فترات الراحة، والوجبات',
    badgeClass: 'bg-teal-950/80 text-teal-300 border-teal-700/60',
    defaultTone: 'health_water',
  },
  {
    key: 'personal',
    label: 'الشخصي والروتين',
    examples: 'المهام الشخصية، المراجعات اليومية، والالتزامات العائلية',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    defaultTone: 'personal_warm',
  },
  {
    key: 'urgent',
    label: 'العاجل والتنبيهات المتأخرة',
    examples: 'المهام العاجلة، المواعيد المتأخرة، وتحذيرات ضغط الطاقة',
    badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
    defaultTone: 'urgent_pulse',
  },
];

export const DEFAULT_CATEGORY_TONES: CategoryTonePreferences = {
  work: 'work_crisp',
  adhkar_quran: 'calm_spiritual',
  study: 'study_bell',
  health: 'health_water',
  personal: 'personal_warm',
  urgent: 'urgent_pulse',
};

const VALID_TONE_IDS = new Set<AlertToneId>(ALERT_TONE_PRESETS.map((p) => p.id));

export function readCategoryTones(): CategoryTonePreferences {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_CATEGORY_TONES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CATEGORY_TONES };
    const parsed = JSON.parse(raw) as Partial<Record<AlertCategoryKey, AlertToneId>>;
    const result: CategoryTonePreferences = { ...DEFAULT_CATEGORY_TONES };
    (Object.keys(DEFAULT_CATEGORY_TONES) as AlertCategoryKey[]).forEach((cat) => {
      const val = parsed?.[cat];
      if (val && VALID_TONE_IDS.has(val)) {
        result[cat] = val;
      }
    });
    return result;
  } catch {
    return { ...DEFAULT_CATEGORY_TONES };
  }
}

export function saveCategoryTones(prefs: CategoryTonePreferences): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore storage quota errors
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TONES_UPDATED_EVENT));
  }
}

export function setCategoryTone(category: AlertCategoryKey, toneId: AlertToneId): CategoryTonePreferences {
  const next = { ...readCategoryTones(), [category]: toneId };
  saveCategoryTones(next);
  return next;
}

export function resetCategoryTones(): CategoryTonePreferences {
  const next = { ...DEFAULT_CATEGORY_TONES };
  saveCategoryTones(next);
  return next;
}

export function getToneForCategory(category: AlertCategoryKey): AlertToneId {
  return readCategoryTones()[category] || DEFAULT_CATEGORY_TONES[category];
}

export function mapTaskCategoryToAlertCategory(cat?: TaskCategory): AlertCategoryKey {
  switch (cat) {
    case 'work':
      return 'work';
    case 'study':
      return 'study';
    case 'health':
      return 'health';
    case 'urgent':
      return 'urgent';
    case 'personal':
    default:
      return 'personal';
  }
}

export function mapBlockCategoryToAlertCategory(cat?: TimeBlock['category']): AlertCategoryKey {
  switch (cat) {
    case 'deep_work':
    case 'meeting':
      return 'work';
    case 'health':
      return 'health';
    case 'routine':
    case 'review':
    case 'personal':
    default:
      return 'personal';
  }
}

export function resolveAlertCategoryForReminder(reminder: SmartReminder): AlertCategoryKey {
  if (reminder.sourceType === 'adhkar') {
    return 'adhkar_quran';
  }
  if (reminder.sourceType === 'energy_overload' || reminder.urgency === 'energy_warning') {
    return 'urgent';
  }
  if (reminder.task) {
    return mapTaskCategoryToAlertCategory(reminder.task.category);
  }
  if (reminder.block) {
    return mapBlockCategoryToAlertCategory(reminder.block.category);
  }
  return reminder.urgency === 'overdue' ? 'urgent' : 'personal';
}

export function playToneForReminder(reminder: SmartReminder): void {
  const category = resolveAlertCategoryForReminder(reminder);
  const toneId = getToneForCategory(category);
  soundEngine.playTone(toneId);
}

export function playToneForLocalCategory(
  category: 'quran' | 'adhkar' | 'task',
  taskCategory?: TaskCategory
): void {
  const alertCategory: AlertCategoryKey =
    category === 'quran' || category === 'adhkar'
      ? 'adhkar_quran'
      : mapTaskCategoryToAlertCategory(taskCategory);
  soundEngine.playTone(getToneForCategory(alertCategory));
}

export function useCategoryTones(): {
  tones: CategoryTonePreferences;
  updateTone: (category: AlertCategoryKey, toneId: AlertToneId) => void;
  resetTones: () => void;
} {
  const [tones, setTones] = useState<CategoryTonePreferences>(() => readCategoryTones());

  useEffect(() => {
    const refresh = () => setTones(readCategoryTones());
    window.addEventListener(TONES_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(TONES_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return {
    tones,
    updateTone: (category, toneId) => {
      setTones(setCategoryTone(category, toneId));
    },
    resetTones: () => {
      setTones(resetCategoryTones());
    },
  };
}
