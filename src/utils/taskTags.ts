import { Task, TaskTag, TaskTagColor } from '../types';

export const DEFAULT_TASK_TAGS: TaskTag[] = [
  { id: 'tag-work', name: 'عمل', color: 'blue' },
  { id: 'tag-study', name: 'دراسة', color: 'cyan' },
  { id: 'tag-personal', name: 'شخصي', color: 'purple' },
  { id: 'tag-health', name: 'صحة', color: 'emerald' },
  { id: 'tag-urgent', name: 'عاجل', color: 'rose' },
];

export const TASK_TAG_COLOR_OPTIONS: ReadonlyArray<{
  value: TaskTagColor;
  label: string;
  dotClass: string;
  badgeClass: string;
  selectedClass: string;
}> = [
  {
    value: 'cyan',
    label: 'سماوي',
    dotClass: 'bg-cyan-400',
    badgeClass: 'bg-cyan-950/75 text-cyan-200 border-cyan-700/60',
    selectedClass: 'bg-cyan-600 text-white border-cyan-400 shadow-sm shadow-cyan-600/30',
  },
  {
    value: 'blue',
    label: 'أزرق',
    dotClass: 'bg-blue-400',
    badgeClass: 'bg-blue-950/75 text-blue-200 border-blue-700/60',
    selectedClass: 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-600/30',
  },
  {
    value: 'emerald',
    label: 'أخضر',
    dotClass: 'bg-emerald-400',
    badgeClass: 'bg-emerald-950/75 text-emerald-200 border-emerald-700/60',
    selectedClass: 'bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-600/30',
  },
  {
    value: 'purple',
    label: 'بنفسجي',
    dotClass: 'bg-purple-400',
    badgeClass: 'bg-purple-950/75 text-purple-200 border-purple-700/60',
    selectedClass: 'bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-600/30',
  },
  {
    value: 'amber',
    label: 'عنبر',
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-950/75 text-amber-200 border-amber-700/60',
    selectedClass: 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm shadow-amber-500/30',
  },
  {
    value: 'rose',
    label: 'وردي',
    dotClass: 'bg-rose-400',
    badgeClass: 'bg-rose-950/75 text-rose-200 border-rose-700/60',
    selectedClass: 'bg-rose-600 text-white border-rose-400 shadow-sm shadow-rose-600/30',
  },
];

export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function getTagStyleByColor(color: TaskTagColor) {
  return (
    TASK_TAG_COLOR_OPTIONS.find((opt) => opt.value === color) ||
    TASK_TAG_COLOR_OPTIONS[0]
  );
}

export function getTagStyleForName(tagName: string, customTags: TaskTag[]) {
  const normalized = normalizeTagName(tagName).toLowerCase();
  const matched = customTags.find(
    (t) => normalizeTagName(t.name).toLowerCase() === normalized
  );
  if (matched) {
    return getTagStyleByColor(matched.color);
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return TASK_TAG_COLOR_OPTIONS[hash % TASK_TAG_COLOR_OPTIONS.length];
}

export function mergeAvailableTags(tasks: Task[], customTags: TaskTag[]): TaskTag[] {
  const result: TaskTag[] = [];
  const seen = new Set<string>();

  for (const tag of customTags) {
    const clean = normalizeTagName(tag.name);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...tag, name: clean });
  }

  for (const task of tasks) {
    for (const rawName of task.tags || []) {
      const clean = normalizeTagName(rawName);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: `auto-${key}`,
        name: clean,
        color: getTagStyleForName(clean, customTags).value,
      });
    }
  }

  return result;
}
