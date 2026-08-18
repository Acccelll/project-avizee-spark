/**
 * Helpers de campos específicos por tipo de documento fiscal (NF-e / NFS-e / CT-e).
 *
 * Motivação: os blocos `cte_*` e `nfse_*` do formulário eram perdidos entre
 * carregamento (edição) e persistência, fazendo o CT-e parecer "não salvo".
 * Centralizamos aqui a extração desses campos e o cálculo do total base.
 */
export const CTE_FORM_FIELDS = [
  "cte_tipo", "cte_modal", "cte_cfop", "cte_natureza_operacao",
  "cte_municipio_inicio", "cte_municipio_inicio_uf", "cte_municipio_inicio_cod",
  "cte_municipio_fim", "cte_municipio_fim_uf", "cte_municipio_fim_cod",
  "cte_tomador_tipo",
  "cte_remetente_doc", "cte_remetente_razao_social", "cte_remetente_uf",
  "cte_destinatario_doc", "cte_destinatario_razao_social", "cte_destinatario_uf",
  "cte_expedidor_doc", "cte_expedidor_razao_social",
  "cte_recebedor_doc", "cte_recebedor_razao_social",
  "cte_produto_predominante", "cte_quantidade", "cte_unidade_medida",
  "cte_valor_prestacao", "cte_valor_receber", "cte_chave_nfe_ref",
] as const;

export const NFSE_FORM_FIELDS = [
  "nfse_codigo_servico_lc116", "nfse_descricao_servico",
  "nfse_municipio_prestacao", "nfse_municipio_prestacao_cod",
  "nfse_aliquota_iss", "nfse_valor_iss", "nfse_valor_servicos",
  "nfse_valor_deducoes", "nfse_valor_base_calculo_iss",
  "nfse_iss_retido", "nfse_optante_simples", "nfse_incentivador_cultural",
  "nfse_data_competencia", "nfse_numero_rps", "nfse_serie_rps",
  "nfse_natureza_operacao",
] as const;

/**
 * Extrai de uma linha de `notas_fiscais` o `tipo_documento` e todos os campos
 * `cte_*`/`nfse_*` preenchidos, no formato aceito pelo estado do formulário.
 */
export function camposDocumentoDaNota(
  n: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    tipo_documento: String(n.tipo_documento || "nfe"),
  };
  for (const key of [...CTE_FORM_FIELDS, ...NFSE_FORM_FIELDS]) {
    const value = n[key];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      // cte_chave_nfe_ref é text[]; o form trabalha com o array direto.
      (out as Record<string, unknown>)[key] = value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

/**
 * Total base do documento. NF-e soma itens; CT-e usa o valor da prestação e
 * NFS-e o valor dos serviços, pois esses documentos não têm grid de itens.
 */
export function totalBaseDocumento(
  form: Record<string, unknown>,
  totalPorItens: number,
): number {
  const tipoDoc = String(form.tipo_documento || "nfe");
  if (tipoDoc === "cte" || tipoDoc === "cte_os") {
    const prestacao = Number(form.cte_valor_prestacao || 0);
    return prestacao > 0 ? prestacao : totalPorItens;
  }
  if (tipoDoc === "nfse") {
    const servicos = Number(form.nfse_valor_servicos || 0);
    return servicos > 0 ? servicos : totalPorItens;
  }
  return totalPorItens;
}
