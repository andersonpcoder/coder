import { describe, expect, it } from "vitest";
import { normalizeHeader, parseBrDate, parseCsv, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("detecta ponto e vírgula, aspas e BOM", () => {
    const { header, rows } = parseCsv('﻿Nome;Observações\n"Silva; Ana";"disse ""oi"""\nBeto;\n');
    expect(header).toEqual(["Nome", "Observações"]);
    expect(rows).toEqual([["Silva; Ana", 'disse "oi"'], ["Beto", ""]]);
  });

  it("aceita vírgula e quebras de linha do Windows", () => {
    const { rows } = parseCsv("nome,telefone\r\nAna,11999990000\r\n\r\n");
    expect(rows).toEqual([["Ana", "11999990000"]]);
  });
});

describe("toCsv", () => {
  it("escapa aspas e usa ponto e vírgula com BOM", () => {
    expect(toCsv(["a"], [['x"y'], [null]])).toBe('﻿"a"\n"x""y"\n""');
  });
});

describe("parseBrDate e normalizeHeader", () => {
  it("converte datas brasileiras", () => {
    expect(parseBrDate("5/3/1990")).toBe("1990-03-05");
    expect(parseBrDate("1990-03-05")).toBe("1990-03-05");
    expect(parseBrDate("ontem")).toBeUndefined();
  });

  it("normaliza cabeçalhos com acento", () => {
    expect(normalizeHeader("Observações")).toBe("observacoes");
    expect(normalizeHeader("E-mail")).toBe("email");
  });
});
