"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, Select, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { formatCurrency, formatDateTime } from "@/lib/helpers/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import type { MenuItem, Promotion } from "@/types/domain";

export function AdminPromotionsPage() {
  const { locale, messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState("");
  const [type, setType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("10");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 16));

  async function loadData() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const [itemResult, promoResult] = await Promise.all([
      supabase
        .from("items")
        .select("*")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .order("nom", { ascending: true }),
      supabase
        .from("promotions")
        .select("*")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .order("date_debut", { ascending: false }),
    ]);

    setItems((itemResult.data as MenuItem[]) ?? []);
    setPromotions((promoResult.data as Promotion[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("admin-promotions-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "promotions" }, () => void loadData())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function createPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase || !itemId || !value || !startDate || !endDate) {
      return;
    }

    const { error } = await supabase.from("promotions").insert({
      item_id: itemId,
      restaurant_id: DEFAULT_RESTAURANT_ID,
      type,
      valeur: Number(value),
      date_debut: new Date(startDate).toISOString(),
      date_fin: new Date(endDate).toISOString(),
      active: true,
    });
    if (error) {
      notifyError("Promotion non créée", error.message);
      return;
    }

    const targetItemName = items.find((item) => item.id === itemId)?.nom;
    setItemId("");
    setValue("10");
    notifySuccess("Promotion créée", targetItemName);
    void loadData();
  }

  async function togglePromotion(promotionId: string, active: boolean) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from("promotions")
      .update({ active: !active })
      .eq("id", promotionId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (error) {
      notifyError("Promotion non mise à jour", error.message);
      return;
    }
    notifySuccess(!active ? "Promotion activée" : "Promotion désactivée");
    void loadData();
  }

  async function deletePromotion(promotionId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from("promotions")
      .delete()
      .eq("id", promotionId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (error) {
      notifyError("Suppression impossible", error.message);
      return;
    }
    notifySuccess("Promotion supprimée");
    void loadData();
  }

  return (
    <PageShell title={messages.admin.promotionManagement} subtitle="Création de remises en pourcentage ou montant fixe avec période de validité.">
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardTitle className="font-heading text-3xl">Nouvelle promotion</CardTitle>
          <form className="mt-4 space-y-3" onSubmit={createPromotion}>
            <div>
              <FieldLabel>Plat</FieldLabel>
              <Select value={itemId} onChange={(event) => setItemId(event.target.value)} required>
                <option value="">Choisir un plat</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nom}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Type</FieldLabel>
              <Select value={type} onChange={(event) => setType(event.target.value as "percent" | "amount")}> 
                <option value="percent">Pourcentage</option>
                <option value="amount">Montant fixe</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Valeur</FieldLabel>
              <TextInput
                type="number"
                min={0}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
              />
            </div>
            <div>
              <FieldLabel>Début</FieldLabel>
              <TextInput
                type="datetime-local"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>
            <div>
              <FieldLabel>Fin</FieldLabel>
              <TextInput
                type="datetime-local"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              {messages.common.save}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle className="font-heading text-3xl">Promotions</CardTitle>
          {loading ? (
            <p className="mt-3 text-sm">{messages.common.loading}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {promotions.map((promotion) => {
                const item = items.find((entry) => entry.id === promotion.item_id);
                return (
                  <li key={promotion.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--color-dark-green)]">{item?.nom ?? "Plat supprimé"}</p>
                        <p className="text-xs text-[var(--color-black)]/65">
                          {promotion.type === "percent"
                            ? `${promotion.valeur}%`
                            : formatCurrency(promotion.valeur, locale)}
                          {" · "}
                          {formatDateTime(promotion.date_debut, locale)} → {formatDateTime(promotion.date_fin, locale)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={promotion.active ? "secondary" : "primary"}
                          onClick={() => void togglePromotion(promotion.id, promotion.active)}
                        >
                          {promotion.active ? messages.admin.disable : messages.admin.enable}
                        </Button>
                        <Button type="button" variant="danger" onClick={() => void deletePromotion(promotion.id)}>
                          {messages.common.delete}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
