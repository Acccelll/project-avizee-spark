/**
 * Builders que materializam payloads completos de NF-e a partir do banco:
 *  - `buildNFeDataFromDb`  → estrutura usada pelo `xmlBuilder` / `autorizarNFe`.
 *  - `buildDanfeDataFromDb` → estrutura usada pelo gerador client-side de DANFE.
 *
 * A montagem busca emitente (empresa_config), destinatário (cliente/fornecedor)
 * e itens (notas_fiscais_itens). Mantemos defaults conservadores quando algum
 * campo opcional do schema NF-e 4.00 está em branco — a SEFAZ rejeitará se
 * informações obrigatórias estiverem faltando, e o motivo será propagado pelo
 * fluxo de retorno SEFAZ existente.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  calcularIndIEDest,
  type AmbienteSefaz,
  type CRT,
  type NFeData,
  type NFeItemData,
} from "@/services/fiscal/sefaz";
import type { DanfeInput } from "@/services/fiscal/danfe.service";
import type { NotaFiscal } from "@/types/domain";

interface EmitenteRow {
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  uf: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  cidade: string | null;
  codigo_ibge_municipio: string | null;
  crt: string | null;
  ambiente_sefaz: string | null;
  ambiente_padrao: string | null;
  telefone: string | null;
}

async function lerEmitente(): Promise<EmitenteRow> {
  const { data, error } = await supabase
    .from("empresa_config")
    .select(
      "cnpj, razao_social, nome_fantasia, inscricao_estadual, uf, cep, logradouro, numero, cidade, codigo_ibge_municipio, crt, ambiente_sefaz, ambiente_padrao, telefone",
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "Configuração da empresa emitente não encontrada (empresa_config).",
    );
  }
  return data as EmitenteRow;
}

interface ParceiroRow {
  nome: string;
  cpf_cnpj: string | null;
  inscricao_estadual: string | null;
  uf: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  cidade: string | null;
  tipo_pessoa: string | null;
  codigo_ibge_municipio: string | null;
}

async function lerCliente(id: string): Promise<ParceiroRow> {
  const { data, error } = await supabase
    .from("clientes")
    .select(
      "nome_razao_social, cpf_cnpj, inscricao_estadual, uf, cep, logradouro, numero, cidade, tipo_pessoa, codigo_ibge_municipio",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Cliente ${id} não encontrado.`);
  const row = data as Record<string, unknown>;
  return {
    nome: String(row.nome_razao_social ?? ""),
    cpf_cnpj: (row.cpf_cnpj as string | null) ?? null,
    inscricao_estadual: (row.inscricao_estadual as string | null) ?? null,
    uf: (row.uf as string | null) ?? null,
    cep: (row.cep as string | null) ?? null,
    logradouro: (row.logradouro as string | null) ?? null,
    numero: (row.numero as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    tipo_pessoa: (row.tipo_pessoa as string | null) ?? null,
    codigo_ibge_municipio:
      (row.codigo_ibge_municipio as string | null) ?? null,
  };
}

async function lerFornecedor(id: string): Promise<ParceiroRow> {
  const { data, error } = await supabase
    .from("fornecedores")
    .select(
      "nome_razao_social, cpf_cnpj, inscricao_estadual, uf, cep, logradouro, numero, cidade, tipo_pessoa, codigo_ibge_municipio",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Fornecedor ${id} não encontrado.`);
  const row = data as Record<string, unknown>;
  return {
    nome: String(row.nome_razao_social ?? ""),
    cpf_cnpj: (row.cpf_cnpj as string | null) ?? null,
    inscricao_estadual: (row.inscricao_estadual as string | null) ?? null,
    uf: (row.uf as string | null) ?? null,
    cep: (row.cep as string | null) ?? null,
    logradouro: (row.logradouro as string | null) ?? null,
    numero: (row.numero as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    tipo_pessoa: (row.tipo_pessoa as string | null) ?? null,
    codigo_ibge_municipio:
      (row.codigo_ibge_municipio as string | null) ?? null,
  };
}

interface ItemRow {
  codigo_produto: string | null;
  descricao: string | null;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  cst: string | null;
  cst_pis: string | null;
  cst_cofins: string | null;
  cst_ipi: string | null;
  icms_aliquota: number | null;
  icms_valor: number | null;
  icms_base: number | null;
  ipi_aliquota: number | null;
  ipi_valor: number | null;
  pis_aliquota: number | null;
  pis_valor: number | null;
  cofins_aliquota: number | null;
  cofins_valor: number | null;
}

async function lerItens(notaId: string): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from("notas_fiscais_itens")
    .select(
      "codigo_produto, descricao, ncm, cfop, unidade, quantidade, valor_unitario, valor_total, cst, cst_pis, cst_cofins, cst_ipi, icms_aliquota, icms_valor, icms_base, ipi_aliquota, ipi_valor, pis_aliquota, pis_valor, cofins_aliquota, cofins_valor",
    )
    .eq("nota_fiscal_id", notaId);
  if (error) throw error;
  return (data ?? []) as ItemRow[];
}

function ambienteFromConfig(emi: EmitenteRow): AmbienteSefaz {
  if (emi.ambiente_sefaz === "1" || emi.ambiente_sefaz === "2") {
    return emi.ambiente_sefaz;
  }
  return emi.ambiente_padrao === "producao" ? "1" : "2";
}

function crtFromConfig(emi: EmitenteRow): CRT {
  const c = (emi.crt ?? "3").trim();
  if (c === "1" || c === "2" || c === "3") return c;
  return "3";
}

function endereco(p: ParceiroRow | EmitenteRow): string {
  if ("logradouro" in p) {
    return [p.logradouro, p.numero].filter(Boolean).join(", ");
  }
  return "";
}

/**
 * Monta o `NFeData` necessário para `autorizarNFe`. Falha cedo com mensagem
 * descritiva quando algum campo crítico do emitente/destinatário está vazio.
 */
