import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from './translations';

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: (navigator.language.startsWith('uk') ? 'uk' : 'en') as Language,
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'language-storage',
    }
  )
);