"use client";

import { LOCAL_STORAGE_KEYS } from "@/lib/helpers/constants";

export function pushOrderHistory(tableNumber: string, orderId: string) {
  const key = LOCAL_STORAGE_KEYS.orderHistory(tableNumber);
  const current = getOrderHistory(tableNumber);
  if (!current.includes(orderId)) {
    window.localStorage.setItem(key, JSON.stringify([orderId, ...current].slice(0, 20)));
  }
}

export function getOrderHistory(tableNumber: string) {
  const key = LOCAL_STORAGE_KEYS.orderHistory(tableNumber);
  try {
    const data = window.localStorage.getItem(key);
    if (!data) {
      return [] as string[];
    }
    const parsed = JSON.parse(data) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as string[];
  }
}
