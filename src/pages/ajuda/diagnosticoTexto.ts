import type { obterDiagnosticoSuporte } from "@/services/suporte.service";

export type Diagnostico = Awaited<ReturnType<typeof obterDiagnosticoSuporte>>;

/**
 * Texto estruturado para "Copiar diagnóstico" (spec §29) — não é o JSON da
 * linha, é um resumo legível pronto para colar num Issue do GitHub.
 */
export function montarTextoCopiavel(chamadoNumero: string, d: NonNullable<Diagnostico>): string {
  const linhas = [
    `Diagnóstico — ${chamadoNumero}`,
    "",
    "Ambiente:",
    `  Navegador: ${d.navegador ?? "—"}`,
    `  Sistema operacional: ${d.sistema_operacional ?? "—"}`,
    `  Viewport: ${d.viewport ?? "—"}`,
    `  Idioma: ${d.idioma ?? "—"}`,
    `  Conectividade: ${d.conectividade ?? "—"}`,
    "",
    "Contexto:",
    `  Rota: ${d.url_relativa ?? "—"}`,
    `  Versão/build: ${d.versao_build ?? "—"}`,
    `  Ambiente (prod/stage): ${d.ambiente ?? "—"}`,
  ];
  if (d.contexto_tela && Object.keys(d.contexto_tela).length > 0) {
    linhas.push(`  Contexto da tela: ${JSON.stringify(d.contexto_tela)}`);
  }
  if (d.erro_mensagem_amigavel || d.erro_codigo || d.erro_correlation_id) {
    linhas.push(
      "",
      "Erro:",
      `  Mensagem: ${d.erro_mensagem_amigavel ?? "—"}`,
      `  Código: ${d.erro_codigo ?? "—"}`,
      `  Operação: ${d.erro_operacao ?? "—"}`,
      `  Correlation ID: ${d.erro_correlation_id ?? "—"}`,
      `  HTTP status: ${d.erro_http_status ?? "—"}`,
    );
    if (d.erro_stack_trace) linhas.push("", "Stack trace:", d.erro_stack_trace);
  }
  return linhas.join("\n");
}
