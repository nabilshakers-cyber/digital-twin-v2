import React, { useId } from 'react';

export type OfficialPhoneAppKind =
  | 'whatsapp'
  | 'telegram'
  | 'tarteel'
  | 'quran'
  | 'hisnmuslim'
  | 'prayer'
  | 'google_calendar'
  | 'google_keep'
  | 'notion'
  | 'google_drive'
  | 'gmail'
  | 'phone'
  | 'google_maps'
  | 'youtube'
  | 'sms'
  | 'google_translate'
  | 'instagram'
  | 'x'
  | 'spotify';

export const OFFICIAL_PHONE_APP_ICONS: ReadonlyArray<OfficialPhoneAppKind> = [
  'whatsapp',
  'telegram',
  'gmail',
  'phone',
  'sms',
  'tarteel',
  'quran',
  'hisnmuslim',
  'prayer',
  'google_calendar',
  'google_keep',
  'notion',
  'google_drive',
  'google_maps',
  'youtube',
  'google_translate',
  'instagram',
  'x',
  'spotify',
];

const OFFICIAL_ICON_SET = new Set<string>(OFFICIAL_PHONE_APP_ICONS);

const LEGACY_UPGRADEABLE_ICONS = new Set<string>([
  '',
  '💚',
  '✈️',
  '🎙️',
  '📖',
  '🤲',
  '🕰️',
  '📅',
  '📝',
  '📓',
  '📁',
  '✉️',
  '📞',
  '🗺️',
  '▶️',
  '💭',
  '🌐',
  '📸',
  '𝕏',
  '🎵',
  '📱',
  '💬',
  '📨',
]);

