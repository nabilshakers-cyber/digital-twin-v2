import { Priority, Task, TaskCategory, TaskStatus } from '../types';
import { normalizeTagName } from './taskTags';

export type CsvTargetField =
  | 'title'
  | 'description'
  | 'category'
  | 'priority'
  | 'status'
  | 'dueDate'
  | 'dueTime'
  | 'estimatedMinutes'
  | 'tags';

export type CsvColumnMapping = Record<CsvTargetField, number | null>;

export interface ParsedCsvData {
  headers: string[];
  rows: string[][];
  delimiter: ',' | ';' | '\t';
  hasHeaderRow: boolean;
}

export interface CsvImportPreviewResult {
  tasks: Partial<Task>[];
  skippedEmptyTitleCount: number;
  skippedDuplicateCount: number;
  truncatedByLimitCount: number;
  discoveredTags: string[];
}

export const MAX_CSV_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_CSV_IMPORT_ROWS = 500;

export const CSV_TARGET_FIELD_META: ReadonlyArray<{
  key: CsvTargetField;
  label: string;
  required?: boolean;
  hint: string;
}> = [
  { key: 'title', label: 'عنوان المهمة', required: true, hint: 'title, task, name, العنوان, المهمة' },
  { key: 'description', label: 'الوصف / الملاحظات', hint: 'description, notes, الوصف, التفاصيل' },
  { key: 'category', label: 'التصنيف', hint: 'category, list, section, التصنيف' },
  { key: 'priority', label: 'الأولوية', hint: 'priority, p1..p4, الأولوية' },
  { key: 'status', label: 'الحالة', hint: 'status, completed, done, الحالة' },
  { key: 'dueDate', label: 'تاريخ الاستحقاق', hint: 'due, date, due_date, التاريخ' },
  { key: 'dueTime', label: 'الوقت', hint: 'time, due_time, الوقت' },
  { key: 'estimatedMinutes', label: 'المدة (بالدقائق)', hint: 'duration, minutes, المدة' },
  { key: 'tags', label: 'الوسوم / التصنيفات', hint: 'tags, labels, الوسوم' },
];

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(sampleText: string): ',' | ';' | '\t' {
  const firstLines = sampleText.split(/\r?\n/).slice(0, 5).join('\n');
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLines.length; i += 1) {
    const ch = firstLines[i];
    if (ch === '"') {
      if (inQuotes && firstLines[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes) {
      if (ch === ',') commas += 1;
      else if (ch === ';') semis += 1;
      else if (ch === '\t') tabs += 1;
    }
  }

  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

/**
 * RFC 4180 compliant CSV parser handling quotes, escaped double quotes,
 * embedded newlines, UTF-8 BOM, and auto-detected delimiters.
 */
export function parseCsvText(rawText: string): ParsedCsvData {
  const cleanText = stripBom(rawText || '').trim();
  if (!cleanText) {
    return { headers: [], rows: [], delimiter: ',', hasHeaderRow: true };
  }

  const delimiter = detectDelimiter(cleanText);
  const allRows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        allRows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        allRows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    allRows.push(currentRow);
  }

  if (allRows.length === 0) {
    return { headers: [], rows: [], delimiter, hasHeaderRow: true };
  }

  const maxCols = Math.max(...allRows.map((r) => r.length));
  const normalizedRows = allRows.map((r) => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push('');
    return padded;
  });

  const firstRow = normalizedRows[0];
  const looksLikeHeader =
    normalizedRows.length > 1 ||
    firstRow.some((cell) => matchesKnownHeader(cell));

  if (looksLikeHeader) {
    const headers = firstRow.map((h, idx) => h || `عمود ${idx + 1}`);
    return {
      headers,
      rows: normalizedRows.slice(1),
      delimiter,
      hasHeaderRow: true,
    };
  }

  const fallbackHeaders = firstRow.map((_, idx) => `عمود ${idx + 1}`);
  return {
    headers: fallbackHeaders,
    rows: normalizedRows,
    delimiter,
    hasHeaderRow: false,
  };
}

