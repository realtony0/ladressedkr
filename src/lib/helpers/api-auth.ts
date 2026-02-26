import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { hasValidStaffAccessCookieFromStore } from "@/lib/helpers/staff-code";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Role } from "@/types/domain";

export interface StaffApiContext {
  userId: string;
  role: Role;
  restaurantId: string;
}

export async function requireStaffApiContext(
  allowedRoles: Role[],
): Promise<StaffApiContext | NextResponse> {
  const cookieStore = await cookies();
  if (!hasValidStaffAccessCookieFromStore(cookieStore)) {
    return NextResponse.json({ error: "Code staff requis." }, { status: 401 });
  }

  const authSupabase = await getServerSupabase();
  if (!authSupabase) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await authSupabase
    .from("users")
    .select("role, restaurant_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as Role | undefined;
  if (profileError || !profile || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  return {
    userId: user.id,
    role,
    restaurantId: profile.restaurant_id as string,
  };
}
