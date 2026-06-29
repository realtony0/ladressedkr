import Link from "next/link";
import { Clock, Mail, MapPin } from "lucide-react";

import { Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";

const HOURS = [
  { day: "Lundi – Vendredi", value: "12h00 – 15h00  ·  19h00 – 23h00" },
  { day: "Samedi", value: "Brunch 10h00 – 16h00  ·  19h00 – 23h30" },
  { day: "Dimanche", value: "Brunch 10h00 – 16h00" },
];

export default function InfosRoute() {
  return (
    <PageShell title="Infos & accès" subtitle="Horaires, adresse et contact de L'Adresse Dakar.">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle className="flex items-center gap-2 font-heading text-2xl">
            <Clock className="h-5 w-5" /> Horaires
          </CardTitle>
          <ul className="mt-4 space-y-3">
            {HOURS.map((h) => (
              <li key={h.day} className="flex flex-col border-b border-[var(--color-light-gray)] pb-3 last:border-0">
                <span className="font-semibold text-[var(--color-dark-green)]">{h.day}</span>
                <span className="text-sm text-[var(--color-black)]/70">{h.value}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2 font-heading text-2xl">
            <MapPin className="h-5 w-5" /> Nous trouver
          </CardTitle>
          <p className="mt-4 text-sm text-[var(--color-black)]/75">
            Rond-point Ngor
            <br />
            Dakar, Sénégal
          </p>
          <a
            href="https://www.google.com/maps/search/?api=1&query=Rond-point+Ngor+Dakar"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-full border border-[var(--color-light-gray)] px-5 py-2 text-sm font-semibold text-[var(--color-dark-green)]"
          >
            Ouvrir dans Google Maps
          </a>

          <div className="mt-6 space-y-2">
            <a
              href="mailto:ladresse.sn@outlook.fr"
              className="flex items-center gap-2 text-sm font-semibold text-[var(--color-dark-green)]"
            >
              <Mail className="h-4 w-4" /> ladresse.sn@outlook.fr
            </a>
          </div>
        </Card>
      </div>

      <div className="mt-6 rounded-2xl bg-[#eef4ee] p-6 text-center">
        <p className="text-sm text-[var(--color-black)]/75">Réservez votre table en quelques secondes.</p>
        <Link
          href="/reservation"
          className="mt-3 inline-block rounded-full bg-[var(--color-dark-green)] px-6 py-2.5 text-sm font-bold text-white"
        >
          Réserver une table
        </Link>
      </div>
    </PageShell>
  );
}
