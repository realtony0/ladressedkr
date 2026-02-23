"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Clock3, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/common/button";
import { Badge, Card, CardTitle } from "@/components/common/card";
import { FieldLabel, Select, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { MenuItemCard } from "@/components/menu/menu-item-card";
import { ClientFlowNav } from "@/components/orders/client-flow-nav";
import {
  activePromotionForItem,
  isBrunchCurrentlyOpen,
  loadCatalog,
  type MenuCatalog,
} from "@/lib/data/menu";
import { resolveActiveTableByNumber } from "@/lib/data/tables";
import { formatCurrency, normalizeAllergen, orderStatusLabel } from "@/lib/helpers/format";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useCart } from "@/providers/cart-provider";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
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

function statusProgress(statut: ClientOrderPreview["statut"]) {
  if (statut === "ready") {
    return 100;
  }
  if (statut === "preparing") {
    return 66;
  }
  return 33;
}

function MenuBoard({ tableId }: { tableId: string }) {
  const { messages, locale } = useI18n();
  const { lines, subtotal, addLine } = useCart();
  const { notifySuccess } = useNotifications();
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
          if (!cancelled) {
            setMenuSource("offline");
            setLoadError(
              locale === "fr"
                ? "Configuration serveur indisponible. Contacte la cuisine."
                : "Server configuration unavailable. Please ask the kitchen team.",
            );
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
      if (!table?.id) {
        setActiveOrder(null);
        setActiveOrderCount(0);
        setLoadingActiveOrder(false);
        return;
      }

      const supabase = getBrowserSupabase();
      if (!supabase) {
        return;
      }

      setLoadingActiveOrder(true);
      const { data } = await supabase
        .from("orders")
        .select("id, statut, heure, eta_minutes, total")
        .eq("table_id", table.id)
        .in("statut", ["received", "preparing"])
        .order("heure", { ascending: false })
        .limit(25);

      if (cancelled) {
        return;
      }

      const activeOrders = (data as ClientOrderPreview[] | null) ?? [];
      setActiveOrderCount(activeOrders.length);
      setActiveOrder(activeOrders[0] ?? null);
      setLoadingActiveOrder(false);
    }

    void loadActiveOrders();

    return () => {
      cancelled = true;
    };
  }, [ordersTick, refreshTick, table?.id]);

  useEffect(() => {
    if (!table?.id) {
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(`client-menu-orders-${table.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `table_id=eq.${table.id}` }, () =>
        setOrdersTick((value) => value + 1),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table?.id]);

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
  const liveLabel =
    locale === "fr"
      ? menuSource === "live"
        ? "Menu synchronisé en direct"
        : "Mode hors-ligne"
      : menuSource === "live"
        ? "Live synced menu"
        : "Offline mode";

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

  return (
    <PageShell
      title={messages.client.welcome}
      subtitle={`${messages.client.menuSubtitle} · ${messages.common.table} ${table.numero}`}
    >
      <ClientFlowNav tableId={tableId} />
      {loadError ? <Card className="mb-4 border-[#9C3D3D] bg-[#fff5f5] text-sm text-[#8b2424]">{loadError}</Card> : null}

      <div className="grid gap-6 pb-28 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:pb-0">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-dark-green)]/70">
                  {messages.common.table} {table.numero}
                </p>
                <p className="mt-1 text-sm text-[var(--color-black)]/70">{visibleCountLabel}</p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-cream)] px-2.5 py-1 text-xs font-semibold text-[var(--color-dark-green)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {liveLabel}
                  {syncingMenu ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-label={messages.common.loading} />
                  ) : null}
                </div>
              </div>
              <div className="hidden flex-wrap gap-2 lg:flex lg:justify-end">
                <Link href={`/${tableId}/panier`} className="block">
                  <Button>{messages.client.cart}</Button>
                </Link>
                <Link href={`/${tableId}/commandes`} className="block">
                  <Button variant="secondary">
                    {messages.client.orderHistory}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setRefreshTick((value) => value + 1);
                    setOrdersTick((value) => value + 1);
                  }}
                  disabled={syncingMenu}
                >
                  <RefreshCw className={`h-4 w-4 ${syncingMenu ? "animate-spin" : ""}`} />
                  {locale === "fr" ? "Actualiser" : "Refresh"}
                </Button>
                <Link href={`/${tableId}/appel`} className="block">
                  <Button variant="secondary">
                    {messages.client.callServer}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <FieldLabel>{messages.client.searchDish}</FieldLabel>
                <TextInput
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={messages.client.searchPlaceholder}
                />
              </div>
              <div>
                <FieldLabel>{messages.client.allergenFilter}</FieldLabel>
                <Select value={selectedAllergen} onChange={(event) => setSelectedAllergen(event.target.value)}>
                  <option value="">{messages.client.clearFilter}</option>
                  {allergenOptions.map((allergen) => (
                    <option key={allergen} value={allergen}>
                      {allergen}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {hasFilters ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-[#eef4ee] text-[var(--color-dark-green)]">
                  {locale === "fr" ? "Filtres actifs" : "Active filters"}
                </Badge>
                {normalizedQuery ? (
                  <Badge className="bg-[#f3efe6] text-[var(--color-black)]">
                    {locale === "fr" ? "Recherche" : "Search"}: {searchQuery}
                  </Badge>
                ) : null}
                {selectedAllergen ? (
                  <Badge className="bg-[#f3efe6] text-[var(--color-black)]">
                    {locale === "fr" ? "Allergène" : "Allergen"}: {selectedAllergen}
                  </Badge>
                ) : null}
                <Button
                  variant="ghost"
                  type="button"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedAllergen("");
                  }}
                >
                  {locale === "fr" ? "Réinitialiser les filtres" : "Reset filters"}
                </Button>
              </div>
            ) : null}
          </Card>

          <Card className="border-[var(--color-sage)] bg-[#f0f6f0]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-dark-green)]/75">
                  {locale === "fr" ? "Commande en direct" : "Live order status"}
                </p>
                {loadingActiveOrder ? (
                  <p className="mt-1 text-sm text-[var(--color-black)]/65">{messages.common.loading}</p>
                ) : activeOrder ? (
                  <>
                    <p className="mt-1 text-base font-bold text-[var(--color-dark-green)]">
                      {orderStatusLabel(activeOrder.statut, locale)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-black)]/65">
                      #{activeOrder.id.slice(0, 8)} · {formatCurrency(activeOrder.total, locale)}
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                      <div
                        className="h-full rounded-full bg-[var(--color-dark-green)] transition-[width] duration-500"
                        style={{ width: `${statusProgress(activeOrder.statut)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--color-black)]/65">
                    {locale === "fr"
                      ? "Aucune commande active. Compose ton panier puis valide."
                      : "No active order. Build your cart and place your order."}
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:shrink-0">
                <div className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-dark-green)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {activeOrder?.eta_minutes
                    ? locale === "fr"
                      ? `${activeOrder.eta_minutes} min estimées`
                      : `${activeOrder.eta_minutes} min ETA`
                    : locale === "fr"
                      ? "ETA en préparation"
                      : "ETA pending"}
                </div>
                <p className="text-right text-xs font-semibold text-[var(--color-dark-green)]/80">
                  {activeOrderCount > 0
                    ? locale === "fr"
                      ? `${activeOrderCount} commande(s) en cours`
                      : `${activeOrderCount} active order(s)`
                    : locale === "fr"
                      ? "0 commande en cours"
                      : "0 active orders"}
                </p>
                {activeOrder ? (
                  <Link href={`/commande/${activeOrder.id}?table=${tableId}`}>
                    <Button className="w-full">{messages.client.orderTracking}</Button>
                  </Link>
                ) : (
                  <Link href={`/${tableId}/panier`}>
                    <Button className="w-full">{messages.client.cart}</Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>

          {filteredSections.length > 0 ? (
            <Card className="sticky top-20 z-20 bg-[var(--color-cream)]/95 p-2 backdrop-blur">
              <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-[var(--color-dark-green)]/70">
                {messages.client.quickCategories}
              </p>
              <div className="min-w-0 flex gap-2 overflow-x-auto pb-1">
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
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      activeCategoryId === section.category.id
                        ? "border-[var(--color-dark-green)] bg-[var(--color-dark-green)] text-white"
                        : "border-[var(--color-sage)] bg-white text-[var(--color-dark-green)] hover:bg-[var(--color-cream)]"
                    }`}
                  >
                    {section.category.nom} ({section.items.length})
                  </button>
                ))}
              </div>
            </Card>
          ) : null}

          {filteredSections.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--color-black)]/70">{messages.client.noResults}</p>
            </Card>
          ) : null}

          {filteredSections.map((section) => {
            if (section.category.slug === "brunch" && !brunchOpen) {
              return (
                <Card key={section.category.id} id={`cat-${section.category.id}`} className="scroll-mt-32">
                  <CardTitle className="font-heading text-3xl">{section.category.nom}</CardTitle>
                  <p className="mt-2 text-sm text-[#9C3D3D]">{messages.client.brunchClosed}</p>
                </Card>
              );
            }

            return (
              <section key={section.category.id} id={`cat-${section.category.id}`} className="scroll-mt-32 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="min-w-0 break-words font-heading text-3xl text-[var(--color-dark-green)]">
                    {section.category.nom}
                  </h2>
                  <Badge className="shrink-0">{section.items.length}</Badge>
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
                        notifySuccess(
                          locale === "fr" ? "Ajouté au panier" : "Added to cart",
                          item.nom,
                        );
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardTitle className="font-heading text-3xl">{messages.client.cart}</CardTitle>
            <p className="mt-2 text-sm text-[var(--color-black)]/70">
              {lines.length === 0
                ? messages.client.cartEmpty
                : `${lines.length} article(s) · ${formatCurrency(subtotal, locale)}`}
            </p>
            <Link href={`/${tableId}/panier`} className="mt-4 block">
              <Button className="w-full">{messages.client.orderNow}</Button>
            </Link>
          </Card>
        </aside>
      </div>

      {lines.length > 0 ? (
        <div className="fixed inset-x-3 bottom-[5.25rem] z-40 lg:hidden">
          <Link href={`/${tableId}/panier`}>
            <Button className="w-full rounded-2xl py-3 text-base">
              {messages.client.cart} · {lines.length} · {formatCurrency(subtotal, locale)}
            </Button>
          </Link>
        </div>
      ) : null}

      {lastAddedDish ? (
        <div className="pointer-events-none fixed bottom-24 right-3 z-40 rounded-xl border border-[var(--color-sage)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-dark-green)] shadow-lg lg:bottom-6 lg:right-6">
          {locale === "fr" ? "Ajouté au panier" : "Added to cart"}: {lastAddedDish}
        </div>
      ) : null}

      {showBackToTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-sage)] bg-white text-[var(--color-dark-green)] shadow-lg transition-transform hover:-translate-y-0.5 lg:bottom-6 lg:right-6"
          aria-label={locale === "fr" ? "Retour en haut" : "Back to top"}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      ) : null}
    </PageShell>
  );
}

export function ClientMenuPage({ tableId }: { tableId: string }) {
  return <MenuBoard tableId={tableId} />;
}
