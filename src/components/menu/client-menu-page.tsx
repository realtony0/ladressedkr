"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Search } from "lucide-react";

import { Button } from "@/components/common/button";
import { Card } from "@/components/common/card";
import { Select, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { MenuItemCard } from "@/components/menu/menu-item-card";
import { ClientFlowNav } from "@/components/orders/client-flow-nav";
import {
  activePromotionForItem,
  getFallbackCatalog,
  isBrunchCurrentlyOpen,
  loadCatalog,
  type MenuCatalog,
} from "@/lib/data/menu";
import { resolveActiveTableByNumber } from "@/lib/data/tables";
import { formatCurrency, normalizeAllergen } from "@/lib/helpers/format";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useCart } from "@/providers/cart-provider";
import { useI18n } from "@/providers/i18n-provider";
import { useTableAccess } from "@/providers/table-access-provider";
import type { Category, MenuItem, Table } from "@/types/domain";

const NETWORK_TIMEOUT_MS = 7000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = NETWORK_TIMEOUT_MS) {
  const pending = Promise.resolve(promise);
  return Promise.race([
    pending,
    new Promise<T>((_, reject) =>
      window.setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), timeoutMs),
    ),
  ]);
}

interface ClientOrderPreview {
  id: string;
  statut: "received" | "preparing" | "ready";
  heure: string;
  eta_minutes: number | null;
  total: number;
}


