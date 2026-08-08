"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { formatCurrency } from "@/lib/helpers/format";
import { groupItemsBySubcategory, loadCatalog, type MenuCatalog } from "@/lib/data/menu";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";

export function VitrineCartePage() {
  const [catalog, setCatalog] = useState<MenuCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const supabase = getBrowserSupabase();
      const data = await loadCatalog({
        supabase,
        restaurantId: DEFAULT_RESTAURANT_ID || undefined,
        allowFallback: true,
      });
      if (!cancelled) {
        setCatalog(data);
        setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return [...catalog.categories]
      .sort((a, b) => a.ordre - b.ordre)
      .map((cat) => {
        const items = catalog.items
          .filter((item) => item.categorie_id === cat.id && item.disponible)
          .sort((a, b) => a.nom.localeCompare(b.nom));
        return {
          category: cat,
          items,
          groups: groupItemsBySubcategory(items, catalog.subcategories, cat.id),
        };
      })
      .filter((group) => group.items.length > 0);
  }, [catalog]);

  return (
    <PageShell title="La carte" subtitle="Tous nos plats faits maison. Les prix sont en francs CFA.">
      {loading ? (
        <p className="text-sm text-[var(--color-black)]/65">Chargement de la carte…</p>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ category, groups }) => (
            <section key={category.id}>
              <h2 className="font-title text-2xl text-[var(--color-dark-green)] md:text-3xl">
                {category.nom}
              </h2>
              {groups.map((group) => (
                <div key={group.subcategory?.id ?? "sans-sous-categorie"} className="mt-4">
                  {group.subcategory ? (
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-black)]/60">
                      {group.subcategory.nom}
                    </h3>
                  ) : null}
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-[var(--color-light-gray)] bg-white"
                      >
                        {item.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photo}
                            alt={item.nom}
                            loading="lazy"
                            className="h-36 w-full object-cover"
                          />
                        ) : null}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-[var(--color-dark-green)]">{item.nom}</h3>
                            <span className="shrink-0 font-bold text-[var(--color-dark-green)]">
                              {formatCurrency(item.prix)}
                            </span>
                          </div>
                          {item.description ? (
                            <p className="mt-1 text-sm text-[var(--color-black)]/65">{item.description}</p>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}

          <div className="rounded-2xl bg-[#eef4ee] p-6 text-center">
            <p className="text-sm text-[var(--color-black)]/75">
              Envie de réserver votre table ?
            </p>
            <Link
              href="/reservation"
              className="mt-3 inline-block rounded-full bg-[var(--color-dark-green)] px-6 py-2.5 text-sm font-bold text-white"
            >
              Réserver une table
            </Link>
          </div>
        </div>
      )}
    </PageShell>
  );
}
