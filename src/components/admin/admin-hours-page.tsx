"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, Select, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";

interface ServiceHour {
  id: string;
  service_type: "service" | "brunch";
  open_time: string;
  close_time: string;
  enabled: boolean;
}

export function AdminHoursPage() {
  const { messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [hours, setHours] = useState<ServiceHour[]>([]);
  const [serviceType, setServiceType] = useState<"service" | "brunch">("brunch");
  const [open, setOpen] = useState("10:30");
  const [close, setClose] = useState("14:30");
  const [loading, setLoading] = useState(true);

  const sortedHours = useMemo(
    () => [...hours].sort((left, right) => left.service_type.localeCompare(right.service_type)),
    [hours],
  );

  async function loadHours() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("service_hours")
      .select("*")
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
      .order("service_type", { ascending: true });
    setHours((data as ServiceHour[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadHours();
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("admin-hours-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_hours" }, () => void loadHours())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function saveHour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const existing = hours.find((hour) => hour.service_type === serviceType);
    if (existing) {
      const { error } = await supabase
        .from("service_hours")
        .update({
          open_time: `${open}:00`,
          close_time: `${close}:00`,
          enabled: true,
        })
        .eq("id", existing.id)
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
      if (error) {
        notifyError("Créneau non mis à jour", error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("service_hours").insert({
        restaurant_id: DEFAULT_RESTAURANT_ID,
        service_type: serviceType,
        open_time: `${open}:00`,
        close_time: `${close}:00`,
        enabled: true,
      });
      if (error) {
        notifyError("Créneau non créé", error.message);
        return;
      }
    }

    notifySuccess("Horaires enregistrés", serviceType === "brunch" ? "Brunch" : "Service");
    void loadHours();
  }

  async function toggleHour(hour: ServiceHour) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from("service_hours")
      .update({ enabled: !hour.enabled })
      .eq("id", hour.id)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (error) {
      notifyError("Statut non modifié", error.message);
      return;
    }
    notifySuccess(hour.enabled ? "Service désactivé" : "Service activé");
    void loadHours();
  }

  return (
    <PageShell title={messages.admin.serviceHours} subtitle="Configuration des horaires brunch et service continu.">
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardTitle className="font-heading text-3xl">Configurer un créneau</CardTitle>
          <form className="mt-4 space-y-3" onSubmit={saveHour}>
            <div>
              <FieldLabel>Service</FieldLabel>
              <Select value={serviceType} onChange={(event) => setServiceType(event.target.value as "service" | "brunch")}>
                <option value="service">Service</option>
                <option value="brunch">Brunch</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Ouverture</FieldLabel>
              <TextInput type="time" value={open} onChange={(event) => setOpen(event.target.value)} required />
            </div>
            <div>
              <FieldLabel>Fermeture</FieldLabel>
              <TextInput type="time" value={close} onChange={(event) => setClose(event.target.value)} required />
            </div>
            <Button type="submit" className="w-full">
              {messages.common.save}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle className="font-heading text-3xl">Horaires actifs</CardTitle>
          {loading ? (
            <p className="mt-3 text-sm">{messages.common.loading}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {sortedHours.map((hour) => (
                <li key={hour.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-dark-green)]">
                        {hour.service_type === "brunch" ? "Brunch" : "Service"}
                      </p>
                      <p className="text-sm text-[var(--color-black)]/70">
                        {hour.open_time.slice(0, 5)} → {hour.close_time.slice(0, 5)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={hour.enabled ? "secondary" : "primary"}
                      onClick={() => void toggleHour(hour)}
                    >
                      {hour.enabled ? messages.admin.disable : messages.admin.enable}
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
