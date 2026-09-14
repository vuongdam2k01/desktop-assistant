export type Locale = 'vi' | 'en';

export interface I18nResources {
  appTitle: string;
  appHeading: string;
  languageLabel: string;
  trayOpen: string;
  trayHidePet: string;
  trayShowPet: string;
  trayQuit: string;
  vietnamese: string;
  english: string;
  placeholderText: string;
}

export const RESOURCES: Record<Locale, I18nResources> = {
  vi: {
    appTitle: 'Desktop Assistant',
    appHeading: 'Trợ lý ảo để bàn',
    languageLabel: 'Ngôn ngữ',
    trayOpen: 'Mở app',
    trayHidePet: 'Ẩn pet',
    trayShowPet: 'Hiện pet',
    trayQuit: 'Thoát',
    vietnamese: 'Tiếng Việt',
    english: 'Tiếng Anh',
    placeholderText: 'Desktop Assistant (Pet Placeholder)',
  },
  en: {
    appTitle: 'Desktop Assistant',
    appHeading: 'Desktop Assistant',
    languageLabel: 'Language',
    trayOpen: 'Open app',
    trayHidePet: 'Hide pet',
    trayShowPet: 'Show pet',
    trayQuit: 'Quit',
    vietnamese: 'Vietnamese',
    english: 'English',
    placeholderText: 'Desktop Assistant (Pet Placeholder)',
  },
} as const;

export function normalizeLocale(rawLocale?: string): Locale {
  if (!rawLocale || typeof rawLocale !== 'string') return 'en';
  const lower = rawLocale.toLowerCase().trim();
  if (lower.startsWith('vi')) return 'vi';
  return 'en';
}
