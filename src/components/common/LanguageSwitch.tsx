import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import type { Language } from '../../lib/i18n/translations';
import { useTranslation } from '../../hooks/useTranslation';

export function LanguageSwitch() {
  const { language, setLanguage } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslation();

  // string traduzida
  const selectedLabel = t.common?.selected || 'Selecionado';

  // Agora usamos URL de SVG em vez de emoji
  const languages: { value: Language; label: string; flagUrl: string }[] = [
    {
      value: 'en',
      label: 'English',
      flagUrl: 'https://flagcdn.com/us.svg',
    },
    {
      value: 'pt',
      label: 'Português',
      flagUrl: 'https://flagcdn.com/br.svg',
    },
  ];

  const currentLanguage =
    languages.find((lang) => lang.value === language) ?? languages[0];

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-600 dark:text-gray-400" />

          {/* Bandeira atual */}
          <span className="relative inline-flex h-5 w-7 overflow-hidden rounded-sm ring-1 ring-gray-200 dark:ring-gray-700">
            <img
              src={currentLanguage.flagUrl}
              alt={currentLanguage.label}
              className="h-full w-full object-cover"
            />
          </span>

          <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 sm:block">
            {currentLanguage.label}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              {languages.map((lang, index) => (
                <motion.button
                  key={lang.value}
                  onClick={() => {
                    setLanguage(lang.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    language === lang.value
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ x: 4 }}
                >
                  {/* Bandeira na lista */}
                  <span className="relative inline-flex h-6 w-8 overflow-hidden rounded-sm ring-1 ring-gray-200 dark:ring-gray-700">
                    <img
                      src={lang.flagUrl}
                      alt={lang.label}
                      className="h-full w-full object-cover"
                    />
                  </span>

                  <div className="flex flex-col">
                    <span className="font-medium">{lang.label}</span>
                    {language === lang.value && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {selectedLabel}
                      </span>
                    )}
                  </div>

                  {language === lang.value && (
                    <motion.div
                      className="ml-auto h-2 w-2 rounded-full bg-green-500"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1 }}
                    />
                  )}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
