import { NextResponse } from "next/server";

import { MIN_STAFF_PASSWORD_LENGTH } from "@/lib/helpers/constants";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/helpers/staff-access";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";

interface BootstrapAdminBody {
  email?: string;
  prenom?: string;
  nom?: string;
  password?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function cleanEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

async function hasConfiguredAdmin() {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) {
    throw new Error("Service Supabase indisponible.");
  }

  let query = serviceSupabase.from("users").select("id").in("role", ["admin", "proprio"]).limit(1);
  if (DEFAULT_RESTAURANT_ID) {
    query = query.eq("restaurant_id", DEFAULT_RESTAURANT_ID);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data?.length ?? 0) > 0;
}

async function findAuthUserByEmail(email: string) {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) {
    throw new Error("Service Supabase indisponible.");
  }

  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await serviceSupabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    const users = data.users ?? [];
    const found = users.find((user) => (user.email ?? "").toLowerCase() === email);
    if (found) {
      return found;
    }
    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

export async function GET() {
  try {
    const configured = await hasConfiguredAdmin();

    return NextResponse.json({
      primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
      hasAdmin: configured,
      ready: Boolean(DEFAULT_RESTAURANT_ID),
      restaurantId: DEFAULT_RESTAURANT_ID || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur bootstrap admin." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) {
    return NextResponse.json({ error: "Service Supabase indisponible." }, { status: 500 });
  }

  if (!DEFAULT_RESTAURANT_ID) {
    return NextResponse.json({ error: "NEXT_PUBLIC_DEFAULT_RESTAURANT_ID est manquant." }, { status: 500 });
  }

  let body: BootstrapAdminBody;
  try {
    body = (await request.json()) as BootstrapAdminBody;
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  const prenom = cleanText(body.prenom);
  const nom = cleanText(body.nom);
  const password = body.password?.trim() ?? "";

  if (email !== PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json(
      {
        error: `Seul l'email admin principal est autorisé: ${PRIMARY_ADMIN_EMAIL}.`,
      },
      { status: 400 },
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  if (prenom.length < 2 || nom.length < 2) {
    return NextResponse.json({ error: "Prénom et nom requis (2 caractères minimum)." }, { status: 400 });
  }

  if (password.length < MIN_STAFF_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Mot de passe trop court. Minimum ${MIN_STAFF_PASSWORD_LENGTH} caractères.` },
      { status: 400 },
    );
  }

  const alreadyConfigured = await hasConfiguredAdmin();
  if (alreadyConfigured) {
    return NextResponse.json(
      { error: "Un admin existe déjà. Connectez-vous puis gérez les accès depuis l'interface admin." },
      { status: 409 },
    );
  }

  const existingAuthUser = await findAuthUserByEmail(email);
  const metadata = {
    role: "admin",
    restaurant_id: DEFAULT_RESTAURANT_ID,
  };

  let userId: string | null = null;
  let createdInAuth = false;

  if (existingAuthUser) {
    const { error: updateUserError } = await serviceSupabase.auth.admin.updateUserById(existingAuthUser.id, {
      password,
      email_confirm: true,
      app_metadata: {
        ...existingAuthUser.app_metadata,
        ...metadata,
      },
      user_metadata: {
        ...existingAuthUser.user_metadata,
        prenom,
        nom,
      },
    });

    if (updateUserError) {
      return NextResponse.json({ error: updateUserError.message }, { status: 500 });
    }

    userId = existingAuthUser.id;
  } else {
    const { data: createdUser, error: createUserError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: metadata,
      user_metadata: {
        prenom,
        nom,
      },
    });

    if (createUserError || !createdUser.user) {
      return NextResponse.json({ error: createUserError?.message ?? "Impossible de créer le compte admin." }, { status: 500 });
    }

    userId = createdUser.user.id;
    createdInAuth = true;
  }

  const { error: profileError } = await serviceSupabase.from("users").upsert(
    {
      id: userId,
      role: "admin",
      restaurant_id: DEFAULT_RESTAURANT_ID,
      prenom,
      nom,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    if (createdInAuth && userId) {
      await serviceSupabase.auth.admin.deleteUser(userId);
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    email,
    restaurantId: DEFAULT_RESTAURANT_ID,
  });
}
