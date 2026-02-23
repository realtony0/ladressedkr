"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";
import { ClientFlowNav } from "@/components/orders/client-flow-nav";
import { formatCurrency } from "@/lib/helpers/format";
import { pushOrderHistory } from "@/lib/helpers/session-history";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useCart } from "@/providers/cart-provider";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";

export function CartPage({ tableId }: { tableId: string }) {
  const router = useRouter();
  const { locale, messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();
  const { isReady, lines, subtotal, updateQuantity, removeLine, clearCart } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (line.pizzaSizePrice + line.accompanimentPrice) * line.quantity,
        0,
      ),
    [lines],
  );

  async function placeOrder() {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tableNumber: Number(tableId),
          restaurantId: DEFAULT_RESTAURANT_ID || undefined,
          lines: lines.map((line) => ({
            itemId: line.item.id,
            quantity: line.quantity,
            note: line.note,
            accompanimentId: line.accompanimentId,
            pizzaSizeId: line.pizzaSizeId,
          })),
        }),
      });

      const payload = (await response.json()) as { orderId?: string; error?: string };

      if (!response.ok || !payload.orderId) {
        const message = payload.error ?? "Impossible d'envoyer la commande pour le moment.";
        setSubmitting(false);
        setError(message);
        notifyError(locale === "fr" ? "Commande non envoyée" : "Order not sent", message);
        return;
      }

      pushOrderHistory(tableId, payload.orderId);
      clearCart();
      notifySuccess(
        locale === "fr" ? "Commande envoyée" : "Order placed",
        locale === "fr" ? `Suivi #${payload.orderId.slice(0, 8)}` : `Tracking #${payload.orderId.slice(0, 8)}`,
      );
      router.push(`/commande/${payload.orderId}?table=${tableId}`);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Impossible d'envoyer la commande pour le moment.";
      setSubmitting(false);
      setError(message);
      notifyError(locale === "fr" ? "Commande non envoyée" : "Order not sent", message);
    }
  }

  return (
    <PageShell
      title={messages.client.cart}
      subtitle={`${messages.common.table} ${tableId}`}
      className="pb-28 lg:pb-8"
    >
      <ClientFlowNav tableId={tableId} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardTitle className="font-heading text-3xl">{messages.client.cart}</CardTitle>
          {!isReady ? (
            <p className="mt-3 text-sm text-[var(--color-black)]/70">{messages.common.loading}</p>
          ) : lines.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-black)]/70">{messages.client.cartEmpty}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {lines.map((line) => (
                <li key={line.lineId} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-[var(--color-dark-green)]">{line.item.nom}</p>
                      {line.pizzaSizeLabel ? <p className="break-words text-xs text-[var(--color-black)]/65">Format: {line.pizzaSizeLabel}</p> : null}
                      {line.accompanimentLabel ? (
                        <p className="break-words text-xs text-[var(--color-black)]/65">Accompagnement: {line.accompanimentLabel}</p>
                      ) : null}
                      {line.note ? <p className="break-words text-xs text-[var(--color-black)]/65">Note: {line.note}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-[var(--color-dark-green)]">
                        {formatCurrency((line.pizzaSizePrice + line.accompanimentPrice) * line.quantity, locale)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="w-4 text-center text-sm font-bold">{line.quantity}</span>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 rounded-full p-0"
                          onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                        >
                          +
                        </Button>
                        <Button type="button" variant="danger" onClick={() => removeLine(line.lineId)}>
                          {messages.common.delete}
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardTitle className="font-heading text-3xl">{messages.common.total}</CardTitle>
            <p className="mt-3 text-2xl font-extrabold text-[var(--color-dark-green)]">{formatCurrency(total, locale)}</p>
            {error ? <p className="mt-2 rounded-xl bg-[#ffe4e4] p-2 text-sm text-[#8b2424]">{error}</p> : null}

            <Button
              type="button"
              className="mt-4 w-full"
              onClick={placeOrder}
              disabled={!isReady || submitting || lines.length === 0}
            >
              {submitting ? messages.common.loading : messages.client.orderNow}
            </Button>

            <Link href={`/${tableId}`} className="mt-3 block">
              <Button type="button" variant="secondary" className="w-full">
                {messages.nav.menu}
              </Button>
            </Link>
          </Card>

          <Card>
            <CardTitle className="font-heading text-3xl">Récapitulatif</CardTitle>
            <p className="mt-2 text-sm text-[var(--color-black)]/70">
              {!isReady ? messages.common.loading : `${lines.length} article(s) · ${formatCurrency(subtotal, locale)}`}
            </p>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}
