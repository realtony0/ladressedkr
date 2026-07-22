import type { Metadata, Viewport } from "next";

import { TopNav } from "@/components/layout/top-nav";
import { PwaRegister } from "@/components/layout/pwa-register";
import { I18nProvider } from "@/providers/i18n-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "L'Amazonia — Restaurant à Dakar | Menu & Réservation",
  description:
    "L'Amazonia, cuisine élégante entre esprit bistro parisien et fraîcheur africaine, au rond-point Ngor. Consultez la carte et réservez votre table en ligne.",
  applicationName: "L'Amazonia",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "L'Amazonia",
    description: "Plus qu'une table, une expérience. Rond-point Ngor, Dakar.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7A9E7E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <I18nProvider>
          <NotificationsProvider>
            <PwaRegister />
            <TopNav />
            {children}
          </NotificationsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
