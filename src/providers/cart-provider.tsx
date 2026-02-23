"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { LOCAL_STORAGE_KEYS } from "@/lib/helpers/constants";
import type { CartLine, MenuItem } from "@/types/domain";

interface AddLineInput {
  item: MenuItem;
  note: string;
  accompanimentId?: string | null;
  accompanimentLabel?: string | null;
  accompanimentPrice?: number;
  pizzaSizeId?: string | null;
  pizzaSizeLabel?: string | null;
  pizzaSizePrice?: number;
}

interface CartContextValue {
  isReady: boolean;
  lines: CartLine[];
  addLine: (input: AddLineInput) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function sanitizeMenuItem(value: unknown): MenuItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<MenuItem>;
  if (typeof item.id !== "string" || !item.id || typeof item.nom !== "string" || !item.nom) {
    return null;
  }

  const prix = typeof item.prix === "number" && Number.isFinite(item.prix) ? item.prix : 0;

  return {
    id: item.id,
    nom: item.nom,
    description: typeof item.description === "string" ? item.description : "",
    prix,
    photo: typeof item.photo === "string" ? item.photo : null,
    categorie_id: typeof item.categorie_id === "string" ? item.categorie_id : "",
    subcategorie_id:
      typeof item.subcategorie_id === "string" || item.subcategorie_id === null
        ? item.subcategorie_id
        : null,
    disponible: typeof item.disponible === "boolean" ? item.disponible : true,
    allergenes: Array.isArray(item.allergenes)
      ? item.allergenes.filter((entry): entry is string => typeof entry === "string")
      : [],
    a_accompagnement: typeof item.a_accompagnement === "boolean" ? item.a_accompagnement : false,
    restaurant_id: typeof item.restaurant_id === "string" ? item.restaurant_id : "",
    plat_du_jour: typeof item.plat_du_jour === "boolean" ? item.plat_du_jour : false,
  };
}

function readCartLines(tableNumber: string): CartLine[] {
  if (typeof window === "undefined") {
    return [];
  }

  const key = LOCAL_STORAGE_KEYS.cart(tableNumber);
  const stored = window.localStorage.getItem(key);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized = parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const line = entry as Partial<CartLine>;
        const item = sanitizeMenuItem(line.item);
        if (!item) {
          return null;
        }

        const quantity = Number.isFinite(line.quantity) ? Math.max(1, Math.floor(line.quantity as number)) : 1;
        const accompanimentPrice =
          typeof line.accompanimentPrice === "number" && Number.isFinite(line.accompanimentPrice)
            ? line.accompanimentPrice
            : 0;
        const pizzaSizePrice =
          typeof line.pizzaSizePrice === "number" && Number.isFinite(line.pizzaSizePrice)
            ? line.pizzaSizePrice
            : item.prix;

        return {
          lineId: typeof line.lineId === "string" && line.lineId ? line.lineId : makeLineId(),
          item,
          quantity,
          note: typeof line.note === "string" ? line.note : "",
          accompanimentId:
            typeof line.accompanimentId === "string" || line.accompanimentId === null
              ? line.accompanimentId
              : null,
          accompanimentLabel:
            typeof line.accompanimentLabel === "string" || line.accompanimentLabel === null
              ? line.accompanimentLabel
              : null,
          accompanimentPrice,
          pizzaSizeId: typeof line.pizzaSizeId === "string" || line.pizzaSizeId === null ? line.pizzaSizeId : null,
          pizzaSizeLabel:
            typeof line.pizzaSizeLabel === "string" || line.pizzaSizeLabel === null
              ? line.pizzaSizeLabel
              : null,
          pizzaSizePrice,
        } satisfies CartLine;
      })
      .filter((line): line is CartLine => Boolean(line));

    return normalized;
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function writeCartLines(tableNumber: string, lines: CartLine[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEYS.cart(tableNumber), JSON.stringify(lines));
}

function makeLineId() {
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeNote(note: string) {
  return note.trim();
}

function lineSignature({
  itemId,
  accompanimentId,
  pizzaSizeId,
  note,
}: {
  itemId: string;
  accompanimentId: string | null;
  pizzaSizeId: string | null;
  note: string;
}) {
  return `${itemId}::${accompanimentId ?? "none"}::${pizzaSizeId ?? "none"}::${note.toLowerCase()}`;
}

export function CartProvider({
  tableNumber,
  children,
}: {
  tableNumber: string;
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>(() => readCartLines(tableNumber));
  const [isReady, setIsReady] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    setIsReady(false);
    setLines(readCartLines(tableNumber));
    setIsReady(true);
  }, [tableNumber]);

  useEffect(() => {
    const key = LOCAL_STORAGE_KEYS.cart(tableNumber);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) {
        setLines(readCartLines(tableNumber));
      }
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [tableNumber]);

  const value = useMemo<CartContextValue>(
    () => ({
      isReady,
      lines,
      addLine: (input) => {
        const normalized = normalizeNote(input.note);
        const nextSignature = lineSignature({
          itemId: input.item.id,
          accompanimentId: input.accompanimentId ?? null,
          pizzaSizeId: input.pizzaSizeId ?? null,
          note: normalized,
        });

        setLines((current) => {
          const existingIndex = current.findIndex((line) => {
            const currentSignature = lineSignature({
              itemId: line.item.id,
              accompanimentId: line.accompanimentId,
              pizzaSizeId: line.pizzaSizeId,
              note: normalizeNote(line.note),
            });
            return currentSignature === nextSignature;
          });

          if (existingIndex === -1) {
            const nextLines = [
              ...current,
              {
                lineId: makeLineId(),
                item: input.item,
                quantity: 1,
                note: normalized,
                accompanimentId: input.accompanimentId ?? null,
                accompanimentLabel: input.accompanimentLabel ?? null,
                accompanimentPrice: input.accompanimentPrice ?? 0,
                pizzaSizeId: input.pizzaSizeId ?? null,
                pizzaSizeLabel: input.pizzaSizeLabel ?? null,
                pizzaSizePrice: input.pizzaSizePrice ?? input.item.prix,
              },
            ];
            writeCartLines(tableNumber, nextLines);
            return nextLines;
          }

          const nextLines = current.map((line, index) =>
            index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line,
          );
          writeCartLines(tableNumber, nextLines);
          return nextLines;
        });
      },
      updateQuantity: (lineId, quantity) => {
        setLines((current) => {
          const nextLines = current
            .map((line) => (line.lineId === lineId ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0);
          writeCartLines(tableNumber, nextLines);
          return nextLines;
        });
      },
      removeLine: (lineId) => {
        setLines((current) => {
          const nextLines = current.filter((line) => line.lineId !== lineId);
          writeCartLines(tableNumber, nextLines);
          return nextLines;
        });
      },
      clearCart: () => {
        writeCartLines(tableNumber, []);
        setLines([]);
      },
      subtotal: lines.reduce(
        (sum, line) =>
          sum +
          (line.pizzaSizePrice + line.accompanimentPrice) *
            (Number.isFinite(line.quantity) ? line.quantity : 1),
        0,
      ),
    }),
    [isReady, lines, tableNumber],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
