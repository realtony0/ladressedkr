import { redirect } from "next/navigation";

import { SetupAdminPage } from "@/components/staff/setup-admin-page";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";

async function hasConfiguredAdmin() {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) {
    return false;
  }

  let query = serviceSupabase.from("users").select("id").in("role", ["admin", "proprio"]).limit(1);
  if (DEFAULT_RESTAURANT_ID) {
    query = query.eq("restaurant_id", DEFAULT_RESTAURANT_ID);
  }

  const { data, error } = await query;
  if (error) {
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export default async function SetupAdminRoutePage() {
  if (await hasConfiguredAdmin()) {
    redirect("/staff/login");
  }

  return <SetupAdminPage />;
}
