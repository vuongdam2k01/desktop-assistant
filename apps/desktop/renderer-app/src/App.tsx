import React, { useState, useEffect } from 'react';
import { RESOURCES, type Locale } from '../../i18n/resources.js';

export const App: React.FC = () => {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    // Initial locale fetch
    if (window.desktopApi) {
      window.desktopApi.locale.get().then(current => {
        setLocale(current);
      }).catch(err => {
        console.error('Failed to get locale:', err);
      });

      // Subscribe to locale changes
      const unsubscribe = window.desktopApi.locale.onChanged(newLocale => {
        setLocale(newLocale);
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    if (window.desktopApi) {
      window.desktopApi.locale.set(newLocale).catch(err => {
        console.error('Failed to set locale:', err);
      });
    }
  };

  const r = RESOURCES[locale];

  return (
    <main className="min-h-screen p-8 flex flex-col items-center justify-center font-sans">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center tracking-tight">
          {r.appHeading}
        </h1>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <label htmlFor="language-group" className="text-sm font-medium text-slate-600">
            {r.languageLabel}:
          </label>

          <div
            id="language-group"
            className="inline-flex rounded-lg shadow-2xs border border-slate-200 p-0.5 bg-slate-50"
            role="group"
            aria-label={r.languageLabel}
          >
            <button
              type="button"
              onClick={() => handleSetLocale('vi')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                locale === 'vi'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r.vietnamese}
            </button>
            <button
              type="button"
              onClick={() => handleSetLocale('en')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                locale === 'en'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r.english}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
