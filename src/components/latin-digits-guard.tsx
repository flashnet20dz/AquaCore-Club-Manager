"use client";

import { useEffect } from "react";
import { installLatinDigitsGuard } from "@/lib/date-utils";

// Run immediately during module execution on client
if (typeof window !== "undefined") {
  installLatinDigitsGuard();
}

export function LatinDigitsGuard() {
  useEffect(() => {
    installLatinDigitsGuard();
  }, []);

  return null;
}
