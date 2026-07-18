import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  STAFF_ACCESS_COOKIE,
  STAFF_ACCESS_COOKIE_VALUE,
  STAFF_SHARED_EMAIL,
  isValidStaffAccessCode,
} from "@/lib/helpers/staff-code";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isServiceKeyConfigured } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";

interface StaffCodeBody {
  code?: string;
}

export async function POST(request: Request) {
  let body: StaffCodeBody;
  try {
    body = (await request.json()) as StaffCodeBody;
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  if (!isValidStaffAccessCode(body.code)) {
    return NextResponse.json({ error: "Code invalide." }, { status: 401 });
  }

  if (!isServiceKeyConfigured) {
    return NextResponse.json(
      { error: "Supabase service role key manquante côté serveur." },
      { status: 500 },
    );
  }

  // Mint a real Supabase session for the shared "équipe" account server-side
  // (no password to store or type): generate a one-time magiclink token with
  // the service role key, then redeem it immediately with the anon key.
  const admin = getServiceSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 500 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: STAFF_SHARED_EMAIL,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message ?? "Impossible de créer la session équipe." },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  response.cookies.set({
    name: STAFF_ACCESS_COOKIE,
    value: STAFF_ACCESS_COOKIE_VALUE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  return response;
}
