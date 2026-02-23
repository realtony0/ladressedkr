import { requireRouteRoles } from "@/lib/helpers/server-route-auth";

export default async function ProprioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRouteRoles(["proprio"]);
  return children;
}
