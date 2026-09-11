from pathlib import Path


def patch(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f'pattern not found in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


patch(
    'src/services/fiscal/portal.service.ts',
    '''export async function buscarNfePortal(
  filtros: PortalRpcFiltros,
  page: number,
  pageSize: number,
): Promise<PortalPageResult> {
  const { data, error } = await supabase.rpc("buscar_nfe_portal", {
    p_filtros: filtros as unknown as never,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw error;
  const r = (data as unknown as PortalPageResult | null) ?? { rows: [], total: 0 };
  return { rows: r.rows ?? [], total: Number(r.total ?? 0) };
}
''',
    '''export async function buscarNfePortal(
  filtros: PortalRpcFiltros,
  page: number,
  pageSize: number,
): Promise<PortalPageResult> {
  const { data, error } = await supabase.rpc("buscar_nfe_portal", {
    p_filtros: filtros as unknown as never,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw error;
  const r = (data as unknown as PortalPageResult | null) ?? { rows: [], total: 0 };
  return { rows: r.rows ?? [], total: Number(r.total ?? 0) };
}

const PORTAL_EXPORT_PAGE_SIZE = 1000;
const PORTAL_EXPORT_HARD_CAP = 50000;

/** Busca sob demanda todo o universo filtrado do Portal Fiscal para exportação. */
export async function buscarTodasNfePortal(
  filtros: PortalRpcFiltros,
): Promise<PortalRow[]> {
  const first = await buscarNfePortal(filtros, 0, PORTAL_EXPORT_PAGE_SIZE);
  if (first.total > PORTAL_EXPORT_HARD_CAP) {
    throw new Error(
      `A exportação excede o limite seguro de ${PORTAL_EXPORT_HARD_CAP.toLocaleString("pt-BR")} NF-es. Aplique filtros mais específicos.`,
    );
  }

  const all = [...first.rows];
  let page = 1;
  while (all.length < first.total) {
    const next = await buscarNfePortal(filtros, page, PORTAL_EXPORT_PAGE_SIZE);
    all.push(...next.rows);
    if (next.rows.length < PORTAL_EXPORT_PAGE_SIZE) break;
    page += 1;
  }
  return all;
}
''',
)

patch(
    'src/pages/fiscal/PortalFiscal.tsx',
    '''  buscarNfePortal,
  excluirNfeDistribuicaoAlheias,''',
    '''  buscarNfePortal,
  buscarTodasNfePortal,
  excluirNfeDistribuicaoAlheias,''',
)

old = '''  const exportarCsv = () => {
    if (rows.length === 0) {
      toast.info("Nada a exportar");
      return;
    }
    const headers = [
      "Chave",
      "Série",
      "Número",
      "Emissão",
      "Emitente",
      "CNPJ Emitente",
      "UF",
      "Valor",
      "Status",
      "Manifestação",
    ];
    const linhas = rows.map((r) => [
      r.chave_acesso,
      r.serie ?? "",
      r.numero ?? "",
      r.data_emissao ?? "",
      (r.nome_emitente ?? "").replace(/[;\\n\\r]/g, " "),
      r.cnpj_emitente ?? "",
      r.uf_emitente ?? "",
      r.valor_total != null ? String(r.valor_total) : "",
      r.status_interno ?? r.status_sefaz ?? "",
      STATUS_LABEL[r.status_manifestacao] ?? r.status_manifestacao,
    ]);
    const csv = [headers, ...linhas]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\\n");
    const blob = new Blob([`\\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portal-nfe-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };'''

new = '''  const exportarCsv = async () => {
    if (total === 0) {
      toast.info("Nada a exportar");
      return;
    }

    const tid = toast.loading("Preparando CSV completo do Portal NF-e...");
    try {
      const payload: PortalRpcFiltros = {};
      if (aplicados.data_inicio) payload.data_inicio = `${aplicados.data_inicio}T00:00:00`;
      if (aplicados.data_fim) payload.data_fim = `${aplicados.data_fim}T23:59:59`;
      if (aplicados.chave) payload.chave = aplicados.chave.replace(/\\D/g, "");
      if (aplicados.cnpj_emitente) payload.cnpj_emitente = aplicados.cnpj_emitente;
      if (aplicados.emitente) payload.emitente = aplicados.emitente;
      if (aplicados.uf) payload.uf = aplicados.uf;
      if (aplicados.serie) payload.serie = aplicados.serie;
      if (aplicados.numero_ini) payload.numero_ini = aplicados.numero_ini;
      if (aplicados.numero_fim) payload.numero_fim = aplicados.numero_fim;
      if (aplicados.status_manifestacao && aplicados.status_manifestacao !== "todos") {
        payload.status_manifestacao = aplicados.status_manifestacao;
      }
      if (aplicados.tipo_documento && aplicados.tipo_documento !== "todos") {
        payload.tipo_documento = aplicados.tipo_documento;
      }
      if (incluirOutros) payload.incluir_outros_destinatarios = "true";

      const allRows = (await buscarTodasNfePortal(payload)) as unknown as PortalRow[];
      const headers = [
        "Chave",
        "Série",
        "Número",
        "Emissão",
        "Emitente",
        "CNPJ Emitente",
        "UF",
        "Valor",
        "Status",
        "Manifestação",
      ];
      const linhas = allRows.map((r) => [
        r.chave_acesso,
        r.serie ?? "",
        r.numero ?? "",
        r.data_emissao ?? "",
        (r.nome_emitente ?? "").replace(/[;\\n\\r]/g, " "),
        r.cnpj_emitente ?? "",
        r.uf_emitente ?? "",
        r.valor_total != null ? String(r.valor_total) : "",
        r.status_interno ?? r.status_sefaz ?? "",
        STATUS_LABEL[r.status_manifestacao] ?? r.status_manifestacao,
      ]);
      const csv = [headers, ...linhas]
        .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
        .join("\\n");
      const blob = new Blob([`\\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portal-nfe-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`CSV exportado com ${allRows.length.toLocaleString("pt-BR")} NF-e(s).`, { id: tid });
    } catch (error) {
      toast.error("Falha ao exportar Portal NF-e", {
        id: tid,
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };'''

patch('src/pages/fiscal/PortalFiscal.tsx', old, new)
print('Portal Fiscal complete CSV export patch applied')
