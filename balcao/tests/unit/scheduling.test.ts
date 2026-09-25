import { describe, expect, it } from "vitest";
import { atMinutes, addDays, startOfDay } from "@/lib/dates";
import { availableSlots, findConflict, isWithinWorkHours, layoutLanes, recurrenceDates } from "@/lib/scheduling";
import type { Appointment, Professional, TimeBlock } from "@/lib/types";

// Segunda-feira fixa, longe do "agora", para os testes não dependerem da data.
const monday = new Date(2031, 0, 6);
const at = (h: number, m = 0) => atMinutes(monday, h * 60 + m);

const pro: Professional = {
  id: "p1", name: "Ana", title: "", avatarHue: 0, commissionPct: 40, serviceIds: ["s1"], active: true,
  workHours: { 1: [{ start: 9 * 60, end: 12 * 60 }] },
};

const appt = (start: Date, end: Date, extra: Partial<Appointment> = {}): Appointment => ({
  id: "a1", professionalId: "p1", serviceId: "s1", customerId: "c1",
  start: start.toISOString(), end: end.toISOString(), status: "agendado", channel: "site", priceCents: 0, ...extra,
});

describe("findConflict", () => {
  it("acusa sobreposição com outro agendamento do mesmo profissional", () => {
    const c = findConflict("p1", at(9, 30), at(10, 30), [appt(at(10), at(11))], []);
    expect(c?.kind).toBe("agendamento");
  });

  it("aceita horários encostados", () => {
    expect(findConflict("p1", at(9), at(10), [appt(at(10), at(11))], [])).toBeNull();
  });

  it("ignora cancelados, faltas, outro profissional e o próprio agendamento", () => {
    const list = [
      appt(at(9), at(10), { id: "x", status: "cancelado" }),
      appt(at(9), at(10), { id: "y", status: "faltou" }),
      appt(at(9), at(10), { id: "z", professionalId: "p2" }),
      appt(at(9), at(10), { id: "self" }),
    ];
    expect(findConflict("p1", at(9), at(10), list, [], "self")).toBeNull();
  });

  it("respeita bloqueios do profissional e da equipe inteira", () => {
    const own: TimeBlock = { id: "b1", professionalId: "p1", kind: "almoco", start: at(12).toISOString(), end: at(13).toISOString() };
    const all: TimeBlock = { id: "b2", kind: "feriado", start: at(15).toISOString(), end: at(16).toISOString() };
    const other: TimeBlock = { id: "b3", professionalId: "p2", kind: "folga", start: at(9).toISOString(), end: at(10).toISOString() };
    expect(findConflict("p1", at(12, 30), at(13), [], [own])?.kind).toBe("bloqueio");
    expect(findConflict("p1", at(15), at(15, 30), [], [all])?.kind).toBe("bloqueio");
    expect(findConflict("p1", at(9), at(10), [], [other])).toBeNull();
  });
});

describe("availableSlots", () => {
  it("lista horários de 15 em 15 minutos dentro do expediente, sem conflitos", () => {
    const slots = availableSlots(pro, monday, 60, [appt(at(10), at(11))], [], new Date(2030, 0, 1));
    const times = slots.map((d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
    expect(times).toEqual(["9:00", "11:00"]);
  });

  it("não oferece horários no passado", () => {
    const slots = availableSlots(pro, monday, 30, [], [], at(10, 40));
    expect(slots[0].getHours() * 60 + slots[0].getMinutes()).toBe(10 * 60 + 45);
  });

  it("dia sem expediente não tem horários", () => {
    expect(availableSlots(pro, addDays(monday, 1), 30, [], [], new Date(2030, 0, 1))).toEqual([]);
  });
});

describe("isWithinWorkHours", () => {
  it("valida o intervalo inteiro", () => {
    expect(isWithinWorkHours(pro, at(11), at(12))).toBe(true);
    expect(isWithinWorkHours(pro, at(11, 30), at(12, 30))).toBe(false);
  });
});

describe("recurrenceDates", () => {
  it("semanal, quinzenal e mensal", () => {
    const start = at(9);
    expect(recurrenceDates(start, "semanal", 3).map((d) => d.getDate())).toEqual([6, 13, 20]);
    expect(recurrenceDates(start, "quinzenal", 3).map((d) => d.getDate())).toEqual([6, 20, 3]);
    expect(recurrenceDates(start, "nenhuma", 5)).toHaveLength(1);
  });

  it("mensal no dia 31 cai no último dia dos meses curtos", () => {
    const jan31 = new Date(2031, 0, 31, 9);
    expect(recurrenceDates(jan31, "mensal", 3).map((d) => `${d.getMonth() + 1}/${d.getDate()}`)).toEqual(["1/31", "2/28", "3/31"]);
  });
});

describe("layoutLanes", () => {
  it("divide a largura entre itens sobrepostos", () => {
    const items = [
      { start: at(9).toISOString(), end: at(10).toISOString() },
      { start: at(9, 30).toISOString(), end: at(10, 30).toISOString() },
      { start: at(11).toISOString(), end: at(12).toISOString() },
    ];
    const out = layoutLanes(items);
    expect(out.map((o) => [o.lane, o.lanes])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });
});

describe("startOfDay", () => {
  it("zera a hora", () => {
    expect(startOfDay(at(15, 45)).getHours()).toBe(0);
  });
});
