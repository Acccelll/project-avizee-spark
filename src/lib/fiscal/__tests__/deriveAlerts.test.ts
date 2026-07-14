import { describe, it, expect } from "vitest";
import { deriveFiscalAlerts } from "../deriveAlerts";
import type { DashboardFiscalKpis } from "@/services/fiscal/dashboardFiscal.service";

const base: DashboardFiscalKpis = {
  saida: { autorizadas: 10, rejeitadas: 0, canceladas: 0, pendentes: 0, valorAutorizado: 0 },
  entrada: { total: 5, semManifestacao: 0, cienciaConfirmada: 5, desconhecidaNaoRealizada: 0, valorTotal: 0 },
  tributos: { icms: 0, ipi: 0, pis: 0, cofins: 0, icmsSt: 0 },
  sincronizacao: { ultimaSyncAt: null, ultimoCStat: null, qtdCnpjs: 1 },
  empresa: { proximoNumero: 1, serie: "1", modoEmissao: "1", contingenciaAtiva: false, ambiente: "2" },
  serieDiaria: [],
};

describe("deriveFiscalAlerts", () => {
  it("não gera alertas quando os KPIs estão saudáveis", () => {
    expect(deriveFiscalAlerts(base)).toEqual([]);
  });

  it("gera alerta crítico para rejeições", () => {
    const kpis = { ...base, saida: { ...base.saida, rejeitadas: 3 } };
    const [a] = deriveFiscalAlerts(kpis);
    expect(a.severidade).toBe("critica");
    expect(a.categoria).toBe("nfe");
    expect(a.mensagem).toContain("3");
  });

  it("gera aviso para DF-e sem manifestação", () => {
    const kpis = { ...base, entrada: { ...base.entrada, semManifestacao: 2 } };
    const [a] = deriveFiscalAlerts(kpis);
    expect(a.severidade).toBe("aviso");
    expect(a.categoria).toBe("sefaz");
  });

  it("gera crítico quando contingência está ativa", () => {
    const kpis = { ...base, empresa: { ...base.empresa, contingenciaAtiva: true } };
    const [a] = deriveFiscalAlerts(kpis);
    expect(a.severidade).toBe("critica");
    expect(a.titulo).toMatch(/contingência/i);
  });

  it("acumula múltiplos alertas", () => {
    const kpis: DashboardFiscalKpis = {
      ...base,
      saida: { ...base.saida, rejeitadas: 1 },
      entrada: { ...base.entrada, semManifestacao: 1 },
      empresa: { ...base.empresa, contingenciaAtiva: true },
    };
    expect(deriveFiscalAlerts(kpis)).toHaveLength(3);
  });
});