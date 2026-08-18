import { detectarTipoDocumentoXml } from "@/lib/fiscal/detectarDocumentoXml";
import { parseCteXml } from "@/lib/fiscal/cteXmlParser";
import { parseNfseXml } from "@/lib/fiscal/nfseXmlParser";
import { calcularNfse } from "@/lib/fiscal/nfseCalculo";
import type { FornecedorMatchRef } from "@/pages/fiscal/hooks/useNFeXmlImport";

export interface DocumentoServicoXmlInterpretado {
  tipoDocumento: "cte" | "cte_os" | "nfse";
  fornecedorId: string;
  fornecedorNome: string;
  fornecedorDoc: string;
  dataEmissao: string;
  chaveArquivo: string;
  form: Record<string, unknown>;
}

const digits = (v: string | null | undefined) => (v || "").replace(/\D/g, "");
const fornecedorPorDoc = (fornecedores: FornecedorMatchRef[], doc: string) =>
  fornecedores.find((f) => digits(f.cpf_cnpj) === digits(doc));

export function interpretarDocumentoServicoXml(xmlText: string, fornecedores: FornecedorMatchRef[]): DocumentoServicoXmlInterpretado | null {
  const detectado = detectarTipoDocumentoXml(xmlText);
  if (detectado === "cte" || detectado === "cte_os") {
    const cte = parseCteXml(xmlText);
    const fornecedor = fornecedorPorDoc(fornecedores, cte.emitente.doc);
    const refsPreview = cte.chavesNfe.map((chave) => ({ chave, status: "nao_localizada" }));
    return {
      tipoDocumento: cte.tipoDocumento,
      fornecedorId: fornecedor?.id || "",
      fornecedorNome: fornecedor?.nome_razao_social || cte.emitente.razaoSocial || "",
      fornecedorDoc: cte.emitente.doc,
      dataEmissao: cte.dataEmissao,
      chaveArquivo: cte.chaveAcesso || `${cte.modelo}-${cte.serie}-${cte.numero}`,
      form: {
        tipo: "entrada", tipo_documento: cte.tipoDocumento, modelo_documento: cte.modelo,
        numero: cte.numero, serie: cte.serie || "1", chave_acesso: cte.chaveAcesso,
        data_emissao: cte.dataEmissao, fornecedor_id: fornecedor?.id || "",
        valor_total: cte.valorPrestacao ?? 0, status: "pendente", status_sefaz: "nao_enviada",
        origem: "xml_importado", movimenta_estoque: false, gera_financeiro: true,
        cte_tipo: cte.tipoCte || "normal", cte_modal: cte.modal || "rodoviario",
        cte_cfop: cte.cfop || "", cte_natureza_operacao: cte.naturezaOperacao || "",
        cte_municipio_inicio: cte.municipioInicio, cte_municipio_inicio_uf: cte.municipioInicioUf,
        cte_municipio_inicio_cod: cte.municipioInicioCod, cte_municipio_fim: cte.municipioFim,
        cte_municipio_fim_uf: cte.municipioFimUf, cte_municipio_fim_cod: cte.municipioFimCod,
        cte_tomador_tipo: cte.tomadorTipo,
        cte_tomador_outros_doc: cte.tomadorOutro?.doc || "",
        cte_tomador_outros_razao_social: cte.tomadorOutro?.razaoSocial || "",
        cte_remetente_doc: cte.remetente?.doc || "", cte_remetente_razao_social: cte.remetente?.razaoSocial || "", cte_remetente_uf: cte.remetente?.uf || "",
        cte_destinatario_doc: cte.destinatario?.doc || "", cte_destinatario_razao_social: cte.destinatario?.razaoSocial || "", cte_destinatario_uf: cte.destinatario?.uf || "",
        cte_expedidor_doc: cte.expedidor?.doc || "", cte_expedidor_razao_social: cte.expedidor?.razaoSocial || "",
        cte_recebedor_doc: cte.recebedor?.doc || "", cte_recebedor_razao_social: cte.recebedor?.razaoSocial || "",
        cte_produto_predominante: cte.produtoPredominante || "", cte_quantidade: cte.quantidade,
        cte_unidade_medida: cte.unidadeMedida || "", cte_valor_prestacao: cte.valorPrestacao,
        cte_valor_receber: cte.valorReceber ?? cte.valorPrestacao, cte_chave_nfe_ref: cte.chavesNfe,
        cte_referencias_json: JSON.stringify(refsPreview), cte_icms_cst: cte.icms.cst || "",
        cte_icms_base: cte.icms.baseCalculo, cte_icms_aliquota: cte.icms.aliquota,
        cte_icms_valor: cte.icms.valor, cte_dados_extras_json: JSON.stringify(cte.dadosExtras),
      },
    };
  }
  if (detectado === "nfse") {
    const nfse = parseNfseXml(xmlText);
    const fornecedor = fornecedorPorDoc(fornecedores, nfse.prestador.doc);
    const calc = calcularNfse({ valorServicos: nfse.valorServicos, valorDeducoes: nfse.valorDeducoes, aliquotaIss: nfse.aliquotaIss, retencoes: nfse.retencoes });
    return {
      tipoDocumento: "nfse",
      fornecedorId: fornecedor?.id || "",
      fornecedorNome: fornecedor?.nome_razao_social || nfse.prestador.razaoSocial || "",
      fornecedorDoc: nfse.prestador.doc,
      dataEmissao: nfse.dataEmissao,
      chaveArquivo: nfse.chaveAcesso || `nfse-${nfse.prestador.doc}-${nfse.numero}`,
      form: {
        tipo: "entrada", tipo_documento: "nfse", modelo_documento: "nfse",
        numero: nfse.numero, serie: nfse.serie || "1",
        // A chave nacional pode não seguir os 44 dígitos da NF-e/CT-e; preservamos em extras.
        chave_acesso: nfse.chaveAcesso && nfse.chaveAcesso.length === 44 ? nfse.chaveAcesso : "",
        data_emissao: nfse.dataEmissao, fornecedor_id: fornecedor?.id || "",
        valor_total: nfse.valorServicos, status: "pendente", status_sefaz: "nao_enviada",
        origem: "xml_importado", movimenta_estoque: false, gera_financeiro: true,
        nfse_numero_rps: nfse.numeroRps || "", nfse_serie_rps: nfse.serieRps || "",
        nfse_data_competencia: nfse.competencia || nfse.dataEmissao,
        nfse_codigo_servico_lc116: nfse.codigoServicoLc116 || "", nfse_nbs: nfse.codigoNbs || "",
        nfse_descricao_servico: nfse.descricaoServico || "",
        nfse_municipio_prestacao: nfse.municipioPrestacao || "",
        nfse_municipio_prestacao_cod: nfse.municipioPrestacaoCod || "",
        nfse_aliquota_iss: nfse.aliquotaIss, nfse_valor_servicos: nfse.valorServicos,
        nfse_valor_deducoes: nfse.valorDeducoes, nfse_valor_base_calculo_iss: nfse.baseCalculoInformada ?? calc.baseCalculo,
        nfse_valor_iss: nfse.valorIssInformado ?? calc.valorIssCalculado,
        nfse_valor_iss_informado: nfse.valorIssInformado,
        nfse_valor_iss_calculado: calc.valorIssCalculado,
        nfse_iss_retido: nfse.issRetido, nfse_optante_simples: nfse.optanteSimples ?? false,
        nfse_incentivador_cultural: nfse.incentivadorCultural ?? false,
        nfse_retencoes_json: JSON.stringify(nfse.retencoes),
        nfse_layout_origem: nfse.layoutOrigem, nfse_versao_layout: nfse.versaoLayout || "",
        nfse_provedor_origem: nfse.provedorOrigem || "",
        nfse_dados_extras_json: JSON.stringify({ ...nfse.dadosExtras, chave_original: nfse.chaveAcesso, tomador: nfse.tomador }),
        nfse_ibscbs_json: JSON.stringify(nfse.ibsCbs || {}),
      },
    };
  }
  return null;
}
