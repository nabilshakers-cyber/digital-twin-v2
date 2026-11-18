import { BurnoutEvaluation, DigitalTwinProfile, Task, TimeBlock } from '../types';
import { toLocalIsoDate } from './calendarUtils';

export type { BurnoutEvaluation };

export type EnergyTier = 'low' | 'medium' | 'high';

export interface ProfileEnergyCapacity {
  level: EnergyTier;
  label: string;
  maxEnergyPoints: number;
  maxHours: number;
  maxHighEnergyTasks: number;
}

export interface TomorrowEnergyAnalysis {
  tomorrowIso: string;
  tomorrowTaskCount: number;
  tomorrowBlockCount: number;
  totalItemsCount: number;
  highEnergyCount: number;
  totalMinutes: number;
  totalHours: number;
  usedEnergyPoints: number;
  capacity: ProfileEnergyCapacity;
  usagePercent: number;
  isOverloaded: boolean;
  overloadReasons: string[];
  summary: string;
  recommendation: string;
}

export function evaluateCognitiveLoad(tasks: any[]): BurnoutEvaluation {
  // تصفية المهام غير المكتملة وعالية الأهمية
  const highPriorityPending = tasks.filter(
    (t) =>
      (t.priority === 'high' || t.urgency === 'high') &&
      !(t.status === 'completed' || Boolean(t.completed))
  );

  if (highPriorityPending.length >= 4) {
    return {
      isOverloaded: true,
      message:
        'تحذير توأمك الرقمي: تم رصد عبء معرفي مرتفع وتراكم مهام شاقة تتجاوز طاقتك المثالية اليوم.',
      recommendedAction: 'إعادة توزيع المهام وتخفيف ساعات العمل العميق',
    };
  }

  if (highPriorityPending.length === 3) {
    return {
      isOverloaded: false,
      message:
        'تنبيه لطيف: جدولك اليومي مكثف بعض الشيء، احرص على أخذ استراحات قصيرة بين الجلسات.',
      recommendedAction: 'تنظيم وقت الراحة',
    };
  }

  return {
    isOverloaded: false,
    message: 'الحمل المعرفي مستقر وضمن الحدود الآمنة للإنتاجية.',
    recommendedAction: 'الاستمرار بالوتيرة الحالية',
  };
}

export function getSmartReschedulingSuggestions<T = any>(
  tasks: T[]
): (T & { suggestedPostpone?: boolean })[] {
  // نموذج مقترح لإعادة الجدولة وتأجيل المهام غير الملحة
  return tasks.map((task) => {
    const item = task as Record<string, any>;
    const isCompleted = item.status === 'completed' || Boolean(item.completed);
    if (!isCompleted && item.priority === 'low') {
      return { ...task, suggestedPostpone: true };
    }
    return task;
  });
}

export function getTomorrowDateString(now: Date = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toLocalIsoDate(tomorrow);
}

export function getProfileEnergyCapacity(profile: DigitalTwinProfile): ProfileEnergyCapacity {
  const level: EnergyTier = profile.dailyEnergyLevel || 'medium';
  const targetHours = Math.max(1, Math.min(16, Number(profile.dailyWorkHoursTarget) || 7));

  if (level === 'low') {
    return {
      level,
      label: 'منخفضة (هادئة)',
      maxHours: Math.min(targetHours, 4.5),
      maxEnergyPoints: Math.max(5, Math.round(Math.min(targetHours, 4.5) * 1.8)),
      maxHighEnergyTasks: 1,
    };
  }

  if (level === 'high') {
    return {
      level,
      label: 'عالية (مكثفة)',
      maxHours: Math.max(targetHours, 8),
      maxEnergyPoints: Math.max(12, Math.round(Math.max(targetHours, 8) * 2.5)),
      maxHighEnergyTasks: 5,
    };
  }

  return {
    level: 'medium',
    label: 'متوسطة (متوازنة)',
    maxHours: targetHours,
    maxEnergyPoints: Math.max(8, Math.round(targetHours * 2)),
    maxHighEnergyTasks: 3,
  };
}

function parseTimeToMinutes(hhmm?: string): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getBlockDurationMinutes(block: TimeBlock): number {
  const start = parseTimeToMinutes(block.startTime);
  const end = parseTimeToMinutes(block.endTime);
  if (start !== null && end !== null && end > start) {
    return Math.min(480, end - start);
  }
  return 60;
}

function computeEnergyWeight(level: 'high' | 'medium' | 'low', minutes: number): number {
  const hoursFactor = Math.max(0.5, minutes / 60);
  if (level === 'high') return Number((hoursFactor * 3).toFixed(1));
  if (level === 'medium') return Number((hoursFactor * 2).toFixed(1));
  return Number((hoursFactor * 1).toFixed(1));
}

