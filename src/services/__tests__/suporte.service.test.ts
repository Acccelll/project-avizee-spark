import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
const storageFromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
    storage: { from: (...args: unknown[]) => storageFromMock(...args) },
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  },
}));

import {
  assumirChamado,
  atribuirResponsavelChamado,
  cancelarChamado,
  confirmarResolucaoSuporte,
  criarChamadoSuporte,
  getAnexoSignedUrl,
  getChamado,
  listarAdmins,
  listarEventosChamado,
  listarMeusChamados,
  marcarChamadoDuplicado,
  obterDiagnosticoSuporte,
  registrarComentarioSuporte,
  resolverChamado,
  triarChamado,
  uploadAnexoChamado,
} from "@/services/suporte.service";

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  storageFromMock.mockReset();
  getUserMock.mockReset();
});

describe("criarChamadoSuporte", () => {
  it("mapeia o input para os parâmetros da RPC e devolve id/numero", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ id: "c1", numero: "CH-000001" }], error: null });

    const result = await criarChamadoSuporte({
      tipo: "bug",
      resumo: "Erro ao salvar",
      descricao: "Descrição detalhada",
      impacto: "nao_consigo_concluir",
      abrangencia: "so_eu",
      frequencia: "sempre_que_tento",
      rota: "/financeiro",
      registroRelacionadoTipo: "financeiro_lancamento",
      registroRelacionadoId: "lanc-1",
      diagnostico: { navegador: "Chrome" },
    });

    expect(result).toEqual({ id: "c1", numero: "CH-000001" });
    expect(rpcMock).toHaveBeenCalledWith("criar_chamado_suporte", {
      p_tipo: "bug",
      p_resumo: "Erro ao salvar",
      p_descricao: "Descrição detalhada",
      p_impacto: "nao_consigo_concluir",
      p_abrangencia: "so_eu",
      p_frequencia: "sempre_que_tento",
      p_rota: "/financeiro",
      p_registro_relacionado_tipo: "financeiro_lancamento",
      p_registro_relacionado_id: "lanc-1",
      p_diagnostico: { navegador: "Chrome" },
    });
  });

  it("lança erro quando a RPC falha", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error("boom") });

    await expect(
      criarChamadoSuporte({
        tipo: "duvida",
        resumo: "x",
        descricao: "y",
        impacto: "incomodo",
        abrangencia: "so_eu",
        frequencia: "uma_vez",
        rota: "/x",
      }),
    ).rejects.toThrow("boom");
  });

  it("lança erro se a RPC não devolver nenhuma linha", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    await expect(
      criarChamadoSuporte({
        tipo: "duvida",
        resumo: "x",
        descricao: "y",
        impacto: "incomodo",
        abrangencia: "so_eu",
        frequencia: "uma_vez",
        rota: "/x",
      }),
    ).rejects.toThrow(/não foi criado/i);
  });
});

describe("registrarComentarioSuporte", () => {
  it("usa visibilidade 'publico' por padrão", async () => {
    rpcMock.mockResolvedValueOnce({ data: "evt-1", error: null });

    const id = await registrarComentarioSuporte("c1", "oi");

    expect(id).toBe("evt-1");
    expect(rpcMock).toHaveBeenCalledWith("registrar_comentario_suporte", {
      p_chamado_id: "c1",
      p_mensagem: "oi",
      p_visibilidade: "publico",
    });
  });

  it("permite marcar como nota interna", async () => {
    rpcMock.mockResolvedValueOnce({ data: "evt-2", error: null });

    await registrarComentarioSuporte("c1", "nota", "interno");

    expect(rpcMock).toHaveBeenCalledWith(
      "registrar_comentario_suporte",
      expect.objectContaining({ p_visibilidade: "interno" }),
    );
  });
});

describe("confirmarResolucaoSuporte", () => {
  it("envia p_confirmado corretamente", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await confirmarResolucaoSuporte("c1", true);
    expect(rpcMock).toHaveBeenCalledWith("suporte_confirmar_resolucao", {
      p_chamado_id: "c1",
      p_confirmado: true,
    });
  });

  it("propaga erro da RPC", async () => {
    rpcMock.mockResolvedValueOnce({ error: new Error("negado") });
    await expect(confirmarResolucaoSuporte("c1", false)).rejects.toThrow("negado");
  });
});

describe("RPCs administrativas — mapeamento de parâmetros", () => {
  it("assumirChamado", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await assumirChamado("c1");
    expect(rpcMock).toHaveBeenCalledWith("suporte_assumir_chamado", { p_chamado_id: "c1" });
  });

  it("atribuirResponsavelChamado", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await atribuirResponsavelChamado("c1", "user-2");
    expect(rpcMock).toHaveBeenCalledWith("suporte_atribuir_responsavel", {
      p_chamado_id: "c1",
      p_responsavel_id: "user-2",
    });
  });

  it("triarChamado só envia os campos informados (undefined nos demais)", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await triarChamado("c1", { prioridade: "alta" });
    expect(rpcMock).toHaveBeenCalledWith("suporte_triar_chamado", {
      p_chamado_id: "c1",
      p_tipo: undefined,
      p_prioridade: "alta",
      p_modulo: undefined,
      p_status: undefined,
    });
  });

  it("resolverChamado", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await resolverChamado("c1", "Corrigido no build 1.2.3", "bug_corrigido");
    expect(rpcMock).toHaveBeenCalledWith("suporte_resolver_chamado", {
      p_chamado_id: "c1",
      p_resumo_resolucao: "Corrigido no build 1.2.3",
      p_causa: "bug_corrigido",
    });
  });

  it("cancelarChamado", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await cancelarChamado("c1", "duplicado");
    expect(rpcMock).toHaveBeenCalledWith("suporte_cancelar_chamado", {
      p_chamado_id: "c1",
      p_motivo: "duplicado",
    });
  });

  it("marcarChamadoDuplicado", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await marcarChamadoDuplicado("c2", "c1");
    expect(rpcMock).toHaveBeenCalledWith("suporte_marcar_duplicado", {
      p_chamado_id: "c2",
      p_duplicado_de_id: "c1",
    });
  });

  it("obterDiagnosticoSuporte devolve a primeira linha ou null", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ erro_mensagem_amigavel: "Falha" }], error: null });
    const diag = await obterDiagnosticoSuporte("c1");
    expect(diag).toEqual({ erro_mensagem_amigavel: "Falha" });

    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    expect(await obterDiagnosticoSuporte("c1")).toBeNull();
  });
});

