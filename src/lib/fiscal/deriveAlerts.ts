import type { NotificacaoFiscal } from "@/modules/fiscal/operacional";
import type { DashboardFiscalKpis } from "@/services/fiscal/dashboardFiscal.service";

/**
 * Etapa 15 — Deriva alertas fiscais contextuais a partir dos KPIs consolidados.
 *
 * Não persiste nada e não substitui o Notification Center oficial — apenas
 * mapeia sinais do dashboard para o contrato `NotificacaoFiscal` do módulo
 * operacional, permitindo que a UI trate rejeições/DF-e/certificado com o
 * mesmo vocabulário do runtime.
 */
export function deriveFiscalAlerts(kpis: DashboardFiscalKpis): NotificacaoFiscal[] {
  const now = new Date().toISOString();
  const out: NotificacaoFiscal[] = [];

  if (kpis.saida.rejeitadas > 0) {
    out.push({
      id: `rej-${now}`,
      empresaId: "current",
      categoria: "nfe",
      titulo: "NF-e rejeitadas no período",
      mensagem: `${kpis.saida.rejeitadas} nota(s) rejeitada(s) pela SEFAZ aguardando correção.`,
      criadoEm: now,
      severidade: "critica",
      canais: ["app"],
    });
  }

  if (kpis.entrada.semManifestacao > 0) {
    out.push({
      id: `dfe-${now}`,
      empresaId: "current",
      categoria: "sefaz",
      titulo: "DF-e sem manifestação",
      mensagem: `${kpis.entrada.semManifestacao} documento(s) recebido(s) aguardando ciência/confirmação.`,
      criadoEm: now,
      severidade: "aviso",
      canais: ["app"],
    });
  }

  if (kpis.empresa.contingenciaAtiva) {
    out.push({
      id: `cont-${now}`,
      empresaId: "current",
      categoria: "sefaz",
      titulo: "Contingência ativa",
      mensagem: "A empresa está operando em modo de contingência. Revisar assim que possível.",
      criadoEm: now,
      severidade: "critica",
      canais: ["app"],
    });
  }

  return out;
}