export async function buildNFeDataFromDb(nf: NotaFiscal): Promise<NFeData> {
  const emi = await lerEmitente();
  if (!emi.cnpj || !emi.razao_social || !emi.uf || !emi.codigo_ibge_municipio) {
    throw new Error(
      "Emitente sem dados obrigatórios (CNPJ, razão social, UF, código IBGE). Acesse Configuração Fiscal.",
    );
  }

  const isSaida = nf.tipo === "saida";
  if (isSaida && !nf.cliente_id) throw new Error("NF de saída sem cliente vinculado.");
  if (!isSaida && !nf.fornecedor_id) throw new Error("NF de entrada sem fornecedor vinculado.");

  const dest = isSaida
    ? await lerCliente(nf.cliente_id!)
    : await lerFornecedor(nf.fornecedor_id!);

  if (!dest.cpf_cnpj || !dest.uf) {
    throw new Error("Destinatário sem CPF/CNPJ ou UF — corrija o cadastro antes de transmitir.");
  }
  if (!dest.codigo_ibge_municipio || dest.codigo_ibge_municipio.length < 7) {
    throw new Error(
      `Destinatário sem código IBGE do município. Edite o cadastro de ${
        isSaida ? "cliente" : "fornecedor"
      } e informe o município (busca por CEP preenche automaticamente).`,
    );
  }

  const itensDb = await lerItens(nf.id);
  if (itensDb.length === 0) {
    throw new Error("NF sem itens — adicione produtos antes de transmitir.");
  }

  const itens: NFeItemData[] = itensDb.map((it, idx) => {
    const qtd = Number(it.quantidade ?? 0);
    const vUnit = Number(it.valor_unitario ?? 0);
    const vTot = Number(it.valor_total ?? qtd * vUnit);
    return {
      numero: idx + 1,
      codigo: it.codigo_produto ?? `ITEM-${idx + 1}`,
      descricao: it.descricao ?? "Produto",
      ncm: (it.ncm ?? "00000000").replace(/\D/g, "").padStart(8, "0").slice(0, 8),
      cfop: it.cfop ?? "5102",
      unidade: it.unidade ?? "UN",
      quantidade: qtd,
      valorUnitario: vUnit,
      valorTotal: vTot,
      icms: {
        cst: it.cst ?? "00",
        modalidade: "3",
        aliquota: Number(it.icms_aliquota ?? 0),
        valor: Number(it.icms_valor ?? 0),
        base: Number(it.icms_base ?? vTot),
      },
      ipi: it.ipi_valor && Number(it.ipi_valor) > 0
        ? {
            cst: it.cst_ipi ?? "50",
            aliquota: Number(it.ipi_aliquota ?? 0),
            valor: Number(it.ipi_valor ?? 0),
          }
        : undefined,
      pis: {
        cst: it.cst_pis ?? "01",
        aliquota: Number(it.pis_aliquota ?? 0),
        valor: Number(it.pis_valor ?? 0),
      },
      cofins: {
        cst: it.cst_cofins ?? "01",
        aliquota: Number(it.cofins_aliquota ?? 0),
        valor: Number(it.cofins_valor ?? 0),
      },
    };
  });

  const valorProdutos = itens.reduce((s, it) => s + it.valorTotal, 0);
  const valorIcms = itens.reduce((s, it) => s + it.icms.valor, 0);
  const baseIcms = itens.reduce((s, it) => s + it.icms.base, 0);
  const valorIpi = itens.reduce((s, it) => s + (it.ipi?.valor ?? 0), 0);
  const valorPis = itens.reduce((s, it) => s + it.pis.valor, 0);
  const valorCofins = itens.reduce((s, it) => s + it.cofins.valor, 0);

  const indIE = calcularIndIEDest(dest.inscricao_estadual, dest.tipo_pessoa ?? "PJ");

  return {
    chave: nf.chave_acesso ?? "".padEnd(44, "0"),
    numero: nf.numero ?? "0",
    serie: nf.serie ?? "1",
    dataEmissao: new Date(nf.data_emissao ?? new Date()).toISOString(),
    naturezaOperacao: nf.natureza_operacao ?? "Venda",
    tipoDocumento: isSaida ? "1" : "0",
    finalidade: "1",
    crt: crtFromConfig(emi),
    ambiente: ambienteFromConfig(emi),
    cfop: itens[0]?.cfop ?? "5102",
    emitente: {
      cnpj: emi.cnpj,
      razaoSocial: emi.razao_social,
      ie: emi.inscricao_estadual ?? "",
      uf: emi.uf,
      cep: emi.cep ?? "",
      logradouro: emi.logradouro ?? "",
      numero: emi.numero ?? "S/N",
      municipio: emi.cidade ?? "",
      codigoMunicipio: emi.codigo_ibge_municipio,
    },
    destinatario: {
      cpfCnpj: dest.cpf_cnpj,
      razaoSocial: dest.nome,
      ie: dest.inscricao_estadual ?? undefined,
      indIEDest: indIE,
      uf: dest.uf,
      cep: dest.cep ?? "",
      logradouro: dest.logradouro ?? "",
      numero: dest.numero ?? "S/N",
      municipio: dest.cidade ?? "",
      codigoMunicipio: dest.codigo_ibge_municipio,
    },
    itens,
    totais: {
      baseIcms,
      valorIcms,
      valorIcmsSt: 0,
      valorProdutos,
      valorFrete: Number(nf.frete_valor ?? 0),
      valorSeguro: Number(nf.valor_seguro ?? 0),
      valorDesconto: Number(nf.desconto_valor ?? 0),
      valorIpi,
      valorPis,
      valorCofins,
      outrasDespesas: Number(nf.outras_despesas ?? 0),
      valorNF: Number(nf.valor_total ?? valorProdutos),
    },
    pagamentos: [
      { forma: nf.forma_pagamento ?? "01", valor: Number(nf.valor_total ?? valorProdutos) },
    ],
  };
}

