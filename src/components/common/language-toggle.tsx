"use client";

import { Globe2 } from "lucide-react";

import { Button } from "@/components/common/button";
import { useI18n } from "@/providers/i18n-provider";
import type { Locale } from "@/types/domain";

const OPTIONS: Locale[] = ["fr", "en"];

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-light-gray)] bg-white px-1.5 py-1 sm:gap-2 sm:px-2">
      <Globe2 className="h-4 w-4 text-[var(--color-dark-green)]" />
      {OPTIONS.map((option) => (
        <Button
          key={option}
          type="button"
          variant={locale === option ? "primary" : "ghost"}
          className="rounded-full px-2.5 py-1 text-xs sm:px-3"
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
