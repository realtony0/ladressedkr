import { OrderTrackingPage } from "@/components/orders/order-tracking-page";
import { requireRouteRoles } from "@/lib/helpers/server-route-auth";

export default async function CommandePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  await requireRouteRoles(["cuisine", "serveur", "admin", "proprio"]);

  const { id } = await params;
  const { table } = await searchParams;

  return <OrderTrackingPage orderId={id} tableHint={table} />;
}
