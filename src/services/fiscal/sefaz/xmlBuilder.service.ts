/**
 * Construção de XML para documentos fiscais (NF-e, Cancelamento, Inutilização).
 * Gera XML conforme o schema NF-e 4.00 da SEFAZ.
 */

export interface NFeItemData {
  numero: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  icms: {
    cst: string;
    modalidade: string;
    aliquota: number;
    valor: number;
    base: number;
  };
  ipi?: {
    cst: string;
    aliquota: number;
    valor: number;
  };
  pis: {
    cst: string;
    aliquota: number;
    valor: number;
  };
  cofins: {
    cst: string;
    aliquota: number;
    valor: number;
  };
}

export interface NFeTotaisData {
  baseIcms: number;
  valorIcms: number;
  valorIcmsSt: number;
  valorProdutos: number;
  valorFrete: number;
  valorSeguro: number;
  valorDesconto: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  outrasDespesas: number;
  valorNF: number;
}

export interface NFePagamentoData {
  forma: string;
  valor: number;
}

/** Código de Regime Tributário do emitente (NF-e 4.00). */
export type CRT = "1" | "2" | "3";
/** Tipo de ambiente SEFAZ: "1" = Produção, "2" = Homologação. */
export type AmbienteSefaz = "1" | "2";
/**
 * Indicador de IE do destinatário (NF-e 4.00):
 * - "1" = Contribuinte ICMS
 * - "2" = Contribuinte isento de IE
 * - "9" = Não contribuinte
 */
export type IndIEDest = "1" | "2" | "9";

export interface NFeData {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  naturezaOperacao: string;
  tipoDocumento: "0" | "1";
  finalidade: "1" | "2" | "3" | "4";
  /** Código de Regime Tributário do emitente. Vem da configuração da empresa. */
  crt: CRT;
  /** Ambiente SEFAZ. "1" = Produção, "2" = Homologação. Vem da configuração. */
  ambiente: AmbienteSefaz;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    ie: string;
    uf: string;
    cep: string;
    logradouro: string;
    numero: string;
    municipio: string;
    codigoMunicipio: string;
  };
  destinatario: {
    cpfCnpj: string;
    razaoSocial: string;
    ie?: string;
    /** Indicador de IE do destinatário. Calcule com `calcularIndIEDest`. */
    indIEDest: IndIEDest;
    uf: string;
    cep: string;
    logradouro: string;
    numero: string;
    municipio: string;
    codigoMunicipio: string;
  };
  itens: NFeItemData[];
  totais: NFeTotaisData;
  pagamentos: NFePagamentoData[];
  cfop: string;
}

/**
 * Calcula o `indIEDest` correto para o destinatário a partir de IE e tipo de pessoa.
 *
 * Regras:
 * - Pessoa Física → "9" (não contribuinte).
 * - PJ sem IE ou com IE "ISENTO" → "9" (não contribuinte) ou "2" (isento).
 *   Por simplicidade, retornamos "9" quando vazio e "2" quando explicitamente "ISENTO".
 * - PJ com IE válida → "1" (contribuinte).
 */
