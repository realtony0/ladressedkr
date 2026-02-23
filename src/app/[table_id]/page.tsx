import { ClientMenuPage } from "@/components/menu/client-menu-page";

export default async function TableMenuPage({
  params,
}: {
  params: Promise<{ table_id: string }>;
}) {
  const { table_id } = await params;

  return <ClientMenuPage tableId={table_id} />;
}
