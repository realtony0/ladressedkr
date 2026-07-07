"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Check, Minus, X } from "lucide-react";

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
    supplementId: string | null;
    supplementLabel: string | null;
    supplementPrice: number;
    pizzaSizeId: string | null;
    pizzaSizeLabel: string | null;
    pizzaSizePrice: number;
  }) => void;
}

// Visual identity per category — appetizing fallback band when a dish has no photo.
const CATEGORY_MEDIA: Record<CategorySlug, { emoji: string; gradient: string }> = {
  "entrees-salades": { emoji: "🥗", gradient: "from-[#a7c79a] to-[#6f9c6f]" },
  burgers: { emoji: "🍔", gradient: "from-[#e0b878] to-[#c4923f]" },
  pates: { emoji: "🍝", gradient: "from-[#e6c98f] to-[#c79a4c]" },
  viandes: { emoji: "🥩", gradient: "from-[#c98f86] to-[#9c4d44]" },
  volailles: { emoji: "🍗", gradient: "from-[#e3bd86] to-[#bd8a45]" },
  poissons: { emoji: "🐟", gradient: "from-[#8fb6c9] to-[#4d7e9c]" },
  pizzas: { emoji: "🍕", gradient: "from-[#e0a878] to-[#c46f3f]" },
  accompagnements: { emoji: "🍟", gradient: "from-[#e8cd8f] to-[#c7a24c]" },
  "cocktails-sans-alcool": { emoji: "🍹", gradient: "from-[#9ec7b4] to-[#5e9c8a]" },
  smoothies: { emoji: "🥤", gradient: "from-[#f0a8c0] to-[#d65f8a]" },
  "cocktails-glaces": { emoji: "🧊", gradient: "from-[#8fc7d6] to-[#4d93b0]" },
  milkshakes: { emoji: "🥛", gradient: "from-[#e8d8c0] to-[#c9a878]" },
  "boissons-chaudes": { emoji: "☕", gradient: "from-[#c9a07a] to-[#8a5a32]" },
  "sodas-jus": { emoji: "🧃", gradient: "from-[#f0c068] to-[#d69020]" },
  eaux: { emoji: "💧", gradient: "from-[#a8d0e0] to-[#5e9cb8]" },
  brunch: { emoji: "🥞", gradient: "from-[#e6c98f] to-[#c79a4c]" },
  chicha: { emoji: "💨", gradient: "from-[#b8a0c8] to-[#7a5a9c]" },
  desserts: { emoji: "🍰", gradient: "from-[#e0b8a8] to-[#c4805f]" },
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

  // Extra side dish, billed on top of the dish (the included accompaniment is free).
  const supplementOptions = useMemo(
    () => sortedAccompaniments.filter((entry) => entry.prix_supplement > 0),
    [sortedAccompaniments],
  );

  const [note, setNote] = useState("");
  const [selectedAccompanimentId, setSelectedAccompanimentId] = useState<string | null>(
    initialAccompaniment?.id ?? null,
  );
  const [selectedSupplementId, setSelectedSupplementId] = useState<string | null>(null);
  const [selectedPizzaSizeId, setSelectedPizzaSizeId] = useState<string | null>(initialPizza?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [open, setOpen] = useState(false);

  const selectedAccompaniment = sortedAccompaniments.find((entry) => entry.id === selectedAccompanimentId) ?? null;
  const selectedSupplement = supplementOptions.find((entry) => entry.id === selectedSupplementId) ?? null;
  const selectedPizzaSize = itemPizzaSizes.find((entry) => entry.id === selectedPizzaSizeId) ?? initialPizza;

  const basePrice = selectedPizzaSize?.prix ?? item.prix;
  const discountedPrice = applyPromotion(basePrice, promotion);

  // True when the dish requires a choice before adding (so we open the sheet).
  const hasChoices = needsAccompaniment || itemPizzaSizes.length > 1;

  useEffect(() => {
    if (!justAdded) return;
    const timeout = window.setTimeout(() => setJustAdded(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [justAdded]);

  // Lock background scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const media = CATEGORY_MEDIA[categorySlug] ?? CATEGORY_MEDIA["entrees-salades"];
  const photoSrc = item.photo ?? undefined;

  function emitAdd() {
    for (let i = 0; i < Math.max(1, quantity); i += 1) {
      onAdd({
        note,
        accompanimentId: selectedAccompaniment?.id ?? null,
        accompanimentLabel: selectedAccompaniment?.nom ?? null,
        // The included accompaniment is free; only the optional extra is billed.
        accompanimentPrice: 0,
        supplementId: selectedSupplement?.id ?? null,
        supplementLabel: selectedSupplement?.nom ?? null,
        supplementPrice: selectedSupplement?.prix_supplement ?? 0,
        pizzaSizeId: selectedPizzaSize?.id ?? null,
        pizzaSizeLabel: selectedPizzaSize?.taille ?? null,
        pizzaSizePrice: discountedPrice,
      });
    }
  }

  // Quick "+" on the vignette: add immediately, or open the sheet if a choice is needed.
  function handleQuickAdd() {
    if (hasChoices) {
      setOpen(true);
      return;
    }
    setQuantity(1);
    onAdd({
      note: "",
      accompanimentId: null,
      accompanimentLabel: null,
      accompanimentPrice: 0,
      supplementId: null,
      supplementLabel: null,
      supplementPrice: 0,
      pizzaSizeId: selectedPizzaSize?.id ?? null,
      pizzaSizeLabel: selectedPizzaSize?.taille ?? null,
      pizzaSizePrice: discountedPrice,
    });
    setJustAdded(true);
  }

  function confirmFromSheet() {
    emitAdd();
    setOpen(false);
    setNote("");
    setQuantity(1);
    setSelectedSupplementId(null);
    setJustAdded(true);
  }

  const Media = (
    <div className="dish-media relative h-full w-full">
      {photoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoSrc} alt={item.nom} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", media.gradient)}>
          <span className="text-4xl drop-shadow-sm" aria-hidden>
            {media.emoji}
          </span>
        </div>
      )}
      {item.plat_du_jour ? (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
          {messages.client.dishOfDay}
        </span>
      ) : null}
      {promotion ? (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-[#9C3D3D] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
          {locale === "fr" ? "Promo" : "Deal"}
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      <article className="card-interactive flex h-full min-h-[7rem] overflow-hidden rounded-2xl border border-[var(--color-light-gray)] bg-white shadow-card sm:flex-col">
        {/* Tappable media + body opens the detail sheet */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block h-36 w-36 shrink-0 overflow-hidden text-left sm:h-44 sm:w-full"
        >
          {Media}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <button type="button" onClick={() => setOpen(true)} className="text-left">
            <h3 className="line-clamp-2 break-words font-heading text-lg leading-tight text-[var(--color-dark-green)] sm:text-base">
              {item.nom}
            </h3>
            {item.description ? (
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--color-black)]/55 sm:hidden">
                {item.description}
              </p>
            ) : null}
          </button>

          <div className="mt-auto flex items-end justify-between gap-2">
            <div className="min-w-0">
              {promotion ? (
                <p className="text-[10px] text-[var(--color-black)]/40 line-through">{formatCurrency(basePrice, locale)}</p>
              ) : null}
              <p className="text-base font-extrabold text-[var(--color-dark-green)]">
                {formatCurrency(discountedPrice, locale)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleQuickAdd}
              aria-label={messages.client.addToCart}
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-float transition-transform active:scale-95",
                justAdded ? "bg-[var(--color-dark-green)]" : "bg-[var(--color-sage)]",
              )}
            >
              {justAdded ? <Check className="h-4 w-4 animate-pop-in" /> : <Plus className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </article>

      {/* Detail / customization sheet — overlay, never breaks the grid */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="animate-rise-in relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-md sm:rounded-3xl">
            <div className="relative h-64 sm:h-72">
              {photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoSrc} alt={item.nom} className="h-full w-full object-contain" />
              ) : (
                <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", media.gradient)}>
                  <span className="text-6xl" aria-hidden>
                    {media.emoji}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--color-dark-green)] shadow"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <h3 className="font-heading text-2xl text-[var(--color-dark-green)]">{item.nom}</h3>
                {item.description ? (
                  <p className="mt-1 text-sm text-[var(--color-black)]/65">{item.description}</p>
                ) : null}
                {item.allergenes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
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
              </div>

              {itemPizzaSizes.length > 1 ? (
                <div>
                  <FieldLabel>{locale === "fr" ? "Format" : "Size"}</FieldLabel>
                  <Select value={selectedPizzaSizeId ?? ""} onChange={(event) => setSelectedPizzaSizeId(event.target.value)}>
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
                    {messages.client.accompaniment}{" "}
                    <span className="font-normal text-[var(--color-sage)]">
                      ({locale === "fr" ? "inclus" : "included"})
                    </span>{" "}
                    <span className="text-[#9C3D3D]">*</span>
                  </FieldLabel>
                  <Select
                    value={selectedAccompanimentId ?? ""}
                    onChange={(event) => setSelectedAccompanimentId(event.target.value)}
                  >
                    {sortedAccompaniments.map((accompaniment) => (
                      <option key={accompaniment.id} value={accompaniment.id}>
                        {accompaniment.nom}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {needsAccompaniment && supplementOptions.length > 0 ? (
                <div>
                  <FieldLabel>
                    {locale === "fr" ? "Supplément" : "Extra side"}{" "}
                    <span className="font-normal text-[var(--color-black)]/45">
                      ({locale === "fr" ? "facultatif, payant" : "optional, paid"})
                    </span>
                  </FieldLabel>
                  <Select
                    value={selectedSupplementId ?? ""}
                    onChange={(event) => setSelectedSupplementId(event.target.value || null)}
                  >
                    <option value="">{locale === "fr" ? "Aucun supplément" : "No extra"}</option>
                    {supplementOptions.map((supplement) => (
                      <option key={supplement.id} value={supplement.id}>
                        {supplement.nom} (+{formatCurrency(supplement.prix_supplement, locale)})
                      </option>
                    ))}
                  </Select>
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

              {/* Quantity */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-dark-green)]">
                  {locale === "fr" ? "Quantité" : "Quantity"}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-light-gray)] text-[var(--color-dark-green)]"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-lg font-bold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-light-gray)] text-[var(--color-dark-green)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <Button type="button" onClick={confirmFromSheet} className="w-full rounded-2xl py-3 text-base">
                {messages.client.addToCart} · {formatCurrency((discountedPrice + (selectedSupplement?.prix_supplement ?? 0)) * quantity, locale)}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
