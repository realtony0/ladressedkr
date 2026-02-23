import { randomInt } from "node:crypto";

import { NextResponse } from "next/server";

import { MIN_STAFF_PASSWORD_LENGTH } from "@/lib/helpers/constants";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/helpers/staff-access";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import type { Role } from "@/types/domain";

type AllowedCreatorRole = Extract<Role, "admin" | "proprio">;

interface StaffCreatorContext {
  userId: string;
  role: AllowedCreatorRole;
  restaurantId: string;
}

interface CreateKitchenAccessBody {
  email?: string;
  prenom?: string;
  nom?: string;
  password?: string;
  role?: Role;
}

interface ResetKitchenAccessBody {
  userId?: string;
  password?: string;
}

const ADMIN_ALLOWED_ROLES = new Set<Role>(["admin", "proprio"]);
const CREATABLE_ROLE: Role = "cuisine";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_ALPHABET = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghijkmnopqrstuvwxyz",
  number: "23456789",
  symbol: "@#$%+=!*?-_",
};

function randomChars(charset: string, length: number) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += charset[randomInt(0, charset.length)];
  }
  return value;
}

function shuffle(input: string[]) {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function generateSecurePassword(length = 14) {
  const safeLength = Math.max(length, MIN_STAFF_PASSWORD_LENGTH);
  const mandatory = [
    randomChars(PASSWORD_ALPHABET.upper, 1),
    randomChars(PASSWORD_ALPHABET.lower, 1),
    randomChars(PASSWORD_ALPHABET.number, 1),
    randomChars(PASSWORD_ALPHABET.symbol, 1),
  ];
  const allChars = [
    ...PASSWORD_ALPHABET.upper,
    ...PASSWORD_ALPHABET.lower,
    ...PASSWORD_ALPHABET.number,
    ...PASSWORD_ALPHABET.symbol,
  ].join("");
  const remaining = randomChars(allChars, safeLength - mandatory.length).split("");
  return shuffle([...mandatory, ...remaining]).join("");
}

function cleanName(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function cleanEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

async function requireStaffCreatorContext(): Promise<StaffCreatorContext | NextResponse> {
  const authSupabase = await getServerSupabase();
  if (!authSupabase) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Session invalide. Connectez-vous en tant qu'admin." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await authSupabase
    .from("users")
    .select("role, restaurant_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as Role | undefined;

  if (profileError || !profile || !role || !ADMIN_ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Accès refusé. Profil admin requis." }, { status: 403 });
  }

  return {
    userId: user.id,
    role: role as AllowedCreatorRole,
    restaurantId: profile.restaurant_id as string,
  };
}

export async function POST(request: Request) {
  const context = await requireStaffCreatorContext();
  if (context instanceof NextResponse) {
    return context;
  }

  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) {
    return NextResponse.json({ error: "Service Supabase indisponible." }, { status: 500 });
  }

  let body: CreateKitchenAccessBody;
  try {
    body = (await request.json()) as CreateKitchenAccessBody;
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  const prenom = cleanName(body.prenom);
  const nom = cleanName(body.nom);
  const requestedRole = body.role ?? CREATABLE_ROLE;
  const providedPassword = body.password?.trim() ?? "";

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }

  if (prenom.length < 2 || nom.length < 2) {
    return NextResponse.json({ error: "Le prénom et le nom sont requis (2 caractères minimum)." }, { status: 400 });
  }

  if (requestedRole !== CREATABLE_ROLE) {
    return NextResponse.json({ error: "Seuls les accès cuisine sont créables depuis cette interface." }, { status: 400 });
  }

  if (providedPassword && providedPassword.length < MIN_STAFF_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Mot de passe trop court. Minimum ${MIN_STAFF_PASSWORD_LENGTH} caractères.` },
      { status: 400 },
    );
  }

  if (email === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Cet email est réservé à l'accès admin principal." }, { status: 400 });
  }

  const password = providedPassword || generateSecurePassword();

  const { data: createdUser, error: createUserError } = await serviceSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: requestedRole,
      restaurant_id: context.restaurantId,
      created_by: context.userId,
    },
    user_metadata: {
      prenom,
      nom,
      role: requestedRole,
      restaurant_id: context.restaurantId,
      created_by: context.userId,
      created_by_role: context.role,
    },
  });

  if (createUserError || !createdUser.user) {
    if (createUserError?.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: "Cet email existe déjà. Utilisez un autre email." }, { status: 409 });
    }
    return NextResponse.json({ error: createUserError?.message ?? "Impossible de créer le compte cuisine." }, { status: 500 });
  }

  const authUser = createdUser.user;

  const { error: upsertProfileError } = await serviceSupabase.from("users").upsert(
    {
      id: authUser.id,
      role: requestedRole,
      restaurant_id: context.restaurantId,
      prenom,
      nom,
    },
    {
      onConflict: "id",
    },
  );

  if (upsertProfileError) {
    await serviceSupabase.auth.admin.deleteUser(authUser.id);
    return NextResponse.json({ error: `Compte créé puis annulé: ${upsertProfileError.message}` }, { status: 500 });
  }

  return NextResponse.json(
    {
      staff: {
        id: authUser.id,
        email: authUser.email ?? email,
        prenom,
        nom,
        role: requestedRole,
      },
      temporaryPassword: providedPassword ? null : password,
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const context = await requireStaffCreatorContext();
  if (context instanceof NextResponse) {
    return context;
  }

  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) {
    return NextResponse.json({ error: "Service Supabase indisponible." }, { status: 500 });
  }

  let body: ResetKitchenAccessBody;
  try {
    body = (await request.json()) as ResetKitchenAccessBody;
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId requis." }, { status: 400 });
  }

  const providedPassword = body.password?.trim() ?? "";
  if (providedPassword && providedPassword.length < MIN_STAFF_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Mot de passe trop court. Minimum ${MIN_STAFF_PASSWORD_LENGTH} caractères.` },
      { status: 400 },
    );
  }
  const password = providedPassword || generateSecurePassword();

  const { data: staffProfile, error: staffProfileError } = await serviceSupabase
    .from("users")
    .select("id, role, restaurant_id")
    .eq("id", userId)
    .eq("restaurant_id", context.restaurantId)
    .maybeSingle();

  if (staffProfileError) {
    return NextResponse.json({ error: staffProfileError.message }, { status: 500 });
  }

  if (!staffProfile) {
    return NextResponse.json({ error: "Profil introuvable dans votre restaurant." }, { status: 404 });
  }

  if ((staffProfile.role as Role) !== CREATABLE_ROLE) {
    return NextResponse.json({ error: "Réinitialisation autorisée uniquement pour les comptes cuisine." }, { status: 400 });
  }

  const { error: updateAuthError } = await serviceSupabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (updateAuthError) {
    return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
  }

  return NextResponse.json({
    userId,
    temporaryPassword: password,
  });
}
