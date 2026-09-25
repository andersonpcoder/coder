import { Sidebar } from "@/components/shell/sidebar";
import { SubscriptionGate } from "@/components/shell/subscription-gate";
import { Topbar } from "@/components/shell/topbar";
import { Toaster } from "@/components/ui/toaster";
import { StoreProvider } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3">
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="conteudo" className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <SubscriptionGate>{children}</SubscriptionGate>
          </main>
        </div>
      </div>
      <Toaster />
    </StoreProvider>
  );
}
