import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Dynamic JSON imports
import zhCNJson from '../locales/zh-CN.json';
import enJson from '../locales/en.json';
import msJson from '../locales/ms.json';
import myJson from '../locales/my.json';
import zhTWJson from '../locales/zh-TW.json';
import hiJson from '../locales/hi.json';
import bnJson from '../locales/bn.json';

export type SupportedLanguage = 'zh-CN' | 'en' | 'ms' | 'my' | 'zh-TW' | 'hi' | 'bn';

export const LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'zh-CN', label: '中文 (简体)', flag: '🇨🇳' },
    { code: 'my', label: 'မြန်မာဘာသာ', flag: '🇲🇲' },
    { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'zh-TW', label: '中文 (繁體)', flag: '🇹🇼' },
    { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
    { code: 'bn', label: 'বাংলা', flag: '🇧🇩' }
];

const resources = {
    'zh-CN': { translation: zhCNJson },
    'en': { translation: enJson },
    'ms': { translation: msJson },
    'my': { translation: myJson },
    'zh-TW': { translation: zhTWJson },
    'hi': { translation: hiJson },
    'bn': { translation: bnJson }
};

const savedLang = (localStorage.getItem('packsecure_lang') as SupportedLanguage) || 'zh-CN';

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: savedLang,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        },
        react: {
            useSuspense: false
        }
    });

export const getCurrentLanguage = (): SupportedLanguage => {
    return (localStorage.getItem('packsecure_lang') as SupportedLanguage) || 'zh-CN';
};

export const t = (text: string, options?: Record<string, any>): string => {
    if (!text) return '';
    return i18n.t(text, { defaultValue: text, ...options });
};

export const changeLanguage = (langCode: SupportedLanguage) => {
    localStorage.setItem('packsecure_lang', langCode);
    i18n.changeLanguage(langCode);
    const event = new CustomEvent('packsecure:lang-change', { detail: langCode });
    window.dispatchEvent(event);
};

export default i18n;
