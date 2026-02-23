import Link from "next/link";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";

const MODULES = [
  { href: "/admin/menu", label: "Menu & catégories" },
  { href: "/admin/tables", label: "Tables & QR codes" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/horaires", label: "Horaires service/brunch" },
  { href: "/admin/personnel", label: "Personnel · Planning" },
  { href: "/admin/personnel/acces-cuisine", label: "Personnel · Accès cuisine" },
  { href: "/admin/personnel/securite", label: "Personnel · Sécurité admin" },
];

export function AdminHomePage() {
  return (
    <PageShell title="Administration" subtitle="Page d'accueil admin avec un module = une page dédiée.">
      <Card>
        <CardTitle className="font-heading text-3xl">Modules admin</CardTitle>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {MODULES.map((module) => (
            <Link key={module.href} href={module.href}>
              <Button variant="secondary" className="w-full justify-start">
                {module.label}
              </Button>
            </Link>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
