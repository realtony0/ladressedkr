"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/helpers/cn";

const PERSONNEL_TABS = [
  { href: "/admin/personnel", label: "Planning service" },
  { href: "/admin/personnel/acces-cuisine", label: "Accès cuisine" },
  { href: "/admin/personnel/securite", label: "Sécurité admin" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/personnel") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function AdminPersonnelNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-light-gray)] bg-white p-2">
      {PERSONNEL_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-xl px-3 py-2 text-xs font-semibold transition-colors md:text-sm",
            isActive(pathname, tab.href)
              ? "bg-[var(--color-dark-green)] text-white"
              : "bg-[var(--color-cream)] text-[var(--color-dark-green)] hover:bg-[var(--color-light-gray)]",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
