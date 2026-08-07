"use client";

import Link from "next/link";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";
import { ClientFlowNav } from "@/components/orders/client-flow-nav";
import { useI18n } from "@/providers/i18n-provider";

// Appel cuisine désactivé pour l'instant, en même temps que l'envoi de
// commande en ligne. La page reste accessible (lien direct / historique)
// mais n'affiche plus qu'un message d'indisponibilité.
export function ServerCallPage({ tableId }: { tableId: string }) {
  const { locale, messages } = useI18n();

  return (
    <PageShell
      title={messages.client.callServer}
      subtitle={`${messages.common.table} ${tableId}`}
      className="pb-10"
    >
      <ClientFlowNav tableId={tableId} />

      <Card className="mx-auto max-w-xl">
        <CardTitle className="font-heading text-3xl">{messages.client.callServer}</CardTitle>

        <div className="mt-4 space-y-3">
          <p className="rounded-xl bg-[#f0ebe0] p-3 text-sm text-[var(--color-black)]/75">
            {locale === "fr"
              ? "Cette fonctionnalité n'est pas disponible pour le moment. Adresse-toi directement à un membre du personnel présent en salle."
              : "This feature isn't available right now. Please speak directly to a staff member on site."}
          </p>
          <Link href={`/${tableId}`}>
            <Button className="w-full">{messages.nav.menu}</Button>
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}
