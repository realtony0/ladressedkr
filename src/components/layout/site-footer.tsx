import { BRAND } from "@/lib/helpers/constants";

export function SiteFooter() {
  return (
    <footer className="mt-10 bg-[var(--color-dark-green)] text-white/80">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <p className="font-title bg-gradient-to-r from-[#9ec7b4] via-[var(--color-sage)] to-[var(--color-gold)] bg-clip-text text-3xl text-transparent">
              {BRAND.name}
            </p>
            <p className="mt-3 text-sm text-white/70">Plus qu&apos;une table, une expérience.</p>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-white">Notre adresse</p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>Rond-point Ngor</li>
              <li>Dakar, Sénégal</li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-white">Contact</p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>
                <a href="tel:+221774392199" className="hover:text-white">
                  +221 77 439 21 99
                </a>
              </li>
              <li>
                <a href="tel:+221776266439" className="hover:text-white">
                  +221 77 626 64 39
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/ladresse.lounge.dkr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  @ladresse.lounge.dkr
                </a>
              </li>
              <li>
                <a href="mailto:ladresse.sn@outlook.fr" className="hover:text-white">
                  ladresse.sn@outlook.fr
                </a>
              </li>
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
