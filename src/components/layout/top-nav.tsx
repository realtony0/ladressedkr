"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LanguageToggle } from "@/components/common/language-toggle";
import { cn } from "@/lib/helpers/cn";
import { useI18n } from "@/providers/i18n-provider";

const links = [
  { href: "/cuisine", key: "kitchen" as const },
  { href: "/admin", key: "admin" as const },
  { href: "/proprio", key: "owner" as const },
  { href: "/proprio/rapports", key: "reports" as const },
  { href: "/staff/login", key: "staffLogin" as const },
];

function isActiveLink(pathname: string, href: string) {
  if (href === "/proprio") {
    return pathname === "/proprio" || pathname === "/proprio/dashboard";
  }

  if (href === "/staff/login") {
    return pathname.startsWith("/staff");
  }

  return pathname.startsWith(href);
}

function isClientOrderRoute(pathname: string) {
  if (/^\/\d+(\/|$)/.test(pathname)) {
    return true;
  }
  return pathname.startsWith("/commande/") || pathname.startsWith("/appel-serveur/");
}

export function TopNav() {
  const pathname = usePathname();
  const { messages } = useI18n();
  const clientRoute = isClientOrderRoute(pathname);

  if (clientRoute) {
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

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-light-gray)] bg-[var(--color-cream)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="font-logo text-2xl text-[var(--color-dark-green)]">
          L’Adresse Dakar
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                isActiveLink(pathname, link.href)
                  ? "bg-[var(--color-dark-green)] text-white"
                  : "bg-white text-[var(--color-dark-green)] hover:bg-[var(--color-light-gray)]",
              )}
            >
              {messages.nav[link.key]}
            </Link>
          ))}
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
