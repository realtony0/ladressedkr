import type { Metadata, Viewport } from "next";

import { TopNav } from "@/components/layout/top-nav";
import { PwaRegister } from "@/components/layout/pwa-register";
import { I18nProvider } from "@/providers/i18n-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "L'Adresse Dakar — Restaurant à Dakar | Menu & Réservation",
  description:
    "L'Adresse Dakar, cuisine élégante entre esprit bistro parisien et fraîcheur africaine, sur la Corniche Ouest. Consultez la carte et réservez votre table en ligne.",
  applicationName: "L'Adresse Dakar",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "L'Adresse Dakar",
    description: "Plus qu'une table, une expérience. Corniche Ouest, Dakar.",
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