export function calcularIndIEDest(
  inscricaoEstadual: string | null | undefined,
  tipoPessoa: string,
): IndIEDest {
  const tipo = (tipoPessoa || "").toUpperCase();
  if (tipo === "PF" || tipo === "F") return "9";
  const ie = (inscricaoEstadual ?? "").trim();
  if (!ie) return "9";
  if (ie.toUpperCase() === "ISENTO") return "2";
  return "1";
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

function fmt4(n: number): string {
  return n.toFixed(4);
}

function fmt10(n: number): string {
  return n.toFixed(10);
}

/**
 * Escapes special XML characters to prevent invalid XML output.
 * Must be applied to all user-supplied string values embedded in XML.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildItem(item: NFeItemData): string {
  const ipiXml = item.ipi
    ? `<IPI>
        <IPITrib>
          <CST>${item.ipi.cst}</CST>
          <pIPI>${fmt4(item.ipi.aliquota)}</pIPI>
          <vIPI>${fmt2(item.ipi.valor)}</vIPI>
        </IPITrib>
      </IPI>`
    : "";

  return `<det nItem="${item.numero}">
    <prod>
      <cProd>${escapeXml(item.codigo)}</cProd>
      <cEAN>SEM GTIN</cEAN>
      <xProd>${escapeXml(item.descricao)}</xProd>
      <NCM>${item.ncm}</NCM>
      <CFOP>${item.cfop}</CFOP>
      <uCom>${escapeXml(item.unidade)}</uCom>
      <qCom>${fmt4(item.quantidade)}</qCom>
      <vUnCom>${fmt10(item.valorUnitario)}</vUnCom>
      <vProd>${fmt2(item.valorTotal)}</vProd>
      <cEANTrib>SEM GTIN</cEANTrib>
      <uTrib>${escapeXml(item.unidade)}</uTrib>
      <qTrib>${fmt4(item.quantidade)}</qTrib>
      <vUnTrib>${fmt10(item.valorUnitario)}</vUnTrib>
      <indTot>1</indTot>
    </prod>
    <imposto>
      <ICMS>
        <ICMS${item.icms.cst.padStart(2, "0")}>
          <orig>0</orig>
          <CST>${item.icms.cst}</CST>
          <modBC>${item.icms.modalidade}</modBC>
          <vBC>${fmt2(item.icms.base)}</vBC>
          <pICMS>${fmt2(item.icms.aliquota)}</pICMS>
          <vICMS>${fmt2(item.icms.valor)}</vICMS>
        </ICMS${item.icms.cst.padStart(2, "0")}>
      </ICMS>
      ${ipiXml}
      <PIS>
        <PISAliq>
          <CST>${item.pis.cst}</CST>
          <vBC>${fmt2(item.valorTotal)}</vBC>
          <pPIS>${fmt2(item.pis.aliquota)}</pPIS>
          <vPIS>${fmt2(item.pis.valor)}</vPIS>
        </PISAliq>
      </PIS>
      <COFINS>
        <COFINSAliq>
          <CST>${item.cofins.cst}</CST>
          <vBC>${fmt2(item.valorTotal)}</vBC>
          <pCOFINS>${fmt2(item.cofins.aliquota)}</pCOFINS>
          <vCOFINS>${fmt2(item.cofins.valor)}</vCOFINS>
        </COFINSAliq>
      </COFINS>
    </imposto>
  </det>`;
}

/**
 * Constrói o XML de uma NF-e conforme schema 4.00.
 *
 * Os campos `crt`, `ambiente` e `destinatario.indIEDest` são lidos de
 * `dados` em vez de hardcoded — garante que a NF reflita a configuração
 * fiscal real do emitente e o status do destinatário.
 */
export function construirXMLNFe(dados: NFeData): string {
  const destDoc = dados.destinatario.cpfCnpj.replace(/\D/g, "").length === 14
    ? `<CNPJ>${dados.destinatario.cpfCnpj.replace(/\D/g, "")}</CNPJ>`
    : `<CPF>${dados.destinatario.cpfCnpj.replace(/\D/g, "")}</CPF>`;

  const emiDoc = `<CNPJ>${dados.emitente.cnpj.replace(/\D/g, "")}</CNPJ>`;

  const itensXml = dados.itens.map(buildItem).join("\n");

  const pagamentosXml = dados.pagamentos
    .map((p) => `<detPag><tPag>${p.forma}</tPag><vPag>${fmt2(p.valor)}</vPag></detPag>`)
    .join("\n");

  const ieDestXml =
    dados.destinatario.indIEDest === "1" && dados.destinatario.ie
      ? `<IE>${dados.destinatario.ie}</IE>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${dados.chave}" versao="4.00">
      <ide>
        <cUF>${dados.emitente.uf}</cUF>
        <cNF>${dados.chave.slice(35, 43)}</cNF>
        <natOp>${escapeXml(dados.naturezaOperacao)}</natOp>
        <mod>55</mod>
        <serie>${dados.serie}</serie>
        <nNF>${dados.numero}</nNF>
        <dhEmi>${dados.dataEmissao}</dhEmi>
        <tpNF>${dados.tipoDocumento}</tpNF>
        <idDest>1</idDest>
        <cMunFG>${dados.emitente.codigoMunicipio}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${dados.chave.slice(43)}</cDV>
        <tpAmb>${dados.ambiente}</tpAmb>
        <finNFe>${dados.finalidade}</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>1.0</verProc>
      </ide>
      <emit>
        ${emiDoc}
        <xNome>${escapeXml(dados.emitente.razaoSocial)}</xNome>
        <enderEmit>
          <xLgr>${escapeXml(dados.emitente.logradouro)}</xLgr>
          <nro>${escapeXml(dados.emitente.numero)}</nro>
          <xMun>${escapeXml(dados.emitente.municipio)}</xMun>
          <cMun>${dados.emitente.codigoMunicipio}</cMun>
          <UF>${dados.emitente.uf}</UF>
          <CEP>${dados.emitente.cep.replace(/\D/g, "")}</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
        </enderEmit>
        <IE>${dados.emitente.ie}</IE>
        <CRT>${dados.crt}</CRT>
      </emit>
      <dest>
        ${destDoc}
        <xNome>${escapeXml(dados.destinatario.razaoSocial)}</xNome>
        <enderDest>
          <xLgr>${escapeXml(dados.destinatario.logradouro)}</xLgr>
          <nro>${escapeXml(dados.destinatario.numero)}</nro>
          <xMun>${escapeXml(dados.destinatario.municipio)}</xMun>
          <cMun>${dados.destinatario.codigoMunicipio}</cMun>
          <UF>${dados.destinatario.uf}</UF>
          <CEP>${dados.destinatario.cep.replace(/\D/g, "")}</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
        </enderDest>
        <indIEDest>${dados.destinatario.indIEDest}</indIEDest>
        ${ieDestXml}
      </dest>
      ${itensXml}
      <total>
        <ICMSTot>
          <vBC>${fmt2(dados.totais.baseIcms)}</vBC>
          <vICMS>${fmt2(dados.totais.valorIcms)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>${fmt2(dados.totais.valorIcmsSt)}</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${fmt2(dados.totais.valorProdutos)}</vProd>
          <vFrete>${fmt2(dados.totais.valorFrete)}</vFrete>
          <vSeg>${fmt2(dados.totais.valorSeguro)}</vSeg>
          <vDesc>${fmt2(dados.totais.valorDesconto)}</vDesc>
          <vII>0.00</vII>
          <vIPI>${fmt2(dados.totais.valorIpi)}</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>${fmt2(dados.totais.valorPis)}</vPIS>
          <vCOFINS>${fmt2(dados.totais.valorCofins)}</vCOFINS>
          <vOutro>${fmt2(dados.totais.outrasDespesas)}</vOutro>
          <vNF>${fmt2(dados.totais.valorNF)}</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      <pag>
        ${pagamentosXml}
      </pag>
      <infAdic>
        <infCpl>Documento emitido pelo sistema Avizee Spark</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
</nfeProc>`;
}

/**
 * Constrói o XML de evento de cancelamento de NF-e.
 *
 * @param ambiente "1" = Produção, "2" = Homologação. Deve refletir o ambiente
 * em que a NF-e foi originalmente autorizada.
 */
export function construirXMLCancelamento(
  chave: string,
  protocolo: string,
  justificativa: string,
  cnpjEmitente: string,
  dataHora: string,
  ambiente: AmbienteSefaz = "2",
): string {
  const cnpj = cnpjEmitente.replace(/\D/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110111${chave}01">
      <cOrgao>91</cOrgao>
      <tpAmb>${ambiente}</tpAmb>
      <CNPJ>${cnpj}</CNPJ>
      <chNFe>${chave}</chNFe>
      <dhEvento>${dataHora}</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <nProt>${protocolo}</nProt>
        <xJust>${escapeXml(justificativa)}</xJust>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`;
}

/**
 * Constrói o XML de inutilização de numeração de NF-e.
 *
 * @param ambiente "1" = Produção, "2" = Homologação.
 */
export function construirXMLInutilizacao(
  cnpj: string,
  ano: number,
  serie: number,
  numInicial: number,
  numFinal: number,
  justificativa: string,
  uf: string,
  ambiente: AmbienteSefaz = "2",
): string {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  const anoStr = String(ano).slice(-2);
  const id = `ID${uf}${anoStr}${cnpjLimpo}55${String(serie).padStart(3, "0")}${String(numInicial).padStart(9, "0")}${String(numFinal).padStart(9, "0")}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<inutNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <infInut Id="${id}">
    <tpAmb>${ambiente}</tpAmb>
    <xServ>INUTILIZAR</xServ>
    <cUF>${uf}</cUF>
    <ano>${anoStr}</ano>
    <CNPJ>${cnpjLimpo}</CNPJ>
    <mod>55</mod>
    <serie>${serie}</serie>
    <nNFIni>${numInicial}</nNFIni>
    <nNFFin>${numFinal}</nNFFin>
    <xJust>${escapeXml(justificativa)}</xJust>
  </infInut>
</inutNFe>`;
}

/**
 * Constrói o XML de evento de Carta de Correção Eletrônica (CC-e).
 * tpEvento = 110110, conforme MOC NF-e 4.00.
 *
 * @param correcao Texto da correção (15 a 1000 caracteres).
 * @param sequencia Número sequencial da CC-e para a mesma NF (1..20).
 */
export function construirXMLCartaCorrecao(
  chave: string,
  correcao: string,
  cnpjEmitente: string,
  dataHora: string,
  sequencia: number,
  ambiente: AmbienteSefaz = "2",
): string {
  const cnpj = cnpjEmitente.replace(/\D/g, "");
  const seqStr = String(sequencia).padStart(2, "0");
  return `<?xml version="1.0" encoding="UTF-8"?>
<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110110${chave}${seqStr}">
      <cOrgao>91</cOrgao>
      <tpAmb>${ambiente}</tpAmb>
      <CNPJ>${cnpj}</CNPJ>
      <chNFe>${chave}</chNFe>
      <dhEvento>${dataHora}</dhEvento>
      <tpEvento>110110</tpEvento>
      <nSeqEvento>${sequencia}</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Carta de Correcao</descEvento>
        <xCorrecao>${escapeXml(correcao)}</xCorrecao>
        <xCondUso>A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.</xCondUso>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`;
}
