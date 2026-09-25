import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Módulos planejados para a próxima fase, com o escopo já definido. */
export function NextPhase({ items }: { items: string[] }) {
  return (
    <Card className="mt-5 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Construction className="size-4 text-accent" aria-hidden /> Próxima fase deste módulo
      </p>
      <ul className="mt-2 list-disc pl-5 text-sm text-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </Card>
  );
}
