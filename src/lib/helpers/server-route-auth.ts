import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { hasValidStaffAccessCookieFromStore } from "@/lib/helpers/staff-code";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Role } from "@/types/domain";

export async function requireRouteRoles(allowedRoles: Role[]) {
  const cookieStore = await cookies();
  if (!hasValidStaffAccessCookieFromStore(cookieStore)) {
    redirect("/staff/login");
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    redirect("/staff/login");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/staff/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as Role | undefined;
  if (profileError || !role || !allowedRoles.includes(role)) {
    redirect("/staff/login");
  }

  return {
    userId: user.id,
    role,
  };
}
