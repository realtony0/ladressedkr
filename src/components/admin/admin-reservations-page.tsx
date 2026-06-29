"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, MapPin, Phone, Users, X } from "lucide-react";

import { Badge, Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useNotifications } from "@/providers/notifications-provider";
import type { Reservation, ReservationStatus } from "@/types/domain";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  declined: "Refusée",
  cancelled: "Annulée",
};

const STATUS_STYLE: Record<ReservationStatus, string> = {
  pending: "bg-[#fff7da] text-[#6b5608]",
  confirmed: "bg-[#e5f6e5] text-[#225222]",
  declined: "bg-[#ffe4e4] text-[#8b2424]",
  cancelled: "bg-[var(--color-light-gray)] text-[var(--color-black)]/60",
};

const LOCATION_LABEL = {
  interieur: "Intérieur",
  terrasse: "Terrasse",
} as const;

function formatDate(dateStr: string) {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateStr;
  }
}

export function AdminReservationsPage() {
  const { notifyError, notifySuccess } = useNotifications();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
      .order("date_reservation", { ascending: true })
      .order("heure", { ascending: true });

    if (error) {
      notifyError("Chargement impossible", error.message);
      setLoading(false);
      return;
    }
    setReservations((data as Reservation[]) ?? []);
    setLoading(false);
  }, [notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel("reservations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function setStatus(id: string, statut: ReservationStatus) {
    setBusyId(id);
    try {
      const response = await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, statut }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        notifyError("Mise à jour impossible", payload.error ?? "Réessaie.");
        return;
      }
      notifySuccess(statut === "confirmed" ? "Réservation confirmée" : "Réservation mise à jour");
      void load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = reservations.filter((r) => r.statut === "pending");
  const others = reservations.filter((r) => r.statut !== "pending");

  return (
    <PageShell
      title="Réservations"
      subtitle="Les demandes de réservation faites en ligne par les clients."
    >
      {loading ? (
        <Card>Chargement…</Card>
      ) : reservations.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-black)]/65">
            Aucune réservation pour le moment. Les demandes du site en ligne apparaîtront ici.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-3xl">À traiter</CardTitle>
              <Badge>{pending.length}</Badge>
            </div>
            {pending.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-black)]/65">Tout est traité 👍</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pending.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[var(--color-light-gray)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-dark-green)]">{r.nom}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-black)]/75">
                          <CalendarClock className="h-4 w-4" /> {formatDate(r.date_reservation)} à {r.heure.slice(0, 5)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-black)]/75">
                          <Users className="h-4 w-4" /> {r.nb_personnes} personne{r.nb_personnes > 1 ? "s" : ""}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-black)]/75">
                          <MapPin className="h-4 w-4" /> {LOCATION_LABEL[r.emplacement]}
                        </p>
                        <a
                          href={`tel:${r.telephone}`}
                          className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-dark-green)] underline"
                        >
                          <Phone className="h-4 w-4" /> {r.telephone}
                        </a>
                        {r.message ? (
                          <p className="mt-2 rounded-lg bg-[#f6f8f6] p-2 text-xs text-[var(--color-black)]/70">
                            « {r.message} »
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void setStatus(r.id, "confirmed")}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-dark-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" /> Confirmer
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void setStatus(r.id, "declined")}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#d99] px-4 py-2 text-sm font-semibold text-[#8b2424] disabled:opacity-50"
                        >
                          <X className="h-4 w-4" /> Refuser
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {others.length > 0 ? (
            <Card>
              <CardTitle className="font-heading text-3xl">Historique</CardTitle>
              <ul className="mt-4 space-y-2">
                {others.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-light-gray)] p-3 text-sm"
                  >
                    <div>
                      <span className="font-semibold text-[var(--color-dark-green)]">{r.nom}</span>
                      <span className="text-[var(--color-black)]/65">
                        {" "}
                        · {formatDate(r.date_reservation)} à {r.heure.slice(0, 5)} · {r.nb_personnes} pers. ·{" "}
                        {LOCATION_LABEL[r.emplacement]}
                      </span>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[r.statut]}`}>
                      {STATUS_LABEL[r.statut]}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
