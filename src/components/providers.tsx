"use client";

import { SessionProvider } from "next-auth/react";
import { PoolProvider } from "@/hooks/use-pools";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PoolProvider>
        {children}
      </PoolProvider>
    </SessionProvider>
  );
}
