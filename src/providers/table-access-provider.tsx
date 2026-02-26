"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { captureTableAccessTokenFromLocation } from "@/lib/helpers/table-access";

interface TableAccessContextValue {
  isReady: boolean;
  accessToken: string | null;
}

const TableAccessContext = createContext<TableAccessContextValue | undefined>(undefined);

export function TableAccessProvider({
  tableNumber,
  children,
}: {
  tableNumber: string;
  children: React.ReactNode;
}) {
  const [isReady, setIsReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    setIsReady(false);
    setAccessToken(captureTableAccessTokenFromLocation(tableNumber));
    setIsReady(true);
  }, [tableNumber]);

  const value = useMemo(
    () => ({
      isReady,
      accessToken,
    }),
    [isReady, accessToken],
  );

  return <TableAccessContext.Provider value={value}>{children}</TableAccessContext.Provider>;
}

export function useTableAccess() {
  const context = useContext(TableAccessContext);
  if (!context) {
    throw new Error("useTableAccess must be used inside TableAccessProvider");
  }
  return context;
}

