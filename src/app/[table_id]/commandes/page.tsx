import { ClientOrdersPage } from "@/components/orders/client-orders-page";

export default async function TableOrdersPage({
  params,
}: {
  params: Promise<{ table_id: string }>;
}) {
  const { table_id } = await params;

  return <ClientOrdersPage tableId={table_id} />;
}