/**
 * Monta `DanfeInput` para o gerador client-side de DANFE PDF.
 * Reaproveita as mesmas leituras do `buildNFeDataFromDb`, mas gera uma
 * estrutura mais leve/visual (sem CST, modalidades, etc).
 */
export async function buildDanfeDataFromDb(nf: NotaFiscal): Promise<DanfeInput> {
  const emi = await lerEmitente();
  const isSaida = nf.tipo === "saida";
  const dest = isSaida && nf.cliente_id
    ? await lerCliente(nf.cliente_id)
    : nf.fornecedor_id
      ? await lerFornecedor(nf.fornecedor_id)
      : null;

  const itensDb = await lerItens(nf.id);

  return {
    numero: nf.numero ?? "0",
    serie: nf.serie ?? "1",
    modelo: nf.modelo_documento ?? "55",
    data_emissao: nf.data_emissao ?? new Date().toISOString(),
    natureza_operacao: nf.natureza_operacao ?? null,
    tipo: isSaida ? "saida" : "entrada",
    chave_acesso: nf.chave_acesso ?? null,
    protocolo_autorizacao: nf.protocolo_autorizacao ?? null,
    status_sefaz: nf.status_sefaz ?? null,
    ambiente_emissao: nf.ambiente_emissao ?? null,
    emitente: {
      razao_social: emi.razao_social ?? "",
      nome_fantasia: emi.nome_fantasia,
      cnpj: emi.cnpj,
      inscricao_estadual: emi.inscricao_estadual,
      endereco: endereco(emi),
      cidade: emi.cidade,
      uf: emi.uf,
      cep: emi.cep,
      telefone: emi.telefone,
    },
    destinatario: {
      nome: dest?.nome ?? "—",
      cpf_cnpj: dest?.cpf_cnpj ?? null,
      inscricao_estadual: dest?.inscricao_estadual ?? null,
      endereco: dest ? endereco(dest as unknown as EmitenteRow) : null,
      cidade: dest?.cidade ?? null,
      uf: dest?.uf ?? null,
      cep: dest?.cep ?? null,
    },
    itens: itensDb.map((it) => ({
      descricao: it.descricao ?? "—",
      codigo: it.codigo_produto,
      ncm: it.ncm,
      cfop: it.cfop,
      unidade: it.unidade,
      quantidade: Number(it.quantidade ?? 0),
      valor_unitario: Number(it.valor_unitario ?? 0),
      valor_total: Number(it.valor_total ?? 0),
    })),
    valor_produtos: Number(nf.valor_produtos ?? 0),
    frete_valor: Number(nf.frete_valor ?? 0),
    desconto_valor: Number(nf.desconto_valor ?? 0),
    outras_despesas: Number(nf.outras_despesas ?? 0),
    icms_valor: Number(nf.icms_valor ?? 0),
    icms_st_valor: Number(nf.icms_st_valor ?? 0),
    ipi_valor: Number(nf.ipi_valor ?? 0),
    pis_valor: Number(nf.pis_valor ?? 0),
    cofins_valor: Number(nf.cofins_valor ?? 0),
    valor_total: Number(nf.valor_total ?? 0),
    observacoes: nf.observacoes ?? null,
  };
}