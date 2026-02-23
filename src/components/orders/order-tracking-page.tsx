"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/common/button";
import { Badge, Card, CardTitle } from "@/components/common/card";
import { FieldLabel, Select, TextArea } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { ClientFlowNav } from "@/components/orders/client-flow-nav";
import { ORDER_STATUS_FLOW } from "@/lib/helpers/constants";
import { formatCurrency, formatDateTime, orderStatusLabel } from "@/lib/helpers/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";

interface OrderView {
  id: string;
  statut: "received" | "preparing" | "ready";
  heure: string;
  total: number;
  eta_minutes: number | null;
  table: { numero: number } | null;
  order_items: Array<{
    id: string;
    quantite: number;
    note: string | null;
    prix_unitaire: number;
    supplement: number;
    item: { nom: string } | null;
    accompaniment: { nom: string } | null;
    pizza_size: { taille: string } | null;
  }>;
}

export function OrderTrackingPage({ orderId, tableHint }: { orderId: string; tableHint?: string }) {
  const { locale, messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingValue, setRatingValue] = useState("5");
  const [comment, setComment] = useState("");
  const [ratingDone, setRatingDone] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      setLoading(true);
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("orders")
        .select(
          "id, statut, heure, total, eta_minutes, table:tables(numero), order_items(id, quantite, note, prix_unitaire, supplement, item:items(nom), accompaniment:accompaniments(nom), pizza_size:pizza_sizes(taille))",
        )
        .eq("id", orderId)
        .maybeSingle();

      setOrder((data as OrderView | null) ?? null);

      const { data: rating } = await supabase.from("ratings").select("id").eq("order_id", orderId).maybeSingle();
      setRatingDone(Boolean(rating));
      setLoading(false);
    }

    void loadOrder();
  }, [orderId]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload: { new: { statut: "received" | "preparing" | "ready"; eta_minutes: number | null } }) => {
          setOrder((current) =>
            current
              ? {
                  ...current,
                  statut: payload.new.statut,
                  eta_minutes: payload.new.eta_minutes,
                }
              : current,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

  async function submitRating() {
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          note: Number(ratingValue),
          commentaire: comment,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        notifyError(
          locale === "fr" ? "Avis non envoyé" : "Rating not submitted",
          payload.error ?? (locale === "fr" ? "Réessaie dans un instant." : "Please try again shortly."),
        );
        return;
      }

      setRatingDone(true);
      setComment("");
      notifySuccess(locale === "fr" ? "Merci pour votre avis" : "Thanks for your feedback");
    } catch (requestError) {
      notifyError(
        locale === "fr" ? "Avis non envoyé" : "Rating not submitted",
        requestError instanceof Error ? requestError.message : undefined,
      );
    }
  }

  if (loading) {
    return (
      <PageShell title={messages.client.orderTracking} className="pb-28 lg:pb-8">
        <Card>{messages.common.loading}</Card>
      </PageShell>
    );
  }

  if (!order) {
    return (
      <PageShell title={messages.client.orderTracking} className="pb-28 lg:pb-8">
        <Card>Commande introuvable.</Card>
      </PageShell>
    );
  }

  const tableForNav = tableHint ?? (order.table?.numero ? String(order.table.numero) : undefined);
  const currentStatusIndex = ORDER_STATUS_FLOW.indexOf(order.statut);

  return (
    <PageShell
      title={`${messages.client.orderTracking} #${order.id.slice(0, 8)}`}
      subtitle={`${messages.common.table} ${order.table?.numero ?? tableHint ?? "-"}`}
      className="pb-28 lg:pb-8"
    >
      {tableForNav ? <ClientFlowNav tableId={tableForNav} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="font-heading text-3xl">Statut</CardTitle>
            <Badge className="shrink-0">{orderStatusLabel(order.statut, locale)}</Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--color-black)]/70">{formatDateTime(order.heure, locale)}</p>
          {order.eta_minutes ? (
            <p className="mt-1 text-sm text-[var(--color-black)]/70">ETA: {order.eta_minutes} min</p>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {ORDER_STATUS_FLOW.map((status, index) => {
              const reached = index <= currentStatusIndex;
              const current = status === order.statut;
              return (
                <div
                  key={status}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    current
                      ? "border-[var(--color-dark-green)] bg-[var(--color-dark-green)] text-white"
                      : reached
                        ? "border-[var(--color-sage)] bg-[#eef4ee] text-[var(--color-dark-green)]"
                        : "border-[var(--color-light-gray)] bg-white text-[var(--color-black)]/55"
                  }`}
                >
                  {orderStatusLabel(status, locale)}
                </div>
              );
            })}
          </div>

          <ul className="mt-4 space-y-3">
            {order.order_items.map((line) => (
              <li key={line.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--color-dark-green)]">
                      {line.quantite} × {line.item?.nom}
                    </p>
                    {line.pizza_size?.taille ? (
                      <p className="break-words text-xs text-[var(--color-black)]/65">Format: {line.pizza_size.taille}</p>
                    ) : null}
                    {line.accompaniment?.nom ? (
                      <p className="break-words text-xs text-[var(--color-black)]/65">Accompagnement: {line.accompaniment.nom}</p>
                    ) : null}
                    {line.note ? <p className="break-words text-xs text-[var(--color-black)]/65">Note: {line.note}</p> : null}
                  </div>
                  <p className="shrink-0 font-bold text-[var(--color-dark-green)]">
                    {formatCurrency((line.prix_unitaire + line.supplement) * line.quantite, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardTitle className="font-heading text-3xl">{messages.common.total}</CardTitle>
            <p className="mt-2 text-2xl font-extrabold text-[var(--color-dark-green)]">{formatCurrency(order.total, locale)}</p>
            <Link href={`/${order.table?.numero ?? tableForNav ?? "1"}`} className="mt-4 block">
              <Button variant="secondary" className="w-full">
                {messages.nav.menu}
              </Button>
            </Link>
            {tableForNav ? (
              <>
                <Link href={`/${tableForNav}/commandes`} className="mt-2 block">
                  <Button variant="secondary" className="w-full">
                    {messages.client.orderHistory}
                  </Button>
                </Link>
                <Link href={`/${tableForNav}/appel`} className="mt-2 block">
                  <Button variant="secondary" className="w-full">
                    {messages.client.callServer}
                  </Button>
                </Link>
              </>
            ) : null}
          </Card>

          {order.statut === "ready" ? (
            <Card>
              <CardTitle className="font-heading text-3xl">{messages.client.rateMeal}</CardTitle>
              {ratingDone ? (
                <p className="mt-2 text-sm text-[var(--color-dark-green)]">Merci pour votre retour.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <FieldLabel>Étoiles</FieldLabel>
                    <Select value={ratingValue} onChange={(event) => setRatingValue(event.target.value)}>
                      <option value="5">5</option>
                      <option value="4">4</option>
                      <option value="3">3</option>
                      <option value="2">2</option>
                      <option value="1">1</option>
                    </Select>
                  </div>

                  <div>
                    <FieldLabel>Commentaire</FieldLabel>
                    <TextArea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
                  </div>

                  <Button onClick={submitRating} className="w-full">
                    {messages.client.submitRating}
                  </Button>
                </div>
              )}
            </Card>
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}
