import { describe, it, expect } from "vitest";
import { coletarDiagnostico } from "@/lib/suporte/diagnostico";

describe("coletarDiagnostico", () => {
  it("coleta apenas informação de ambiente, sem erro, quando nenhum é passado", () => {
    const diag = coletarDiagnostico();

    expect(diag.url_relativa).toBeDefined();
    expect(diag.navegador).toBeDefined();
    expect(diag.viewport).toMatch(/^\d+x\d+$/);
    expect(diag.idioma).toBeDefined();
    expect(diag.conectividade).toBeDefined();
    expect(diag.erro_mensagem_amigavel).toBeUndefined();
    expect(diag.erro_stack_trace).toBeUndefined();
  });

  it("inclui contexto_tela quando fornecido pelo chamador", () => {
    const diag = coletarDiagnostico({ contextoTela: { abaAtiva: "fatura", filtro: "vencidos" } });
    expect(diag.contexto_tela).toEqual({ abaAtiva: "fatura", filtro: "vencidos" });
  });

  it("inclui os campos de erro quando um erro tratado é passado", () => {
    const diag = coletarDiagnostico({
      erro: {
        codigo: "ERR_X",
        operacao: "salvar_lancamento",
        mensagemAmigavel: "Não foi possível salvar.",
        correlationId: "corr-123",
        httpStatus: 500,
        stackTrace: "Error: boom\n  at foo (bar.ts:1:1)",
      },
    });

    expect(diag.erro_codigo).toBe("ERR_X");
    expect(diag.erro_operacao).toBe("salvar_lancamento");
    expect(diag.erro_mensagem_amigavel).toBe("Não foi possível salvar.");
    expect(diag.erro_correlation_id).toBe("corr-123");
    expect(diag.erro_http_status).toBe(500);
    expect(diag.erro_stack_trace).toContain("boom");
  });

  it("nunca inclui chaves de senha/token/cookie/authorization", () => {
    const diag = coletarDiagnostico({
      contextoTela: { filtro: "ativo" },
      erro: { mensagemAmigavel: "erro", stackTrace: "stack" },
    });

    const serialized = JSON.stringify(diag).toLowerCase();
    expect(serialized).not.toContain("senha");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("cookie");
    expect(serialized).not.toContain("authorization");
  });
});
