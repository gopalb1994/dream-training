import { ui, defaultLang } from '../i18n/ui';

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/');
  if (lang in ui) return lang as keyof typeof ui;
  return defaultLang;
}

export function useTranslations(lang: keyof typeof ui) {
  return function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang][key] || ui[defaultLang][key];
  }
}

// Ensures links go to /es/module-2 if currently in Spanish
export function getLocalizedPath(path: string, lang: string) {
    // If English, return normal path
    if (lang === defaultLang) return path;
    // If other language, prepend language code
    return `/${lang}${path}`;
}