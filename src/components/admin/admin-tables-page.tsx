"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { APP_URL, DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import type { Table } from "@/types/domain";

interface TableRow extends Table {
  qr_data_url?: string;
}

export function AdminTablesPage() {
  const { messages } = useI18n();
  const { notifyError, notifyInfo, notifySuccess } = useNotifications();

  const [tables, setTables] = useState<TableRow[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentBaseUrl = useCallback(() => {
    const configuredBaseUrl = APP_URL.trim().replace(/\/+$/, "");
    const hasConfiguredPublicHost =
      configuredBaseUrl.length > 0 &&
      !configuredBaseUrl.includes("localhost") &&
      !configuredBaseUrl.includes("127.0.0.1");

    if (hasConfiguredPublicHost) {
      return configuredBaseUrl;
    }

    if (typeof window !== "undefined") {
      return window.location.origin;
    }

    return configuredBaseUrl || "http://localhost:3000";
  }, []);

  const tableQrUrl = useCallback(
    (numero: number) => `${currentBaseUrl()}/${numero}`,
    [currentBaseUrl],
  );

  const withQrImages = useCallback(
    async (rows: Table[]) =>
      Promise.all(
      rows.map(async (table) => {
        const url = table.qr_code || tableQrUrl(table.numero);
        const qr_data_url = await QRCode.toDataURL(url, {
          margin: 1,
          width: 220,
          color: {
            dark: "#1A1A1A",
            light: "#F5F2EC",
          },
        });

        return {
          ...table,
          qr_data_url,
        } satisfies TableRow;
      }),
    ),
    [tableQrUrl],
  );

  const loadTables = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
      .order("numero", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      notifyError("Chargement des tables impossible", loadError.message);
      setLoading(false);
      return;
    }

    const rows = ((data as Table[]) ?? []).map((table) => ({ ...table }));
    const nextTables = await withQrImages(rows);

    setTables(nextTables);
    setLoading(false);
  }, [notifyError, withQrImages]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("admin-tables-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => void loadTables())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTables]);

  async function addOrUpdateTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = getBrowserSupabase();
    const numero = Number(tableNumber);
    if (!supabase || !Number.isFinite(numero) || numero <= 0) {
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const qr = tableQrUrl(numero);

    const { error: upsertError } = await supabase.from("tables").upsert(
      {
        numero,
        qr_code: qr,
        statut: "active",
        restaurant_id: DEFAULT_RESTAURANT_ID,
      },
      {
        onConflict: "restaurant_id,numero",
      },
    );

    if (upsertError) {
      setError(upsertError.message);
      notifyError("Table non enregistrée", upsertError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(`Table ${numero} prête avec QR actif.`);
    notifySuccess("Table enregistrée", `Table ${numero} prête avec QR actif.`);
    setTableNumber("");
    setSubmitting(false);
    void loadTables();
  }

  async function regenerateQr(table: TableRow) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    setError(null);
    setSuccess(null);

    const freshQr = tableQrUrl(table.numero);
    const { error: updateError } = await supabase
      .from("tables")
      .update({
        qr_code: freshQr,
      })
      .eq("id", table.id)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);

    if (updateError) {
      setError(updateError.message);
      notifyError("QR non régénéré", updateError.message);
      return;
    }

    setSuccess(`QR régénéré pour la table ${table.numero}.`);
    notifySuccess("QR régénéré", `Table ${table.numero}`);
    void loadTables();
  }

  async function toggleTableStatus(table: TableRow) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    setError(null);
    setSuccess(null);

    const nextStatus = table.statut === "active" ? "inactive" : "active";

    const { error: updateError } = await supabase
      .from("tables")
      .update({
        statut: nextStatus,
      })
      .eq("id", table.id)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);

    if (updateError) {
      setError(updateError.message);
      notifyError("Statut QR non modifié", updateError.message);
      return;
    }

    setSuccess(nextStatus === "active" ? "QR réactivé." : "QR désactivé.");
    notifySuccess(nextStatus === "active" ? "QR réactivé" : "QR désactivé", `Table ${table.numero}`);
    void loadTables();
  }

  function printQr(table: TableRow) {
    if (!table.qr_data_url) {
      return;
    }

    const popup = window.open("", "_blank", "width=420,height=560");
    if (!popup) {
      notifyError("Impression bloquée", "Autorise les popups pour imprimer le QR.");
      return;
    }

    const targetUrl = table.qr_code || tableQrUrl(table.numero);

    popup.document.write(`
      <html>
        <head>
          <title>QR Table ${table.numero}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 24px; }
            img { width: 260px; height: 260px; }
          </style>
        </head>
        <body>
          <h1>L'Adresse Dakar</h1>
          <h2>Table ${table.numero}</h2>
          <img src="${table.qr_data_url}" alt="QR table ${table.numero}" />
          <p>${targetUrl}</p>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
    notifyInfo("Impression lancée", `Table ${table.numero}`);
  }

  return (
    <PageShell title={messages.admin.tableManagement} subtitle="QR code unique par table, impression et activation/désactivation instantanées.">
      {error ? <Card className="mb-4 border-[#9C3D3D] bg-[#fff5f5] text-sm text-[#8b2424]">{error}</Card> : null}
      {success ? <Card className="mb-4 border-[#7A9E7E] bg-[#eef7ef] text-sm text-[#1f5122]">{success}</Card> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardTitle className="font-heading text-3xl">{messages.admin.addTable}</CardTitle>
          <form className="mt-4 space-y-3" onSubmit={addOrUpdateTable}>
            <div>
              <FieldLabel>Numéro de table</FieldLabel>
              <TextInput
                type="number"
                min={1}
                value={tableNumber}
                onChange={(event) => setTableNumber(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? messages.common.loading : messages.common.save}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle className="font-heading text-3xl">Tables</CardTitle>
          {loading ? (
            <p className="mt-3 text-sm">{messages.common.loading}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {tables.map((table) => (
                <li key={table.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--color-dark-green)]">Table {table.numero}</p>
                      <p className="text-xs text-[var(--color-black)]/65">{table.qr_code || tableQrUrl(table.numero)}</p>
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          table.statut === "active" ? "text-[#225222]" : "text-[#8b2424]"
                        }`}
                      >
                        {table.statut === "active" ? "QR actif" : "QR désactivé"}
                      </p>
                    </div>
                    {table.qr_data_url ? (
                      <Image
                        src={table.qr_data_url}
                        alt={`QR table ${table.numero}`}
                        width={96}
                        height={96}
                        unoptimized
                        className="h-24 w-24 rounded-lg border border-[var(--color-light-gray)]"
                      />
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => void regenerateQr(table)}>
                      {messages.admin.generateQr}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => printQr(table)}>
                      {messages.admin.printQr}
                    </Button>
                    <Button
                      type="button"
                      variant={table.statut === "active" ? "danger" : "primary"}
                      onClick={() => void toggleTableStatus(table)}
                    >
                      {table.statut === "active" ? messages.admin.deactivateQr : messages.admin.enable}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
