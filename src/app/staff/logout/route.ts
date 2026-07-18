import { NextResponse } from "next/server";

import { STAFF_ACCESS_COOKIE } from "@/lib/helpers/staff-code";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Next.js automatically prefetches <Link> targets. Without this guard, the
  // prefetch of the "Déconnexion" link would silently sign the user out on
  // every page load. Only act on a real, user-initiated navigation.
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("x-purpose") === "prefetch" ||
    new URL(request.url).searchParams.has("_rsc");

  if (isPrefetch) {
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await getServerSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }

  const url = new URL("/staff/login", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: STAFF_ACCESS_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
