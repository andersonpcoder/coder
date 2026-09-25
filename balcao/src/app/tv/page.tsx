import type { Metadata } from "next";
import { StoreProvider } from "@/lib/store";
import { TvPanel } from "./tv-panel";

export const metadata: Metadata = { title: "Painel de chamadas" };

export default function TvPage() {
  return (
    <StoreProvider>
      <TvPanel />
    </StoreProvider>
  );
}
