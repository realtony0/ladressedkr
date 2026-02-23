import type { Metadata, Viewport } from "next";

import { TopNav } from "@/components/layout/top-nav";
import { PwaRegister } from "@/components/layout/pwa-register";
import { I18nProvider } from "@/providers/i18n-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "L'Adresse Dakar | Gestion Restaurant",
  description: "Plateforme complète de gestion restaurant pour L'Adresse Dakar.",
  applicationName: "L'Adresse Dakar",
  manifest: "/manifest.webmanifest",
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