export function resolveOfficialPhoneAppKind(params: {
  id?: string;
  name?: string;
  icon?: string;
  deepLink?: string;
}): OfficialPhoneAppKind | null {
  const { id = '', name = '', icon = '', deepLink = '' } = params;

  if (OFFICIAL_ICON_SET.has(icon)) {
    return icon as OfficialPhoneAppKind;
  }

  if (!LEGACY_UPGRADEABLE_ICONS.has(icon)) {
    return null;
  }

  const normalizedName = name.trim().toLowerCase();
  const normalizedLink = deepLink.trim().toLowerCase();

  if (
    id === 'app-whatsapp' ||
    normalizedName.includes('واتساب') ||
    normalizedName.includes('whatsapp') ||
    normalizedLink.startsWith('whatsapp:') ||
    normalizedLink.includes('wa.me')
  ) {
    return 'whatsapp';
  }

  if (
    id === 'app-telegram' ||
    normalizedName.includes('تيليجرام') ||
    normalizedName.includes('تيلجرام') ||
    normalizedName.includes('تلجرام') ||
    normalizedName.includes('تليجرام') ||
    normalizedName.includes('telegram') ||
    normalizedLink.startsWith('tg:') ||
    normalizedLink.includes('t.me') ||
    normalizedLink.includes('telegram.')
  ) {
    return 'telegram';
  }

  if (
    id === 'app-tarteel' ||
    normalizedName.includes('ترتيل') ||
    normalizedName.includes('tarteel') ||
    normalizedLink.includes('tarteel')
  ) {
    return 'tarteel';
  }

  if (
    id === 'app-quran' ||
    normalizedName.includes('المصحف') ||
    normalizedName.includes('quran') ||
    normalizedLink.includes('quran.com')
  ) {
    return 'quran';
  }

  if (
    id === 'app-athkari' ||
    normalizedName.includes('حصن المسلم') ||
    normalizedLink.includes('hisnmuslim')
  ) {
    return 'hisnmuslim';
  }

  if (
    id === 'app-prayer' ||
    normalizedName.includes('مواقيت الصلاة') ||
    normalizedLink.includes('islamicfinder')
  ) {
    return 'prayer';
  }

  if (
    id === 'app-calendar' ||
    normalizedName.includes('تقويم جوجل') ||
    normalizedName.includes('calendar') ||
    normalizedLink.includes('calendar.google')
  ) {
    return 'google_calendar';
  }

  if (
    id === 'app-keep' ||
    normalizedName.includes('keep') ||
    normalizedName.includes('كيب') ||
    normalizedLink.includes('keep.google')
  ) {
    return 'google_keep';
  }

  if (
    id === 'app-notion' ||
    normalizedName.includes('نوشن') ||
    normalizedName.includes('notion') ||
    normalizedLink.includes('notion')
  ) {
    return 'notion';
  }

  if (
    id === 'app-drive' ||
    normalizedName.includes('جوجل درايف') ||
    normalizedName.includes('درايف') ||
    normalizedLink.includes('drive.google')
  ) {
    return 'google_drive';
  }

  if (
    id === 'app-gmail' ||
    normalizedName.includes('البريد') ||
    normalizedName.includes('جيميل') ||
    normalizedName.includes('gmail') ||
    normalizedLink.startsWith('mailto:') ||
    normalizedLink.includes('mail.google')
  ) {
    return 'gmail';
  }

  if (
    id === 'app-phone' ||
    normalizedName.includes('الهاتف') ||
    normalizedLink.startsWith('tel:')
  ) {
    return 'phone';
  }

  if (
    id === 'app-maps' ||
    normalizedName.includes('خرائط جوجل') ||
    normalizedName.includes('خرائط') ||
    normalizedLink.includes('maps.google')
  ) {
    return 'google_maps';
  }

  if (
    id === 'app-youtube' ||
    normalizedName.includes('يوتيوب') ||
    normalizedName.includes('youtube') ||
    normalizedLink.includes('youtube')
  ) {
    return 'youtube';
  }

  if (
    id === 'app-sms' ||
    normalizedName.includes('الرسائل') ||
    normalizedLink.startsWith('sms:')
  ) {
    return 'sms';
  }

  if (
    id === 'app-translate' ||
    normalizedName.includes('ترجمة جوجل') ||
    normalizedName.includes('ترجمة') ||
    normalizedLink.includes('translate.google')
  ) {
    return 'google_translate';
  }

  if (
    normalizedName.includes('إنستغرام') ||
    normalizedName.includes('انستغرام') ||
    normalizedName.includes('instagram') ||
    normalizedLink.includes('instagram')
  ) {
    return 'instagram';
  }

  if (
    normalizedName.includes('منصة x') ||
    normalizedName.includes('تويتر') ||
    normalizedLink.includes('twitter') ||
    normalizedLink.includes('x.com')
  ) {
    return 'x';
  }

  if (
    normalizedName.includes('سبوتيفاي') ||
    normalizedName.includes('spotify') ||
    normalizedLink.includes('spotify')
  ) {
    return 'spotify';
  }

  return null;
}

export function normalizeLegacyPhoneAppIcon(params: {
  id?: string;
  name?: string;
  icon?: string;
  deepLink?: string;
}): string {
  const official = resolveOfficialPhoneAppKind(params);
  if (official) return official;
  return params.icon || '📱';
}

