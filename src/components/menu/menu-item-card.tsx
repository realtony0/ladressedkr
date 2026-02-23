"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Badge, Card } from "@/components/common/card";
import { FieldLabel, Select, TextArea } from "@/components/common/field";
import { ACCOMPANIMENT_REQUIRED_SLUGS } from "@/lib/helpers/constants";
import { applyPromotion } from "@/lib/data/menu";
import { formatCurrency } from "@/lib/helpers/format";
import { useI18n } from "@/providers/i18n-provider";
import type { Accompaniment, CategorySlug, MenuItem, PizzaSize, Promotion } from "@/types/domain";

interface MenuItemCardProps {
  item: MenuItem;
  categorySlug: CategorySlug;
  accompaniments: Accompaniment[];
  pizzaSizes: PizzaSize[];
  promotion?: Promotion;
  onAdd: (payload: {
    note: string;
    accompanimentId: string | null;
    accompanimentLabel: string | null;
    accompanimentPrice: number;
    pizzaSizeId: string | null;
    pizzaSizeLabel: string | null;
    pizzaSizePrice: number;
  }) => void;
}

export function MenuItemCard({
  item,
  categorySlug,
  accompaniments,
  pizzaSizes,
  promotion,
  onAdd,
}: MenuItemCardProps) {
  const { locale, messages } = useI18n();

  const needsAccompaniment = item.a_accompagnement && ACCOMPANIMENT_REQUIRED_SLUGS.includes(categorySlug);
  const isBurger = categorySlug === "burgers";

  const sortedAccompaniments = useMemo(
    () => [...accompaniments].sort((left, right) => left.ordre - right.ordre),
    [accompaniments],
  );

  const itemPizzaSizes = useMemo(
    () => pizzaSizes.filter((size) => size.item_id === item.id).sort((a, b) => a.prix - b.prix),
    [pizzaSizes, item.id],
  );

  const initialAccompaniment = needsAccompaniment ? sortedAccompaniments[0] : null;
  const initialPizza = itemPizzaSizes[0] ?? null;

  const [note, setNote] = useState("");
  const [selectedAccompanimentId, setSelectedAccompanimentId] = useState<string | null>(
    initialAccompaniment?.id ?? null,
  );
  const [selectedPizzaSizeId, setSelectedPizzaSizeId] = useState<string | null>(initialPizza?.id ?? null);
  const [justAdded, setJustAdded] = useState(false);

  const selectedAccompaniment = sortedAccompaniments.find((entry) => entry.id === selectedAccompanimentId) ?? null;
  const selectedPizzaSize = itemPizzaSizes.find((entry) => entry.id === selectedPizzaSizeId) ?? initialPizza;

  const basePrice = selectedPizzaSize?.prix ?? item.prix;
  const discountedPrice = applyPromotion(basePrice, promotion);

  useEffect(() => {
    if (!justAdded) {
      return;
    }
    const timeout = window.setTimeout(() => setJustAdded(false), 1400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [justAdded]);

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-heading text-xl text-[var(--color-dark-green)]">{item.nom}</h3>
          <p className="mt-1 break-words text-sm text-[var(--color-black)]/70">{item.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.plat_du_jour ? <Badge>{messages.client.dishOfDay}</Badge> : null}
            {item.allergenes.map((allergen) => (
              <Badge key={allergen} className="bg-[#f0ebe0] text-[var(--color-black)]">
                {allergen}
              </Badge>
            ))}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {promotion ? (
            <>
              <p className="text-sm text-[var(--color-black)]/45 line-through">{formatCurrency(basePrice, locale)}</p>
              <p className="text-lg font-extrabold text-[var(--color-dark-green)]">{formatCurrency(discountedPrice, locale)}</p>
            </>
          ) : (
            <p className="text-lg font-extrabold text-[var(--color-dark-green)]">{formatCurrency(basePrice, locale)}</p>
          )}
        </div>
      </div>

      {isBurger ? (
        <p className="rounded-xl bg-[var(--color-cream)] px-3 py-2 text-xs font-semibold text-[var(--color-dark-green)]">
          Servi avec frites maison incluses.
        </p>
      ) : null}

      {itemPizzaSizes.length > 0 ? (
        <div>
          <FieldLabel>Format pizza</FieldLabel>
          <Select
            value={selectedPizzaSizeId ?? ""}
            onChange={(event) => setSelectedPizzaSizeId(event.target.value)}
          >
            {itemPizzaSizes.map((size) => (
              <option key={size.id} value={size.id}>
                {size.taille} — {formatCurrency(size.prix, locale)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {needsAccompaniment ? (
        <div>
          <FieldLabel>
            {messages.client.accompaniment} <span className="text-[#9C3D3D]">*</span>
          </FieldLabel>
          <Select
            value={selectedAccompanimentId ?? ""}
            onChange={(event) => setSelectedAccompanimentId(event.target.value)}
          >
            {sortedAccompaniments.map((accompaniment) => (
              <option key={accompaniment.id} value={accompaniment.id}>
                {accompaniment.nom}
                {accompaniment.prix_supplement > 0
                  ? ` (+${formatCurrency(accompaniment.prix_supplement, locale)})`
                  : ` (${formatCurrency(0, locale)})`}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-[var(--color-dark-green)]/70">{messages.client.requiredAccompaniment}</p>
        </div>
      ) : null}

      <div>
        <FieldLabel>{messages.common.notes}</FieldLabel>
        <TextArea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder={messages.client.notePlaceholder}
          maxLength={200}
        />
      </div>

      <Button
        type="button"
        onClick={() => {
          onAdd({
            note,
            accompanimentId: selectedAccompaniment?.id ?? null,
            accompanimentLabel: selectedAccompaniment?.nom ?? null,
            accompanimentPrice: selectedAccompaniment?.prix_supplement ?? 0,
            pizzaSizeId: selectedPizzaSize?.id ?? null,
            pizzaSizeLabel: selectedPizzaSize?.taille ?? null,
            pizzaSizePrice: discountedPrice,
          });
          setNote("");
          setJustAdded(true);
        }}
        className="mt-auto"
      >
        {justAdded ? (locale === "fr" ? "Ajouté" : "Added") : messages.client.addToCart}
      </Button>
    </Card>
  );
}
