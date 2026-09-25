"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Ban, Check, ChevronLeft, ChevronRight, Filter, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppointmentDialog, type AppointmentDialogSeed } from "@/components/agenda/appointment-dialog";
import { BlockDialog } from "@/components/agenda/block-dialog";
import { MonthView } from "@/components/agenda/month-view";
import { TeamView } from "@/components/agenda/team-view";
import { columnKey, TimeGrid, type GridColumn } from "@/components/agenda/time-grid";
import { PageHeader } from "@/components/shell/page-header";
import { PaymentDialog, type PaymentTarget } from "@/components/shared/payment-dialog";
import { statusDot } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useActions } from "@/lib/actions";
import { addDays, addMonths, isSameDay, startOfDay, startOfWeek } from "@/lib/dates";
import { formatDate, formatDayLong, formatMonth, formatWeekday, statusLabel } from "@/lib/format";
import { useLookups, useStore } from "@/lib/store";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "dia" | "semana" | "mes" | "equipe";
const ALL_STATUSES = Object.keys(statusLabel) as AppointmentStatus[];

export default function AgendaPage() {
  const { state, dispatch } = useStore();
  const { currentUser, customers, services } = useLookups();
  const { moveAppointment } = useActions();
  const isPro = currentUser.role === "profissional";

  const [view, setView] = useState<View>(isPro ? "semana" : "dia");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [proFilter, setProFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [statuses, setStatuses] = useState<AppointmentStatus[]>(ALL_STATUSES.filter((s) => s !== "cancelado"));
  const [dialog, setDialog] = useState<AppointmentDialogSeed | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentTarget | null>(null);

  // Profissional vê só a própria agenda (mesma regra das políticas RLS).
  const chosenPro = isPro ? (currentUser.professionalId ?? "") : proFilter;
  // Na semana, vários profissionais sobrepostos ficam ilegíveis; mostra um por vez.
  const effectivePro = view === "semana" && !chosenPro ? state.professionals[0].id : chosenPro;
  const professionals = state.professionals.filter((p) => !effectivePro || p.id === effectivePro);

  const filtered = useMemo(
    () =>
      state.appointments.filter(
        (a) =>
          (!effectivePro || a.professionalId === effectivePro) &&
          (!serviceFilter || a.serviceId === serviceFilter) &&
          statuses.includes(a.status),
      ),
    [state.appointments, effectivePro, serviceFilter, statuses],
  );

  const weekStart = startOfWeek(cursor);
  const [startMin, endMin] = useMemo(() => {
    let s = 24 * 60;
    let e = 0;
    for (const p of state.professionals)
      for (const ws of Object.values(p.workHours))
        for (const w of ws) {
          s = Math.min(s, w.start);
          e = Math.max(e, w.end);
        }
    return [Math.max(6 * 60, Math.floor(s / 60) * 60 - 60), Math.min(23 * 60, Math.ceil(e / 60) * 60 + 60)];
  }, [state.professionals]);

  const columns: GridColumn[] = useMemo(() => {
    if (view === "dia") {
      return professionals.map((p) => ({
        key: columnKey(cursor, p.id),
        day: cursor,
        professional: p,
        label: p.name,
        sublabel: p.title,
      }));
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return { key: columnKey(d), day: d, label: String(d.getDate()), sublabel: formatWeekday(d) };
    });
  }, [view, professionals, cursor, weekStart]);

  const step = (dir: 1 | -1) => {
    if (view === "dia") setCursor(addDays(cursor, dir));
    else if (view === "mes") setCursor(addMonths(cursor, dir));
    else setCursor(addDays(cursor, 7 * dir));
  };

  const rangeLabel =
    view === "dia"
      ? formatDayLong(cursor)
      : view === "mes"
        ? formatMonth(cursor)
        : `${formatDate(weekStart)} a ${formatDate(addDays(weekStart, 6))}`;

  const openDay = (d: Date) => {
    setCursor(startOfDay(d));
    setView("dia");
  };

  const conclude = (a: Appointment) => {
    dispatch({ type: "updateAppointment", id: a.id, patch: { status: "concluido" } });
    setDialog(null);
    // Profissional marca como concluído; o recebimento fica com a recepção.
    if (isPro) return;
    setPayment({
      title: `${customers.get(a.customerId)?.name} · ${services.get(a.serviceId)?.name}`,
      amountCents: a.priceCents,
      appointmentId: a.id,
      customerId: a.customerId,
      professionalId: a.professionalId,
    });
  };

  const dayCount = filtered.filter((a) => isSameDay(new Date(a.start), cursor) && a.status !== "cancelado").length;

  return (
    <div>
      <PageHeader
        title="Agenda"
        description={isPro ? "Sua agenda de atendimentos." : `${dayCount} agendamentos em ${formatDate(cursor)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setBlockOpen(true)}>
              <Ban /> Bloquear horário
            </Button>
            <Button onClick={() => setDialog({ start: nextQuarter(), professionalId: effectivePro || undefined })}>
              <Plus /> Novo agendamento
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label="Visualização"
          value={view}
          onChange={setView}
          options={[
            { value: "dia", label: "Dia" },
            { value: "semana", label: "Semana" },
            { value: "mes", label: "Mês" },
            ...(isPro ? [] : [{ value: "equipe" as const, label: "Equipe" }]),
          ]}
        />
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label="Período anterior">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" onClick={() => step(1)} aria-label="Próximo período">
            <ChevronRight />
          </Button>
          <Button variant="outline" onClick={() => setCursor(startOfDay(new Date()))}>
            Hoje
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {rangeLabel}
        </h2>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!isPro && (
            <Select aria-label="Filtrar por profissional" value={effectivePro} onChange={(e) => setProFilter(e.target.value)} className="w-auto">
              {view !== "semana" && <option value="">Todos os profissionais</option>}
              {state.professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )}
          <Select aria-label="Filtrar por serviço" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="w-auto">
            <option value="">Todos os serviços</option>
            {state.services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <StatusFilter value={statuses} onChange={setStatuses} />
        </div>
      </div>

      {view === "mes" ? (
        <MonthView cursor={cursor} appointments={filtered} blocks={state.blocks} onPickDay={openDay} onOpen={(a) => setDialog({ appointment: a })} />
      ) : view === "equipe" ? (
        <TeamView
          weekStart={weekStart}
          professionals={professionals}
          appointments={filtered}
          blocks={state.blocks}
          onOpen={(a) => setDialog({ appointment: a })}
          onPickDay={openDay}
        />
      ) : (
        <TimeGrid
          columns={columns}
          appointments={filtered}
          blocks={effectivePro ? state.blocks.filter((b) => !b.professionalId || b.professionalId === effectivePro) : state.blocks}
          startMin={startMin}
          endMin={endMin}
          canEdit
          onCreate={(start, professionalId) => setDialog({ start, professionalId: professionalId ?? (effectivePro || undefined) })}
          onOpen={(a) => setDialog({ appointment: a })}
          onMove={moveAppointment}
        />
      )}

      <ServiceLegend />

      <AppointmentDialog seed={dialog} onClose={() => setDialog(null)} onConclude={conclude} />
      <BlockDialog open={blockOpen} day={cursor} onClose={() => setBlockOpen(false)} />
      <PaymentDialog target={payment} onClose={() => setPayment(null)} />
    </div>
  );
}

function nextQuarter(): Date {
  const d = new Date();
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15, 0, 0);
  return d;
}

function StatusFilter({ value, onChange }: { value: AppointmentStatus[]; onChange: (v: AppointmentStatus[]) => void }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button variant="outline">
          <Filter /> Status{value.length < ALL_STATUSES.length ? ` (${value.length})` : ""}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className="z-50 w-56 rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
          {ALL_STATUSES.map((s) => {
            const checked = value.includes(s);
            return (
              <Dropdown.CheckboxItem
                key={s}
                checked={checked}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(c) => onChange(c ? [...value, s] : value.filter((x) => x !== s))}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-surface-2"
              >
                <span className={cn("grid size-5 place-items-center rounded-md border border-border", checked && "border-primary bg-primary text-primary-fg")}>
                  {checked && <Check className="size-3.5" />}
                </span>
                <span className={cn("size-2 rounded-full", statusDot[s])} aria-hidden />
                {statusLabel[s]}
              </Dropdown.CheckboxItem>
            );
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function ServiceLegend() {
  const { state } = useStore();
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted" aria-label="Legenda de serviços">
      {state.services.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span className={cn("svc size-3 rounded-sm", `svc-${s.color}`)} aria-hidden />
          {s.name}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="hatch size-3 rounded-sm border border-border" aria-hidden /> Bloqueado
      </li>
    </ul>
  );
}
