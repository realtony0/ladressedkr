"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { MIN_STAFF_PASSWORD_LENGTH } from "@/lib/helpers/constants";
import { generateBrowserPassword } from "@/lib/helpers/password";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/helpers/staff-access";
import { useNotifications } from "@/providers/notifications-provider";

interface BootstrapStatus {
  primaryAdminEmail: string;
  hasAdmin: boolean;
  ready: boolean;
  restaurantId: string | null;
}

export default function SetupAdminPage() {
  const { notifyError, notifySuccess } = useNotifications();
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prenom, setPrenom] = useState("Admin");
  const [nom, setNom] = useState("L'Adresse");
  const [email, setEmail] = useState(PRIMARY_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const disabled = useMemo(() => {
    return saving || !prenom.trim() || !nom.trim() || !email.trim() || !password || !confirmPassword;
  }, [saving, prenom, nom, email, password, confirmPassword]);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);

    try {
      const response = await fetch("/api/staff/bootstrap-admin", {
        method: "GET",
      });
      const result = (await response.json()) as BootstrapStatus & { error?: string };

      if (!response.ok) {
        const message = result.error ?? "Impossible de vérifier la configuration admin.";
        setError(message);
        notifyError("Configuration admin", message);
        setLoadingStatus(false);
        return;
      }

      setStatus(result);
      setEmail(result.primaryAdminEmail || PRIMARY_ADMIN_EMAIL);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Erreur réseau.";
      setError(message);
      notifyError("Configuration admin", message);
    } finally {
      setLoadingStatus(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      const message = "Les mots de passe ne correspondent pas.";
      setError(message);
      notifyError("Mot de passe invalide", message);
      return;
    }

    if (password.length < MIN_STAFF_PASSWORD_LENGTH) {
      const message = `Mot de passe trop court. Minimum ${MIN_STAFF_PASSWORD_LENGTH} caractères.`;
      setError(message);
      notifyError("Mot de passe invalide", message);
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/staff/bootstrap-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prenom: prenom.trim(),
          nom: nom.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = result.error ?? "Impossible de créer l'accès admin.";
        setError(message);
        notifyError("Création admin impossible", message);
        setSaving(false);
        return;
      }

      setSuccess("Accès admin créé. Vous pouvez maintenant vous connecter.");
      notifySuccess("Accès admin créé", email.trim().toLowerCase());
      setPassword("");
      setConfirmPassword("");
      await loadStatus();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Erreur réseau.";
      setError(message);
      notifyError("Création admin impossible", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      title="Configuration admin"
      subtitle="Configuration initiale de l'accès admin principal, directement depuis l'interface."
    >
      <Card className="mx-auto max-w-xl">
        <CardTitle className="font-heading text-3xl">Accès admin principal</CardTitle>

        {loadingStatus ? <p className="mt-4 text-sm">Chargement de la configuration...</p> : null}

        {!loadingStatus && status && !status.ready ? (
          <p className="mt-4 rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">
            Configuration incomplète: `NEXT_PUBLIC_DEFAULT_RESTAURANT_ID` est requis.
          </p>
        ) : null}

        {!loadingStatus && status?.hasAdmin ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-[#e8f5e9] p-3 text-sm text-[#1f5a2d]">
              L&apos;accès admin est déjà configuré pour <strong>{status.primaryAdminEmail}</strong>.
            </p>
            <Link href="/staff/login" className="text-sm font-semibold text-[var(--color-dark-green)] underline">
              Aller à la connexion staff
            </Link>
          </div>
        ) : null}

        {!loadingStatus && status && !status.hasAdmin ? (
          <form className="mt-5 space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Prénom</FieldLabel>
                <TextInput value={prenom} onChange={(event) => setPrenom(event.target.value)} autoComplete="given-name" required />
              </div>
              <div>
                <FieldLabel>Nom</FieldLabel>
                <TextInput value={nom} onChange={(event) => setNom(event.target.value)} autoComplete="family-name" required />
              </div>
            </div>

            <div>
              <FieldLabel>Email admin principal</FieldLabel>
              <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <FieldLabel>Mot de passe</FieldLabel>
                <TextInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={`Minimum ${MIN_STAFF_PASSWORD_LENGTH} caractères`}
                  required
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => setPassword(generateBrowserPassword(14))}>
                Générer un mot de passe
              </Button>
            </div>

            <div>
              <FieldLabel>Confirmer le mot de passe</FieldLabel>
              <TextInput
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">{error}</p> : null}
            {success ? <p className="rounded-xl bg-[#e8f5e9] p-3 text-sm text-[#1f5a2d]">{success}</p> : null}

            <Button type="submit" disabled={disabled}>
              {saving ? "Création en cours..." : "Créer l'accès admin"}
            </Button>
          </form>
        ) : null}

        {!loadingStatus && !status ? (
          <p className="mt-4 rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">
            Impossible de charger la configuration. Vérifiez Supabase puis réessayez.
          </p>
        ) : null}
      </Card>
    </PageShell>
  );
}
