import type { Metadata } from "next";

// Affichage plein écran pour une TV/écran en salle : juste le logo,
// sans aucune interface. À ouvrir en plein écran (F11) sur l'appareil
// connecté à la TV — la page s'adapte à n'importe quelle taille d'écran.
export const metadata: Metadata = {
  title: "L'Aura Lounge",
  robots: { index: false, follow: false },
};

export default function EcranPage() {
  return (
    <div className="tv-screen">
      <div className="tv-glow" aria-hidden />

      <div className="tv-content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="" className="tv-badge" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-wordmark.png" alt="L'Aura" className="tv-wordmark" />
        <p className="tv-caption">Lounge</p>
      </div>

      <style>{`
        .tv-screen {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 38%, #4a4522 0%, #3d381a 55%, #2c2813 100%);
          cursor: none;
        }

        .tv-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 42%, rgba(238, 232, 220, 0.16), transparent 45%);
          animation: tv-breathe 7s ease-in-out infinite;
        }

        .tv-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(1.25rem, 3vw, 2.5rem);
          animation: tv-rise 1400ms ease-out both;
        }

        .tv-badge {
          height: clamp(90px, 16vh, 220px);
          width: clamp(90px, 16vh, 220px);
          border-radius: 9999px;
          box-shadow: 0 0 0 1px rgba(238, 232, 220, 0.12), 0 20px 80px -20px rgba(0, 0, 0, 0.6);
        }

        .tv-wordmark {
          width: clamp(280px, 42vw, 780px);
          max-width: 88vw;
          filter: drop-shadow(0 4px 30px rgba(0, 0, 0, 0.45));
        }

        .tv-caption {
          margin: 0;
          font-family: var(--font-serif), serif;
          font-weight: 600;
          font-size: clamp(0.85rem, 1.6vw, 1.35rem);
          letter-spacing: 0.55em;
          text-transform: uppercase;
          color: rgba(238, 232, 220, 0.82);
          padding-left: 0.55em; /* optical centering vs. the tracking */
        }

        @keyframes tv-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }

        @keyframes tv-rise {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
