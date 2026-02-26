import { NextResponse } from "next/server";

import {
  STAFF_ACCESS_COOKIE,
  STAFF_ACCESS_COOKIE_VALUE,
  isValidStaffAccessCode,
} from "@/lib/helpers/staff-code";

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
    return NextResponse.json({ error: "Code staff invalide." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: STAFF_ACCESS_COOKIE,
    value: STAFF_ACCESS_COOKIE_VALUE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

