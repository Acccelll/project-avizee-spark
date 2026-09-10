import { describe, it, expect } from "vitest";
import { agruparPorColuna, decidirAcaoDrag, KANBAN_COLUNAS } from "../kanbanLogic";
import type { SuporteChamado } from "@/services/suporte.service";

function chamado(overrides: Partial<SuporteChamado>): SuporteChamado {
  return {
    id: "id-1",
    numero: "CH-000001",
    tipo: "bug",
    resumo: "x",
    descricao: "y",
    impacto: "incomodo",
    abrangencia: "so_eu",
    frequencia: "uma_vez",
    status: "aberto",
    prioridade: null,
    modulo: null,
    solicitante_id: "u1",
    reportado_por_nome: null,
    responsavel_id: null,
    registro_relacionado_tipo: null,
    registro_relacionado_id: null,
    rota: "/x",
    causa_resolucao: null,
    resumo_resolucao: null,
    decisao_sugestao: null,
    decisao_observacao: null,
    duplicado_de_id: null,
    github_issue_url: null,
    github_pr_url: null,
    github_commit_sha: null,
    versao_corrigida: null,
    diagnostic_session_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    resolved_at: null,
    closed_at: null,
    ...overrides,
  } as SuporteChamado;
}

describe("decidirAcaoDrag", () => {
  it("não faz nada quando solta na mesma coluna", () => {
    expect(decidirAcaoDrag("aberto", "aberto")).toBe("nenhuma");
  });

  it("abre a triagem (nunca move direto) ao soltar em 'resolvido'", () => {
    expect(decidirAcaoDrag("aberto", "resolvido")).toBe("abrir_resolucao");
    expect(decidirAcaoDrag("em_andamento", "resolvido")).toBe("abrir_resolucao");
  });

  it("move diretamente entre as demais colunas", () => {
    expect(decidirAcaoDrag("aberto", "em_triagem")).toBe("mover");
    expect(decidirAcaoDrag("em_triagem", "em_andamento")).toBe("mover");
    expect(decidirAcaoDrag("em_andamento", "aguardando_usuario")).toBe("mover");
  });

  it("mover para fora de 'resolvido' (reabertura pelo admin) também é 'mover' direto", () => {
    expect(decidirAcaoDrag("resolvido", "em_andamento")).toBe("mover");
  });
});

describe("agruparPorColuna", () => {
  it("cria uma entrada vazia para cada coluna, mesmo sem chamados", () => {
    const grupos = agruparPorColuna([]);
    for (const coluna of KANBAN_COLUNAS) {
      expect(grupos[coluna]).toEqual([]);
    }
  });

  it("agrupa cada chamado na coluna do seu status", () => {
    const c1 = chamado({ id: "1", status: "aberto" });
    const c2 = chamado({ id: "2", status: "em_andamento" });
    const c3 = chamado({ id: "3", status: "aberto" });

    const grupos = agruparPorColuna([c1, c2, c3]);

    expect(grupos.aberto.map((c) => c.id)).toEqual(["1", "3"]);
    expect(grupos.em_andamento.map((c) => c.id)).toEqual(["2"]);
  });

  it("ignora chamados em status fora do quadro (fechado/cancelado)", () => {
    const ativo = chamado({ id: "1", status: "aberto" });
    const fechado = chamado({ id: "2", status: "fechado" });
    const cancelado = chamado({ id: "3", status: "cancelado" });

    const grupos = agruparPorColuna([ativo, fechado, cancelado]);

    const todosIds = Object.values(grupos).flat().map((c) => c.id);
    expect(todosIds).toEqual(["1"]);
  });
});
