"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { routeForRole } from "@/lib/helpers/auth";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import type { Role } from "@/types/domain";

export default function StaffLoginPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  const disabled = useMemo(
    () => !email || !password || loading,
    [email, password, loading],
  );

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("next");
    setNextPath(value);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const supabase = getBrowserSupabase();
    if (!supabase) {
      const message = "Supabase n'est pas configuré. Ajoute NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.";
      setError(message);
      notifyError("Connexion impossible", message);
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setLoading(false);
      setError(messages.auth.invalid);
      notifyError("Connexion refusée", messages.auth.invalid);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    const role = profile?.role as Role | undefined;
    if (!role) {
      setLoading(false);
      setError(messages.auth.invalid);
      notifyError("Connexion refusée", messages.auth.invalid);
      return;
    }

    notifySuccess("Connexion réussie");
    router.push(nextPath && nextPath.startsWith("/") ? nextPath : routeForRole(role));
    router.refresh();
  }

  return (
    <PageShell title={messages.auth.title} subtitle={messages.auth.subtitle}>
      <Card className="mx-auto max-w-lg">
        <div className="mb-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.png" alt="L'Adresse Dakar" className="h-16 w-16 rounded-2xl" />
        </div>
        <CardTitle className="font-heading text-3xl">{messages.auth.signin}</CardTitle>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <FieldLabel>{messages.auth.email}</FieldLabel>
            <TextInput
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <FieldLabel>{messages.auth.password}</FieldLabel>
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <p className="rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">{error}</p> : null}

          <Button type="submit" disabled={disabled} className="w-full">
            {loading ? messages.common.loading : messages.auth.signin}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
