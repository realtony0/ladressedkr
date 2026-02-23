"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { LOCAL_STORAGE_KEYS } from "@/lib/helpers/constants";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import type { Locale } from "@/types/domain";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Messages;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEYS.locale);
    if (stored === "fr" || stored === "en") {
      setLocale(stored);
      return;
    }

    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith("en")) {
      setLocale("en");
    }
  }, []);

  const setLocalePersisted = (nextLocale: Locale) => {
    setLocale(nextLocale);
    window.localStorage.setItem(LOCAL_STORAGE_KEYS.locale, nextLocale);
  };

  const value = useMemo(
    () => ({ locale, setLocale: setLocalePersisted, messages: getMessages(locale) }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
