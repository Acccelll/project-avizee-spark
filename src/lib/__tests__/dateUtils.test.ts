import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { todayISO, isoDateOffset, toLocalISODate } from "@/lib/dateUtils";

// "Hoje" tem de ser o dia do usuário no Brasil, mesmo depois das 21h, quando
// em UTC já é o dia seguinte.
describe("dateUtils no horário de Brasília", () => {
  const tzOriginal = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/Sao_Paulo";
  });
  afterAll(() => {
    process.env.TZ = tzOriginal;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("todayISO devolve o dia local às 22h30 (em UTC já é amanhã)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T01:30:00Z")); // 16/11 22:30 em Brasília
    // eslint-disable-next-line no-restricted-syntax -- reproduz de propósito o bug antigo
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-11-17"); // o bug antigo
    expect(todayISO()).toBe("2026-11-16");
  });

  it("isoDateOffset conta a partir do dia local", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-30T23:00:00Z")); // 30/11 20:00 em Brasília
    expect(isoDateOffset(0)).toBe("2026-11-30");
    expect(isoDateOffset(1)).toBe("2026-12-01");
    expect(isoDateOffset(-30)).toBe("2026-10-31");
  });

  it("toLocalISODate mantém o dia de datas montadas no horário local", () => {
    expect(toLocalISODate(new Date(2026, 10, 30))).toBe("2026-11-30"); // último dia do mês
    expect(toLocalISODate(new Date(2026, 10, 16, 23, 59))).toBe("2026-11-16");
  });
});
