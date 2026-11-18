export interface DualDateInfo {
  iso: string;
  weekday: string;
  hijriFull: string;
  hijriShort: string;
  hijriDayNumber: number;
  hijriMonthName: string;
  hijriYear: string;
  gregorianFull: string;
  gregorianShort: string;
  gregorianDayNumber: number;
  gregorianMonthName: string;
  spiritualTag?: string;
}

export const toLocalIsoDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalIsoDate = (iso: string): Date => {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return new Date();
  }
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
};

const getHijriFormatter = (options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', options);
  } catch {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', options);
  }
};

export const getDualDateInfo = (input: Date | string = new Date()): DualDateInfo => {
  const date = typeof input === 'string' ? parseLocalIsoDate(input) : input;
  const iso = toLocalIsoDate(date);

  const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(date);

  const hijriParts = getHijriFormatter({
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).formatToParts(date);

  const hijriDayStr =
    hijriParts.find((p) => p.type === 'day')?.value || '1';
  const hijriMonthName =
    hijriParts.find((p) => p.type === 'month')?.value || '';
  const hijriYear =
    hijriParts.find((p) => p.type === 'year')?.value || '';
  const hijriDayNumber = parseInt(hijriDayStr, 10) || 1;

  const gregParts = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date);

  const gregDayStr =
    gregParts.find((p) => p.type === 'day')?.value || String(date.getDate());
  const gregorianMonthName =
    gregParts.find((p) => p.type === 'month')?.value || '';
  const gregYear =
    gregParts.find((p) => p.type === 'year')?.value || String(date.getFullYear());
  const gregorianDayNumber = parseInt(gregDayStr, 10) || date.getDate();

  const hijriFull = `${hijriDayStr} ${hijriMonthName} ${hijriYear} هـ`;
  const hijriShort = `${hijriDayStr} ${hijriMonthName}`;
  const gregorianFull = `${gregDayStr} ${gregorianMonthName} ${gregYear} م`;
  const gregorianShort = `${gregDayStr} ${gregorianMonthName}`;

  const dayOfWeek = date.getDay();
  let spiritualTag: string | undefined;
  if (dayOfWeek === 5) {
    spiritualTag = 'يوم الجمعة — سورة الكهف والصلاة على النبي ﷺ';
  } else if (hijriDayNumber === 13 || hijriDayNumber === 14 || hijriDayNumber === 15) {
    spiritualTag = `الأيام البيض (${hijriDayNumber} ${hijriMonthName})`;
  } else if (dayOfWeek === 1 || dayOfWeek === 4) {
    spiritualTag = dayOfWeek === 1 ? 'الإثنين — سنة الصيام' : 'الخميس — سنة الصيام';
  }

  return {
    iso,
    weekday,
    hijriFull,
    hijriShort,
    hijriDayNumber,
    hijriMonthName,
    hijriYear,
    gregorianFull,
    gregorianShort,
    gregorianDayNumber,
    gregorianMonthName,
    spiritualTag,
  };
};

export const getCalendarStripDays = (
  anchorDate: Date | string = new Date(),
  daysBefore = 1,
  totalDays = 7
): Array<DualDateInfo & { isToday: boolean }> => {
  const anchor =
    typeof anchorDate === 'string' ? parseLocalIsoDate(anchorDate) : anchorDate;
  const todayIso = toLocalIsoDate(new Date());

  const result: Array<DualDateInfo & { isToday: boolean }> = [];
  for (let i = -daysBefore; i < totalDays - daysBefore; i++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    const info = getDualDateInfo(d);
    result.push({
      ...info,
      isToday: info.iso === todayIso,
    });
  }
  return result;
};
