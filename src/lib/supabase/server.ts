import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  isServiceKeyConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export async function getServerSupabase() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // This client is used from Server Components (layouts/pages), where
        // Next.js does not allow mutating cookies — calling cookieStore.set()
        // here does not persist to the response and can wipe the existing
        // cookie instead of leaving it alone. Session refresh/persistence is
        // handled by middleware.ts, which runs first and can write cookies
        // safely; this is the documented-safe no-op for the read-only path.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Expected when called during Server Component rendering — ignore.
        }
      },
    },
  });
}

export function getServiceSupabase() {
  if (!isServiceKeyConfigured) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
