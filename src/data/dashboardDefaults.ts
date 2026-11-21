import { DashboardLayoutEntry, DashboardSectionId, PhoneAppList } from '../types';

export interface BuiltInSectionMeta {
  id: DashboardSectionId;
  label: string;
  description: string;
  icon: string;
}

export const BUILTIN_DASHBOARD_SECTIONS: BuiltInSectionMeta[] = [
  {
    id: 'twin_avatar',
    label: 'بطاقة التوأم الرقمي والمزامنة',
    description: 'ملخص حالة نسختك الرقمية واختصارات المحادثة والإحاطة الصباحية/المسائية.',
    icon: '✨',
  },
  {
    id: 'mental_state',
    label: 'ملخص الحالة الذهنية والتشجيع المخصص',
    description: 'قراءة ذكية لنسبة الإنجاز والمهام المتأخرة مع رسالة تحفيزية مخصصة.',
    icon: '🧠',
  },
  {
    id: 'quran_tracker',
    label: 'جدول تعاهد القرآن والأذكار',
    description: 'متابعة الورد اليومي المرتبط بمنصة ترتيل مع أذكار الصباح والمساء التفاعلية.',
    icon: '📖',
  },
  {
    id: 'phone_apps',
    label: 'قوائم تطبيقات الهاتف السريعة',
    description: 'قوائم منظمة للدخول السريع إلى تطبيقات هاتفك (القرآن، الإنتاجية، التواصل، الأدوات).',
    icon: '📱',
  },
  {
    id: 'burnout_banner',
    label: 'مراقب الحمل المعرفي وإعادة الجدولة',
    description: 'تنبيهات الإرهاق وخيارات تأجيل المهام غير العاجلة لحماية تركيزك.',
    icon: '🛡️',
  },
  {
    id: 'current_block',
    label: 'الكتلة الزمنية الحالية',
    description: 'عرض النشاط الجاري أو القادم مع زر بدء جلسة التركيز فوراً.',
    icon: '⏱️',
  },
  {
    id: 'priorities_and_schedule',
    label: 'أهم الأولويات وتسلسل الجدول اليومي',
    description: 'أهم المهام العاجلة جنباً إلى جنب مع معاينة الجدول اليومي بالتقويم الهجري والميلادي.',
    icon: '⚡',
  },
  {
    id: 'weekly_goal_chart',
    label: 'معدل الإنجاز الأسبوعي مقارنة بالأسابيع السابقة',
    description: 'رسم بياني تفاعلي يقارن معدل إنجاز المهام الأسبوعي بالأسابيع السابقة والهدف الشخصي.',
    icon: '📊',
  },
  {
    id: 'productivity_stats',
    label: 'إحصائيات الإنتاجية والتركيز',
    description: 'تحليل ساعات العمل والتصنيفات ومؤشرات الأداء اليومية.',
    icon: '📈',
  },
  {
    id: 'long_term_goals',
    label: 'الأهداف والمشاريع طويلة المدى',
    description: 'متابعة المشاريع الإستراتيجية ونسب التقدم في كل هدف.',
    icon: '🎯',
  },
];

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutEntry[] =
  BUILTIN_DASHBOARD_SECTIONS.map((sec) => ({
    id: sec.id,
    isCustom: false,
    visible: true,
  }));

