import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, t as translate, getLanguageFromPreference } from '@/lib/i18n';
import { useAuth } from './AuthContext';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: Parameters<typeof translate>[0]) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const { profile } = useAuth();

  useEffect(() => {
    // Get language from profile preference or localStorage
    const savedLang = localStorage.getItem('preferred_language');
    const profileLang = profile?.preferred_language;
    
    const lang = getLanguageFromPreference(profileLang || savedLang);
    setLanguageState(lang);
  }, [profile?.preferred_language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);
  };

  const t = (key: Parameters<typeof translate>[0]) => translate(key, language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