const HEADER_ALIASES: Record<CsvTargetField, string[]> = {
  title: [
    'title',
    'task',
    'task name',
    'name',
    'subject',
    'content',
    'summary',
    'todo',
    'item',
    'عنوان',
    'العنوان',
    'عنوان المهمة',
    'المهمة',
    'اسم المهمة',
    'الاسم',
  ],
  description: [
    'description',
    'desc',
    'details',
    'notes',
    'note',
    'body',
    'comment',
    'الوصف',
    'التفاصيل',
    'ملاحظات',
    'الملاحظات',
  ],
  category: [
    'category',
    'cat',
    'list',
    'folder',
    'section',
    'section/column',
    'project',
    'group',
    'التصنيف',
    'الفئة',
    'القائمة',
    'المشروع',
  ],
  priority: [
    'priority',
    'prio',
    'importance',
    'urgency',
    'الأولوية',
    'الاولوية',
    'الأهمية',
  ],
  status: [
    'status',
    'state',
    'completed',
    'done',
    'is_completed',
    'checked',
    'الحالة',
    'مكتملة',
    'منجزة',
  ],
  dueDate: [
    'duedate',
    'due_date',
    'due date',
    'due',
    'date',
    'deadline',
    'start date',
    'تاريخ الاستحقاق',
    'التاريخ',
    'الموعد',
    'تاريخ الانتهاء',
  ],
  dueTime: [
    'duetime',
    'due_time',
    'due time',
    'time',
    'الوقت',
    'وقت الاستحقاق',
    'الساعة',
  ],
  estimatedMinutes: [
    'estimatedminutes',
    'estimated_minutes',
    'estimated minutes',
    'duration',
    'minutes',
    'estimate',
    'time estimate',
    'المدة',
    'المدة بالدقائق',
    'الدقائق',
    'الوقت المقدر',
  ],
  tags: [
    'tags',
    'tag',
    'labels',
    'label',
    'الوسوم',
    'وسوم',
    'العلامات',
    'تصنيفات مخصصة',
  ],
};

function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function matchesKnownHeader(cell: string): boolean {
  const norm = normalizeHeaderKey(cell);
  if (!norm) return false;
  return Object.values(HEADER_ALIASES).some((aliases) =>
    aliases.some((alias) => normalizeHeaderKey(alias) === norm)
  );
}

export function autoDetectCsvMapping(headers: string[]): CsvColumnMapping {
  const mapping: CsvColumnMapping = {
    title: null,
    description: null,
    category: null,
    priority: null,
    status: null,
    dueDate: null,
    dueTime: null,
    estimatedMinutes: null,
    tags: null,
  };

  const usedIndices = new Set<number>();
  const normalizedHeaders = headers.map(normalizeHeaderKey);

  // Exact alias match first
  for (const field of Object.keys(HEADER_ALIASES) as CsvTargetField[]) {
    const aliases = HEADER_ALIASES[field].map(normalizeHeaderKey);
    const idx = normalizedHeaders.findIndex(
      (h, colIdx) => !usedIndices.has(colIdx) && aliases.includes(h)
    );
    if (idx !== -1) {
      mapping[field] = idx;
      usedIndices.add(idx);
    }
  }

  // Partial substring match fallback for unmapped fields
  for (const field of Object.keys(HEADER_ALIASES) as CsvTargetField[]) {
    if (mapping[field] !== null) continue;
    const aliases = HEADER_ALIASES[field].map(normalizeHeaderKey);
    const idx = normalizedHeaders.findIndex(
      (h, colIdx) =>
        !usedIndices.has(colIdx) &&
        h.length > 0 &&
        aliases.some((alias) => alias.length >= 3 && (h.includes(alias) || alias.includes(h)))
    );
    if (idx !== -1) {
      mapping[field] = idx;
      usedIndices.add(idx);
    }
  }

  // If title is still null and there is at least one column, default to first column
  if (mapping.title === null && headers.length > 0) {
    mapping.title = 0;
  }

  return mapping;
}

export function normalizeCsvCategory(raw: string): TaskCategory {
  const val = raw.trim().toLowerCase();
  if (!val) return 'work';
  if (/(urgent|طارئ|عاجل|asap|critical)/.test(val)) return 'urgent';
  if (/(health|fitness|sport|workout|صحة|رياضة|لياقة|عافية)/.test(val)) return 'health';
  if (/(study|learn|course|read|book|education|دراسة|تعلم|قراءة|جامعة|مذاكرة|قرآن)/.test(val)) {
    return 'study';
  }
  if (/(personal|home|family|life|شخصي|عائلي|منزل|بيت|تسوق)/.test(val)) return 'personal';
  return 'work';
}

