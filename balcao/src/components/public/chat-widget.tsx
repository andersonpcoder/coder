"use client";

import { MessageCircle, SendHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatTime } from "@/lib/format";
import { publicApi, type ChatMessage } from "@/lib/public-api";
import { cn } from "@/lib/utils";

const VISITOR_KEY = "balcao:visitante";

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  }
}

/** Chat do site: as mensagens chegam na caixa de entrada do painel (canal Site). */
export function ChatWidget({ slug, company }: { slug: string; company: string }) {
  const [open, setOpen] = useState(false);
  const [visitor, setVisitor] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setVisitor(visitorId()), []);

  const refresh = useCallback(async () => {
    if (!visitor) return;
    try {
      setMessages(await publicApi().chatMessages(visitor));
    } catch {
      // Falha momentânea de rede: tenta de novo no próximo ciclo.
    }
  }, [visitor]);

  // Busca respostas a cada 4 segundos enquanto o chat está aberto.
  useEffect(() => {
    if (!open) return;
    refresh();
    const id = window.setInterval(refresh, 4000);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages.length, open]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError("");
    setText("");
    setMessages((m) => [...m, { direction: "entrada", body, at: new Date().toISOString() }]);
    try {
      await publicApi().chatSend(slug, visitor, name, body);
      refresh();
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <section aria-label={`Conversar com ${company}`} className="flex h-[min(480px,75dvh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[20px] border border-border bg-surface shadow-2xl">
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-fg">
            <div>
              <p className="font-semibold">{company}</p>
              <p className="text-xs opacity-85">Respondemos o mais rápido possível</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar chat" className="grid size-11 place-items-center rounded-xl hover:bg-white/10"><X className="size-5" /></button>
          </header>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3" role="log">
            {messages.length === 0 && <p className="mt-6 text-center text-sm text-muted">Mande sua dúvida. Você pode continuar navegando.</p>}
            {messages.map((m, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line", m.direction === "entrada" ? "self-end rounded-br-md bg-primary text-primary-fg" : "self-start rounded-bl-md bg-surface-2")}>
                {m.body}
                <span className="mt-0.5 block text-right text-[11px] opacity-70">{formatTime(m.at)}</span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {error && <p className="px-3 text-xs text-danger" role="alert">{error}</p>}
          <form onSubmit={send} className="flex flex-col gap-2 border-t border-border p-3">
            {messages.length === 0 && <Input aria-label="Seu nome" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />}
            <div className="flex gap-2">
              <Input aria-label="Mensagem" placeholder="Escreva sua mensagem" value={text} onChange={(e) => setText(e.target.value)} />
              <Button type="submit" size="icon" aria-label="Enviar" disabled={!text.trim()}><SendHorizontal /></Button>
            </div>
          </form>
        </section>
      )}
      <Button size="lg" className="rounded-full shadow-lg" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <MessageCircle className="!size-5" /> {open ? "Fechar" : "Fale conosco"}
      </Button>
    </div>
  );
}
