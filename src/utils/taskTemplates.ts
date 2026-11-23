import type {
  Priority,
  SubTask,
  Task,
  TaskCategory,
  TaskTemplate,
  TaskTemplateColor,
  TaskTemplateItem,
} from '../types';
import { getTodayLocalISO, normalizeRecurrence } from './taskRecurrence';
import { normalizeTagName } from './taskTags';

export const TEMPLATE_STYLE_MAP: Record<
  TaskTemplateColor,
  {
    label: string;
    badgeClass: string;
    cardBorderClass: string;
    iconBgClass: string;
    dotClass: string;
  }
> = {
  cyan: {
    label: 'سماوي',
    badgeClass: 'bg-cyan-950/70 text-cyan-300 border-cyan-700/60',
    cardBorderClass: 'border-cyan-800/45 hover:border-cyan-500/60',
    iconBgClass: 'bg-cyan-500/15 border-cyan-500/30',
    dotClass: 'bg-cyan-400',
  },
  emerald: {
    label: 'زمردي',
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60',
    cardBorderClass: 'border-emerald-800/45 hover:border-emerald-500/60',
    iconBgClass: 'bg-emerald-500/15 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  amber: {
    label: 'ذهبي',
    badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-700/60',
    cardBorderClass: 'border-amber-800/45 hover:border-amber-500/60',
    iconBgClass: 'bg-amber-500/15 border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  rose: {
    label: 'وردي',
    badgeClass: 'bg-rose-950/70 text-rose-300 border-rose-700/60',
    cardBorderClass: 'border-rose-800/45 hover:border-rose-500/60',
    iconBgClass: 'bg-rose-500/15 border-rose-500/30',
    dotClass: 'bg-rose-400',
  },
  purple: {
    label: 'بنفسجي',
    badgeClass: 'bg-purple-950/70 text-purple-300 border-purple-700/60',
    cardBorderClass: 'border-purple-800/45 hover:border-purple-500/60',
    iconBgClass: 'bg-purple-500/15 border-purple-500/30',
    dotClass: 'bg-purple-400',
  },
  blue: {
    label: 'أزرق',
    badgeClass: 'bg-blue-950/70 text-blue-300 border-blue-700/60',
    cardBorderClass: 'border-blue-800/45 hover:border-blue-500/60',
    iconBgClass: 'bg-blue-500/15 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
};

export const TEMPLATE_COLOR_KEYS: TaskTemplateColor[] = [
  'cyan',
  'emerald',
  'amber',
  'rose',
  'purple',
  'blue',
];

export const TEMPLATE_ICON_OPTIONS = [
  '📋',
  '🛒',
  '✈️',
  '💼',
  '🕌',
  '📚',
  '🏋️',
  '🏠',
  '🎯',
  '⚡',
];

export const DEFAULT_TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-daily-work',
    name: 'قائمة العمل اليومية',
    description: 'روتين بداية ونهاية يوم العمل لإنجاز الأولويات وتنظيم البريد والاجتماعات.',
    icon: '💼',
    color: 'cyan',
    defaultCategory: 'work',
    createdAt: '2026-01-01T08:00:00.000Z',
    usageCount: 0,
    items: [
      {
        id: 'tpl-dw-1',
        title: 'مراجعة أولويات اليوم وجدولة المهام الحرجة',
        description: 'تحديد أهم 3 مهام قبل فتح البريد أو المحادثات',
        category: 'work',
        priority: 'high',
        estimatedMinutes: 15,
        energyRequired: 'high',
        dueTime: '08:30',
        tags: ['عمل', 'تخطيط'],
      },
      {
        id: 'tpl-dw-2',
        title: 'جلسة عمل عميق للمهمة الرئيسية',
        description: 'العمل بدون تشتيت لمدة 60 دقيقة على المخرج الأهم',
        category: 'work',
        priority: 'high',
        estimatedMinutes: 60,
        energyRequired: 'high',
        dueTime: '09:00',
        tags: ['عمل', 'تركيز'],
      },
      {
        id: 'tpl-dw-3',
        title: 'فرز الرسائل والرد على المتابعات العاجلة',
        category: 'work',
        priority: 'medium',
        estimatedMinutes: 25,
        energyRequired: 'medium',
        dueTime: '12:00',
        tags: ['عمل'],
      },
      {
        id: 'tpl-dw-4',
        title: 'مراجعة ما تم إنجازه وتجهيز قائمة الغد',
        category: 'work',
        priority: 'low',
        estimatedMinutes: 10,
        energyRequired: 'low',
        dueTime: '16:30',
        tags: ['عمل', 'مراجعة'],
      },
    ],
  },
  {
    id: 'tpl-shopping',
    name: 'قائمة التسوق والمقاضي',
    description: 'قائمة سريعة للمشتريات الأساسية للمنزل لتفادي نسيان أي غرض.',
    icon: '🛒',
    color: 'emerald',
    defaultCategory: 'personal',
    createdAt: '2026-01-01T08:01:00.000Z',
    usageCount: 0,
    items: [
      {
        id: 'tpl-sh-1',
        title: 'شراء الخضار والفواكه الطازجة',
        category: 'personal',
        priority: 'medium',
        estimatedMinutes: 20,
        energyRequired: 'low',
        tags: ['شخصي', 'تسوق'],
        subtasks: ['طماطم وخيار', 'ورقيات', 'فواكه الموسم'],
      },
      {
        id: 'tpl-sh-2',
        title: 'تأمين مستلزمات المطبخ والتموين الجاف',
        category: 'personal',
        priority: 'medium',
        estimatedMinutes: 25,
        energyRequired: 'low',
        tags: ['شخصي', 'تسوق'],
        subtasks: ['أرز ومعكرونة', 'زيت وبهارات', 'حليب وأجبان'],
      },
      {
        id: 'tpl-sh-3',
        title: 'مستلزمات النظافة والعناية المنزلية',
        category: 'personal',
        priority: 'low',
        estimatedMinutes: 15,
        energyRequired: 'low',
        tags: ['شخصي', 'تسوق'],
      },
    ],
  },
  {
    id: 'tpl-travel',
    name: 'قائمة تجهيز السفر',
    description: 'كل ما يلزمك قبل السفر من أوراق ثبوتية، حجوزات، وحقيبة السفر.',
    icon: '✈️',
    color: 'amber',
    defaultCategory: 'personal',
    createdAt: '2026-01-01T08:02:00.000Z',
    usageCount: 0,
    items: [
      {
        id: 'tpl-tr-1',
        title: 'التأكد من صلاحية الجواز والتذاكر وحجز الفندق',
        category: 'urgent',
        priority: 'high',
        estimatedMinutes: 20,
        energyRequired: 'medium',
        tags: ['سفر', 'مهم'],
        subtasks: ['حفظ نسخة رقمية للجواز والتأشيرة', 'طباعة أو حفظ تذكرة الطيران', 'تأكيد عنوان الفندق'],
      },
      {
        id: 'tpl-tr-2',
        title: 'تجهيز حقيبة الملابس والأحذية حسب الطقس',
        category: 'personal',
        priority: 'medium',
        estimatedMinutes: 40,
        energyRequired: 'medium',
        tags: ['سفر'],
        subtasks: ['ملابس يومية', 'ملابس رسمية/مريحة', 'مستلزمات العناية الشخصية'],
      },
      {
        id: 'tpl-tr-3',
        title: 'تجهيز الشواحن والباور بانك ومحول الكهرباء',
        category: 'personal',
        priority: 'high',
        estimatedMinutes: 15,
        energyRequired: 'low',
        tags: ['سفر'],
      },
      {
        id: 'tpl-tr-4',
        title: 'تأمين المنزل وإغلاق الأجهزة قبل المغادرة',
        category: 'personal',
        priority: 'high',
        estimatedMinutes: 15,
        energyRequired: 'low',
        tags: ['سفر'],
      },
    ],
  },
];

