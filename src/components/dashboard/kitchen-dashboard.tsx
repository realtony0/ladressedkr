"use client";

import { Bell, Clock3, Printer, RefreshCw, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";

import { Button } from "@/components/common/button";
import { Badge, Card } from "@/components/common/card";
import { FieldLabel, Select, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { DEFAULT_DELAY_ALERT_MINUTES, ORDER_STATUS_FLOW } from "@/lib/helpers/constants";
import { cn } from "@/lib/helpers/cn";
import { formatCurrency, formatDateTime, orderStatusLabel, serverCallReasonLabel } from "@/lib/helpers/format";
import { playNotificationTone } from "@/lib/helpers/sound";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import type { MenuItem, OrderStatus, ServerCallStatus } from "@/types/domain";

interface KitchenOrderView {
  id: string;
  statut: OrderStatus;
  heure: string;
  total: number;
  eta_minutes: number | null;
  table: { numero: number } | null;
  order_items: Array<{
    id: string;
    quantite: number;
    note: string | null;
    prix_unitaire: number;
    supplement: number;
    item: { id: string; nom: string } | null;
    accompaniment: { nom: string } | null;
    pizza_size: { taille: string } | null;
  }>;
}

interface KitchenCallView {
  id: string;
  motif: "addition" | "aide" | "demande_speciale";
  details: string | null;
  statut: ServerCallStatus;
  heure: string;
  table: { numero: number } | null;
}

interface KitchenPreferences {
  delayAlertMinutes: number;
  defaultEtaMinutes: number;
  soundEnabled: boolean;
  autoPrintEnabled: boolean;
}

const KITCHEN_PREFERENCES_KEY = "ladresse.kitchen.preferences";

const DEFAULT_KITCHEN_PREFERENCES: KitchenPreferences = {
  delayAlertMinutes: DEFAULT_DELAY_ALERT_MINUTES,
  defaultEtaMinutes: 22,
  soundEnabled: true,
  autoPrintEnabled: true,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function delayInMinutes(orderTime: string) {
  const deltaMs = Date.now() - new Date(orderTime).getTime();
  return Math.max(0, Math.round(deltaMs / 60000));
}

function suggestedEtaMinutes(order: KitchenOrderView, baseEta: number) {
  const units = order.order_items.reduce((sum, line) => sum + line.quantite, 0);
  const hasPizza = order.order_items.some((line) => Boolean(line.pizza_size));
  const hasSpecialNote = order.order_items.some((line) => Boolean(line.note));

  return clamp(baseEta + Math.floor(units * 1.4) + (hasPizza ? 4 : 0) + (hasSpecialNote ? 2 : 0), 8, 75);
}

export function KitchenDashboard({ historyOnly = false }: { historyOnly?: boolean }) {
  const { locale, messages } = useI18n();
  const { notifyError, notifyInfo, notifySuccess } = useNotifications();

  const [orders, setOrders] = useState<KitchenOrderView[]>([]);
  const [calls, setCalls] = useState<KitchenCallView[]>([]);
  const [availableItems, setAvailableItems] = useState<Array<Pick<MenuItem, "id" | "nom">>>([]);
  const [selectedItemOut, setSelectedItemOut] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<KitchenPreferences>(DEFAULT_KITCHEN_PREFERENCES);
  const [etaDrafts, setEtaDrafts] = useState<Record<string, string>>({});
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const previousCallIdsRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);
  const printQueueRef = useRef<string[]>([]);
  const printingRef = useRef(false);

  const printNow = useReactToPrint({
    contentRef: printRef,
    documentTitle: printOrderId ? `ticket-${printOrderId.slice(0, 8)}` : "ticket",
  });

  const processPrintQueue = useCallback(() => {
    if (printingRef.current) {
      return;
    }

    const printNext = () => {
      const nextOrderId = printQueueRef.current.shift();
      if (!nextOrderId) {
        printingRef.current = false;
        return;
      }

      printingRef.current = true;
      setPrintOrderId(nextOrderId);

      window.setTimeout(() => {
        void printNow();
        window.setTimeout(printNext, 850);
      }, 120);
    };

    printNext();
  }, [printNow]);

  const enqueuePrint = useCallback(
    (orderId: string) => {
      if (printQueueRef.current.includes(orderId)) {
        return;
      }
      printQueueRef.current.push(orderId);
      processPrintQueue();
    },
    [processPrintQueue],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KITCHEN_PREFERENCES_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<KitchenPreferences>;
      setPreferences({
        delayAlertMinutes: clamp(
          Number(parsed.delayAlertMinutes ?? DEFAULT_KITCHEN_PREFERENCES.delayAlertMinutes),
          8,
          90,
        ),
        defaultEtaMinutes: clamp(
          Number(parsed.defaultEtaMinutes ?? DEFAULT_KITCHEN_PREFERENCES.defaultEtaMinutes),
          8,
          75,
        ),
        soundEnabled: Boolean(parsed.soundEnabled ?? DEFAULT_KITCHEN_PREFERENCES.soundEnabled),
        autoPrintEnabled: Boolean(parsed.autoPrintEnabled ?? DEFAULT_KITCHEN_PREFERENCES.autoPrintEnabled),
      });
    } catch {
      // Keep defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(KITCHEN_PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const loadData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        if (!silent) {
          setLoading(false);
        }
        return;
      }

      if (!silent && !hydratedRef.current) {
        setLoading(true);
      }

      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const orderQuery = supabase
          .from("orders")
          .select(
            "id, statut, heure, total, eta_minutes, table:tables(numero), order_items(id, quantite, note, prix_unitaire, supplement, item:items(id, nom), accompaniment:accompaniments(nom), pizza_size:pizza_sizes(taille))",
          )
          .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
          .gte("heure", todayStart.toISOString())
          .order("heure", { ascending: false });

        const scopedQuery = historyOnly
          ? orderQuery.eq("statut", "ready")
          : orderQuery.in("statut", ["received", "preparing"]);

        const [orderResult, itemResult, callsResult] = await Promise.all([
          scopedQuery,
          supabase
            .from("items")
            .select("id, nom")
            .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
            .eq("disponible", true)
            .order("nom", { ascending: true }),
          supabase
            .from("server_calls")
            .select("id, motif, details, statut, heure, table:tables(numero)")
            .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
            .in("statut", ["pending", "acknowledged"])
            .order("heure", { ascending: false }),
        ]);

        if (orderResult.error || itemResult.error || callsResult.error) {
          setError(orderResult.error?.message ?? itemResult.error?.message ?? callsResult.error?.message ?? "Erreur chargement cuisine");
        } else {
          setError(null);
        }

        type RawKitchenOrder = Omit<KitchenOrderView, "table" | "order_items"> & {
          table: KitchenOrderView["table"] | Array<NonNullable<KitchenOrderView["table"]>>;
          order_items: Array<
            Omit<KitchenOrderView["order_items"][number], "item" | "accompaniment" | "pizza_size"> & {
              item: KitchenOrderView["order_items"][number]["item"] | Array<NonNullable<KitchenOrderView["order_items"][number]["item"]>>;
              accompaniment:
                | KitchenOrderView["order_items"][number]["accompaniment"]
                | Array<NonNullable<KitchenOrderView["order_items"][number]["accompaniment"]>>;
              pizza_size:
                | KitchenOrderView["order_items"][number]["pizza_size"]
                | Array<NonNullable<KitchenOrderView["order_items"][number]["pizza_size"]>>;
            }
          >;
        };
        type RawKitchenCall = Omit<KitchenCallView, "table"> & {
          table: KitchenCallView["table"] | Array<NonNullable<KitchenCallView["table"]>>;
        };

        const normalizedOrders = ((orderResult.data ?? []) as unknown as RawKitchenOrder[]).map((order) => ({
          ...order,
          table: Array.isArray(order.table) ? (order.table[0] ?? null) : order.table,
          order_items: order.order_items.map((line) => ({
            ...line,
            item: Array.isArray(line.item) ? (line.item[0] ?? null) : line.item,
            accompaniment: Array.isArray(line.accompaniment) ? (line.accompaniment[0] ?? null) : line.accompaniment,
            pizza_size: Array.isArray(line.pizza_size) ? (line.pizza_size[0] ?? null) : line.pizza_size,
          })),
        }));

        const normalizedCalls = ((callsResult.data ?? []) as unknown as RawKitchenCall[])
          .map((call) => ({
            ...call,
            table: Array.isArray(call.table) ? (call.table[0] ?? null) : call.table,
          }))
          .sort((left, right) => {
            const statusRank = { pending: 0, acknowledged: 1, closed: 2 } as const;
            const rankDiff = statusRank[left.statut] - statusRank[right.statut];
            if (rankDiff !== 0) {
              return rankDiff;
            }
            return new Date(left.heure).getTime() - new Date(right.heure).getTime();
          });

        const sortedOrders = [...normalizedOrders].sort((left, right) => {
          if (historyOnly) {
            return new Date(right.heure).getTime() - new Date(left.heure).getTime();
          }

          const rank = { received: 0, preparing: 1, ready: 2 } as const;
          const rankDiff = rank[left.statut] - rank[right.statut];
          if (rankDiff !== 0) {
            return rankDiff;
          }
          return new Date(left.heure).getTime() - new Date(right.heure).getTime();
        });

        if (!historyOnly) {
          const currentIds = new Set(sortedOrders.map((order) => order.id));

          if (hydratedRef.current) {
            const newlyArrived = sortedOrders.filter(
              (order) => !previousOrderIdsRef.current.has(order.id) && order.statut === "received",
            );

            if (newlyArrived.length > 0) {
              setNewOrderIds((current) => Array.from(new Set([...current, ...newlyArrived.map((order) => order.id)])));

              if (preferences.soundEnabled) {
                playNotificationTone("new_order");
              }

               newlyArrived.forEach((order) => {
                notifyInfo(
                  locale === "fr" ? "Nouvelle commande" : "New order",
                  `${locale === "fr" ? "Table" : "Table"} ${order.table?.numero ?? "-"}`,
                );
              });

              if (preferences.autoPrintEnabled) {
                newlyArrived.forEach((order) => enqueuePrint(order.id));
              }
            }
          }

          previousOrderIdsRef.current = currentIds;

          const pendingCallIds = new Set(
            normalizedCalls.filter((call) => call.statut === "pending").map((call) => call.id),
          );

          if (hydratedRef.current) {
            const newCalls = normalizedCalls.filter(
              (call) => call.statut === "pending" && !previousCallIdsRef.current.has(call.id),
            );

            newCalls.forEach((call) => {
              notifyInfo(
                locale === "fr" ? "Nouvel appel client" : "New table call",
                `${locale === "fr" ? "Table" : "Table"} ${call.table?.numero ?? "-"} · ${serverCallReasonLabel(call.motif, locale)}`,
              );
            });
          }

          previousCallIdsRef.current = pendingCallIds;
        }

        hydratedRef.current = true;
        setOrders(sortedOrders);
        setCalls(normalizedCalls);
        setAvailableItems(((itemResult.data ?? []) as unknown as Array<Pick<MenuItem, "id" | "nom">>) ?? []);
        setLastSyncAt(new Date().toISOString());
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Erreur chargement cuisine";
        setError(message);
        if (!silent) {
          notifyError(locale === "fr" ? "Cuisine indisponible" : "Kitchen load failed", message);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [enqueuePrint, historyOnly, locale, notifyError, notifyInfo, preferences.autoPrintEnabled, preferences.soundEnabled],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const refresh = () => void loadData({ silent: true });

    const channel = supabase
      .channel(historyOnly ? "kitchen-history" : "kitchen-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_items" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order_items" }, refresh)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "order_items" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "items" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "server_calls" }, () => {
        if (preferences.soundEnabled) {
          playNotificationTone("server_call");
        }
        refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "server_calls" }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [historyOnly, loadData, preferences.soundEnabled]);

  useEffect(() => {
    if (historyOnly) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadData({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [historyOnly, loadData]);

  useEffect(() => {
    if (newOrderIds.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNewOrderIds([]);
    }, 10000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [newOrderIds]);

  const printOrder = useMemo(
    () => orders.find((order) => order.id === printOrderId) ?? null,
    [orders, printOrderId],
  );

  const settingsLabel =
    locale === "fr"
      ? {
          title: "Paramètres cuisine",
          soundOn: "Son actif",
          soundOff: "Son coupé",
          testSound: "Tester le son",
          autoPrintOn: "Auto-impression active",
          autoPrintOff: "Auto-impression arrêtée",
          delayThreshold: "Alerte retard (min)",
          defaultEta: "ETA par défaut (min)",
          refresh: "Actualiser",
          applyEta: "Appliquer ETA",
          autoEta: "ETA auto",
          etaLabel: "ETA",
          elapsed: "Écoulé",
          lastSync: "Dernière synchro",
          newOrder: "Nouvelle",
          lateBy: "Retard",
        }
      : {
          title: "Kitchen settings",
          soundOn: "Sound on",
          soundOff: "Sound off",
          testSound: "Test sound",
          autoPrintOn: "Auto print on",
          autoPrintOff: "Auto print off",
          delayThreshold: "Delay alert (min)",
          defaultEta: "Default ETA (min)",
          refresh: "Refresh",
          applyEta: "Apply ETA",
          autoEta: "Auto ETA",
          etaLabel: "ETA",
          elapsed: "Elapsed",
          lastSync: "Last sync",
          newOrder: "New",
          lateBy: "Late",
        };

  async function setStatus(order: KitchenOrderView, status: OrderStatus) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const payload: { statut: OrderStatus; eta_minutes?: number } = { statut: status };
    if (status === "preparing" && !order.eta_minutes) {
      payload.eta_minutes = suggestedEtaMinutes(order, preferences.defaultEtaMinutes);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", order.id)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (updateError) {
      setError(updateError.message);
      notifyError(locale === "fr" ? "Statut non mis à jour" : "Status not updated", updateError.message);
      return;
    }

    setError(null);
    notifySuccess(
      locale === "fr" ? "Statut mis à jour" : "Status updated",
      `${locale === "fr" ? "Commande" : "Order"} #${order.id.slice(0, 8)} · ${orderStatusLabel(status, locale)}`,
    );
    void loadData({ silent: true });
  }

  async function updateEta(orderId: string, eta: number) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const normalizedEta = clamp(Math.round(eta), 0, 180);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ eta_minutes: normalizedEta })
      .eq("id", orderId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);

    if (updateError) {
      setError(updateError.message);
      notifyError(locale === "fr" ? "ETA non mis à jour" : "ETA not updated", updateError.message);
      return;
    }

    setError(null);
    notifySuccess(
      locale === "fr" ? "ETA mis à jour" : "ETA updated",
      `${locale === "fr" ? "Commande" : "Order"} #${orderId.slice(0, 8)} · ${normalizedEta} min`,
    );
    setEtaDrafts((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
    void loadData({ silent: true });
  }

  async function markItemOutOfStock() {
    const supabase = getBrowserSupabase();
    if (!supabase || !selectedItemOut) {
      return;
    }

    const { error: updateError } = await supabase
      .from("items")
      .update({ disponible: false })
      .eq("id", selectedItemOut)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (updateError) {
      setError(updateError.message);
      notifyError(locale === "fr" ? "Rupture non enregistrée" : "Out-of-stock update failed", updateError.message);
      return;
    }

    const selectedName = availableItems.find((item) => item.id === selectedItemOut)?.nom ?? "";
    setError(null);
    setSelectedItemOut("");
    notifySuccess(
      locale === "fr" ? "Plat marqué épuisé" : "Item marked out of stock",
      selectedName || undefined,
    );
    void loadData({ silent: true });
  }

  function triggerPrint(orderId: string) {
    enqueuePrint(orderId);
    notifyInfo(
      locale === "fr" ? "Ticket envoyé à l'impression" : "Ticket sent to print",
      `#${orderId.slice(0, 8)}`,
    );
  }

  async function updateCallStatus(callId: string, status: ServerCallStatus) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error: updateError } = await supabase
      .from("server_calls")
      .update({ statut: status })
      .eq("id", callId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (updateError) {
      setError(updateError.message);
      notifyError(
        locale === "fr" ? "Appel non mis à jour" : "Call status not updated",
        updateError.message,
      );
      return;
    }

    setError(null);
    notifySuccess(
      locale === "fr" ? "Appel mis à jour" : "Call updated",
      status === "closed"
        ? locale === "fr"
          ? "Appel clôturé"
          : "Call closed"
        : locale === "fr"
          ? "Appel acquitté"
          : "Call acknowledged",
    );
    void loadData({ silent: true });
  }

  return (
    <PageShell
      title={historyOnly ? messages.kitchen.history : messages.kitchen.title}
      subtitle={
        historyOnly
          ? "Commandes prêtes du jour"
          : `${messages.kitchen.liveOrders}${lastSyncAt ? ` · ${settingsLabel.lastSync}: ${formatDateTime(lastSyncAt, locale)}` : ""}`
      }
    >
      {error ? (
        <Card className="mb-4 border-[#9C3D3D] bg-[#fff5f5]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#8b2424]">{error}</p>
            <Button type="button" variant="secondary" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              {settingsLabel.refresh}
            </Button>
          </div>
        </Card>
      ) : null}

      {!historyOnly ? (
        <div className="mb-5 grid gap-4 xl:grid-cols-3">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-2xl text-[var(--color-dark-green)]">{settingsLabel.title}</h3>
              <Settings2 className="h-5 w-5 text-[var(--color-dark-green)]/70" />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <Button
                type="button"
                variant={preferences.soundEnabled ? "primary" : "secondary"}
                onClick={() => setPreferences((current) => ({ ...current, soundEnabled: !current.soundEnabled }))}
              >
                <Bell className="h-4 w-4" />
                {preferences.soundEnabled ? settingsLabel.soundOn : settingsLabel.soundOff}
              </Button>

              <Button
                type="button"
                variant={preferences.autoPrintEnabled ? "primary" : "secondary"}
                onClick={() =>
                  setPreferences((current) => ({
                    ...current,
                    autoPrintEnabled: !current.autoPrintEnabled,
                  }))
                }
              >
                <Printer className="h-4 w-4" />
                {preferences.autoPrintEnabled ? settingsLabel.autoPrintOn : settingsLabel.autoPrintOff}
              </Button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>{settingsLabel.delayThreshold}</FieldLabel>
                <TextInput
                  type="number"
                  min={8}
                  max={90}
                  value={preferences.delayAlertMinutes}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      delayAlertMinutes: clamp(Number(event.target.value || current.delayAlertMinutes), 8, 90),
                    }))
                  }
                />
              </div>

              <div>
                <FieldLabel>{settingsLabel.defaultEta}</FieldLabel>
                <TextInput
                  type="number"
                  min={8}
                  max={75}
                  value={preferences.defaultEtaMinutes}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      defaultEtaMinutes: clamp(Number(event.target.value || current.defaultEtaMinutes), 8, 75),
                    }))
                  }
                />
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="mt-3"
              onClick={() => {
                if (preferences.soundEnabled) {
                  playNotificationTone("default");
                }
              }}
              disabled={!preferences.soundEnabled}
            >
              <Bell className="h-4 w-4" />
              {settingsLabel.testSound}
            </Button>
          </Card>

          <Card>
            <div className="grid gap-3 md:grid-cols-[2fr_auto] md:items-end">
              <div>
                <FieldLabel>{messages.kitchen.markOutOfStock}</FieldLabel>
                <Select value={selectedItemOut} onChange={(event) => setSelectedItemOut(event.target.value)}>
                  <option value="">Choisir un plat</option>
                  {availableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="button" variant="danger" onClick={markItemOutOfStock} disabled={!selectedItemOut}>
                {messages.kitchen.markOutOfStock}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-2xl text-[var(--color-dark-green)]">{messages.waiter.incomingCalls}</h3>
              <Badge>{calls.length}</Badge>
            </div>
            {calls.length === 0 ? (
              <p className="text-sm text-[var(--color-black)]/65">{messages.waiter.noCalls}</p>
            ) : (
              <ul className="space-y-2">
                {calls.map((call) => (
                  <li key={call.id} className="rounded-xl border border-[var(--color-light-gray)] p-2">
                    <p className="text-sm font-semibold text-[var(--color-dark-green)]">
                      Table {call.table?.numero ?? "-"} · {serverCallReasonLabel(call.motif, locale)}
                    </p>
                    <p className="text-xs text-[var(--color-black)]/65">{formatDateTime(call.heure, locale)}</p>
                    {call.details ? <p className="mt-1 text-xs text-[var(--color-black)]/75">{call.details}</p> : null}
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void updateCallStatus(call.id, "acknowledged")}
                        disabled={call.statut !== "pending"}
                      >
                        {messages.waiter.acknowledge}
                      </Button>
                      <Button type="button" onClick={() => void updateCallStatus(call.id, "closed")}>
                        {messages.waiter.closeCall}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {loading && orders.length === 0 ? (
        <Card>{messages.common.loading}</Card>
      ) : orders.length === 0 ? (
        <Card>{messages.kitchen.noOrders}</Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const elapsed = delayInMinutes(order.heure);
            const isDelayed = !historyOnly && order.statut !== "ready" && elapsed >= preferences.delayAlertMinutes;
            const isNewOrder = newOrderIds.includes(order.id);
            const etaValue =
              etaDrafts[order.id] ??
              String(
                Number.isFinite(order.eta_minutes ?? NaN)
                  ? order.eta_minutes
                  : suggestedEtaMinutes(order, preferences.defaultEtaMinutes),
              );

            return (
              <Card
                key={order.id}
                className={cn(
                  isDelayed ? "border-[#9C3D3D]" : undefined,
                  isNewOrder ? "ring-2 ring-[var(--color-gold)]" : undefined,
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-2xl text-[var(--color-dark-green)]">
                      Commande #{order.id.slice(0, 8)} · Table {order.table?.numero ?? "-"}
                    </h3>
                    <p className="text-xs text-[var(--color-black)]/65">{formatDateTime(order.heure, locale)}</p>
                  </div>

                  <div className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge>{orderStatusLabel(order.statut, locale)}</Badge>
                      {isNewOrder ? <Badge className="bg-[#fdf2d5] text-[#7b5a12]">{settingsLabel.newOrder}</Badge> : null}
                    </div>
                    <p className="mt-1 text-lg font-bold text-[var(--color-dark-green)]">{formatCurrency(order.total, locale)}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-black)]/70">
                      <Clock3 className="h-3.5 w-3.5" />
                      {settingsLabel.elapsed}: {elapsed} min
                    </p>
                    {order.eta_minutes ? (
                      <p className="text-xs font-semibold text-[var(--color-dark-green)]">
                        {settingsLabel.etaLabel}: {order.eta_minutes} min
                      </p>
                    ) : null}
                    {isDelayed ? (
                      <p className="text-xs font-bold text-[#9C3D3D]">
                        {messages.kitchen.delayed} · {settingsLabel.lateBy} +{elapsed - preferences.delayAlertMinutes} min
                      </p>
                    ) : null}
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {order.order_items.map((line) => (
                    <li key={line.id} className="rounded-xl border border-[var(--color-light-gray)] p-2 text-sm">
                      <p className="font-semibold text-[var(--color-dark-green)]">
                        {line.quantite} × {line.item?.nom ?? "Plat supprimé"}
                      </p>
                      {line.pizza_size?.taille ? <p className="text-xs text-[var(--color-black)]/65">Format: {line.pizza_size.taille}</p> : null}
                      {line.accompaniment?.nom ? (
                        <p className="text-xs text-[var(--color-black)]/65">Accompagnement: {line.accompaniment.nom}</p>
                      ) : null}
                      {line.note ? <p className="text-xs text-[var(--color-black)]/65">Note: {line.note}</p> : null}
                    </li>
                  ))}
                </ul>

                {!historyOnly ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_auto_auto] md:items-end">
                    <div>
                      <FieldLabel>{messages.kitchen.updateStatus}</FieldLabel>
                      <Select value={order.statut} onChange={(event) => void setStatus(order, event.target.value as OrderStatus)}>
                        {ORDER_STATUS_FLOW.map((status) => (
                          <option key={status} value={status}>
                            {orderStatusLabel(status, locale)}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <FieldLabel>{messages.kitchen.etaMinutes}</FieldLabel>
                      <TextInput
                        type="number"
                        min={0}
                        max={180}
                        value={etaValue}
                        onChange={(event) =>
                          setEtaDrafts((current) => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void updateEta(
                          order.id,
                          Number(
                            etaDrafts[order.id] ??
                              order.eta_minutes ??
                              suggestedEtaMinutes(order, preferences.defaultEtaMinutes),
                          ),
                        )
                      }
                    >
                      {settingsLabel.applyEta}
                    </Button>

                    <Button type="button" variant="ghost" onClick={() => void updateEta(order.id, suggestedEtaMinutes(order, preferences.defaultEtaMinutes))}>
                      {settingsLabel.autoEta}
                    </Button>

                    <div className="md:col-span-4">
                      <Button type="button" variant="secondary" onClick={() => triggerPrint(order.id)}>
                        <Printer className="h-4 w-4" />
                        {messages.kitchen.printTicket}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <div className="hidden">
        <div ref={printRef}>
          {printOrder ? (
            <div style={{ fontFamily: "sans-serif", width: "300px", padding: "10px" }}>
              <h2 style={{ margin: 0 }}>L&apos;Adresse Dakar</h2>
              <p style={{ margin: "6px 0" }}>Ticket #{printOrder.id.slice(0, 8)}</p>
              <p style={{ margin: "6px 0" }}>Table {printOrder.table?.numero ?? "-"}</p>
              <p style={{ margin: "6px 0" }}>{formatDateTime(printOrder.heure, locale)}</p>
              {printOrder.eta_minutes ? <p style={{ margin: "6px 0" }}>ETA: {printOrder.eta_minutes} min</p> : null}
              <hr />
              {printOrder.order_items.map((line) => (
                <p key={line.id} style={{ margin: "6px 0" }}>
                  {line.quantite} x {line.item?.nom ?? "Plat supprimé"}
                  {line.accompaniment?.nom ? ` (${line.accompaniment.nom})` : ""}
                  {line.note ? ` - ${line.note}` : ""}
                </p>
              ))}
              <hr />
              <p style={{ fontWeight: 700 }}>Total: {formatCurrency(printOrder.total, locale)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
