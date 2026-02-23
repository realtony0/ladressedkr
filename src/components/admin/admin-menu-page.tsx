"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Badge, Card, CardTitle } from "@/components/common/card";
import { FieldLabel, Select, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { formatCurrency, normalizeAllergen } from "@/lib/helpers/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import type { Accompaniment, Category, MenuItem, PizzaSize, Subcategory } from "@/types/domain";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeAllergenToken(value: string) {
  return normalizeAllergen(value).replace(/\s+/g, " ").trim();
}

function parseAllergens(raw: string) {
  const parsed: string[] = [];
  const seen = new Set<string>();

  raw.split(",").forEach((entry) => {
    const token = normalizeAllergenToken(entry);
    if (!token || seen.has(token)) {
      return;
    }
    seen.add(token);
    parsed.push(token);
  });

  return parsed;
}

export function AdminMenuPage() {
  const { locale, messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [pizzaSizes, setPizzaSizes] = useState<PizzaSize[]>([]);
  const [accompaniments, setAccompaniments] = useState<Accompaniment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryOrder, setCategoryOrder] = useState("10");

  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemSubcategoryId, setItemSubcategoryId] = useState("");
  const [itemAllergens, setItemAllergens] = useState("");
  const [itemNeedsAccompaniment, setItemNeedsAccompaniment] = useState(false);
  const [itemAllergenDrafts, setItemAllergenDrafts] = useState<Record<string, string>>({});
  const [itemAllergenSaving, setItemAllergenSaving] = useState<Record<string, boolean>>({});

  const [pizzaItemId, setPizzaItemId] = useState("");
  const [pizzaLabel, setPizzaLabel] = useState("");
  const [pizzaPrice, setPizzaPrice] = useState("");

  const [accName, setAccName] = useState("");
  const [accPrice, setAccPrice] = useState("2500");

  async function loadData() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const [categoryRes, subcategoryRes, itemsRes, sizesRes, accompanimentRes] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .order("ordre", { ascending: true }),
      supabase
        .from("subcategories")
        .select("*")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .order("ordre", { ascending: true }),
      supabase
        .from("items")
        .select("*")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .order("nom", { ascending: true }),
      supabase.from("pizza_sizes").select("*").order("taille", { ascending: true }),
      supabase
        .from("accompaniments")
        .select("*")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .order("ordre", { ascending: true }),
    ]);

    setCategories((categoryRes.data as Category[]) ?? []);
    setSubcategories((subcategoryRes.data as Subcategory[]) ?? []);
    setItems((itemsRes.data as MenuItem[]) ?? []);
    setPizzaSizes((sizesRes.data as PizzaSize[]) ?? []);
    setAccompaniments((accompanimentRes.data as Accompaniment[]) ?? []);
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
      .channel("admin-menu-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "subcategories" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pizza_sizes" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "accompaniments" }, () => void loadData())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const pizzaItems = useMemo(
    () => items.filter((item) => categories.find((category) => category.id === item.categorie_id)?.slug === "pizzas"),
    [items, categories],
  );

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const supabase = getBrowserSupabase();
    if (!supabase || !categoryName.trim()) {
      return;
    }

    const { error: createError } = await supabase.from("categories").insert({
      nom: categoryName.trim(),
      slug: slugify(categoryName),
      icone: "Utensils",
      ordre: Number(categoryOrder) || 10,
      restaurant_id: DEFAULT_RESTAURANT_ID,
    });

    if (createError) {
      setError(createError.message);
      notifyError("Catégorie non créée", createError.message);
      return;
    }

    setCategoryName("");
    setCategoryOrder("10");
    notifySuccess("Catégorie créée", categoryName.trim());
    void loadData();
  }

  async function createSubcategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const supabase = getBrowserSupabase();
    if (!supabase || !subcategoryName.trim() || !subcategoryCategoryId) {
      return;
    }

    const currentCount = subcategories.filter((sub) => sub.categorie_id === subcategoryCategoryId).length;

    const { error: createError } = await supabase.from("subcategories").insert({
      nom: subcategoryName.trim(),
      categorie_id: subcategoryCategoryId,
      ordre: currentCount + 1,
      restaurant_id: DEFAULT_RESTAURANT_ID,
    });

    if (createError) {
      setError(createError.message);
      notifyError("Sous-catégorie non créée", createError.message);
      return;
    }

    setSubcategoryName("");
    notifySuccess("Sous-catégorie créée", subcategoryName.trim());
    void loadData();
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const supabase = getBrowserSupabase();
    if (!supabase || !itemName.trim() || !itemCategoryId || !itemPrice) {
      return;
    }

    const allergens = parseAllergens(itemAllergens);

    const { error: createError } = await supabase.from("items").insert({
      nom: itemName.trim(),
      description: itemDescription.trim(),
      prix: Number(itemPrice),
      categorie_id: itemCategoryId,
      subcategorie_id: itemSubcategoryId || null,
      disponible: true,
      allergenes: allergens,
      a_accompagnement: itemNeedsAccompaniment,
      plat_du_jour: false,
      restaurant_id: DEFAULT_RESTAURANT_ID,
    });

    if (createError) {
      setError(createError.message);
      notifyError("Plat non créé", createError.message);
      return;
    }

    setItemName("");
    setItemDescription("");
    setItemPrice("");
    setItemAllergens("");
    setItemNeedsAccompaniment(false);
    notifySuccess("Plat créé", itemName.trim());
    void loadData();
  }

  async function updateItem(itemId: string, payload: Partial<MenuItem>) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error: updateError } = await supabase
      .from("items")
      .update(payload)
      .eq("id", itemId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (updateError) {
      setError(updateError.message);
      notifyError("Plat non mis à jour", updateError.message);
      return;
    }
    notifySuccess("Plat mis à jour");
    void loadData();
  }

  async function deleteItem(itemId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", itemId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (deleteError) {
      setError(deleteError.message);
      notifyError("Suppression impossible", deleteError.message);
      return;
    }
    notifySuccess("Plat supprimé");
    void loadData();
  }

  async function saveItemAllergens(item: MenuItem, rawAllergens: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const nextAllergens = parseAllergens(rawAllergens);
    setItemAllergenSaving((current) => ({ ...current, [item.id]: true }));

    const { error: updateError } = await supabase
      .from("items")
      .update({ allergenes: nextAllergens })
      .eq("id", item.id)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);

    setItemAllergenSaving((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });

    if (updateError) {
      setError(updateError.message);
      notifyError("Allergènes non mis à jour", updateError.message);
      return;
    }

    setError(null);
    setItemAllergenDrafts((current) => ({ ...current, [item.id]: nextAllergens.join(", ") }));
    notifySuccess("Allergènes mis à jour", `${item.nom} · ${nextAllergens.length} allergène(s)`);
    void loadData();
  }

  async function removeAllergenFromItem(item: MenuItem, allergen: string) {
    const remaining = item.allergenes.filter(
      (entry) => normalizeAllergenToken(entry) !== normalizeAllergenToken(allergen),
    );
    await saveItemAllergens(item, remaining.join(", "));
  }

  async function createPizzaSize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase || !pizzaItemId || !pizzaLabel.trim() || !pizzaPrice) {
      return;
    }

    const { error: createError } = await supabase.from("pizza_sizes").insert({
      item_id: pizzaItemId,
      taille: pizzaLabel.trim(),
      prix: Number(pizzaPrice),
    });
    if (createError) {
      setError(createError.message);
      notifyError("Taille pizza non créée", createError.message);
      return;
    }

    setPizzaLabel("");
    setPizzaPrice("");
    notifySuccess("Taille pizza créée", pizzaLabel.trim());
    void loadData();
  }

  async function deletePizzaSize(sizeId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error: deleteError } = await supabase.from("pizza_sizes").delete().eq("id", sizeId);
    if (deleteError) {
      setError(deleteError.message);
      notifyError("Suppression impossible", deleteError.message);
      return;
    }
    notifySuccess("Taille pizza supprimée");
    void loadData();
  }

  async function createAccompaniment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase || !accName.trim()) {
      return;
    }

    const { error: createError } = await supabase.from("accompaniments").insert({
      nom: accName.trim(),
      prix_supplement: Number(accPrice),
      ordre: accompaniments.length + 1,
      restaurant_id: DEFAULT_RESTAURANT_ID,
    });
    if (createError) {
      setError(createError.message);
      notifyError("Accompagnement non créé", createError.message);
      return;
    }

    setAccName("");
    setAccPrice("2500");
    notifySuccess("Accompagnement créé", accName.trim());
    void loadData();
  }

  async function updateAccompaniment(accId: string, payload: Partial<Accompaniment>) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error: updateError } = await supabase
      .from("accompaniments")
      .update(payload)
      .eq("id", accId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (updateError) {
      setError(updateError.message);
      notifyError("Accompagnement non mis à jour", updateError.message);
      return;
    }
    notifySuccess("Accompagnement mis à jour");
    void loadData();
  }

  async function deleteAccompaniment(accId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("accompaniments")
      .delete()
      .eq("id", accId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (deleteError) {
      setError(deleteError.message);
      notifyError("Suppression impossible", deleteError.message);
      return;
    }
    notifySuccess("Accompagnement supprimé");
    void loadData();
  }

  return (
    <PageShell title={messages.admin.menuManagement} subtitle="CRUD complet des catégories, plats, tailles pizza et accompagnements.">
      {error ? <Card className="mb-4 border-[#9C3D3D] text-[#8b2424]">{error}</Card> : null}

      {loading ? (
        <Card>{messages.common.loading}</Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle className="font-heading text-3xl">{messages.admin.addCategory}</CardTitle>
              <form className="mt-4 space-y-3" onSubmit={createCategory}>
                <div>
                  <FieldLabel>Nom catégorie</FieldLabel>
                  <TextInput value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
                </div>
                <div>
                  <FieldLabel>Ordre</FieldLabel>
                  <TextInput
                    type="number"
                    value={categoryOrder}
                    onChange={(event) => setCategoryOrder(event.target.value)}
                    min={1}
                  />
                </div>
                <Button type="submit">{messages.common.save}</Button>
              </form>

              <hr className="my-5 border-[var(--color-light-gray)]" />

              <h4 className="font-heading text-2xl text-[var(--color-dark-green)]">Ajouter une sous-catégorie</h4>
              <form className="mt-3 space-y-3" onSubmit={createSubcategory}>
                <div>
                  <FieldLabel>Catégorie parent</FieldLabel>
                  <Select
                    value={subcategoryCategoryId}
                    onChange={(event) => setSubcategoryCategoryId(event.target.value)}
                    required
                  >
                    <option value="">Choisir une catégorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nom}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Nom sous-catégorie</FieldLabel>
                  <TextInput
                    value={subcategoryName}
                    onChange={(event) => setSubcategoryName(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit">{messages.common.save}</Button>
              </form>
            </Card>

            <Card>
              <CardTitle className="font-heading text-3xl">{messages.admin.addItem}</CardTitle>
              <form className="mt-4 space-y-3" onSubmit={createItem}>
                <div>
                  <FieldLabel>Nom plat</FieldLabel>
                  <TextInput value={itemName} onChange={(event) => setItemName(event.target.value)} required />
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <TextInput
                    value={itemDescription}
                    onChange={(event) => setItemDescription(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <FieldLabel>Prix (FCFA)</FieldLabel>
                  <TextInput
                    type="number"
                    value={itemPrice}
                    onChange={(event) => setItemPrice(event.target.value)}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <FieldLabel>Catégorie</FieldLabel>
                  <Select value={itemCategoryId} onChange={(event) => setItemCategoryId(event.target.value)} required>
                    <option value="">Choisir</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nom}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Sous-catégorie</FieldLabel>
                  <Select value={itemSubcategoryId} onChange={(event) => setItemSubcategoryId(event.target.value)}>
                    <option value="">Aucune</option>
                    {subcategories
                      .filter((subcategory) => !itemCategoryId || subcategory.categorie_id === itemCategoryId)
                      .map((subcategory) => (
                        <option key={subcategory.id} value={subcategory.id}>
                          {subcategory.nom}
                        </option>
                      ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Allergènes (séparés par virgule)</FieldLabel>
                  <TextInput
                    value={itemAllergens}
                    onChange={(event) => setItemAllergens(event.target.value)}
                    placeholder="gluten, lait, oeufs"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-dark-green)]">
                  <input
                    type="checkbox"
                    checked={itemNeedsAccompaniment}
                    onChange={(event) => setItemNeedsAccompaniment(event.target.checked)}
                  />
                  Accompagnement obligatoire
                </label>
                <Button type="submit">{messages.common.save}</Button>
              </form>
            </Card>
          </div>

          <Card>
            <CardTitle className="font-heading text-3xl">Plats</CardTitle>
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--color-dark-green)]">{item.nom}</p>
                      <p className="text-xs text-[var(--color-black)]/65">
                        {formatCurrency(item.prix, locale)} · {categories.find((category) => category.id === item.categorie_id)?.nom}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge className={item.disponible ? "bg-[#e5f6e5] text-[#225222]" : "bg-[#ffe4e4] text-[#8b2424]"}>
                          {item.disponible ? "Disponible" : "Épuisé"}
                        </Badge>
                        {item.plat_du_jour ? <Badge>{messages.admin.dishOfDay}</Badge> : null}
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-dark-green)]/80">
                          Allergènes
                        </p>
                        {item.allergenes.length === 0 ? (
                          <p className="mt-2 text-xs text-[var(--color-black)]/65">Aucun allergène renseigné.</p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.allergenes.map((allergen, index) => (
                              <button
                                key={`${item.id}-${allergen}-${index}`}
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-sage)] bg-[var(--color-cream)] px-2.5 py-1 text-xs font-semibold text-[var(--color-dark-green)]"
                                onClick={() => void removeAllergenFromItem(item, allergen)}
                                disabled={Boolean(itemAllergenSaving[item.id])}
                                aria-label={`Supprimer l'allergène ${allergen}`}
                              >
                                {allergen}
                                <span aria-hidden="true">×</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <form
                          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveItemAllergens(
                              item,
                              itemAllergenDrafts[item.id] ?? item.allergenes.join(", "),
                            );
                          }}
                        >
                          <TextInput
                            value={itemAllergenDrafts[item.id] ?? item.allergenes.join(", ")}
                            onChange={(event) =>
                              setItemAllergenDrafts((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            placeholder="gluten, lait, oeufs"
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            className="sm:shrink-0"
                            disabled={Boolean(itemAllergenSaving[item.id])}
                          >
                            {itemAllergenSaving[item.id] ? messages.common.loading : "Enregistrer"}
                          </Button>
                        </form>
                        <p className="mt-1 text-xs text-[var(--color-black)]/60">
                          Sépare par virgule pour ajouter ou modifier. Clique un allergène pour le supprimer.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void updateItem(item.id, { disponible: !item.disponible })}
                      >
                        {item.disponible ? messages.admin.disable : messages.admin.enable}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void updateItem(item.id, { plat_du_jour: !item.plat_du_jour })}
                      >
                        {messages.admin.dishOfDay}
                      </Button>
                      <Button type="button" variant="danger" onClick={() => void deleteItem(item.id)}>
                        {messages.common.delete}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle className="font-heading text-3xl">Tailles Pizza</CardTitle>
              <form className="mt-4 space-y-3" onSubmit={createPizzaSize}>
                <div>
                  <FieldLabel>Pizza</FieldLabel>
                  <Select value={pizzaItemId} onChange={(event) => setPizzaItemId(event.target.value)} required>
                    <option value="">Choisir une pizza</option>
                    {pizzaItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nom}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Libellé taille</FieldLabel>
                  <TextInput value={pizzaLabel} onChange={(event) => setPizzaLabel(event.target.value)} required />
                </div>
                <div>
                  <FieldLabel>Prix (FCFA)</FieldLabel>
                  <TextInput
                    type="number"
                    value={pizzaPrice}
                    onChange={(event) => setPizzaPrice(event.target.value)}
                    min={0}
                    required
                  />
                </div>
                <Button type="submit">{messages.common.save}</Button>
              </form>

              <ul className="mt-4 space-y-2 text-sm">
                {pizzaSizes.map((size) => (
                  <li key={size.id} className="flex items-center justify-between rounded-xl border border-[var(--color-light-gray)] p-2">
                    <span>
                      {items.find((item) => item.id === size.item_id)?.nom} · {size.taille} · {formatCurrency(size.prix, locale)}
                    </span>
                    <Button type="button" variant="danger" onClick={() => void deletePizzaSize(size.id)}>
                      {messages.common.delete}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle className="font-heading text-3xl">Accompagnements</CardTitle>
              <form className="mt-4 space-y-3" onSubmit={createAccompaniment}>
                <div>
                  <FieldLabel>Nom</FieldLabel>
                  <TextInput value={accName} onChange={(event) => setAccName(event.target.value)} required />
                </div>
                <div>
                  <FieldLabel>Supplément (FCFA)</FieldLabel>
                  <TextInput
                    type="number"
                    value={accPrice}
                    onChange={(event) => setAccPrice(event.target.value)}
                    min={0}
                    required
                  />
                </div>
                <Button type="submit">{messages.common.save}</Button>
              </form>

              <ul className="mt-4 space-y-2 text-sm">
                {accompaniments.map((acc) => (
                  <li key={acc.id} className="rounded-xl border border-[var(--color-light-gray)] p-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--color-dark-green)]">{acc.nom}</p>
                        <p>{formatCurrency(acc.prix_supplement, locale)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            void updateAccompaniment(acc.id, {
                              prix_supplement: acc.prix_supplement === 0 ? 2500 : 0,
                            })
                          }
                        >
                          {messages.common.edit}
                        </Button>
                        <Button type="button" variant="danger" onClick={() => void deleteAccompaniment(acc.id)}>
                          {messages.common.delete}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