// Como o query builder real do supabase-js, o mock é "thenable": qualquer
// método de encadeamento (`select`, `eq`, `order`...) devolve o próprio
// chain, e o `await` resolve através de `then` — não importa em qual método
// o caller efetivamente "para" de encadear (`order` vs `limit` vs nenhum).
function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => resolve(result),
  };
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  return chain;
}

describe("leituras — listarMeusChamados / getChamado / listarEventosChamado", () => {
  it("listarMeusChamados devolve [] quando data é null", async () => {
    fromMock.mockReturnValueOnce(makeSelectChain({ data: null, error: null }));
    expect(await listarMeusChamados()).toEqual([]);
  });

  it("getChamado devolve null quando não encontrado", async () => {
    fromMock.mockReturnValueOnce(makeSelectChain({ data: null, error: null }));
    expect(await getChamado("c1")).toBeNull();
  });

  it("listarEventosChamado propaga erro do Supabase", async () => {
    fromMock.mockReturnValueOnce(makeSelectChain({ data: null, error: new Error("rls") }));
    await expect(listarEventosChamado("c1")).rejects.toThrow("rls");
  });
});

describe("listarAdmins", () => {
  it("busca os user_id com role=admin e resolve os nomes em profiles", async () => {
    fromMock.mockReturnValueOnce(
      makeSelectChain({ data: [{ user_id: "u1" }, { user_id: "u2" }], error: null }),
    );
    fromMock.mockReturnValueOnce(
      makeSelectChain({
        data: [
          { id: "u1", nome: "Ana" },
          { id: "u2", nome: "Bruno" },
        ],
        error: null,
      }),
    );

    const admins = await listarAdmins();

    expect(admins).toEqual([
      { id: "u1", nome: "Ana" },
      { id: "u2", nome: "Bruno" },
    ]);
  });

  it("devolve [] sem consultar profiles quando não há nenhum admin", async () => {
    fromMock.mockReturnValueOnce(makeSelectChain({ data: [], error: null }));

    const admins = await listarAdmins();

    expect(admins).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("usa o próprio id como nome quando o perfil não tem nome preenchido", async () => {
    fromMock.mockReturnValueOnce(makeSelectChain({ data: [{ user_id: "u1" }], error: null }));
    fromMock.mockReturnValueOnce(makeSelectChain({ data: [{ id: "u1", nome: null }], error: null }));

    expect(await listarAdmins()).toEqual([{ id: "u1", nome: "u1" }]);
  });

  it("propaga erro ao buscar user_roles", async () => {
    fromMock.mockReturnValueOnce(makeSelectChain({ data: null, error: new Error("negado") }));
    await expect(listarAdmins()).rejects.toThrow("negado");
  });
});

describe("anexos", () => {
  it("getAnexoSignedUrl usa o bucket dbavizee e devolve a URL assinada", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://x/y" }, error: null });
    storageFromMock.mockReturnValueOnce({ createSignedUrl });

    const url = await getAnexoSignedUrl("chamados/c1/foo.png");

    expect(storageFromMock).toHaveBeenCalledWith("dbavizee");
    expect(createSignedUrl).toHaveBeenCalledWith("chamados/c1/foo.png", 300);
    expect(url).toBe("https://x/y");
  });

  it("uploadAnexoChamado sobe o arquivo para chamados/{id}/ e insere a linha", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    storageFromMock.mockReturnValueOnce({ upload });
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const insertChain: Record<string, unknown> = {};
    insertChain.insert = vi.fn(() => insertChain);
    insertChain.select = vi.fn(() => insertChain);
    insertChain.single = vi.fn(() =>
      Promise.resolve({ data: { id: "anexo-1", nome_arquivo: "print.png" }, error: null }),
    );
    fromMock.mockReturnValueOnce(insertChain);

    const file = new File(["conteudo"], "print.png", { type: "image/png" });
    const anexo = await uploadAnexoChamado("c1", file);

    expect(anexo).toEqual({ id: "anexo-1", nome_arquivo: "print.png" });
    const uploadPath = upload.mock.calls[0][0] as string;
    expect(uploadPath.startsWith("chamados/c1/")).toBe(true);
    expect(uploadPath.endsWith("-print.png")).toBe(true);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ chamado_id: "c1", uploaded_by: "user-1", nome_arquivo: "print.png" }),
    );
  });

  it("uploadAnexoChamado lança erro se não houver usuário autenticado", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    storageFromMock.mockReturnValueOnce({ upload });
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    const file = new File(["x"], "a.png", { type: "image/png" });
    await expect(uploadAnexoChamado("c1", file)).rejects.toThrow(/não autenticado/i);
  });
});
