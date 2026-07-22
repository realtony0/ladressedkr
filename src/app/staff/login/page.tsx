"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { useNotifications } from "@/providers/notifications-provider";

export default function StaffLoginPage() {
  const { notifyError, notifySuccess } = useNotifications();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  const disabled = useMemo(() => !code || loading, [code, loading]);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("next");
    setNextPath(value);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/staff/access-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = payload?.error ?? "Code invalide.";
      setLoading(false);
      setError(message);
      notifyError("Connexion refusée", message);
      return;
    }

    notifySuccess("Connexion réussie");
    // Full navigation (not router.push) so the server always sees the
    // just-issued session cookies on the very first request.
    window.location.href = nextPath && nextPath.startsWith("/") ? nextPath : "/admin";
  }

  return (
    <PageShell title="Espace équipe" subtitle="Entre le code d'accès pour continuer">
      <Card className="mx-auto max-w-md">
        <div className="mb-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.png" alt="L'Amazonia" className="h-16 w-16 rounded-2xl" />
        </div>
        <CardTitle className="text-center font-heading text-3xl">Espace équipe</CardTitle>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <FieldLabel>Code d&apos;accès</FieldLabel>
            <TextInput
              type="password"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              autoFocus
              required
              className="text-center text-2xl tracking-[0.3em]"
            />
          </div>

          {error ? <p className="rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">{error}</p> : null}

          <Button type="submit" disabled={disabled} className="w-full">
            {loading ? "Connexion…" : "Entrer"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
