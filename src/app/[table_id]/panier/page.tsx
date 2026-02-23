import { CartPage } from "@/components/orders/cart-page";

export default async function TableCartPage({
  params,
}: {
  params: Promise<{ table_id: string }>;
}) {
  const { table_id } = await params;

  return <CartPage tableId={table_id} />;
}
