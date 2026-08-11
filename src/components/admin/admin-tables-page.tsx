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

  // Carte crème bordée d'olive, centrée sur une page A4, avec un trait de
  // découpe en pointillés autour. Le nom du restaurant tient la vedette ; le
  // numéro de table reste en pied, discret mais lisible — sans lui, deux
  // cartes découpées ne sont plus différenciables alors que chaque QR porte
  // le jeton d'une table précise.
  function posterStyles() {
    return `
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0; background: #fff; }
      .sheet {
        width: 210mm; height: 297mm;
        display: flex; align-items: center; justify-content: center;
        page-break-after: always;
      }
      .sheet:last-child { page-break-after: auto; }
      .cut {
        width: 128mm; height: 182mm; padding: 3mm;
        border: 1px dashed #b9b4a4; border-radius: 12mm; position: relative;
      }
      .cut::after {
        content: "\\2702"; position: absolute; top: -4.6mm; left: 50%;
        transform: translateX(-50%); background: #fff; padding: 0 2mm;
        font-size: 9pt; color: #b9b4a4;
      }
      .card {
        width: 100%; height: 100%; border-radius: 9mm;
        background: #f5f2ec; border: 0.6mm solid #3d381a;
        padding: 10mm 8mm 6mm;
        display: flex; flex-direction: column; align-items: center;
        text-align: center; position: relative; overflow: hidden;
      }
      .card::before {
        content: ""; position: absolute; inset: 0;
        background:
          radial-gradient(circle at 82% 6%, rgba(138,134,84,.20), transparent 45%),
          radial-gradient(circle at 12% 96%, rgba(201,168,76,.18), transparent 42%);
      }
      .card > * { position: relative; }
      .mark { width: 24mm; height: 24mm; border-radius: 50%; display: block; }
      .name {
        font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600;
        color: #3d381a; font-size: 25pt; line-height: 1.1;
        margin-top: 4mm; letter-spacing: .4pt;
      }
      .rule { display: flex; align-items: center; gap: 2.5mm; margin: 3.5mm 0 1mm; }
      .rule i { display: block; width: 15mm; height: .35mm; background: #8a8654; opacity: .55; }
      .rule b { width: 1.7mm; height: 1.7mm; background: #c9a84c; border-radius: 50%; display: block; }
      .kicker {
        font-family: 'Jost', Arial, sans-serif; font-size: 8pt;
        letter-spacing: 2.6pt; text-transform: uppercase; color: #8a8654;
      }
      .qrbox {
        margin-top: 6mm; background: #fff; border-radius: 7mm;
        padding: 5mm; border: .3mm solid rgba(61,56,26,.16);
      }
      .qr { width: 62mm; height: 62mm; display: block; }
      .cta {
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-size: 16.5pt; color: #3d381a; line-height: 1.35; margin-top: 6mm;
      }
      .url {
        font-family: 'Jost', Arial, sans-serif; font-size: 8.5pt;
        letter-spacing: 1.5pt; text-transform: uppercase; color: #8a8654; margin-top: 2.5mm;
      }
      .spacer { flex: 1; min-height: 3mm; }
      .tablenum {
        font-family: 'Jost', Arial, sans-serif; font-weight: 500; font-size: 7pt;
        letter-spacing: 1.6pt; text-transform: uppercase; color: rgba(61,56,26,.42);
      }
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
          width: 900,
          errorCorrectionLevel: "H",
          color: { dark: "#3D381A", light: "#FFFFFF" },
        });
        // Seul le domaine est imprimé : l'URL complète contient le jeton
        // d'accès de la table, illisible et inutile à recopier à la main.
        const display = new URL(targetUrl).host.replace(/^www\./, "");
        return { numero: table.numero, qr, display };
      }),
    );

    const body = posters
      .map(
        (poster) => `
        <div class="sheet"><div class="cut"><div class="card">
          <img class="mark" src="${origin}/brand/logo-mark.png" alt="" />
          <div class="name">L&rsquo;Aura Lounge</div>
          <div class="rule"><i></i><b></b><i></i></div>
          <div class="kicker">Restaurant &middot; Dakar</div>
          <div class="qrbox"><img class="qr" src="${poster.qr}" alt="QR table ${poster.numero}" /></div>
          <div class="cta">Scannez pour découvrir<br/>notre carte</div>
          <div class="url">${poster.display}</div>
          <div class="spacer"></div>
          <div class="tablenum">Table ${poster.numero}</div>
        </div></div></div>`,
      )
      .join("");

    const webFonts =
      '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Jost:wght@400;500&display=swap" />';

    popup.document.open();
    popup.document.write(`<html><head><title>Affiches QR — L'Aura Lounge</title>${webFonts}<style>${posterStyles()}</style></head><body>${body}</body></html>`);
    popup.document.close();
    popup.focus();

    // Les polices sont chargées depuis le web : imprimer trop tôt sortirait
    // les affiches dans la police de repli. On attend leur chargement, avec
    // un délai de sécurité si la promesse n'aboutit jamais.
    const fontsReady = popup.document.fonts?.ready ?? Promise.resolve();
    await Promise.race([fontsReady, new Promise((resolve) => window.setTimeout(resolve, 4000))]);
    window.setTimeout(() => popup.print(), 300);
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
