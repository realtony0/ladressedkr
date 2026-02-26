import { NextResponse } from "next/server";

import { STAFF_ACCESS_COOKIE } from "@/lib/helpers/staff-code";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
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
