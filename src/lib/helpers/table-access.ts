import { LOCAL_STORAGE_KEYS } from "@/lib/helpers/constants";

export const TABLE_ACCESS_QUERY_PARAM = "access";

const TOKEN_MIN_LENGTH = 16;
const TOKEN_MAX_LENGTH = 128;

function normalizeToken(value: string | null | undefined) {
  const token = value?.trim() ?? "";
  if (token.length < TOKEN_MIN_LENGTH || token.length > TOKEN_MAX_LENGTH) {
    return null;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    return null;
  }
  return token;
}

export function createTableAccessToken(length = 36) {
  const safeLength = Math.max(TOKEN_MIN_LENGTH, Math.min(TOKEN_MAX_LENGTH, Math.floor(length)));
  const byteLength = Math.max(12, Math.ceil(safeLength / 2));
  const bytes = new Uint8Array(byteLength);

  if (typeof globalThis.crypto !== "undefined") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < byteLength; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").slice(0, safeLength);
}

export function buildTableQrUrl({
  baseUrl,
  tableNumber,
  accessToken,
}: {
  baseUrl: string;
  tableNumber: number;
  accessToken: string;
}) {
  const safeToken = normalizeToken(accessToken);
  if (!safeToken) {
    throw new Error("Invalid table access token.");
  }

  const normalizedBase = (baseUrl || "http://localhost:3000").trim().replace(/\/+$/, "");
  const url = new URL(`${normalizedBase}/${tableNumber}`);
  url.searchParams.set(TABLE_ACCESS_QUERY_PARAM, safeToken);
  return url.toString();
}

export function extractTableAccessTokenFromQrCode(qrCode: string | null | undefined) {
  if (!qrCode?.trim()) {
    return null;
  }
  try {
    const url = new URL(qrCode, "http://localhost:3000");
    return normalizeToken(url.searchParams.get(TABLE_ACCESS_QUERY_PARAM));
  } catch {
    return null;
  }
}

export function readStoredTableAccessToken(tableNumber: string) {
  if (typeof window === "undefined") {
    return null;
  }
  return normalizeToken(window.localStorage.getItem(LOCAL_STORAGE_KEYS.tableAccess(tableNumber)));
}

export function persistTableAccessToken(tableNumber: string, token: string) {
  if (typeof window === "undefined") {
    return;
  }
  const safeToken = normalizeToken(token);
  if (!safeToken) {
    return;
  }
  window.localStorage.setItem(LOCAL_STORAGE_KEYS.tableAccess(tableNumber), safeToken);
}

export function clearStoredTableAccessToken(tableNumber: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(LOCAL_STORAGE_KEYS.tableAccess(tableNumber));
}

export function captureTableAccessTokenFromLocation(tableNumber: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const fromUrl = normalizeToken(url.searchParams.get(TABLE_ACCESS_QUERY_PARAM));
  if (fromUrl) {
    persistTableAccessToken(tableNumber, fromUrl);
    url.searchParams.delete(TABLE_ACCESS_QUERY_PARAM);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    return fromUrl;
  }

  return readStoredTableAccessToken(tableNumber);
}

