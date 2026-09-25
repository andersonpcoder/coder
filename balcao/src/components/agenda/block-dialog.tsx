"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { atMinutes, fromDateInput, parseTimeInput, toDateInput } from "@/lib/dates";
import { blockKindLabel } from "@/lib/format";
import { newId, useStore } from "@/lib/store";
import type { TimeBlockKind } from "@/lib/types";

/** Bloqueio de horário: almoço, folga, feriado ou outro motivo. */
export function BlockDialog({ open, day, onClose }: { open: boolean; day: Date; onClose: () => void }) {
  const { state, dispatch, toast } = useStore();
  const [kind, setKind] = useState<TimeBlockKind>("almoco");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setDate(toDateInput(day));
      setKind("almoco");
      setAllDay(false);
      setReason("");
    }
  }, [open, day]);

  const submit = () => {
    const d = fromDateInput(date);
    const s = allDay ? 0 : parseTimeInput(start);
    const e = allDay ? 24 * 60 - 1 : parseTimeInput(end);
    if (e <= s) {
      toast("O fim precisa ser depois do início.", "erro");
      return;
    }
    dispatch({
      type: "addBlock",
      block: {
        id: newId("b"),
        kind,
        professionalId: professionalId || undefined,
        reason: reason.trim() || blockKindLabel[kind],
        start: atMinutes(d, s).toISOString(),
        end: atMinutes(d, e).toISOString(),
      },
    });
    toast("Horário bloqueado.", "sucesso");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Bloquear horário"
      description="Horários bloqueados não aparecem na página pública e impedem novos agendamentos."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Bloquear</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Motivo">
          {(id) => (
            <Select
              id={id}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as TimeBlockKind;
                setKind(k);
                setAllDay(k === "folga" || k === "feriado");
              }}
            >
              {(Object.keys(blockKindLabel) as TimeBlockKind[]).map((k) => (
                <option key={k} value={k}>{blockKindLabel[k]}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Para quem">
          {(id) => (
            <Select id={id} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Toda a equipe</option>
              {state.professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Data">
          {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Dia inteiro
        </label>
        {!allDay && (
          <>
            <Field label="Início">
              {(id) => <Input id={id} type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} />}
            </Field>
            <Field label="Fim">
              {(id) => <Input id={id} type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} />}
            </Field>
          </>
        )}
        <Field label="Descrição (opcional)" className="sm:col-span-2">
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: consulta médica" />}
        </Field>
      </div>
    </Dialog>
  );
}
