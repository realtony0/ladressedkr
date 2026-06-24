import { requireRouteRoles } from "@/lib/helpers/server-route-auth";

export default async function CuisineLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRouteRoles(["cuisine", "serveur", "admin", "proprio"]);
  return children;
}
