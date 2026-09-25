import { describe, expect, it } from "vitest";
import { fromRow, hoursFromJson, hoursToJson, toRow } from "@/lib/db/mappers";
import { slugify } from "@/lib/segments";

describe("mapeadores do banco", () => {
  it("horário semanal ida e volta", () => {
    const wh = { 1: [{ start: 540, end: 1080 }], 6: [{ start: 540, end: 780 }] };
    expect(hoursToJson(wh)).toEqual({ 1: [{ inicio: "09:00", fim: "18:00" }], 6: [{ inicio: "09:00", fim: "13:00" }] });
    expect(hoursFromJson(hoursToJson(wh))).toEqual(wh);
  });

  it("toRow renomeia, ignora campos calculados e converte undefined em null", () => {
    expect(toRow("appointments", { start: "a", end: "b", manageToken: "t", notes: undefined, priceCents: 10 })).toEqual({
      starts_at: "a",
      ends_at: "b",
      notes: null,
      price_cents: 10,
    });
    expect(toRow("conversations", { unread: 0, messages: [] })).toEqual({ unread_count: 0 });
    expect(toRow("professionals", { title: "Barbeiro", serviceIds: [], workHours: {} })).toEqual({ role_title: "Barbeiro" });
  });

  it("fromRow de agendamento", () => {
    const a = fromRow.appointment({
      id: "1", professional_id: "p", service_id: "s", customer_id: "c", starts_at: "2031-01-06T12:00:00+00:00",
      ends_at: "2031-01-06T13:00:00+00:00", status: "agendado", channel: "site", price_cents: 100, notes: null,
      recurrence_id: null, unit_id: null, manage_token: "tok",
    });
    expect(a.start).toBe("2031-01-06T12:00:00.000Z");
    expect(a.notes).toBeUndefined();
    expect(a.manageToken).toBe("tok");
  });

  it("slugify para o link público", () => {
    expect(slugify("  Salão da Márcia & Cia! ")).toBe("salao-da-marcia-cia");
  });
});
