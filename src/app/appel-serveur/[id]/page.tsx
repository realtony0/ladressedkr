import { ServerCallPage } from "@/components/orders/server-call-page";

export default async function AppelServeurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ServerCallPage tableId={id} />;
}
