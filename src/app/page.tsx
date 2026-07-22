import Link from "next/link";
import { CalendarCheck, Clock, MapPin, UtensilsCrossed } from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=70";
const DISH_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=70";

const HIGHLIGHTS = [
  {
    icon: UtensilsCrossed,
    title: "Cuisine bistro & africaine",
    text: "Entre esprit bistro parisien et fraîcheur de Dakar.",
  },
  {
    icon: Clock,
    title: "Tous les jours",
    text: "Ouvert de 9h à 2h du matin, 7j/7.",
  },
  {
    icon: MapPin,
    title: "Rond-point Ngor",
    text: "Au cœur de Dakar, à Ngor.",
  },
];

export default function Home() {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--color-dark-green)]/80 via-[var(--color-dark-green)]/65 to-[var(--color-dark-green)]/85" />

        <div className="mx-auto flex min-h-[72vh] w-full max-w-7xl flex-col items-center justify-center px-4 py-20 text-center md:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-cream.png" alt="L'Amazonia" className="h-24 w-auto md:h-28" />
          <p className="mt-4 font-logo text-lg text-[var(--color-cream)]/90">L&apos;Amazonia</p>
          <h1 className="mt-3 font-title text-4xl text-white sm:text-5xl md:text-6xl">
            Plus qu&apos;une table,
            <br />
            une expérience.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/85 md:text-lg">
            Cuisine élégante entre esprit bistro parisien et fraîcheur africaine,
            au rond-point Ngor, Dakar.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/reservation"
              className="flex items-center gap-2 rounded-full bg-[var(--color-cream)] px-7 py-3 text-base font-bold text-[var(--color-dark-green)] transition-transform hover:-translate-y-0.5"
            >
              <CalendarCheck className="h-5 w-5" /> Réserver une table
            </Link>
            <Link
              href="/carte"
              className="flex items-center gap-2 rounded-full border-2 border-white/80 px-7 py-3 text-base font-bold text-white transition-colors hover:bg-white/10"
            >
              Voir la carte
            </Link>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {HIGHLIGHTS.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.title}
                className="rounded-2xl border border-[var(--color-light-gray)] bg-white p-6 text-center"
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef4ee]">
                  <Icon className="h-6 w-6 text-[var(--color-dark-green)]" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-[var(--color-dark-green)]">{h.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-black)]/70">{h.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Showcase band */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 md:px-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl border border-[var(--color-light-gray)] bg-white md:grid-cols-2">
          <div
            className="h-64 w-full bg-cover bg-center md:h-full md:min-h-[20rem]"
            style={{ backgroundImage: `url(${DISH_IMAGE})` }}
          />
          <div className="p-8 md:p-10">
            <h2 className="font-title text-3xl text-[var(--color-dark-green)] md:text-4xl">
              Une carte généreuse
            </h2>
            <p className="mt-4 text-sm text-[var(--color-black)]/75 md:text-base">
              Entrées fraîches, viandes grillées, poissons du jour, pizzas, pâtes
              et créations du bar sans alcool. Tout est fait maison, avec des
              produits choisis.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/carte"
                className="rounded-full bg-[var(--color-dark-green)] px-6 py-2.5 text-sm font-bold text-white"
              >
                Découvrir la carte
              </Link>
              <Link
                href="/infos"
                className="rounded-full border border-[var(--color-light-gray)] px-6 py-2.5 text-sm font-bold text-[var(--color-dark-green)]"
              >
                Horaires & accès
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
