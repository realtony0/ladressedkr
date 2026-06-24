"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CalendarCheck } from "lucide-react";

import { Button } from "@/components/common/button";
import { Card, CardTitle } from "@/components/common/card";
import { FieldLabel, Select, TextArea, TextInput } from "@/components/common/field";
import { PageShell } from "@/components/layout/page-shell";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";

const TIME_SLOTS = [
  "12:00", "12:30", "13:00", "13:30", "14:00",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00",
];

export function VitrineReservationPage() {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("20:00");
  const [nbPersonnes, setNbPersonnes] = useState("2");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          telephone,
          email,
          date,
          heure,
          nbPersonnes: Number(nbPersonnes),
          message,
          restaurantId: DEFAULT_RESTAURANT_ID || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Impossible d'envoyer la demande.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Impossible d'envoyer la demande. Réessayez.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <PageShell title="Réservation" subtitle="">
        <Card className="mx-auto max-w-lg text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e5f6e5]">
            <CalendarCheck className="h-7 w-7 text-[var(--color-dark-green)]" />
          </span>
          <CardTitle className="mt-4 font-heading text-3xl">Demande envoyée !</CardTitle>
          <p className="mt-3 text-sm text-[var(--color-black)]/70">
            Merci {nom.split(" ")[0]}. Nous avons bien reçu votre demande de réservation
            pour {nbPersonnes} personne(s). Le restaurant vous confirmera très vite par téléphone.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="secondary">Retour à l&apos;accueil</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Réserver une table"
      subtitle="Remplissez le formulaire, le restaurant vous confirme votre table."
    >
      <Card className="mx-auto max-w-lg">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <FieldLabel>Nom complet *</FieldLabel>
            <TextInput value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div>
            <FieldLabel>Téléphone *</FieldLabel>
            <TextInput
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+221 …"
              required
            />
          </div>
          <div>
            <FieldLabel>Email (facultatif)</FieldLabel>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Date *</FieldLabel>
              <TextInput
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <FieldLabel>Heure *</FieldLabel>
              <Select value={heure} onChange={(e) => setHeure(e.target.value)}>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel>Nombre de personnes *</FieldLabel>
            <Select value={nbPersonnes} onChange={(e) => setNbPersonnes(e.target.value)}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n} personne{n > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel>Message (facultatif)</FieldLabel>
            <TextArea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Allergie, anniversaire, demande particulière…"
            />
          </div>

          {error ? <p className="rounded-xl bg-[#ffe4e4] p-3 text-sm text-[#8b2424]">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={submitting || !nom || !telephone || !date}>
            {submitting ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
