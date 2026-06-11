import { BRAND } from "@/lib/helpers/constants";

export function SiteFooter() {
  return (
    <footer className="mt-10 bg-[var(--color-dark-green)] text-white/80">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="font-title bg-gradient-to-r from-[#9ec7b4] via-[var(--color-sage)] to-[var(--color-gold)] bg-clip-text text-3xl text-transparent">
              {BRAND.name}
            </p>
            <p className="mt-3 text-sm text-white/70">Plus qu&apos;une table, une expérience.</p>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-white">Navigation</p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>Menu</li>
              <li>Mon panier</li>
              <li>Mes commandes</li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-white">Notre adresse</p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>Corniche Ouest</li>
              <li>Dakar, Sénégal</li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-white">Contact</p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>ladresse.sn@outlook.fr</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/15 pt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} {BRAND.name}. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
