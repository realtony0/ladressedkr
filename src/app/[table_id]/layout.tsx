import { SiteFooter } from "@/components/layout/site-footer";
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
      <CartProvider tableNumber={table_id}>
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <div className="pb-20 lg:pb-0">
            <SiteFooter />
          </div>
        </div>
      </CartProvider>
    </TableAccessProvider>
  );
}
