"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { LanguageToggle } from "@/components/common/language-toggle";
import { useI18n } from "@/providers/i18n-provider";

function isClientOrderRoute(pathname: string) {
  if (/^\/\d+(\/|$)/.test(pathname)) {
    return true;
  }
  return pathname.startsWith("/commande/") || pathname.startsWith("/appel-serveur/");
}

function isStaffRoute(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/proprio") ||
    pathname.startsWith("/cuisine") ||
    pathname.startsWith("/serveur")
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { messages } = useI18n();

  // Client menu/order pages: just the logo + language toggle.
  if (isClientOrderRoute(pathname)) {
    return (
      <header className="sticky top-0 z-30 border-b border-[var(--color-light-gray)] bg-[var(--color-cream)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
          <span className="min-w-0 font-logo text-xl leading-none text-[var(--color-dark-green)] sm:text-2xl">
            L’Adresse Dakar
          </span>
          <LanguageToggle />
        </div>
      </header>
    );
  }

  // Staff pages (Gérant / Cuisine): dashboard link + logout.
  if (isStaffRoute(pathname)) {
    const onDashboard = pathname.startsWith("/admin");
    return (
      <header className="sticky top-0 z-30 border-b border-[var(--color-light-gray)] bg-[var(--color-cream)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/admin" className="font-logo text-2xl text-[var(--color-dark-green)]">
            L’Adresse Dakar
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            {!onDashboard ? (
              <Link
                href="/admin"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-dark-green)] transition-colors hover:bg-[var(--color-light-gray)]"
              >
                {messages.nav.dashboard}
              </Link>
            ) : null}
            <a
              href="/staff/logout"
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-dark-green)] transition-colors hover:bg-[var(--color-light-gray)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              {messages.nav.logout}
            </a>
            <LanguageToggle />
          </nav>
        </div>
      </header>
    );
  }

  // Public pages (home): logo + discreet team area link.
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-light-gray)] bg-[var(--color-cream)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="font-logo text-2xl text-[var(--color-dark-green)]">
          L’Adresse Dakar
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/staff/login"
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-dark-green)] transition-colors hover:bg-[var(--color-light-gray)]"
          >
            {messages.nav.staffArea}
          </Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
