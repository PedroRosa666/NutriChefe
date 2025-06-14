import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import type { Language } from '../../lib/i18n/translations';

export function LanguageSwitch() {
  const { language, setLanguage } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);

  const languages: { value: Language; label: string; flag: string }[] = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'pt', label: 'Português', flag: '🇧🇷' },
  ];

  const currentLanguage = languages.find(lang => lang.value === language);

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
          <span className="text-lg">{currentLanguage?.flag}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
            {currentLanguage?.label}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
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
              className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
            >
              {languages.map((lang, index) => (
                <motion.button
                  key={lang.value}
                  onClick={() => {
                    setLanguage(lang.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                    language === lang.value
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ x: 4 }}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <div className="flex flex-col">
                    <span className="font-medium">{lang.label}</span>
                    {language === lang.value && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Selecionado
                      </span>
                    )}
                  </div>
                  {language === lang.value && (
                    <motion.div
                      className="ml-auto w-2 h-2 bg-green-500 rounded-full"
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