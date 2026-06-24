import Link from "next/link";

import { Button } from "@/components/common/button";
import { PageShell } from "@/components/layout/page-shell";

export default function Home() {
  return (
    <PageShell
      title="L'Adresse Dakar"
      subtitle="Cuisine élégante entre esprit bistro parisien et fraîcheur africaine."
    >
      <div className="mx-auto max-w-xl text-center">
        <p className="text-base text-[var(--color-black)]/75">
          Découvrez notre carte et commandez directement depuis votre table.
        </p>

        <Link href="/1" className="mt-6 inline-block">
          <Button className="px-8 py-3 text-base">Voir le menu</Button>
        </Link>

        <p className="mt-10 text-sm text-[var(--color-black)]/55">
          Vous faites partie de l&apos;équipe ?{" "}
          <Link
            href="/staff/login"
            className="font-semibold text-[var(--color-dark-green)] underline"
          >
            Espace équipe
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
