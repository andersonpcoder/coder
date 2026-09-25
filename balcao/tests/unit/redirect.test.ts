import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";

describe("safeNext", () => {
  it("aceita caminhos internos", () => {
    expect(safeNext("/agenda?dia=2026-01-01")).toBe("/agenda?dia=2026-01-01");
    expect(safeNext("/convite/abc")).toBe("/convite/abc");
  });

  it("recusa outros sites e javascript:", () => {
    for (const value of ["https://mal.com", "//mal.com", "/\\mal.com", "javascript:alert(1)", "/\tmal", "", null]) {
      expect(safeNext(value)).toBe("/painel");
    }
  });
});
