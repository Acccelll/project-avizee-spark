/** Campos específicos por tipo de documento fiscal. */
export const CTE_FORM_FIELDS = [
  "cte_tipo", "cte_modal", "cte_cfop", "cte_natureza_operacao",
  "cte_municipio_inicio", "cte_municipio_inicio_uf", "cte_municipio_inicio_cod",
  "cte_municipio_fim", "cte_municipio_fim_uf", "cte_municipio_fim_cod", "cte_tomador_tipo",
  "cte_remetente_doc", "cte_remetente_razao_social", "cte_remetente_uf",
  "cte_destinatario_doc", "cte_destinatario_razao_social", "cte_destinatario_uf",
  "cte_expedidor_doc", "cte_expedidor_razao_social", "cte_recebedor_doc", "cte_recebedor_razao_social",
  "cte_tomador_outros_doc", "cte_tomador_outros_razao_social",
  "cte_produto_predominante", "cte_quantidade", "cte_unidade_medida",
  "cte_valor_prestacao", "cte_valor_receber", "cte_chave_nfe_ref",
  "cte_icms_cst", "cte_icms_base", "cte_icms_aliquota", "cte_icms_valor",
] as const;
export const NFSE_FORM_FIELDS = [
  "nfse_codigo_servico_lc116", "nfse_nbs", "nfse_descricao_servico",
  "nfse_municipio_prestacao", "nfse_municipio_prestacao_cod",
  "nfse_aliquota_iss", "nfse_valor_iss", "nfse_valor_iss_informado", "nfse_valor_iss_calculado",
  "nfse_valor_servicos", "nfse_valor_deducoes", "nfse_valor_base_calculo_iss",
  "nfse_iss_retido", "nfse_optante_simples", "nfse_incentivador_cultural",
  "nfse_data_competencia", "nfse_numero_rps", "nfse_serie_rps", "nfse_natureza_operacao",
  "nfse_layout_origem", "nfse_versao_layout", "nfse_provedor_origem",
] as const;
export function camposDocumentoDaNota(n: Record<string, unknown>): Record<string, string | number | boolean> {
  const tipoBanco = String(n.tipo_documento || "nfe");
  // A UI trabalha CT-e como uma família; modelo 67 é normalizado de volta para cte_os na RPC de save.
  const out: Record<string, string | number | boolean> = { tipo_documento: tipoBanco === "cte_os" ? "cte" : tipoBanco };
  if (n.id) out.documento_id = String(n.id);
  for (const key of [...CTE_FORM_FIELDS, ...NFSE_FORM_FIELDS]) {
    const value = n[key]; if (value === null || value === undefined) continue;
    if (Array.isArray(value)) { (out as Record<string, unknown>)[key] = value; continue; }
    if (typeof value === "number" || typeof value === "boolean") { out[key] = value; continue; }
    out[key] = String(value);
  }
  if (n.cte_dados_extras && typeof n.cte_dados_extras === "object") out.cte_dados_extras_json = JSON.stringify(n.cte_dados_extras);
  if (n.nfse_dados_extras && typeof n.nfse_dados_extras === "object") out.nfse_dados_extras_json = JSON.stringify(n.nfse_dados_extras);
  if (n.nfse_ibscbs_dados && typeof n.nfse_ibscbs_dados === "object") out.nfse_ibscbs_json = JSON.stringify(n.nfse_ibscbs_dados);
  return out;
}
export function totalBaseDocumento(form: Record<string, unknown>, totalPorItens: number): number {
  const tipoDoc=String(form.tipo_documento||"nfe");
  if(tipoDoc==="cte"||tipoDoc==="cte_os"){const v=Number(form.cte_valor_prestacao||0);return v>0?v:totalPorItens;}
  if(tipoDoc==="nfse"){const v=Number(form.nfse_valor_servicos||0);return v>0?v:totalPorItens;}
  return totalPorItens;
}