export function analyzeTomorrowEnergyLoad(
  tasks: Task[],
  schedule: TimeBlock[],
  profile: DigitalTwinProfile,
  now: Date = new Date()
): TomorrowEnergyAnalysis {
  const tomorrowIso = getTomorrowDateString(now);
  const capacity = getProfileEnergyCapacity(profile);

  const tomorrowTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.dueDate === tomorrowIso
  );
  const taskIdSet = new Set(tomorrowTasks.map((t) => t.id));

  // Avoid double-counting blocks that are directly linked to a counted tomorrow task
  const standaloneTomorrowBlocks = schedule.filter(
    (b) =>
      !b.isCompleted &&
      b.date === tomorrowIso &&
      !(b.relatedTaskId && taskIdSet.has(b.relatedTaskId)) &&
      b.category !== 'health' // rest/meal breaks do not drain work energy
  );

  let totalMinutes = 0;
  let usedEnergyPoints = 0;
  let highEnergyCount = 0;

  for (const t of tomorrowTasks) {
    const mins = Math.max(15, Number(t.estimatedMinutes) || 30);
    const level: 'high' | 'medium' | 'low' =
      t.energyRequired || (t.priority === 'high' ? 'high' : t.priority === 'low' ? 'low' : 'medium');
    totalMinutes += mins;
    usedEnergyPoints += computeEnergyWeight(level, mins);
    if (level === 'high' || t.priority === 'high') {
      highEnergyCount += 1;
    }
  }

  for (const b of standaloneTomorrowBlocks) {
    const mins = getBlockDurationMinutes(b);
    const level: 'high' | 'medium' | 'low' =
      b.energyLevel ||
      (b.category === 'deep_work' || b.priority === 'high'
        ? 'high'
        : b.category === 'routine' || b.category === 'personal'
        ? 'low'
        : 'medium');
    totalMinutes += mins;
    usedEnergyPoints += computeEnergyWeight(level, mins);
    if (level === 'high' || b.priority === 'high') {
      highEnergyCount += 1;
    }
  }

  usedEnergyPoints = Math.round(usedEnergyPoints * 10) / 10;
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const usagePercent =
    capacity.maxEnergyPoints > 0
      ? Math.round((usedEnergyPoints / capacity.maxEnergyPoints) * 100)
      : 0;

  const overloadReasons: string[] = [];
  if (usedEnergyPoints > capacity.maxEnergyPoints) {
    overloadReasons.push(
      `نقاط الطاقة المقدرة (${usedEnergyPoints}) تتجاوز طاقتك المخصصة (${capacity.maxEnergyPoints})`
    );
  }
  if (totalHours > capacity.maxHours) {
    overloadReasons.push(
      `ساعات الغد المجدولة (${totalHours} س) تتجاوز حدك اليومي (${capacity.maxHours} س)`
    );
  }
  if (highEnergyCount > capacity.maxHighEnergyTasks) {
    overloadReasons.push(
      `عدد المهام عالية الجهد (${highEnergyCount}) يتجاوز الحد الملائم لمستوى طاقتك (${capacity.maxHighEnergyTasks})`
    );
  }

  const isOverloaded = overloadReasons.length > 0;
  const totalItemsCount = tomorrowTasks.length + standaloneTomorrowBlocks.length;

  const summary =
    totalItemsCount === 0
      ? 'لا توجد مهام أو مواعيد مجدولة ليوم غد حتى الآن.'
      : isOverloaded
      ? `تم رصد ${totalItemsCount} مهمة/موعد ليوم غد بإجمالي ${totalHours} ساعة (${usagePercent}% من طاقتك المخصصة "${capacity.label}").`
      : `جدول الغد متوازن: ${totalItemsCount} مهام/مواعيد (${totalHours} س) ضمن حد طاقتك المخصصة (${usagePercent}%).`;

  const recommendation = isOverloaded
    ? 'يُفضل ترحيل مهمة غير عاجلة أو تقليص مهام الطاقة العالية قبل بدء الغد لتفادي الإرهاق.'
    : 'توزيع مهام الغد متناغم مع مستوى طاقتك المخصص.';

  return {
    tomorrowIso,
    tomorrowTaskCount: tomorrowTasks.length,
    tomorrowBlockCount: standaloneTomorrowBlocks.length,
    totalItemsCount,
    highEnergyCount,
    totalMinutes,
    totalHours,
    usedEnergyPoints,
    capacity,
    usagePercent,
    isOverloaded,
    overloadReasons,
    summary,
    recommendation,
  };
}

export function isEndOfDayWindow(
  profile: DigitalTwinProfile,
  now: Date = new Date()
): boolean {
  const alertTime =
    profile.endOfDayAlertTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(profile.endOfDayAlertTime)
      ? profile.endOfDayAlertTime
      : '20:00';
  const [targetHour, targetMin] = alertTime.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = targetHour * 60 + targetMin;
  return currentMinutes >= targetMinutes;
}

