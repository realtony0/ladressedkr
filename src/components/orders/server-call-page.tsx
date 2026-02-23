"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, Select, TextArea } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { ClientFlowNav } from "@/components/orders/client-flow-nav";
import { SERVER_CALL_REASONS } from "@/lib/helpers/constants";
import { serverCallReasonLabel } from "@/lib/helpers/format";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import type { ServerCallReason } from "@/types/domain";

export function ServerCallPage({ tableId }: { tableId: string }) {
  const { locale, messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [reason, setReason] = useState<ServerCallReason>("addition");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCall() {
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/server-calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tableNumber: Number(tableId),
          restaurantId: DEFAULT_RESTAURANT_ID || undefined,
          motif: reason,
          details,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Impossible d'envoyer l'appel pour le moment.";
        setSending(false);
        setError(message);
        notifyError(locale === "fr" ? "Appel non envoyé" : "Call not sent", message);
        return;
      }

      setDone(true);
      setSending(false);
      notifySuccess(
        locale === "fr" ? "Cuisine notifiée" : "Kitchen notified",
        serverCallReasonLabel(reason, locale),
      );
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Impossible d'envoyer l'appel pour le moment.";
      setSending(false);
      setError(message);
      notifyError(locale === "fr" ? "Appel non envoyé" : "Call not sent", message);
    }
  }

  return (
    <PageShell
      title={messages.client.callServer}
      subtitle={`${messages.common.table} ${tableId} · Notification envoyée en temps réel au dashboard cuisine.`}
      className="pb-28 lg:pb-8"
    >
      <ClientFlowNav tableId={tableId} />

      <Card className="mx-auto max-w-xl">
        <CardTitle className="font-heading text-3xl">{messages.client.callServer}</CardTitle>

        {done ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-[#e5f6e5] p-3 text-sm text-[#225222]">La cuisine a été notifiée.</p>
            <Link href={`/${tableId}`}>
              <Button className="w-full">{messages.nav.menu}</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <FieldLabel>Motif</FieldLabel>
              <Select value={reason} onChange={(event) => setReason(event.target.value as ServerCallReason)}>
                {SERVER_CALL_REASONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {serverCallReasonLabel(entry, locale)}
                  </option>
                ))}
              </Select>
            </div>

            {reason === "demande_speciale" ? (
              <div>
                <FieldLabel>Détail</FieldLabel>
                <TextArea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={4}
                  placeholder={messages.client.specialRequestPlaceholder}
                />
              </div>
            ) : null}

            {error ? <p className="rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">{error}</p> : null}

            <Button className="w-full" onClick={submitCall} disabled={sending}>
              {sending ? messages.common.loading : messages.common.confirm}
            </Button>

            <Link href={`/${tableId}`}>
              <Button variant="secondary" className="w-full">
                {messages.nav.menu}
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
