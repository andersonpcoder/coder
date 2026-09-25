import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <div className="mb-8 flex justify-center"><Logo /></div>
        <h1 className="text-3xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-muted">O endereço pode estar errado ou a página mudou de lugar.</p>
        <Button asChild className="mt-6"><Link href="/">Voltar ao início</Link></Button>
      </div>
    </div>
  );
}
