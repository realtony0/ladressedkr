"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AdminPersonnelNav } from "@/components/admin/admin-personnel-nav";
import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { generateBrowserPassword } from "@/lib/helpers/password";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useNotifications } from "@/providers/notifications-provider";

interface CuisineUser {
  id: string;
  prenom: string;
  nom: string;
}

interface KitchenFormState {
  prenom: string;
  nom: string;
  email: string;
  password: string;
}

export function AdminKitchenAccessPage() {
  const { notifyError, notifySuccess } = useNotifications();
  const [users, setUsers] = useState<CuisineUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSuccess, setAccessSuccess] = useState<string | null>(null);
  const [kitchenForm, setKitchenForm] = useState<KitchenFormState>({
    prenom: "",
    nom: "",
    email: "",
    password: "",
  });
  const [credentialsPreview, setCredentialsPreview] = useState<{ email: string; password: string } | null>(null);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  const loadUsers = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoadingUsers(false);
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("id, prenom, nom")
      .eq("role", "cuisine")
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
      .order("prenom", { ascending: true });

    setUsers((data as CuisineUser[]) ?? []);
    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("admin-kitchen-access-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => void loadUsers())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadUsers]);

  async function createKitchenAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccessError(null);
    setAccessSuccess(null);
    setCredentialsPreview(null);
    setCreatingAccess(true);

    try {
      const payload = {
        prenom: kitchenForm.prenom.trim(),
        nom: kitchenForm.nom.trim(),
        email: kitchenForm.email.trim().toLowerCase(),
        role: "cuisine" as const,
        ...(kitchenForm.password.trim() ? { password: kitchenForm.password.trim() } : {}),
      };

      const response = await fetch("/api/admin/staff-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        error?: string;
        temporaryPassword?: string | null;
        staff?: { email?: string };
      };

      if (!response.ok) {
        setAccessError(result.error ?? "Impossible de créer l'accès cuisine.");
        notifyError("Accès cuisine non créé", result.error);
        setCreatingAccess(false);
        return;
      }

      const staffEmail = result.staff?.email ?? payload.email;
      const tempPassword = result.temporaryPassword ?? kitchenForm.password.trim();

      setCredentialsPreview(
        tempPassword
          ? {
              email: staffEmail,
              password: tempPassword,
            }
          : null,
      );
      setAccessSuccess(`Accès cuisine créé pour ${staffEmail}.`);
      notifySuccess("Accès cuisine créé", staffEmail);
      setKitchenForm({
        prenom: "",
        nom: "",
        email: "",
        password: "",
      });
      await loadUsers();
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Erreur réseau.");
      notifyError("Accès cuisine non créé", error instanceof Error ? error.message : undefined);
    } finally {
      setCreatingAccess(false);
    }
  }

  async function regenerateKitchenAccess(userId: string) {
    setAccessError(null);
    setAccessSuccess(null);
    setResettingUserId(userId);

    try {
      const response = await fetch("/api/admin/staff-access", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const result = (await response.json()) as { error?: string; temporaryPassword?: string };
      if (!response.ok || !result.temporaryPassword) {
        setAccessError(result.error ?? "Impossible de régénérer l'accès cuisine.");
        notifyError("Régénération impossible", result.error);
        setResettingUserId(null);
        return;
      }

      setResetPasswords((previous) => ({
        ...previous,
        [userId]: result.temporaryPassword as string,
      }));
      setAccessSuccess("Mot de passe cuisine régénéré avec succès.");
      notifySuccess("Mot de passe régénéré");
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Erreur réseau.");
      notifyError("Régénération impossible", error instanceof Error ? error.message : undefined);
    } finally {
      setResettingUserId(null);
    }
  }

  return (
    <PageShell title="Accès cuisine" subtitle="Page dédiée à la création et la régénération des accès cuisine.">
      <AdminPersonnelNav />

      <Card className="mb-5">
        <CardTitle className="font-heading text-3xl">Créer un accès cuisine</CardTitle>
        <form className="mt-4 space-y-4" onSubmit={(event) => void createKitchenAccess(event)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Prénom</FieldLabel>
              <TextInput
                value={kitchenForm.prenom}
                onChange={(event) => setKitchenForm((previous) => ({ ...previous, prenom: event.target.value }))}
                autoComplete="given-name"
                required
              />
            </div>
            <div>
              <FieldLabel>Nom</FieldLabel>
              <TextInput
                value={kitchenForm.nom}
                onChange={(event) => setKitchenForm((previous) => ({ ...previous, nom: event.target.value }))}
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div>
            <FieldLabel>Email cuisine</FieldLabel>
            <TextInput
              type="email"
              value={kitchenForm.email}
              onChange={(event) => setKitchenForm((previous) => ({ ...previous, email: event.target.value }))}
              autoComplete="email"
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <FieldLabel>Mot de passe (optionnel)</FieldLabel>
              <TextInput
                type="password"
                value={kitchenForm.password}
                onChange={(event) => setKitchenForm((previous) => ({ ...previous, password: event.target.value }))}
                placeholder="Laisser vide pour génération automatique"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setKitchenForm((previous) => ({
                  ...previous,
                  password: generateBrowserPassword(14),
                }))
              }
            >
              Générer un mot de passe
            </Button>
          </div>

          {accessError ? <p className="rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">{accessError}</p> : null}
          {accessSuccess ? <p className="rounded-xl bg-[#e3f8e8] p-3 text-sm text-[#1f5a2d]">{accessSuccess}</p> : null}
          {credentialsPreview ? (
            <div className="rounded-xl border border-[var(--color-gold)]/50 bg-[#fff9ea] p-3 text-sm text-[var(--color-black)]">
              <p className="font-semibold text-[var(--color-dark-green)]">Identifiants cuisine générés</p>
              <p className="mt-1">
                Email: <span className="font-mono">{credentialsPreview.email}</span>
              </p>
              <p className="mt-1">
                Mot de passe temporaire: <span className="font-mono">{credentialsPreview.password}</span>
              </p>
            </div>
          ) : null}

          <Button type="submit" disabled={creatingAccess}>
            {creatingAccess ? "Création en cours..." : "Créer l'accès cuisine"}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle className="font-heading text-3xl">Comptes cuisine</CardTitle>
        {loadingUsers ? (
          <p className="mt-3 text-sm">Chargement...</p>
        ) : users.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-black)]/65">Aucun compte cuisine.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {users.map((user) => (
              <li key={user.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--color-dark-green)]">
                    {user.prenom} {user.nom}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void regenerateKitchenAccess(user.id)}
                    disabled={resettingUserId === user.id}
                  >
                    {resettingUserId === user.id ? "Régénération..." : "Régénérer accès"}
                  </Button>
                </div>
                {resetPasswords[user.id] ? (
                  <p className="mt-2 rounded-xl bg-[#fff9ea] p-2 text-xs text-[var(--color-black)]">
                    Nouveau mot de passe temporaire: <span className="font-mono">{resetPasswords[user.id]}</span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
