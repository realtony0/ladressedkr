"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, History, Menu, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/helpers/cn";
import { useI18n } from "@/providers/i18n-provider";

function isActive(pathname: string, href: string, isRoot: boolean) {
  if (isRoot) {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function ClientFlowNav({ tableId }: { tableId: string }) {
  const pathname = usePathname();
  const { messages } = useI18n();
  const base = `/${tableId}`;
  const tabs = [
    { href: base, label: messages.nav.menu, icon: Menu, isRoot: true },
    { href: `${base}/panier`, label: messages.client.cart, icon: ShoppingBag, isRoot: false },
    { href: `${base}/commandes`, label: messages.client.orderHistory, icon: History, isRoot: false },
    { href: `${base}/appel`, label: messages.client.callServer, icon: BellRing, isRoot: false },
  ];

  return (
    <>
      <nav className="mb-5 hidden flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-light-gray)] bg-white p-2 lg:flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors lg:text-sm",
                isActive(pathname, tab.href, tab.isRoot)
                  ? "bg-[var(--color-dark-green)] text-white"
                  : "bg-[var(--color-cream)] text-[var(--color-dark-green)] hover:bg-[var(--color-light-gray)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 gap-1 rounded-2xl border border-[var(--color-light-gray)] bg-white/98 p-1 shadow-xl backdrop-blur lg:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab.href, tab.isRoot);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold leading-tight transition-colors",
                active
                  ? "bg-[var(--color-dark-green)] text-white"
                  : "bg-[var(--color-cream)] text-[var(--color-dark-green)]",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