export const WhatsAppOfficialIcon: React.FC<{ className?: string }> = ({
  className = 'w-6 h-6',
}) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="WhatsApp">
    <rect width="32" height="32" rx="8" fill="#25D366" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.3 25.5L7.64 20.5A10 10 0 1 1 11.3 24.16L6.3 25.5ZM8.55 23.25L12.01 22.37A8.1 8.1 0 1 0 9.43 19.79L8.55 23.25Z"
      fill="#FFFFFF"
    />
    <path
      d="M13.3 10.95C13.05 10.45 12.8 10.45 12.5 10.45C12.25 10.45 11.95 10.45 11.65 10.75C11.35 11.05 10.6 11.75 10.6 13.15C10.6 14.55 11.65 15.9 11.8 16.1C11.95 16.3 13.85 19.25 16.85 20.4C19.35 21.35 19.85 21.15 20.4 21.1C20.95 21.05 22.15 20.4 22.4 19.7C22.65 19.0 22.65 18.4 22.55 18.25C22.45 18.1 22.25 18.0 21.95 17.85C21.65 17.7 20.2 17.0 19.95 16.9C19.7 16.8 19.5 16.75 19.3 17.05C19.1 17.35 18.55 17.95 18.4 18.15C18.25 18.35 18.05 18.35 17.75 18.2C17.45 18.05 16.5 17.75 15.35 16.75C14.45 15.95 13.85 15.0 13.7 14.7C13.55 14.4 13.7 14.25 13.85 14.1C14.0 13.95 14.15 13.75 14.3 13.55C14.45 13.35 14.5 13.2 14.6 13.0C14.7 12.8 14.65 12.65 14.55 12.45C14.45 12.25 13.6 11.45 13.3 10.95Z"
      fill="#FFFFFF"
    />
  </svg>
);

export const TelegramOfficialIcon: React.FC<{ className?: string }> = ({
  className = 'w-6 h-6',
}) => {
  const gradId = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Telegram">
      <defs>
        <linearGradient id={gradId} x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2AABEE" />
          <stop offset="1" stopColor="#229ED9" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" fill={`url(#${gradId})`} />
      <path
        d="M22.9 9.7C23.4 9.5 23.85 9.85 23.7 10.5L21.05 22.95C20.85 23.8 20.3 24.0 19.55 23.6L15.55 20.65L13.6 22.55C13.35 22.8 13.15 23.0 12.7 23.0L13.0 18.9L20.45 12.15C20.78 11.85 20.38 11.7 19.95 11.95L10.75 17.75L6.8 16.5C5.95 16.25 5.93 15.65 7.0 15.23L22.9 9.7Z"
        fill="#FFFFFF"
      />
      <path
        d="M12.7 23.0L13.0 18.9L15.55 20.65L13.6 22.55C13.35 22.8 13.15 23.0 12.7 23.0Z"
        fill="#C8DAEA"
      />
      <path
        d="M13.0 18.9L20.45 12.15C20.78 11.85 20.38 11.7 19.95 11.95L10.75 17.75L13.0 18.9Z"
        fill="#EFF7FC"
        fillOpacity="0.35"
      />
    </svg>
  );
};

const GmailOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Gmail">
    <rect width="32" height="32" rx="8" fill="#FFFFFF" />
    <path d="M5.5 23.25H9V14.7L4.5 11.35V22.25C4.5 22.8 4.95 23.25 5.5 23.25Z" fill="#4285F4" />
    <path d="M23 23.25H26.5C27.05 23.25 27.5 22.8 27.5 22.25V11.35L23 14.7V23.25Z" fill="#34A853" />
    <path d="M23 8.75V14.7L27.5 11.35V9.95C27.5 8.2 25.5 7.2 24.1 8.25L23 8.75Z" fill="#FBBC04" />
    <path d="M9 14.7V8.75L16 14L23 8.75V14.7L16 19.95L9 14.7Z" fill="#EA4335" />
    <path d="M4.5 9.95V11.35L9 14.7V8.75L7.9 8.25C6.5 7.2 4.5 8.2 4.5 9.95Z" fill="#C5221F" />
  </svg>
);

const PhoneOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const gradId = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Phone">
      <defs>
        <linearGradient id={gradId} x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" fill={`url(#${gradId})`} />
      <path
        d="M11.6 9.3C11.3 8.75 11.0 8.75 10.65 8.75C10.35 8.75 10.0 8.8 9.65 9.15C9.3 9.5 8.4 10.35 8.4 12.1C8.4 13.85 9.65 15.55 9.85 15.8C10.05 16.05 12.4 19.75 16.15 21.2C19.25 22.4 19.9 22.15 20.6 22.05C21.3 21.95 22.8 21.15 23.1 20.3C23.4 19.45 23.4 18.7 23.3 18.5C23.2 18.3 22.95 18.18 22.55 17.98C22.15 17.78 20.35 16.9 20.05 16.78C19.75 16.66 19.5 16.6 19.25 16.98C19.0 17.35 18.3 18.15 18.1 18.4C17.9 18.65 17.65 18.68 17.28 18.48C16.9 18.28 15.7 17.9 14.25 16.62C13.15 15.65 12.4 14.42 12.2 14.05C12.0 13.68 12.18 13.48 12.38 13.28C12.55 13.1 12.75 12.83 12.95 12.6C13.15 12.38 13.2 12.18 13.32 11.93C13.45 11.68 13.38 11.48 13.25 11.23C13.12 10.98 11.95 9.95 11.6 9.3Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};

const SmsOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Messages">
    <rect width="32" height="32" rx="8" fill="#1A73E8" />
    <path
      d="M7 9.5C7 8.4 7.9 7.5 9 7.5H23C24.1 7.5 25 8.4 25 9.5V19.5C25 20.6 24.1 21.5 23 21.5H12.2L8 25.2C7.45 25.68 7 25.35 7 24.6V9.5Z"
      fill="#FFFFFF"
    />
    <rect x="10.5" y="11.8" width="11" height="1.9" rx="0.95" fill="#1A73E8" />
    <rect x="10.5" y="15.3" width="7.8" height="1.9" rx="0.95" fill="#4285F4" />
  </svg>
);

const GoogleCalendarOfficialIcon: React.FC<{ className?: string }> = ({
  className = 'w-6 h-6',
}) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Google Calendar">
    <rect width="32" height="32" rx="8" fill="#FFFFFF" />
    <rect x="4.5" y="4.5" width="23" height="23" rx="3.5" fill="#FFFFFF" />
    <path d="M8 4.5H24V9.5H4.5V8C4.5 6.07 6.07 4.5 8 4.5Z" fill="#4285F4" />
    <path d="M4.5 9.5H9.5V22.5H4.5V9.5Z" fill="#4285F4" />
    <path d="M22.5 9.5H27.5V22.5H22.5V9.5Z" fill="#FBBC04" />
    <path d="M9.5 22.5H22.5V27.5H9.5V22.5Z" fill="#34A853" />
    <path d="M4.5 22.5H9.5V27.5H8C6.07 27.5 4.5 25.93 4.5 24V22.5Z" fill="#1967D2" />
    <path d="M22.5 22.5H27.5L22.5 27.5V22.5Z" fill="#EA4335" />
    <path d="M24 4.5C25.93 4.5 27.5 6.07 27.5 8V9.5H22.5V4.5H24Z" fill="#1967D2" />
    <rect x="9.5" y="9.5" width="13" height="13" fill="#FFFFFF" />
    <text
      x="16"
      y="19.3"
      textAnchor="middle"
      fill="#1A73E8"
      fontSize="9.5"
      fontWeight="800"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      31
    </text>
  </svg>
);

const GoogleKeepOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Google Keep">
    <path
      d="M7 4.5H20.5L26.5 10.5V25C26.5 26.38 25.38 27.5 24 27.5H7C5.62 27.5 4.5 26.38 4.5 25V7C4.5 5.62 5.62 4.5 7 4.5Z"
      fill="#FBBC04"
    />
    <path d="M20.5 4.5V9.2C20.5 9.92 21.08 10.5 21.8 10.5H26.5L20.5 4.5Z" fill="#F29900" />
    <path
      d="M15.5 10.8C12.95 10.8 10.9 12.85 10.9 15.4C10.9 17.08 11.8 18.55 13.15 19.35V21C13.15 21.45 13.5 21.8 13.95 21.8H17.05C17.5 21.8 17.85 21.45 17.85 21V19.35C19.2 18.55 20.1 17.08 20.1 15.4C20.1 12.85 18.05 10.8 15.5 10.8Z"
      fill="#FFFFFF"
    />
    <rect x="13.5" y="22.8" width="4" height="1.5" rx="0.75" fill="#FFFFFF" />
  </svg>
);

const NotionOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Notion">
    <rect width="32" height="32" rx="8" fill="#FFFFFF" />
    <path
      d="M6.2 7.2L20.6 6.1C21.8 6.0 22.3 6.3 23.1 6.9L25.8 8.9C26.3 9.3 26.5 9.5 26.5 10.1V23.8C26.5 24.8 26.0 25.4 24.9 25.5L9.5 26.4C8.6 26.4 8.2 26.2 7.6 25.5L5.7 23.0C5.2 22.3 5.0 21.9 5.0 21.1V8.6C5.0 7.7 5.4 7.3 6.2 7.2Z"
      fill="#FFFFFF"
      stroke="#191919"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M5.4 7.7L8.6 10.2H25.9" stroke="#191919" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M8.6 10.2V26.2" stroke="#191919" strokeWidth="1.4" />
    <path
      d="M12.3 21.6V14.2H14.1L18.4 19.6V14.2H20.1V21.6H18.4L14.0 16.0V21.6H12.3Z"
      fill="#191919"
    />
  </svg>
);

const GoogleDriveOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Google Drive">
    <rect width="32" height="32" rx="8" fill="#FFFFFF" />
    <path d="M12.1 6.5H19.9L27.2 19.1H19.4L12.1 6.5Z" fill="#FBBC04" />
    <path d="M4.8 19.1L12.1 6.5L16 13.2L8.7 25.8L4.8 19.1Z" fill="#34A853" />
    <path d="M8.7 25.8L12.6 19.1H27.2L23.3 25.8H8.7Z" fill="#4285F4" />
    <path d="M19.9 6.5L16 13.2L19.4 19.1H27.2L19.9 6.5Z" fill="#EA4335" fillOpacity="0.9" />
    <path d="M8.7 25.8L12.6 19.1L16 13.2L12.1 20.0L8.7 25.8Z" fill="#0F9D58" />
  </svg>
);

const GoogleMapsOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Google Maps">
    <rect width="32" height="32" rx="8" fill="#FFFFFF" />
    <path
      d="M16 4.5C11.4 4.5 7.7 8.2 7.7 12.8C7.7 18.3 14.5 24.4 15.6 27.1C15.8 27.5 16.2 27.5 16.4 27.1C17.5 24.4 24.3 18.3 24.3 12.8C24.3 8.2 20.6 4.5 16 4.5Z"
      fill="#4285F4"
    />
    <path d="M16 4.5C12.8 4.5 10.0 6.3 8.6 9.0L14.2 14.6L19.5 5.3C18.4 4.8 17.2 4.5 16 4.5Z" fill="#EA4335" />
    <path d="M8.6 9.0C8.0 10.1 7.7 11.4 7.7 12.8C7.7 15.2 9.0 17.8 10.8 20.2L16.5 14.5L8.6 9.0Z" fill="#FBBC04" />
    <path d="M10.8 20.2C12.9 22.9 15.1 25.5 15.6 27.1C15.8 27.5 16.2 27.5 16.4 27.1C17.1 25.3 20.1 22.1 22.1 19.0L16 15.2L10.8 20.2Z" fill="#34A853" />
    <circle cx="16" cy="12.6" r="3.4" fill="#FFFFFF" />
  </svg>
);

const YouTubeOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="YouTube">
    <rect x="2" y="6" width="28" height="20" rx="6" fill="#FF0000" />
    <path d="M13.2 11.3L21.2 16L13.2 20.7V11.3Z" fill="#FFFFFF" />
  </svg>
);

