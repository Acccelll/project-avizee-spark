import { describe, expect, it } from "vitest";
import { montarTextoCopiavel } from "../diagnosticoTexto";

const BASE = {
  url_relativa: "/financeiro/lancamentos",
  versao_build: "2026.09.10-abc123",
  ambiente: "production",
  navegador: "Chrome 128",
  sistema_operacional: "Windows 11",
  viewport: "1920x1080",
  idioma: "pt-BR",
  conectividade: "4g",
  contexto_tela: null,
  erro_mensagem_amigavel: null,
  erro_codigo: null,
  erro_operacao: null,
  erro_correlation_id: null,
  erro_http_status: null,
  erro_stack_trace: null,
  erros_recentes: null,
  requisicoes_rede: null,
};

describe("montarTextoCopiavel", () => {
  it("inclui o número do chamado e os campos de ambiente/contexto", () => {
    const texto = montarTextoCopiavel("CH-000123", BASE);
    expect(texto).toContain("CH-000123");
    expect(texto).toContain("Chrome 128");
    expect(texto).toContain("/financeiro/lancamentos");
  });

  it("omite a seção de erro quando não há dados de erro", () => {
    const texto = montarTextoCopiavel("CH-000123", BASE);
    expect(texto).not.toContain("Erro:");
  });

  it("inclui a seção de erro quando há mensagem amigável", () => {
    const texto = montarTextoCopiavel("CH-000123", { ...BASE, erro_mensagem_amigavel: "Falha ao salvar" });
    expect(texto).toContain("Erro:");
    expect(texto).toContain("Falha ao salvar");
  });

  it("inclui o stack trace só quando presente", () => {
    const texto = montarTextoCopiavel("CH-000123", {
      ...BASE,
      erro_mensagem_amigavel: "Falha ao salvar",
      erro_stack_trace: "TypeError: x is not a function\n  at foo.js:1",
    });
    expect(texto).toContain("Stack trace:");
    expect(texto).toContain("TypeError: x is not a function");
  });

  it("resume contexto_tela como pares chave=valor no texto, sem despejar JSON bruto na UI", () => {
    const texto = montarTextoCopiavel("CH-000123", {
      ...BASE,
      contexto_tela: { lancamento_id: "abc", tela: "detalhe" },
    });
    expect(texto).toContain("Contexto da tela");
  });
});
