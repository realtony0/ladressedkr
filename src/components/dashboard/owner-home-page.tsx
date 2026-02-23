import Link from "next/link";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";

const OWNER_MODULES = [
  { href: "/proprio/dashboard", label: "Dashboard analytics" },
  { href: "/proprio/rapports", label: "Rapports & exports" },
  { href: "/admin", label: "Administration" },
];

export function OwnerHomePage() {
  return (
    <PageShell title="Espace propriétaire" subtitle="Page d'accueil proprio, avec accès direct à chaque page métier.">
      <Card>
        <CardTitle className="font-heading text-3xl">Modules propriétaire</CardTitle>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {OWNER_MODULES.map((module) => (
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