export function sanitizeTemplateItem(
  item: Partial<TaskTemplateItem>,
  fallbackCategory: TaskCategory = 'work',
  idx = 0
): TaskTemplateItem {
  const validCats = new Set<TaskCategory>(['work', 'personal', 'health', 'study', 'urgent']);
  const validPrio = new Set<Priority>(['high', 'medium', 'low']);

  const category: TaskCategory = validCats.has(item.category as TaskCategory)
    ? (item.category as TaskCategory)
    : fallbackCategory;
  const priority: Priority = validPrio.has(item.priority as Priority)
    ? (item.priority as Priority)
    : 'medium';
  const energyRequired: Priority = validPrio.has(item.energyRequired as Priority)
    ? (item.energyRequired as Priority)
    : priority === 'high'
      ? 'high'
      : priority === 'low'
        ? 'low'
        : 'medium';

  const cleanTags = Array.isArray(item.tags)
    ? Array.from(
        new Set(
          item.tags
            .map((t) => normalizeTagName(String(t)))
            .filter(Boolean)
        )
      ).slice(0, 15)
    : undefined;

  const cleanSubtasks = Array.isArray(item.subtasks)
    ? item.subtasks
        .map((st) => String(st).trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 30)
    : undefined;

  const cleanRec = normalizeRecurrence(item.recurrence);

  const estimatedRaw = Number(item.estimatedMinutes);
  const estimatedMinutes =
    Number.isFinite(estimatedRaw) && estimatedRaw > 0
      ? Math.max(1, Math.min(1440, Math.round(estimatedRaw)))
      : 30;

  const cleanDueTime =
    item.dueTime && /^\d{1,2}:\d{2}$/.test(item.dueTime.trim())
      ? item.dueTime.trim().slice(0, 16)
      : undefined;

  const rawId = (item.id || `tpl-item-${Date.now()}-${idx}`)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 120);

  return {
    id: rawId || `tpl-item-${Date.now()}-${idx}`,
    title: (item.title || 'مهمة من القالب').trim().slice(0, 300) || 'مهمة من القالب',
    ...(item.description?.trim()
      ? { description: item.description.trim().slice(0, 1000) }
      : {}),
    category,
    priority,
    estimatedMinutes,
    energyRequired,
    ...(cleanDueTime ? { dueTime: cleanDueTime } : {}),
    ...(cleanTags && cleanTags.length > 0 ? { tags: cleanTags } : {}),
    ...(cleanSubtasks && cleanSubtasks.length > 0 ? { subtasks: cleanSubtasks } : {}),
    ...(cleanRec ? { recurrence: cleanRec } : {}),
  };
}

