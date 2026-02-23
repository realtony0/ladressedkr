"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { formatCurrency, formatDateTime } from "@/lib/helpers/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";

interface ReportOrder {
  id: string;
  heure: string;
  total: number;
  statut: "received" | "preparing" | "ready";
  table: { numero: number } | null;
}

export function OwnerReportsPage() {
  const { locale, messages } = useI18n();
  const { notifyError, notifyInfo, notifySuccess } = useNotifications();

  const [fromDate, setFromDate] = useState(() => new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const fromIso = `${fromDate}T00:00:00.000Z`;
    const toIso = `${toDate}T23:59:59.999Z`;

    const { data } = await supabase
      .from("orders")
      .select("id, heure, total, statut, table:tables(numero)")
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
      .gte("heure", fromIso)
      .lte("heure", toIso)
      .order("heure", { ascending: false });

    type RawReportOrder = Omit<ReportOrder, "table"> & {
      table: ReportOrder["table"] | Array<NonNullable<ReportOrder["table"]>>;
    };

    const normalizedOrders = ((data ?? []) as unknown as RawReportOrder[]).map((order) => ({
      ...order,
      table: Array.isArray(order.table) ? (order.table[0] ?? null) : order.table,
    }));

    setOrders(normalizedOrders);
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const totalRevenue = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);

  function exportCsv() {
    const query = new URLSearchParams({ from: fromDate, to: toDate });
    window.open(`/api/export/csv?${query.toString()}`, "_blank");
    notifyInfo("Export CSV lancé");
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("L'Adresse Dakar - Rapport", 14, 18);
    doc.setFontSize(11);
    doc.text(`Période: ${fromDate} au ${toDate}`, 14, 26);
    doc.text(`CA total: ${formatCurrency(totalRevenue, locale)}`, 14, 33);

    autoTable(doc, {
      startY: 40,
      head: [["Commande", "Date", "Table", "Statut", "Montant"]],
      body: orders.map((order) => [
        `#${order.id.slice(0, 8)}`,
        formatDateTime(order.heure, locale),
        String(order.table?.numero ?? "-"),
        order.statut,
        formatCurrency(order.total, locale),
      ]),
      styles: {
        fontSize: 9,
      },
      headStyles: {
        fillColor: [45, 74, 45],
      },
    });

    doc.save(`rapport-ladresse-${fromDate}-${toDate}.pdf`);
    notifySuccess("Export PDF généré");
  }

  async function sendDailyReport() {
    setSending(true);
    try {
      const response = await fetch("/api/reports/daily?manual=true", { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        notifyError("Rapport non envoyé", payload.error ?? "Erreur serveur");
        setSending(false);
        return;
      }
      notifySuccess("Rapport journalier envoyé");
    } catch (error) {
      notifyError("Rapport non envoyé", error instanceof Error ? error.message : "Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell title={messages.nav.reports} subtitle="Exports CSV/PDF et envoi du rapport journalier automatique.">
      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-end">
          <div>
            <FieldLabel>Du</FieldLabel>
            <TextInput type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div>
            <FieldLabel>Au</FieldLabel>
            <TextInput type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <Button type="button" variant="secondary" onClick={exportCsv}>
            {messages.owner.exportCsv}
          </Button>
          <Button type="button" variant="secondary" onClick={exportPdf}>
            {messages.owner.exportPdf}
          </Button>
          <Button type="button" onClick={sendDailyReport} disabled={sending}>
            {sending ? messages.common.loading : messages.owner.dailyReport}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="font-heading text-3xl">Résumé</CardTitle>
          <p className="text-lg font-bold text-[var(--color-dark-green)]">{formatCurrency(totalRevenue, locale)}</p>
        </div>

        {loading ? (
          <p className="mt-3 text-sm">{messages.common.loading}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-[var(--color-light-gray)] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-dark-green)]">#{order.id.slice(0, 8)}</span>
                  <span>{formatCurrency(order.total, locale)}</span>
                </div>
                <p className="text-xs text-[var(--color-black)]/65">
                  {formatDateTime(order.heure, locale)} · Table {order.table?.numero ?? "-"} · {order.statut}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