export const INITIAL_PHONE_APP_LISTS: PhoneAppList[] = [
  {
    id: 'plist-quran',
    title: 'قائمة القرآن والعبادات',
    icon: '🕌',
    color: 'emerald',
    apps: [
      {
        id: 'app-tarteel',
        name: 'ترتيل (Tarteel)',
        icon: 'tarteel',
        deepLink: 'https://tarteel.ai/',
        note: 'مراجعة وتسميع القرآن',
      },
      {
        id: 'app-quran',
        name: 'المصحف (Quran)',
        icon: 'quran',
        deepLink: 'https://quran.com/',
        note: 'القراءة والتفسير',
      },
      {
        id: 'app-athkari',
        name: 'حصن المسلم',
        icon: 'hisnmuslim',
        deepLink: 'https://hisnmuslim.com/',
        note: 'الأذكار والأدعية',
      },
      {
        id: 'app-prayer',
        name: 'مواقيت الصلاة',
        icon: 'prayer',
        deepLink: 'https://www.islamicfinder.org/',
        note: 'الأذان والقبلة',
      },
    ],
  },
  {
    id: 'plist-productivity',
    title: 'قائمة الإنتاجية والعمل',
    icon: '💼',
    color: 'cyan',
    apps: [
      {
        id: 'app-calendar',
        name: 'تقويم جوجل',
        icon: 'google_calendar',
        deepLink: 'https://calendar.google.com/',
        note: 'المواعيد والاجتماعات',
      },
      {
        id: 'app-keep',
        name: 'ملاحظات Keep',
        icon: 'google_keep',
        deepLink: 'https://keep.google.com/',
        note: 'الملاحظات السريعة',
      },
      {
        id: 'app-notion',
        name: 'نوشن (Notion)',
        icon: 'notion',
        deepLink: 'notion://',
        fallbackUrl: 'https://www.notion.so/',
        note: 'المشاريع والمستندات',
      },
      {
        id: 'app-drive',
        name: 'جوجل درايف',
        icon: 'google_drive',
        deepLink: 'https://drive.google.com/',
        note: 'الملفات السحابية',
      },
    ],
  },
  {
    id: 'plist-communication',
    title: 'قائمة التواصل والاتصال',
    icon: '💬',
    color: 'indigo',
    apps: [
      {
        id: 'app-whatsapp',
        name: 'واتساب',
        icon: 'whatsapp',
        deepLink: 'whatsapp://send',
        fallbackUrl: 'https://wa.me/',
        note: 'المحادثات الفورية',
      },
      {
        id: 'app-telegram',
        name: 'تيليجرام',
        icon: 'telegram',
        deepLink: 'tg://resolve',
        fallbackUrl: 'https://t.me/',
        note: 'القنوات والرسائل',
      },
      {
        id: 'app-gmail',
        name: 'البريد الإلكتروني',
        icon: 'gmail',
        deepLink: 'mailto:',
        fallbackUrl: 'https://mail.google.com/',
        note: 'كتابة رسالة بريد',
      },
      {
        id: 'app-phone',
        name: 'الهاتف والاتصال',
        icon: 'phone',
        deepLink: 'tel:',
        note: 'فتح لوحة الاتصال',
      },
    ],
  },
  {
    id: 'plist-daily',
    title: 'قائمة الأدوات واليومية',
    icon: '🧭',
    color: 'amber',
    apps: [
      {
        id: 'app-maps',
        name: 'خرائط جوجل',
        icon: 'google_maps',
        deepLink: 'https://maps.google.com/',
        note: 'الملاحة والطرق',
      },
      {
        id: 'app-youtube',
        name: 'يوتيوب',
        icon: 'youtube',
        deepLink: 'vnd.youtube://',
        fallbackUrl: 'https://www.youtube.com/',
        note: 'المحاضرات والفيديو',
      },
      {
        id: 'app-sms',
        name: 'الرسائل النصية',
        icon: 'sms',
        deepLink: 'sms:',
        note: 'فتح تطبيق الرسائل',
      },
      {
        id: 'app-translate',
        name: 'ترجمة جوجل',
        icon: 'google_translate',
        deepLink: 'https://translate.google.com/',
        note: 'الترجمة الفورية',
      },
    ],
  },
];

export const POPULAR_PHONE_APP_PRESETS: Array<{
  name: string;
  icon: string;
  deepLink: string;
  fallbackUrl?: string;
  note: string;
}> = [
  { name: 'واتساب', icon: 'whatsapp', deepLink: 'whatsapp://send', fallbackUrl: 'https://wa.me/', note: 'المحادثات' },
  { name: 'تيليجرام', icon: 'telegram', deepLink: 'tg://resolve', fallbackUrl: 'https://t.me/', note: 'الرسائل والقنوات' },
  { name: 'ترتيل', icon: 'tarteel', deepLink: 'https://tarteel.ai/', note: 'مراجعة القرآن' },
  { name: 'نوشن', icon: 'notion', deepLink: 'notion://', fallbackUrl: 'https://www.notion.so/', note: 'الملاحظات والمشاريع' },
  { name: 'يوتيوب', icon: 'youtube', deepLink: 'vnd.youtube://', fallbackUrl: 'https://www.youtube.com/', note: 'الفيديو' },
  { name: 'إنستغرام', icon: 'instagram', deepLink: 'instagram://', fallbackUrl: 'https://www.instagram.com/', note: 'التواصل' },
  { name: 'منصة X', icon: 'x', deepLink: 'twitter://', fallbackUrl: 'https://x.com/', note: 'الأخبار' },
  { name: 'سبوتيفاي', icon: 'spotify', deepLink: 'spotify://', fallbackUrl: 'https://open.spotify.com/', note: 'الصوتيات والبودكاست' },
  { name: 'خرائط جوجل', icon: 'google_maps', deepLink: 'https://maps.google.com/', note: 'الملاحة' },
  { name: 'البريد', icon: 'gmail', deepLink: 'mailto:', fallbackUrl: 'https://mail.google.com/', note: 'تطبيق البريد' },
  { name: 'الهاتف', icon: 'phone', deepLink: 'tel:', note: 'لوحة الاتصال' },
  { name: 'الرسائل', icon: 'sms', deepLink: 'sms:', note: 'تطبيق الرسائل' },
];
