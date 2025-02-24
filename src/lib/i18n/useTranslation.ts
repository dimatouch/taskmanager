import { useCallback } from 'react';
import { useLanguageStore } from './store';
import { translations, type TranslationPath } from './translations';

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const t = useCallback((path: TranslationPath) => {
    const keys = path.split('.');
    let value: any = translations[language];
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        console.warn(`Translation missing for key: ${path} in language: ${language}`);
        return path;
      }
    }
    
    return value;
  }, [language]);

  return { t, language, setLanguage };
}