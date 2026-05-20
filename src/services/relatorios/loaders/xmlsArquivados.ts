/**
 * Loader do relatório "XMLs Arquivados".
 *
 * Lê `notas_fiscais` com filtros canônicos (período por data_emissao,
 * fornecedor, cliente, status) e devolve linhas tipadas com a flag
 * `temXml` (sim/nao) + `caminhoXml` pronto para o export em .zip.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  withDateRange,
  type FiltroRelatorio,
  type RelatorioResultado,
} from "@/services/relatorios/lib/shared";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";
import type { XmlArquivadoRow } from "@/types/relatorios-xml";

interface RawNotaXml {
  id: string;
  tipo: string | null;
  numero: string | null;
  serie: string | null;
  chave_acesso: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  status: string | null;
  caminho_xml: string | null;
  fornecedor_id: string | null;
  cliente_id: string | null;
  fornecedores: { nome_razao_social: string } | null;
  clientes: { nome_razao_social: string } | null;
}

export interface XmlsArquivadosFiltros extends FiltroRelatorio {
  /** "entrada" | "saida" | "todos" — default "todos". */
  tipoNota?: "entrada" | "saida" | "todos";
  /** Quando true, lista apenas notas com `caminho_xml` (default true). */
  apenasComXml?: boolean;
  statusList?: string[];
}

export async function loadXmlsArquivados(
  filtros: XmlsArquivadosFiltros,
): Promise<RelatorioResultado<XmlArquivadoRow>> {
  const tipoNota = filtros.tipoNota ?? "todos";
  const apenasComXml = filtros.apenasComXml ?? true;

  const data = await fetchAllPages<RawNotaXml>(() => {
    let q = supabase
      .from("notas_fiscais")
      .select(
        "id, tipo, numero, serie, chave_acesso, data_emissao, valor_total, status, caminho_xml, fornecedor_id, cliente_id, fornecedores(nome_razao_social), clientes(nome_razao_social)",
      )
      .eq("ativo", true)
      .order("data_emissao", { ascending: false });
    q = withDateRange(q, "data_emissao", filtros);
    if (tipoNota !== "todos") q = q.eq("tipo", tipoNota);
    if (filtros.fornecedorIds?.length) q = q.in("fornecedor_id", filtros.fornecedorIds);
    if (filtros.clienteIds?.length) q = q.in("cliente_id", filtros.clienteIds);
    if (filtros.statusList?.length) q = q.in("status", filtros.statusList);
    if (apenasComXml) q = q.not("caminho_xml", "is", null);
    return q as unknown as Parameters<typeof fetchAllPages<RawNotaXml>>[0] extends () => infer R
      ? R
      : never;
  });

  const rows: XmlArquivadoRow[] = data.map((n) => {
    const tipoNorm = (n.tipo || "saida").toLowerCase();
    const parceiro =
      tipoNorm === "entrada"
        ? n.fornecedores?.nome_razao_social || "-"
        : n.clientes?.nome_razao_social || "-";
    return {
      notaFiscalId: n.id,
      tipo: tipoNorm,
      numero: n.numero || "-",
      serie: n.serie || "-",
      chave: n.chave_acesso || "-",
      emissao: n.data_emissao,
      parceiro,
      fornecedorId: n.fornecedor_id ?? undefined,
      clienteId: n.cliente_id ?? undefined,
      valor: Number(n.valor_total || 0),
      status: n.status || "-",
      caminhoXml: n.caminho_xml,
      temXml: n.caminho_xml ? "sim" : "nao",
    };
  });

  const totalArquivados = rows.filter((r) => r.temXml === "sim").length;
  const semXml = rows.length - totalArquivados;
  const totalValor = rows.reduce((s, r) => s + r.valor, 0);
  const entradas = rows.filter((r) => r.tipo === "entrada").length;
  const saidas = rows.filter((r) => r.tipo === "saida").length;

  return {
    title: "XMLs Arquivados",
    subtitle:
      "NF-e com XML persistido no armazenamento interno — pronto para download em .zip.",
    rows,
    kpis: {
      totalNotas: rows.length,
      totalArquivados,
      semXml,
      entradas,
      saidas,
      valorTotal: totalValor,
    },
    meta: {
      kind: "list",
      valueNature: "monetario",
      timeAxis: { field: "emissao", label: "data de emissão", required: true },
      drillDownReady: false,
    },
  };
}