const GoogleTranslateOfficialIcon: React.FC<{ className?: string }> = ({
  className = 'w-6 h-6',
}) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Google Translate">
    <rect x="12" y="10" width="16" height="18" rx="3" fill="#E2E8F0" />
    <rect x="4" y="4" width="17" height="19" rx="3" fill="#4285F4" />
    <text
      x="12.5"
      y="16.8"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="10"
      fontWeight="800"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      A
    </text>
    <text
      x="21.2"
      y="23.2"
      textAnchor="middle"
      fill="#475569"
      fontSize="8.5"
      fontWeight="700"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      ع
    </text>
  </svg>
);

const TarteelOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const gradId = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Tarteel">
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradId})`} />
      <rect x="13" y="7.5" width="6" height="10" rx="3" fill="#FFFFFF" />
      <path
        d="M9.8 14.5C9.8 17.9 12.6 20.5 16 20.5C19.4 20.5 22.2 17.9 22.2 14.5"
        stroke="#FFFFFF"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path d="M16 20.5V24.5M12.5 24.5H19.5" stroke="#FFFFFF" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
};

const QuranOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const gradId = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Quran">
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2CA4AB" />
          <stop offset="1" stopColor="#0D5C63" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradId})`} />
      <path
        d="M6.5 9.8C6.5 9.0 7.1 8.4 7.9 8.4H12.5C14.3 8.4 15.6 9.3 16 10.6C16.4 9.3 17.7 8.4 19.5 8.4H24.1C24.9 8.4 25.5 9.0 25.5 9.8V21.7C25.5 22.5 24.9 23.1 24.1 23.1H19.2C17.7 23.1 16.5 23.8 16 24.8C15.5 23.8 14.3 23.1 12.8 23.1H7.9C7.1 23.1 6.5 22.5 6.5 21.7V9.8Z"
        fill="#FFFFFF"
      />
      <path d="M16 10.6V24.5" stroke="#0D5C63" strokeWidth="1.6" />
      <path d="M9.3 12.8H13.5M9.3 16.0H13.5M18.5 12.8H22.7M18.5 16.0H22.7" stroke="#2CA4AB" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
};

const HisnMuslimOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const gradId = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="حصن المسلم">
      <defs>
        <linearGradient id={gradId} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#065F46" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradId})`} />
      <path
        d="M16 5.5L24.5 9V15.8C24.5 21.1 20.8 25.4 16 27C11.2 25.4 7.5 21.1 7.5 15.8V9L16 5.5Z"
        fill="#FFFFFF"
        fillOpacity="0.16"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M18.8 11.7C17.8 11.1 16.5 11.0 15.3 11.5C13.3 12.3 12.3 14.6 13.1 16.7C13.9 18.8 16.2 19.8 18.3 19.0C18.7 18.8 19.1 18.6 19.4 18.3C17.8 18.5 16.3 17.5 15.7 15.9C15.1 14.3 15.8 12.5 17.3 11.9C17.8 11.7 18.3 11.7 18.8 11.7Z"
        fill="#FDE68A"
      />
    </svg>
  );
};

const PrayerTimesOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const gradId = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="مواقيت الصلاة">
      <defs>
        <linearGradient id={gradId} x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E3A8A" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradId})`} />
      <path d="M16 6.8C16 6.8 10.5 10.6 10.5 15.5V24.5H21.5V15.5C21.5 10.6 16 6.8 16 6.8Z" fill="#FFFFFF" />
      <rect x="6.5" y="13.5" width="2.8" height="11" rx="0.8" fill="#93C5FD" />
      <rect x="22.7" y="13.5" width="2.8" height="11" rx="0.8" fill="#93C5FD" />
      <path d="M16 17.5C14.7 17.5 13.7 18.6 13.7 20V24.5H18.3V20C18.3 18.6 17.3 17.5 16 17.5Z" fill="#1E3A8A" />
      <circle cx="24" cy="7.5" r="2.2" fill="#FBBF24" />
    </svg>
  );
};

const InstagramOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const gradId = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Instagram">
      <defs>
        <radialGradient id={gradId} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FDF497" />
          <stop offset="5%" stopColor="#FDF497" />
          <stop offset="45%" stopColor="#FD5949" />
          <stop offset="60%" stopColor="#D6249F" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradId})`} />
      <rect x="6.5" y="6.5" width="19" height="19" rx="5.5" stroke="#FFFFFF" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="4.5" stroke="#FFFFFF" strokeWidth="2.2" />
      <circle cx="21.5" cy="10.5" r="1.35" fill="#FFFFFF" />
    </svg>
  );
};

const XOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="X">
    <rect width="32" height="32" rx="8" fill="#000000" />
    <path
      d="M18.1 14.3L24.8 6.5H23.2L17.4 13.3L12.7 6.5H7.3L14.3 16.7L7.3 24.9H8.9L15.0 17.7L20.0 24.9H25.4L18.1 14.3ZM15.9 16.8L15.2 15.8L9.5 7.7H12.0L16.6 14.2L17.3 15.2L23.2 23.7H20.7L15.9 16.8Z"
      fill="#FFFFFF"
    />
  </svg>
);

const SpotifyOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Spotify">
    <circle cx="16" cy="16" r="14.5" fill="#1DB954" />
    <path
      d="M9.5 12.7C13.9 11.4 19.6 11.7 23.4 13.9"
      stroke="#09110C"
      strokeWidth="2.3"
      strokeLinecap="round"
    />
    <path
      d="M10.6 16.5C14.3 15.4 18.9 15.7 22.1 17.6"
      stroke="#09110C"
      strokeWidth="2.0"
      strokeLinecap="round"
    />
    <path
      d="M11.6 20.1C14.6 19.2 18.2 19.5 20.8 21.0"
      stroke="#09110C"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

interface PhoneAppIconProps {
  id?: string;
  name?: string;
  icon: string;
  deepLink?: string;
  className?: string;
  emojiClassName?: string;
}

export const PhoneAppIcon: React.FC<PhoneAppIconProps> = ({
  id,
  name,
  icon,
  deepLink,
  className = 'w-6 h-6',
  emojiClassName = 'text-xl leading-none',
}) => {
  const official = resolveOfficialPhoneAppKind({ id, name, icon, deepLink });

  switch (official) {
    case 'whatsapp':
      return <WhatsAppOfficialIcon className={className} />;
    case 'telegram':
      return <TelegramOfficialIcon className={className} />;
    case 'gmail':
      return <GmailOfficialIcon className={className} />;
    case 'phone':
      return <PhoneOfficialIcon className={className} />;
    case 'sms':
      return <SmsOfficialIcon className={className} />;
    case 'tarteel':
      return <TarteelOfficialIcon className={className} />;
    case 'quran':
      return <QuranOfficialIcon className={className} />;
    case 'hisnmuslim':
      return <HisnMuslimOfficialIcon className={className} />;
    case 'prayer':
      return <PrayerTimesOfficialIcon className={className} />;
    case 'google_calendar':
      return <GoogleCalendarOfficialIcon className={className} />;
    case 'google_keep':
      return <GoogleKeepOfficialIcon className={className} />;
    case 'notion':
      return <NotionOfficialIcon className={className} />;
    case 'google_drive':
      return <GoogleDriveOfficialIcon className={className} />;
    case 'google_maps':
      return <GoogleMapsOfficialIcon className={className} />;
    case 'youtube':
      return <YouTubeOfficialIcon className={className} />;
    case 'google_translate':
      return <GoogleTranslateOfficialIcon className={className} />;
    case 'instagram':
      return <InstagramOfficialIcon className={className} />;
    case 'x':
      return <XOfficialIcon className={className} />;
    case 'spotify':
      return <SpotifyOfficialIcon className={className} />;
    default:
      return <span className={emojiClassName}>{icon || '📱'}</span>;
  }
};
