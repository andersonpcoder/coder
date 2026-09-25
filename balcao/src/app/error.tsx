"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center" role="alert">
      <div>
        <h1 className="text-3xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-muted">Tente de novo. Se continuar, recarregue a página.</p>
        {error.digest && <p className="mt-1 text-xs text-muted">Código: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Tentar de novo</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>
        </div>
      </div>
    </div>
  );
}
