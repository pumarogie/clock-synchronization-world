"use client";

import { ReactNode } from "react";
import { SocketProvider } from "./context/SocketContext";

export function Providers({ children }: { children: ReactNode }) {
  return <SocketProvider>{children}</SocketProvider>;
}
