import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS, fr } from "date-fns/locale";

import type { Locale, OrderStatus, ServerCallReason } from "@/types/domain";

const locales = {
  fr,
  en: enUS,
} as const;

export function formatCurrency(value: number, locale: Locale = "fr") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-SN" : "en-US", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string, locale: Locale = "fr") {
  return format(new Date(value), "dd MMM yyyy · HH:mm", {
    locale: locales[locale],
  });
}

export function timeAgo(value: string, locale: Locale = "fr") {
  return formatDistanceToNowStrict(new Date(value), {
    addSuffix: true,
    locale: locales[locale],
  });
}

export function orderStatusLabel(status: OrderStatus, locale: Locale = "fr") {
  const frLabels: Record<OrderStatus, string> = {
    received: "Reçue",
    preparing: "En préparation",
    ready: "Prête",
  };

  const enLabels: Record<OrderStatus, string> = {
    received: "Received",
    preparing: "Preparing",
    ready: "Ready",
  };

  return locale === "fr" ? frLabels[status] : enLabels[status];
}

export function serverCallReasonLabel(reason: ServerCallReason, locale: Locale = "fr") {
  const labels = {
    fr: {
      addition: "Demander l'addition",
      aide: "Besoin d'aide",
      demande_speciale: "Demande spéciale",
    },
    en: {
      addition: "Request the bill",
      aide: "Need assistance",
      demande_speciale: "Special request",
    },
  };

  return labels[locale][reason];
}

export function normalizeAllergen(allergen: string) {
  return allergen
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