export function normalizeCsvPriority(raw: string): Priority {
  const val = raw.trim().toLowerCase();
  if (!val) return 'medium';
  if (/(high|urgent|critical|p1|p2|عالي|عالية|عاجل|قصوى|مرتفع|مهم جداً|!{2,})/.test(val) || val === '1' || val === '2') {
    return 'high';
  }
  if (/(low|minor|p4|منخفض|منخفضة|بسيط|بسيطة|ثانوي)/.test(val) || val === '4') {
    return 'low';
  }
  return 'medium';
}

export function normalizeCsvStatus(raw: string): TaskStatus {
  const val = raw.trim().toLowerCase();
  if (!val) return 'todo';
  if (/(completed|complete|done|finished|closed|true|yes|مكتمل|مكتملة|تم|منجز|منجزة|انتهى|نعم)/.test(val) || val === '1') {
    return 'completed';
  }
  if (/(in_progress|in progress|progress|doing|active|started|قيد التنفيذ|جاري|قيد العمل)/.test(val)) {
    return 'in_progress';
  }
  return 'todo';
}

export function normalizeCsvDateAndTime(
  rawDate: string,
  rawTime?: string
): { dueDate?: string; dueTime?: string } {
  let dueDate: string | undefined;
  let dueTime: string | undefined;

  const trimmedDate = rawDate.trim();
  if (trimmedDate) {
    // ISO YYYY-MM-DD (optionally with THH:MM)
    const isoMatch = trimmedDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      dueDate = `${y}-${m}-${d}`;
      if (isoMatch[4] && isoMatch[5]) {
        dueTime = `${isoMatch[4].padStart(2, '0')}:${isoMatch[5]}`;
      }
    } else {
      // DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = trimmedDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
      if (dmyMatch) {
        const d = dmyMatch[1].padStart(2, '0');
        const m = dmyMatch[2].padStart(2, '0');
        const y = dmyMatch[3];
        if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
          dueDate = `${y}-${m}-${d}`;
        }
        if (dmyMatch[4] && dmyMatch[5]) {
          dueTime = `${dmyMatch[4].padStart(2, '0')}:${dmyMatch[5]}`;
        }
      } else {
        const parsed = new Date(trimmedDate);
        if (!Number.isNaN(parsed.getTime())) {
          dueDate = parsed.toISOString().split('T')[0];
        }
      }
    }
  }

  const trimmedTime = (rawTime || '').trim();
  if (trimmedTime) {
    const timeMatch = trimmedTime.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hh = Number(timeMatch[1]);
      const mm = Number(timeMatch[2]);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
        dueTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
    }
  }

  return { dueDate, dueTime };
}

export function normalizeCsvMinutes(raw: string): number {
  const clean = raw.trim().toLowerCase();
  if (!clean) return 30;
  const numMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return 30;
  const num = Number(numMatch[1]);
  if (!Number.isFinite(num) || num <= 0) return 30;
  const minutes = /(hour|hr|h|ساعة|ساعات)/.test(clean) && !/(min|m|دقيق)/.test(clean)
    ? Math.round(num * 60)
    : Math.round(num);
  return Math.max(5, Math.min(1440, minutes));
}

