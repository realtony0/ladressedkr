"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import {
  buildTableQrUrl,
  createTableAccessToken,
  extractTableAccessTokenFromQrCode,
} from "@/lib/helpers/table-access";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { APP_URL, DEFAULT_RESTAURANT_ID, QR_BASE_URL } from "@/lib/supabase/env";
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
    // A dedicated, owned QR domain always wins so printed codes stay valid forever.
    if (QR_BASE_URL) {
      return QR_BASE_URL.replace(/\/+$/, "");
    }

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
    (numero: number, accessToken?: string) => {
      if (!accessToken) {
        return `${currentBaseUrl()}/${numero}`;
      }
      return buildTableQrUrl({
        baseUrl: currentBaseUrl(),
        tableNumber: numero,
        accessToken,
      });
    },
    [currentBaseUrl],
  );

  const canonicalTableQrUrl = useCallback(
    (table: Pick<Table, "numero" | "qr_code" | "access_token">) => {
      const accessToken = table.access_token ?? extractTableAccessTokenFromQrCode(table.qr_code) ?? undefined;
      return tableQrUrl(table.numero, accessToken);
    },
    [tableQrUrl],
  );

  const withQrImages = useCallback(
    async (rows: Table[]) =>
      Promise.all(
      rows.map(async (table) => {
        const url = canonicalTableQrUrl(table);
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
    [canonicalTableQrUrl],
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

    const existingTable = tables.find((entry) => entry.numero === numero);
    const accessToken = existingTable?.access_token ?? createTableAccessToken();
    const qr = tableQrUrl(numero, accessToken);

    let upsertError: { message: string } | null = null;

    const upsertWithToken = await supabase.from("tables").upsert(
      {
        numero,
        qr_code: qr,
        access_token: accessToken,
        statut: "active",
        restaurant_id: DEFAULT_RESTAURANT_ID,
      },
      {
        onConflict: "restaurant_id,numero",
      },
    );

    upsertError = upsertWithToken.error;

    if (upsertError?.message?.toLowerCase().includes("access_token")) {
      const fallbackUpsert = await supabase.from("tables").upsert(
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
      upsertError = fallbackUpsert.error;
    }

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

    const freshAccessToken = createTableAccessToken();
    const freshQr = tableQrUrl(table.numero, freshAccessToken);
    let updateError: { message: string } | null = null;

    const updateWithToken = await supabase
      .from("tables")
      .update({
        qr_code: freshQr,
        access_token: freshAccessToken,
      })
      .eq("id", table.id)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);

    updateError = updateWithToken.error;

    if (updateError?.message?.toLowerCase().includes("access_token")) {
      const fallbackUpdate = await supabase
        .from("tables")
        .update({
          qr_code: freshQr,
        })
        .eq("id", table.id)
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
      updateError = fallbackUpdate.error;
    }

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

  function posterStyles() {
    return `
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; }
      .poster {
        width: 100%; min-height: 100vh; padding: 48px 40px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; page-break-after: always;
      }
      .poster:last-child { page-break-after: auto; }
      .logo { width: 96px; height: 96px; border-radius: 18px; }
      .brand { margin-top: 16px; font-size: 26px; letter-spacing: 1px; color: #2d4a2d; }
      .table { margin: 6px 0 26px; font-size: 44px; font-weight: bold; color: #2d4a2d; }
      .qrbox { padding: 18px; border: 2px solid #e7e2d6; border-radius: 20px; }
      .qr { width: 320px; height: 320px; display: block; }
      .cta { margin-top: 26px; font-size: 22px; color: #1a1a1a; }
      .url { margin-top: 12px; font-family: Arial, sans-serif; font-size: 14px; color: #9a9a9a; }
    `;
  }

  async function printPosters(rows: TableRow[]) {
    const popup = window.open("", "_blank");
    if (!popup) {
      notifyError("Impression bloquée", "Autorise les popups pour imprimer les QR.");
      return;
    }

    popup.document.write(
      "<html><body style=\"font-family:sans-serif;padding:32px;text-align:center\">Génération des affiches…</body></html>",
    );

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const toPrint = rows.filter((table) => table.statut === "active");

    const posters = await Promise.all(
      toPrint.map(async (table) => {
        const targetUrl = canonicalTableQrUrl(table);
        const qr = await QRCode.toDataURL(targetUrl, {
          margin: 1,
          width: 640,
          color: { dark: "#1A1A1A", light: "#FFFFFF" },
        });
        const display = targetUrl.replace(/^https?:\/\//, "");
        return { numero: table.numero, qr, display };
      }),
    );

    const body = posters
      .map(
        (poster) => `
        <div class="poster">
          <img class="logo" src="${origin}/brand/logo-mark.png" alt="L'Amazonia" />
          <div class="brand">L'Amazonia</div>
          <div class="table">Table ${poster.numero}</div>
          <div class="qrbox"><img class="qr" src="${poster.qr}" alt="QR table ${poster.numero}" /></div>
          <div class="cta">Scannez pour voir le menu<br/>et commander</div>
          <div class="url">${poster.display}</div>
        </div>`,
      )
      .join("");

    popup.document.open();
    popup.document.write(`<html><head><title>Affiches QR — L'Amazonia</title><style>${posterStyles()}</style></head><body>${body}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 400);
    notifyInfo("Impression prête", `${posters.length} affiche(s)`);
  }

  function printQr(table: TableRow) {
    void printPosters([table]);
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="font-heading text-3xl">Tables</CardTitle>
            {tables.some((table) => table.statut === "active") ? (
              <Button type="button" onClick={() => void printPosters(tables)}>
                Imprimer toutes les affiches
              </Button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--color-black)]/60">
            Une affiche par table (logo + QR), prête à imprimer et poser sur les tables.
          </p>
          {loading ? (
            <p className="mt-3 text-sm">{messages.common.loading}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {tables.map((table) => (
                <li key={table.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--color-dark-green)]">Table {table.numero}</p>
                      <p className="text-xs text-[var(--color-black)]/65">
                        {canonicalTableQrUrl(table)}
                      </p>
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
