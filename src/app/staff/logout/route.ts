import { NextResponse } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await getServerSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }

  const url = new URL("/staff/login", request.url);
  return NextResponse.redirect(url);
}
