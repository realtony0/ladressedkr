import { ServerCallPage } from "@/components/orders/server-call-page";
import { requireRouteRoles } from "@/lib/helpers/server-route-auth";

export default async function AppelServeurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteRoles(["cuisine", "serveur", "admin", "proprio"]);

  const { id } = await params;

  return <ServerCallPage tableId={id} />;
}