function MenuBoard({ tableId }: { tableId: string }) {
  const { messages, locale } = useI18n();
  const { lines, subtotal, addLine } = useCart();
  const { isReady: tableAccessReady, accessToken } = useTableAccess();
  const [catalog, setCatalog] = useState<MenuCatalog | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [tableNotFound, setTableNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAllergen, setSelectedAllergen] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [syncingMenu, setSyncingMenu] = useState(false);
  const [menuSource, setMenuSource] = useState<"live" | "offline">("live");
  const [refreshTick, setRefreshTick] = useState(0);
  const [ordersTick, setOrdersTick] = useState(0);
  const [lastAddedDish, setLastAddedDish] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<ClientOrderPreview | null>(null);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [loadingActiveOrder, setLoadingActiveOrder] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        if (!cancelled) {
          setSyncingMenu(true);
        }
        setTableNotFound(false);
        setLoadError(null);

        const supabase = getBrowserSupabase();
        const tableNumber = Number(tableId);
        if (!supabase) {
          // Dev / demo preview: no Supabase configured (only happens locally —
          // production always has it). Show the seed catalog with its photos
          // instead of an error so the menu can be previewed offline.
          if (!cancelled) {
            const previewNumber = Number.isFinite(tableNumber) && tableNumber > 0 ? tableNumber : 1;
            setMenuSource("offline");
            setLoadError(null);
            setTableNotFound(false);
            setTable({
              id: "offline-preview",
              numero: previewNumber,
              qr_code: "",
              statut: "active",
              restaurant_id: DEFAULT_RESTAURANT_ID,
            });
            setCatalog(getFallbackCatalog(DEFAULT_RESTAURANT_ID));
          }
          return;
        }

        if (!Number.isFinite(tableNumber) || tableNumber <= 0) {
          if (!cancelled) {
            setLoadError(locale === "fr" ? "Numéro de table invalide." : "Invalid table number.");
          }
          return;
        }

        const tableResolution = await withTimeout(
          resolveActiveTableByNumber<Table>({
            supabase,
            tableNumber,
            restaurantId: DEFAULT_RESTAURANT_ID || undefined,
            select: "*",
          }),
        );

        if (tableResolution.error) {
          if (!cancelled) {
            setLoadError(tableResolution.error);
            setCatalog(null);
            setTable(null);
          }
          return;
        }

        const resolvedTable = tableResolution.table;
        if (cancelled) {
          return;
        }
        setTable(resolvedTable);

        if (!resolvedTable) {
          setCatalog(null);
          setTableNotFound(true);
          return;
        }

        const nextCatalog = await withTimeout(
          loadCatalog({ supabase, restaurantId: resolvedTable.restaurant_id, allowFallback: false }),
        );
        if (cancelled) {
          return;
        }
        setMenuSource("live");
        setCatalog(nextCatalog);
      } catch (error) {
        if (!cancelled) {
          setCatalog(null);
          setTable(null);
          setLoadError(
            error instanceof Error && error.message
              ? error.message
              : locale === "fr"
                ? "Impossible de charger le menu en direct."
                : "Unable to load live menu.",
          );
        }
      } finally {
        if (!cancelled) {
          setSyncingMenu(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [locale, tableId, refreshTick]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const refreshCatalog = async () => {
      if (!table?.restaurant_id) {
        return;
      }
      try {
        const refreshed = await loadCatalog({
          supabase,
          restaurantId: table.restaurant_id,
          allowFallback: false,
        });
        setCatalog(refreshed);
        setLoadError(null);
      } catch (error) {
        setLoadError(
          error instanceof Error && error.message
            ? error.message
            : locale === "fr"
              ? "Menu temporairement indisponible."
              : "Menu temporarily unavailable.",
        );
      }
    };

    const channel = supabase
      .channel(`menu-live-${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => void refreshCatalog())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [locale, table?.restaurant_id, tableId]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 560);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!lastAddedDish) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setLastAddedDish(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [lastAddedDish]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveOrders() {
      if (!table?.id || !tableAccessReady) {
        setActiveOrder(null);
        setActiveOrderCount(0);
        setLoadingActiveOrder(false);
        return;
      }

      if (!accessToken) {
        setActiveOrder(null);
        setActiveOrderCount(0);
        setLoadingActiveOrder(false);
        return;
      }

      setLoadingActiveOrder(true);
      const params = new URLSearchParams({
        tableNumber: tableId,
        accessToken,
      });
      if (DEFAULT_RESTAURANT_ID) {
        params.set("restaurantId", DEFAULT_RESTAURANT_ID);
      }

      const response = await fetch(`/api/client/orders?${params.toString()}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as {
        activeOrders?: ClientOrderPreview[];
      };

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setActiveOrder(null);
        setActiveOrderCount(0);
        setLoadingActiveOrder(false);
        return;
      }

      const activeOrders = payload.activeOrders ?? [];
      setActiveOrderCount(activeOrders.length);
      setActiveOrder(activeOrders[0] ?? null);
      setLoadingActiveOrder(false);
    }

    void loadActiveOrders();

    return () => {
      cancelled = true;
    };
  }, [accessToken, ordersTick, refreshTick, table?.id, tableAccessReady, tableId]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const interval = window.setInterval(() => {
      setOrdersTick((value) => value + 1);
    }, 6000);

    return () => {
      window.clearInterval(interval);
    };
  }, [accessToken]);

  const allergenOptions = useMemo(() => {
    if (!catalog) {
      return [];
    }

    return Array.from(new Set(catalog.items.flatMap((item) => item.allergenes))).sort();
  }, [catalog]);

  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const filteredSections = useMemo(() => {
    if (!catalog) {
      return [] as Array<{ category: Category; items: MenuItem[] }>;
    }

    return catalog.categories
      .map((category) => {
        const items = catalog.items
          .filter((item) => item.categorie_id === category.id && item.disponible)
          .filter((item) => {
            if (selectedAllergen) {
              const hasAllergen = item
                .allergenes
                .map(normalizeAllergen)
                .includes(normalizeAllergen(selectedAllergen));
              if (!hasAllergen) {
                return false;
              }
            }

            if (!normalizedQuery) {
              return true;
            }

            return `${item.nom} ${item.description}`.toLowerCase().includes(normalizedQuery);
          });

        return {
          category,
          items,
        };
      })
      .filter((section) => section.items.length > 0);
  }, [catalog, normalizedQuery, selectedAllergen]);

  const visibleItemCount = useMemo(
    () => filteredSections.reduce((sum, section) => sum + section.items.length, 0),
    [filteredSections],
  );
  const hasFilters = Boolean(selectedAllergen || normalizedQuery);

  useEffect(() => {
    const visibleCategories = filteredSections.map((section) => section.category.id);
    if (!visibleCategories.length) {
      setActiveCategoryId(null);
      return;
    }

    const ids = visibleCategories.map((id) => `cat-${id}`);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

        if (visible.length === 0) {
          return;
        }

        const nextId = visible[0].target.id.replace("cat-", "");
        if (nextId) {
          setActiveCategoryId(nextId);
        }
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: [0, 0.2, 0.5],
      },
    );

    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    if (!activeCategoryId || !visibleCategories.includes(activeCategoryId)) {
      setActiveCategoryId(visibleCategories[0]);
    }

    return () => {
      observer.disconnect();
    };
  }, [activeCategoryId, filteredSections]);

  if (tableNotFound) {
    return (
      <PageShell title={messages.client.welcome} subtitle={messages.client.menuSubtitle}>
        <Card>
          <p className="text-sm text-[#8b2424]">
            {locale === "fr"
              ? "Cette table est inactive ou le QR n'est plus valide."
              : "This table is inactive or this QR is no longer valid."}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => setRefreshTick((value) => value + 1)}
          >
            {messages.common.retry}
          </Button>
        </Card>
      </PageShell>
    );
  }

  if (!catalog) {
    if (loadError) {
      return (
        <PageShell title={messages.client.welcome} subtitle={messages.client.menuSubtitle}>
          <Card>
            <p className="text-sm text-[#8b2424]">{loadError}</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => setRefreshTick((value) => value + 1)}
            >
              {messages.common.retry}
            </Button>
          </Card>
        </PageShell>
      );
    }

    return (
      <PageShell title={messages.client.welcome} subtitle={messages.client.menuSubtitle}>
        <Card>{messages.common.loading}</Card>
      </PageShell>
    );
  }

  if (!table) {
    return (
      <PageShell title={messages.client.welcome} subtitle={messages.client.menuSubtitle}>
        <Card>{messages.common.loading}</Card>
      </PageShell>
    );
  }

  const brunchOpen = isBrunchCurrentlyOpen(catalog.serviceHours);
  const visibleCountLabel =
    locale === "fr" ? `${visibleItemCount} plats affichés` : `${visibleItemCount} dishes shown`;

  const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 pb-32">
        {loadError ? (
          <div className="mt-4 rounded-2xl border border-[#9C3D3D] bg-[#fff5f5] p-3 text-sm text-[#8b2424]">
            {loadError}
          </div>
        ) : null}

        {/* En-tête épuré */}
        <div className="flex items-end justify-between gap-3 pb-3 pt-5">
          <div className="min-w-0">
            <h1 className="font-title text-3xl text-[var(--color-dark-green)]">{messages.nav.menu}</h1>
            <p className="mt-0.5 text-xs font-semibold text-[var(--color-black)]/55">
              {messages.common.table} {table.numero} · {visibleCountLabel}
              {menuSource === "offline" ? " · hors-ligne" : ""}
            </p>
          </div>
          {activeOrder ? (
            <Link
              href={`/${tableId}/commandes`}
              className="shrink-0 rounded-full bg-[#eef4ee] px-3 py-1.5 text-xs font-bold text-[var(--color-dark-green)]"
            >
              {locale === "fr" ? "Suivre ma commande →" : "Track order →"}
            </Link>
          ) : null}
        </div>

        {/* Recherche + catégories collantes */}
        <div className="sticky top-14 z-20 -mx-4 space-y-2 bg-[var(--color-cream)]/95 px-4 pb-2 pt-2 backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-black)]/40" />
            <TextInput
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={messages.client.searchPlaceholder}
              className="rounded-full pl-9"
            />
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedAllergen("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--color-sage)]"
              >
                {locale === "fr" ? "Effacer" : "Clear"}
              </button>
            ) : null}
          </div>

          {filteredSections.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filteredSections.map((section) => (
                <button
                  key={section.category.id}
                  type="button"
                  onClick={() => {
                    setActiveCategoryId(section.category.id);
                    document
                      .getElementById(`cat-${section.category.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    activeCategoryId === section.category.id
                      ? "bg-[var(--color-dark-green)] text-white"
                      : "bg-white text-[var(--color-dark-green)]"
                  }`}
                >
                  {section.category.nom}
                </button>
              ))}
            </div>
          ) : null}

          {allergenOptions.length > 0 ? (
            <Select
              value={selectedAllergen}
              onChange={(event) => setSelectedAllergen(event.target.value)}
              className="h-9 rounded-full text-xs"
            >
              <option value="">{messages.client.allergenFilter}</option>
              {allergenOptions.map((allergen) => (
                <option key={allergen} value={allergen}>
                  {allergen}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {/* Les plats — la vedette */}
        {filteredSections.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[var(--color-black)]/60">{messages.client.noResults}</p>
        ) : null}

        <div className="mt-3 space-y-8">
          {filteredSections.map((section) => {
            if (section.category.slug === "brunch" && !brunchOpen) {
              return (
                <section key={section.category.id} id={`cat-${section.category.id}`} className="scroll-mt-28">
                  <h2 className="font-title text-2xl text-[var(--color-dark-green)]">{section.category.nom}</h2>
                  <p className="mt-2 text-sm text-[#9C3D3D]">{messages.client.brunchClosed}</p>
                </section>
              );
            }

            return (
              <section key={section.category.id} id={`cat-${section.category.id}`} className="scroll-mt-28 space-y-3">
                <h2 className="font-title text-2xl text-[var(--color-dark-green)]">{section.category.nom}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {section.items.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      categorySlug={section.category.slug}
                      accompaniments={catalog.accompaniments}
                      pizzaSizes={catalog.pizzaSizes}
                      promotion={activePromotionForItem(item.id, catalog.promotions)}
                      onAdd={(payload) => {
                        addLine({
                          item,
                          note: payload.note,
                          accompanimentId: payload.accompanimentId,
                          accompanimentLabel: payload.accompanimentLabel,
                          accompanimentPrice: payload.accompanimentPrice,
                          pizzaSizeId: payload.pizzaSizeId,
                          pizzaSizeLabel: payload.pizzaSizeLabel,
                          pizzaSizePrice: payload.pizzaSizePrice,
                        });
                        setLastAddedDish(item.nom);
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* Barre panier collante */}
      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[4.75rem] z-40 px-3">
          <Link href={`/${tableId}/panier`} className="mx-auto block max-w-3xl">
            <div className="flex items-center justify-between rounded-2xl bg-[var(--color-dark-green)] px-5 py-3.5 text-white shadow-float transition-transform active:scale-[0.99]">
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs">
                  {totalQty}
                </span>
                {messages.client.orderNow}
              </span>
              <span className="text-base font-extrabold">{formatCurrency(subtotal, locale)}</span>
            </div>
          </Link>
        </div>
      ) : null}

      {lastAddedDish ? (
        <div className="pointer-events-none fixed bottom-[8.5rem] left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--color-dark-green)] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {locale === "fr" ? "Ajouté ✓" : "Added ✓"} {lastAddedDish}
        </div>
      ) : null}

      {showBackToTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-[8.5rem] right-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-sage)] bg-white text-[var(--color-dark-green)] shadow-lg"
          aria-label={locale === "fr" ? "Retour en haut" : "Back to top"}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      ) : null}

      <ClientFlowNav tableId={tableId} />
    </>
  );
}

export function ClientMenuPage({ tableId }: { tableId: string }) {
  return <MenuBoard tableId={tableId} />;
}
