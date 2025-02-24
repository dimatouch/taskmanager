import { useLanguageStore } from '../../lib/i18n/store';
import { cn } from '../../lib/utils';

export function LanguageSwitcher() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage('en')}
        className={cn(
          "px-2 py-1 text-sm font-medium rounded-lg transition-colors",
          language === 'en'
            ? "bg-indigo-100 text-indigo-700"
            : "text-gray-600 hover:bg-gray-100"
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('uk')}
        className={cn(
          "px-2 py-1 text-sm font-medium rounded-lg transition-colors",
          language === 'uk'
            ? "bg-indigo-100 text-indigo-700"
            : "text-gray-600 hover:bg-gray-100"
        )}
      >
        UA
      </button>
    </div>
  );
}