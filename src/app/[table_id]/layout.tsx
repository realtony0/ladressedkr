import { CartProvider } from "@/providers/cart-provider";

export default async function TableLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ table_id: string }>;
}>) {
  const { table_id } = await params;

  return <CartProvider tableNumber={table_id}>{children}</CartProvider>;
}
