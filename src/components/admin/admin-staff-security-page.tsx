"use client";

import { FormEvent, useState } from "react";

import { AdminPersonnelNav } from "@/components/admin/admin-personnel-nav";
import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { MIN_STAFF_PASSWORD_LENGTH } from "@/lib/helpers/constants";
import { generateBrowserPassword } from "@/lib/helpers/password";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useNotifications } from "@/providers/notifications-provider";

export function AdminStaffSecurityPage() {
  const { notifyError, notifySuccess } = useNotifications();
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [updatingAdminPassword, setUpdatingAdminPassword] = useState(false);
  const [adminPasswordMessage, setAdminPasswordMessage] = useState<string | null>(null);
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null);

  async function updateMyAdminPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminPasswordError(null);
    setAdminPasswordMessage(null);

    if (adminPassword.length < MIN_STAFF_PASSWORD_LENGTH) {
      const message = `Mot de passe trop court. Minimum ${MIN_STAFF_PASSWORD_LENGTH} caractères.`;
      setAdminPasswordError(message);
      notifyError("Mot de passe invalide", message);
      return;
    }

    if (adminPassword !== adminPasswordConfirm) {
      const message = "Les mots de passe ne correspondent pas.";
      setAdminPasswordError(message);
      notifyError("Mot de passe invalide", message);
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      const message = "Supabase non configuré.";
      setAdminPasswordError(message);
      notifyError("Mise à jour impossible", message);
      return;
    }

    setUpdatingAdminPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: adminPassword,
      });

      if (error) {
        setAdminPasswordError(error.message);
        notifyError("Mise à jour impossible", error.message);
        setUpdatingAdminPassword(false);
        return;
      }

      setAdminPassword("");
      setAdminPasswordConfirm("");
      setAdminPasswordMessage("Mot de passe admin mis à jour.");
      notifySuccess("Mot de passe admin mis à jour");
    } catch (error) {
      setAdminPasswordError(error instanceof Error ? error.message : "Erreur réseau.");
      notifyError("Mise à jour impossible", error instanceof Error ? error.message : "Erreur réseau.");
    } finally {
      setUpdatingAdminPassword(false);
    }
  }

  return (
    <PageShell title="Sécurité admin" subtitle="Page dédiée à la sécurité du compte connecté.">
      <AdminPersonnelNav />

      <Card className="mx-auto max-w-2xl">
        <CardTitle className="font-heading text-3xl">Modifier le mot de passe admin</CardTitle>
        <form className="mt-4 space-y-4" onSubmit={(event) => void updateMyAdminPassword(event)}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <FieldLabel>Nouveau mot de passe admin</FieldLabel>
              <TextInput
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder={`Minimum ${MIN_STAFF_PASSWORD_LENGTH} caractères`}
                required
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => setAdminPassword(generateBrowserPassword(14))}>
              Générer un mot de passe
            </Button>
          </div>

          <div>
            <FieldLabel>Confirmer le mot de passe</FieldLabel>
            <TextInput
              type="password"
              value={adminPasswordConfirm}
              onChange={(event) => setAdminPasswordConfirm(event.target.value)}
              required
            />
          </div>

          {adminPasswordError ? <p className="rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">{adminPasswordError}</p> : null}
          {adminPasswordMessage ? <p className="rounded-xl bg-[#e3f8e8] p-3 text-sm text-[#1f5a2d]">{adminPasswordMessage}</p> : null}

          <Button type="submit" disabled={updatingAdminPassword}>
            {updatingAdminPassword ? "Mise à jour..." : "Mettre à jour mon mot de passe admin"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
