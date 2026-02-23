import { ServerCallPage } from "@/components/orders/server-call-page";

export default async function TableCallPage({
  params,
}: {
  params: Promise<{ table_id: string }>;
}) {
  const { table_id } = await params;

  return <ServerCallPage tableId={table_id} />;
}
