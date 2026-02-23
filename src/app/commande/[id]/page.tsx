import { OrderTrackingPage } from "@/components/orders/order-tracking-page";

export default async function CommandePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { id } = await params;
  const { table } = await searchParams;

  return <OrderTrackingPage orderId={id} tableHint={table} />;
}
