import { CartProvider } from "@/providers/cart-provider";
import { TableAccessProvider } from "@/providers/table-access-provider";

export default async function TableLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ table_id: string }>;
}>) {
  const { table_id } = await params;

  return (
    <TableAccessProvider tableNumber={table_id}>
      <CartProvider tableNumber={table_id}>{children}</CartProvider>
    </TableAccessProvider>
  );
}
