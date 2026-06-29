"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { Brand } from "@/components/layout/brand";
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
          <Brand size="sm" />
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
          <Brand href="/admin" />

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

  // Public vitrine pages: showcase nav + discreet team area link.
  const vitrineLinks = [
    { href: "/", label: "Accueil" },
    { href: "/carte", label: "La carte" },
    { href: "/reservation", label: "Réserver" },
    { href: "/infos", label: "Infos" },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-light-gray)] bg-[var(--color-cream)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Brand href="/" />

        <nav className="flex flex-wrap items-center gap-1.5">
          {vitrineLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive(link.href)
                  ? "bg-[var(--color-dark-green)] text-white"
                  : "bg-white text-[var(--color-dark-green)] hover:bg-[var(--color-light-gray)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/staff/login"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--color-black)]/50 transition-colors hover:text-[var(--color-dark-green)]"
          >
            {messages.nav.staffArea}
          </Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