export function parseCsvTags(raw: string): string[] {
  if (!raw.trim()) return [];
  const parts = raw.split(/[,;|،#]+/);
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const part of parts) {
    const clean = normalizeTagName(part);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(clean);
    if (tags.length >= 15) break;
  }

  return tags;
}

export function buildTasksFromCsv(
  parsed: ParsedCsvData,
  mapping: CsvColumnMapping,
  existingTasks: Task[],
  options: { skipDuplicates: boolean } = { skipDuplicates: true }
): CsvImportPreviewResult {
  const existingTitles = new Set(
    existingTasks.map((t) => t.title.trim().toLowerCase())
  );
  const seenImportTitles = new Set<string>();
  const discoveredTagsSet = new Set<string>();
  const discoveredTags: string[] = [];

  const tasks: Partial<Task>[] = [];
  let skippedEmptyTitleCount = 0;
  let skippedDuplicateCount = 0;

  const eligibleRows = parsed.rows.slice(0, MAX_CSV_IMPORT_ROWS);
  const truncatedByLimitCount = Math.max(0, parsed.rows.length - MAX_CSV_IMPORT_ROWS);

  const getCell = (row: string[], field: CsvTargetField): string => {
    const colIdx = mapping[field];
    if (colIdx === null || colIdx < 0 || colIdx >= row.length) return '';
    return row[colIdx] || '';
  };

  for (const row of eligibleRows) {
    const rawTitle = getCell(row, 'title').trim().slice(0, 300);
    if (!rawTitle) {
      skippedEmptyTitleCount += 1;
      continue;
    }

    const titleKey = rawTitle.toLowerCase();
    if (
      options.skipDuplicates &&
      (existingTitles.has(titleKey) || seenImportTitles.has(titleKey))
    ) {
      skippedDuplicateCount += 1;
      continue;
    }
    seenImportTitles.add(titleKey);

    const description = getCell(row, 'description').trim().slice(0, 2000);
    const category = normalizeCsvCategory(getCell(row, 'category'));
    const priority = normalizeCsvPriority(getCell(row, 'priority'));
    const status = normalizeCsvStatus(getCell(row, 'status'));
    const { dueDate, dueTime } = normalizeCsvDateAndTime(
      getCell(row, 'dueDate'),
      getCell(row, 'dueTime')
    );
    const estimatedMinutes = normalizeCsvMinutes(getCell(row, 'estimatedMinutes'));
    const tags = parseCsvTags(getCell(row, 'tags'));

    for (const tg of tags) {
      const k = tg.toLowerCase();
      if (!discoveredTagsSet.has(k)) {
        discoveredTagsSet.add(k);
        discoveredTags.push(tg);
      }
    }

    tasks.push({
      title: rawTitle,
      description,
      category,
      priority,
      status,
      estimatedMinutes,
      ...(dueDate ? { dueDate } : {}),
      ...(dueTime ? { dueTime } : {}),
      energyRequired: priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'medium',
      isTopPriority: priority === 'high',
      isUnclassified: false,
      ...(tags.length > 0 ? { tags } : {}),
      ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    });
  }

  return {
    tasks,
    skippedEmptyTitleCount,
    skippedDuplicateCount,
    truncatedByLimitCount,
    discoveredTags,
  };
}

function escapeCsvCell(value: string): string {
  const safeVal = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r;]/.test(safeVal)) {
    return `"${safeVal.replace(/"/g, '""')}"`;
  }
  return safeVal;
}

export function generateSampleTasksCsv(): string {
  const today = new Date().toISOString().split('T')[0];
  const headers = [
    'العنوان',
    'الوصف',
    'التصنيف',
    'الأولوية',
    'الحالة',
    'تاريخ الاستحقاق',
    'الوقت',
    'المدة بالدقائق',
    'الوسوم',
  ];
  const sampleRows = [
    [
      'مراجعة خطة المشروع الأسبوعية',
      'تحديد الأولويات وتوزيع المهام على الفريق',
      'عمل',
      'عالية',
      'قيد التنفيذ',
      today,
      '10:00',
      '45',
      'عمل، عاجل',
    ],
    [
      'مراجعة الفصل الخامس من المقرر',
      'تلخيص النقاط الأساسية وحل التمارين',
      'دراسة',
      'متوسطة',
      'قيد الانتظار',
      today,
      '19:30',
      '30',
      'دراسة',
    ],
  ];

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...sampleRows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  return `\uFEFF${lines.join('\r\n')}`;
}

export function exportTasksToCsv(tasks: Task[]): string {
  const headers = [
    'العنوان',
    'الوصف',
    'التصنيف',
    'الأولوية',
    'الحالة',
    'تاريخ الاستحقاق',
    'الوقت',
    'المدة بالدقائق',
    'الوسوم',
  ];

  const categoryLabels: Record<TaskCategory, string> = {
    work: 'عمل',
    personal: 'شخصي',
    health: 'صحة',
    study: 'دراسة',
    urgent: 'طارئ',
  };
  const priorityLabels: Record<Priority, string> = {
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
  };
  const statusLabels: Record<TaskStatus, string> = {
    todo: 'جديدة',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتملة',
  };

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...tasks.map((t) =>
      [
        t.title || '',
        t.description || '',
        categoryLabels[t.category] || t.category,
        priorityLabels[t.priority] || t.priority,
        statusLabels[t.status] || t.status,
        t.dueDate || '',
        t.dueTime || '',
        String(t.estimatedMinutes || 30),
        (t.tags || []).join('، '),
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];

  return `\uFEFF${lines.join('\r\n')}`;
}