export function sanitizeTaskTemplate(raw: Partial<TaskTemplate>): TaskTemplate {
  const validCats = new Set<TaskCategory>(['work', 'personal', 'health', 'study', 'urgent']);
  const validColors = new Set<TaskTemplateColor>(TEMPLATE_COLOR_KEYS);

  const defaultCategory: TaskCategory = validCats.has(raw.defaultCategory as TaskCategory)
    ? (raw.defaultCategory as TaskCategory)
    : 'work';
  const color: TaskTemplateColor = validColors.has(raw.color as TaskTemplateColor)
    ? (raw.color as TaskTemplateColor)
    : 'cyan';

  const cleanId = (raw.id || `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 120);

  const items = (Array.isArray(raw.items) ? raw.items : [])
    .slice(0, 40)
    .map((it, idx) => sanitizeTemplateItem(it, defaultCategory, idx));

  const usageRaw = Number(raw.usageCount);
  const usageCount =
    Number.isFinite(usageRaw) && usageRaw >= 0 ? Math.min(1000000, Math.round(usageRaw)) : 0;

  return {
    id: cleanId || `tpl-${Date.now()}`,
    name: (raw.name || 'قالب مهام جديد').trim().slice(0, 160) || 'قالب مهام جديد',
    ...(raw.description?.trim()
      ? { description: raw.description.trim().slice(0, 500) }
      : {}),
    icon: (raw.icon || '📋').trim().slice(0, 32) || '📋',
    color,
    defaultCategory,
    items,
    createdAt: raw.createdAt || new Date().toISOString(),
    usageCount,
  };
}

export function taskToTemplateItem(task: Task, idx = 0): TaskTemplateItem {
  return sanitizeTemplateItem(
    {
      id: `tpl-from-${task.id}-${idx}`.slice(0, 120),
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      energyRequired: task.energyRequired,
      dueTime: task.dueTime,
      tags: task.tags,
      subtasks: task.subtasks?.map((s) => s.title).filter(Boolean),
      recurrence: task.recurrence ? { ...task.recurrence, regeneratedNextId: undefined, occurrenceCount: 1 } : undefined,
    },
    task.category,
    idx
  );
}

export interface ApplyTemplateOptions {
  dueDate?: string; // YYYY-MM-DD or '' for no due date
  selectedItemIds?: string[]; // if omitted, all items
  extraTag?: string;
  includeSubtasks?: boolean;
}

export function buildTasksFromTemplate(
  template: TaskTemplate,
  options: ApplyTemplateOptions = {}
): Task[] {
  const nowMs = Date.now();
  const dueDate =
    options.dueDate === ''
      ? undefined
      : options.dueDate || getTodayLocalISO(new Date(nowMs));
  const selectedSet = options.selectedItemIds ? new Set(options.selectedItemIds) : null;
  const includeSubtasks = options.includeSubtasks !== false;
  const extraCleanTag = options.extraTag ? normalizeTagName(options.extraTag) : '';

  const targetItems = template.items.filter((item) =>
    selectedSet ? selectedSet.has(item.id) : true
  );

  return targetItems.map((item, idx) => {
    const suffix = Math.random().toString(36).slice(2, 6);
    const taskId = `task-tpl-${nowMs}-${idx}-${suffix}`;

    const mergedTags = Array.from(
      new Set(
        [...(item.tags || []), ...(extraCleanTag ? [extraCleanTag] : [])]
          .map((t) => normalizeTagName(t))
          .filter(Boolean)
      )
    ).slice(0, 15);

    const subtasks: SubTask[] | undefined =
      includeSubtasks && item.subtasks && item.subtasks.length > 0
        ? item.subtasks.slice(0, 30).map((stTitle, stIdx) => ({
            id: `sub-tpl-${nowMs}-${idx}-${stIdx}-${suffix}`,
            title: stTitle,
            completed: false,
          }))
        : undefined;

    const cleanRecurrence = item.recurrence
      ? normalizeRecurrence({
          ...item.recurrence,
          seriesId: taskId,
          occurrenceCount: 1,
          regeneratedNextId: undefined,
        })
      : undefined;

    return {
      id: taskId,
      title: item.title,
      description: item.description || '',
      category: item.category,
      priority: item.priority,
      status: 'todo',
      estimatedMinutes: item.estimatedMinutes || 30,
      ...(dueDate ? { dueDate } : {}),
      ...(item.dueTime ? { dueTime: item.dueTime } : {}),
      energyRequired: item.energyRequired,
      ...(subtasks ? { subtasks } : {}),
      ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
      isTopPriority: item.priority === 'high',
      isUnclassified: false,
      createdAt: new Date(nowMs + idx).toISOString(),
      ...(cleanRecurrence ? { recurrence: cleanRecurrence } : {}),
    };
  });
}
