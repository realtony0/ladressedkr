"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, History, Menu, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/helpers/cn";
import { useCartOptional } from "@/providers/cart-provider";
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
  const cart = useCartOptional();
  const cartQty = cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

  const base = `/${tableId}`;
  const tabs = [
    { href: base, label: messages.nav.menu, icon: Menu, isRoot: true, badge: 0 },
    { href: `${base}/panier`, label: messages.client.cart, icon: ShoppingBag, isRoot: false, badge: cartQty },
    { href: `${base}/commandes`, label: messages.client.orderHistory, icon: History, isRoot: false, badge: 0 },
    { href: `${base}/appel`, label: messages.client.callServer, icon: BellRing, isRoot: false, badge: 0 },
  ];

  return (
    <nav className="scrollbar-none mb-5 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-[var(--color-light-gray)] bg-white p-1.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(pathname, tab.href, tab.isRoot);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors lg:text-sm",
              active
                ? "bg-[var(--color-dark-green)] text-white"
                : "bg-[var(--color-cream)] text-[var(--color-dark-green)] hover:bg-[var(--color-light-gray)]",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
            {tab.badge > 0 ? (
              <span
                className={cn(
                  "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  active ? "bg-white/25 text-white" : "bg-[var(--color-dark-green)] text-white",
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
