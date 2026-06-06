"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Check, ChevronRight } from "lucide-react";

import { Button } from "@/components/common/button";
import { FieldLabel, Select, TextArea } from "@/components/common/field";
import { ACCOMPANIMENT_REQUIRED_SLUGS } from "@/lib/helpers/constants";
import { applyPromotion } from "@/lib/data/menu";
import { cn } from "@/lib/helpers/cn";
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

// Visual identity per category — used to render an appetizing fallback band
// when a dish has no real photo yet (Le Mint-style media on top of each card).
const CATEGORY_MEDIA: Record<CategorySlug, { emoji: string; gradient: string }> = {
  "entrees-salades": { emoji: "🥗", gradient: "from-[#a7c79a] to-[#6f9c6f]" },
  burgers: { emoji: "🍔", gradient: "from-[#e0b878] to-[#c4923f]" },
  pates: { emoji: "🍝", gradient: "from-[#e6c98f] to-[#c79a4c]" },
  viandes: { emoji: "🥩", gradient: "from-[#c98f86] to-[#9c4d44]" },
  volailles: { emoji: "🍗", gradient: "from-[#e3bd86] to-[#bd8a45]" },
  poissons: { emoji: "🐟", gradient: "from-[#8fb6c9] to-[#4d7e9c]" },
  pizzas: { emoji: "🍕", gradient: "from-[#e0a878] to-[#c46f3f]" },
  "cocktails-sans-alcool": { emoji: "🍹", gradient: "from-[#9ec7b4] to-[#5e9c8a]" },
  brunch: { emoji: "🥞", gradient: "from-[#e6c98f] to-[#c79a4c]" },
};

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
  const [expanded, setExpanded] = useState(false);

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

  const media = CATEGORY_MEDIA[categorySlug] ?? CATEGORY_MEDIA["entrees-salades"];

  function handleAdd() {
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
    setExpanded(false);
    setJustAdded(true);
  }

  return (
    <article className="card-interactive flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--color-light-gray)] bg-white shadow-card">
      {/* Media on top — real photo if available, else an appetizing fallback band */}
      <div className="dish-media relative h-40">
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo} alt={item.nom} className="h-full w-full object-cover" />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", media.gradient)}>
            <span className="text-5xl drop-shadow-sm" aria-hidden>
              {media.emoji}
            </span>
          </div>
        )}

        {item.plat_du_jour ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-[var(--color-gold)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            {messages.client.dishOfDay}
          </span>
        ) : null}
        {promotion ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-[#9C3D3D] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            {locale === "fr" ? "Promo" : "Deal"}
          </span>
        ) : null}

        {/* Quick one-tap add button, overlaid like Le Mint */}
        <button
          type="button"
          onClick={handleAdd}
          aria-label={messages.client.addToCart}
          className={cn(
            "absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-white shadow-float transition-transform hover:scale-105 active:scale-95",
            justAdded ? "bg-[var(--color-dark-green)]" : "bg-[var(--color-sage)]",
          )}
        >
          {justAdded ? <Check className="h-4 w-4 animate-pop-in" /> : <Plus className="h-5 w-5" />}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="break-words font-heading text-lg leading-tight text-[var(--color-dark-green)]">{item.nom}</h3>
        <p className="line-clamp-2 break-words text-sm text-[var(--color-black)]/60">{item.description}</p>

        {item.allergenes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.allergenes.map((allergen) => (
              <span
                key={allergen}
                className="rounded-full bg-[#f0ebe0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-black)]/55"
              >
                {allergen}
              </span>
            ))}
          </div>
        ) : null}

        {/* Price + "Voir" row, Le Mint style */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {promotion ? (
              <p className="text-xs text-[var(--color-black)]/40 line-through">{formatCurrency(basePrice, locale)}</p>
            ) : null}
            <p className="text-base font-extrabold text-[var(--color-dark-green)]">
              {formatCurrency(discountedPrice, locale)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-0.5 text-sm font-semibold text-[var(--color-sage)] hover:text-[var(--color-dark-green)]"
          >
            {locale === "fr" ? "Voir" : "View"}
            <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
          </button>
        </div>

        {/* Expanded detail / customization */}
        {expanded ? (
          <div className="animate-rise-in space-y-3 rounded-2xl bg-[var(--color-cream)] p-3">
            {itemPizzaSizes.length > 1 ? (
              <div>
                <FieldLabel>{locale === "fr" ? "Format pizza" : "Pizza size"}</FieldLabel>
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

            <Button type="button" onClick={handleAdd} className="w-full rounded-2xl">
              <Plus className="h-4 w-4" />
              {messages.client.addToCart}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
