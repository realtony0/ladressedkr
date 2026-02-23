"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPersonnelNav } from "@/components/admin/admin-personnel-nav";
import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { ROLE_LABELS } from "@/lib/helpers/constants";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import type { Role } from "@/types/domain";

interface StaffUser {
  id: string;
  role: Role;
  prenom: string;
  nom: string;
  restaurant_id: string;
}

interface StaffSchedule {
  id: string;
  user_id: string;
  date: string;
  en_service: boolean;
  restaurant_id: string;
}

export function AdminStaffPage() {
  const { messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const [userResult, scheduleResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, role, prenom, nom, restaurant_id")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .order("role", { ascending: true })
        .order("prenom"),
      supabase
        .from("staff_schedule")
        .select("*")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .eq("date", selectedDate),
    ]);

    setUsers((userResult.data as StaffUser[]) ?? []);
    setSchedules((scheduleResult.data as StaffSchedule[]) ?? []);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("admin-staff-schedule-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_schedule" }, () => void loadData())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const scheduleMap = useMemo(
    () =>
      new Map(
        schedules.map((schedule) => [
          schedule.user_id,
          {
            id: schedule.id,
            en_service: schedule.en_service,
          },
        ]),
      ),
    [schedules],
  );

  async function toggleService(userId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const entry = scheduleMap.get(userId);
    if (entry) {
      const { error } = await supabase
        .from("staff_schedule")
        .update({
          en_service: !entry.en_service,
        })
        .eq("id", entry.id)
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
      if (error) {
        notifyError("Planning non modifié", error.message);
        return;
      }
      notifySuccess(!entry.en_service ? "Mise en service confirmée" : "Retiré du service");
    } else {
      const { error } = await supabase.from("staff_schedule").insert({
        user_id: userId,
        date: selectedDate,
        en_service: true,
        restaurant_id: DEFAULT_RESTAURANT_ID,
      });
      if (error) {
        notifyError("Planning non modifié", error.message);
        return;
      }
      notifySuccess("Mise en service confirmée");
    }

    void loadData();
  }

  return (
    <PageShell title={messages.admin.staffManagement} subtitle="Page dédiée au planning des équipes en service.">
      <AdminPersonnelNav />

      <Card className="mb-5">
        <FieldLabel>Date du service</FieldLabel>
        <TextInput
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="max-w-xs"
        />
      </Card>

      <Card>
        <CardTitle className="font-heading text-3xl">Équipe</CardTitle>
        {loading ? (
          <p className="mt-3 text-sm">{messages.common.loading}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {users.map((user) => {
              const schedule = scheduleMap.get(user.id);
              const active = schedule?.en_service ?? false;

              return (
                <li key={user.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-dark-green)]">
                        {user.prenom} {user.nom}
                      </p>
                      <p className="text-xs text-[var(--color-black)]/65">{ROLE_LABELS[user.role]}</p>
                    </div>
                    <Button
                      type="button"
                      variant={active ? "secondary" : "primary"}
                      onClick={() => void toggleService(user.id)}
                    >
                      {active ? "Retirer du service" : "Mettre en service"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
