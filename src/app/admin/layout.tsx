import { requireRouteRoles } from "@/lib/helpers/server-route-auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRouteRoles(["admin", "proprio"]);
  return children;
}
