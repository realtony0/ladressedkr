export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const isServiceKeyConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ladressedkr.com";

// Stable base used to build the printed QR codes. Set this to your OWN domain
// (e.g. https://ladressedkr.com) so printed QR codes never need reprinting when
// the underlying deployment changes — just re-point the domain. Falls back to
// APP_URL / the current origin when unset.
export const QR_BASE_URL = process.env.NEXT_PUBLIC_QR_BASE_URL?.trim() ?? "https://ladressedkr.com";
const SINGLE_RESTAURANT_FALLBACK_ID = "8f7c1bf8-feb5-4f34-88fb-781f2fd89d55";

// Application mono-restaurant: L'Adresse Dakar.
export const DEFAULT_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_RESTAURANT_ID?.trim() || SINGLE_RESTAURANT_FALLBACK_ID;
