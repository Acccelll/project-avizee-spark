import { normalizeText, normalizeCodigoProduto, normalizeCpfCnpj, normalizePhone, normalizeCep } from './normalizers';
import { parseDecimalFlexible, parseDateFlexible, parseQuantidadeEstoque } from './parsers';

/**
 * Resultado da validação de importação.
 */
export interface ImportValidationResult<T = unknown> {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  normalizedData: T;
}

/**
 * Validação genérica para produtos.
 */
export function validateProdutoImport(data: Record<string, unknown>): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const tipoRaw = normalizeText(
    data.tipo_item || data.TIPO_ITEM || data['TIPO ITEM'] || data.TIPO || ''
  ).toLowerCase();
  const tipoItem = tipoRaw === 'insumo' ? 'insumo' : 'produto';

  const normalizedData: Record<string, unknown> = {
    codigo_legado: normalizeText(
      data.codigo_legado || data['CODIGO LEGADO'] || data['CÓDIGO LEGADO'] || data.CODLEG || ''
    ) || null,
    codigo_interno: normalizeCodigoProduto(
      data.codigo_interno || data.codigo || data.SKU || data.CÓDIGO || data.CODIGO
    ),
    nome: normalizeText(data.nome || data.DESCRIÇÃO || data.DESCRICAO || data.PRODUTO || ''),
    tipo_item: tipoItem,
    variacoes: data.variacoes || data.VARIAÇÕES || data.VARIACOES || null,
    preco_venda: parseDecimalFlexible(
      data.preco_venda || data['PRECO VENDA'] || data['PREÇO VENDA'] || data.PREÇO || data.VALOR
    ).value || 0,
    preco_custo: parseDecimalFlexible(
      data.preco_custo || data['PRECO CUSTO'] || data['PREÇO CUSTO'] || data.CUSTO
    ).value || 0,
    unidade_medida: normalizeText(data.unidade_medida || data.UN || data.UNIDADE) || 'UN',
    ncm: normalizeText(data.ncm || data.NCM) || null,
    gtin: normalizeText(data.gtin || data.GTIN || data.EAN) || null,
    peso: parseDecimalFlexible(data.peso || data.PESO).value || 0,
    grupo: normalizeText(data.grupo || data.GRUPO || data.CATEGORIA) || null,
  };

  // Resolve chave principal: prioriza codigo_legado, depois codigo_interno
  if (!normalizedData.codigo_legado && !normalizedData.codigo_interno) {
    errors.push('Código do produto é obrigatório.');
  }
  if (!normalizedData.nome) errors.push('Nome/Descrição do produto é obrigatório.');
  if (tipoItem === 'produto' && normalizedData.preco_venda <= 0) {
    warnings.push('Preço de venda é zero ou não informado.');
  }

  return { valid: errors.length === 0, errors, warnings, normalizedData };
}

/**
 * Validação para clientes.
 */
export function validateClienteImport(data: Record<string, unknown>): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const cpfCnpjRaw = normalizeCpfCnpj(data.cpf_cnpj || data.CPF || data.CNPJ || data['CPF/CNPJ'] || '');
  const tipoPessoa = cpfCnpjRaw.length === 11 ? 'F' : 'J';

  const normalizedData: Record<string, unknown> = {
    codigo_legado: normalizeText(
      data.codigo_legado || data['CODIGO LEGADO'] || data['CÓDIGO LEGADO'] || data.CODLEG || ''
    ) || null,
    nome_razao_social: normalizeText(
      data.nome || data.nome_razao_social || data['RAZAO SOCIAL'] || data['RAZÃO SOCIAL'] || ''
    ),
    nome_fantasia: normalizeText(data.nome_fantasia || data['NOME FANTASIA'] || '') || null,
    cpf_cnpj: cpfCnpjRaw || null,
    tipo_pessoa: tipoPessoa,
    inscricao_estadual: normalizeText(data.inscricao_estadual || data['INSCRIÇÃO ESTADUAL'] || data.IE || '') || null,
    email: normalizeText(data.email || data.EMAIL || data['E-MAIL'] || '').toLowerCase() || null,
    telefone: normalizePhone(data.telefone || data.FONE || data.CELULAR || '') || null,
    contato: normalizeText(data.contato || data.CONTATO || '') || null,
    logradouro: normalizeText(data.logradouro || data.endereco || data.ENDEREÇO || data.ENDERECO || '') || null,
    numero: normalizeText(data.numero || data.NÚMERO || data.NUMERO || '') || null,
    complemento: normalizeText(data.complemento || data.COMPLEMENTO || '') || null,
    bairro: normalizeText(data.bairro || data.BAIRRO || '') || null,
    cidade: normalizeText(data.cidade || data.CIDADE || '') || null,
    uf: normalizeText(data.uf || data.ESTADO || data.UF || '').toUpperCase().slice(0, 2) || null,
    cep: normalizeCep(data.cep || data.CEP || '') || null,
    observacoes: normalizeText(data.observacoes || data.OBSERVAÇÕES || data.OBSERVACOES || '') || null,
  };

  if (!normalizedData.nome_razao_social) errors.push('Nome/Razão Social do cliente é obrigatório.');
  if (cpfCnpjRaw && cpfCnpjRaw.length !== 11 && cpfCnpjRaw.length !== 14) {
    errors.push('CPF/CNPJ inválido (deve ter 11 ou 14 dígitos).');
  }
  if (!normalizedData.codigo_legado && !cpfCnpjRaw) {
    warnings.push('Sem chave legada nem CPF/CNPJ: risco de duplicidade.');
  }

  return { valid: errors.length === 0, errors, warnings, normalizedData };
}

/**
 * Validação para fornecedores.
 */
export function validateFornecedorImport(data: Record<string, unknown>): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const cpfCnpjRaw = normalizeCpfCnpj(data.cpf_cnpj || data.CPF || data.CNPJ || data['CPF/CNPJ'] || '');
  const tipoPessoa = cpfCnpjRaw.length === 11 ? 'F' : 'J';

  const normalizedData: Record<string, unknown> = {
    codigo_legado: normalizeText(
      data.codigo_legado || data['CODIGO LEGADO'] || data['CÓDIGO LEGADO'] || data.CODLEG || ''
    ) || null,
    nome_razao_social: normalizeText(
      data.nome || data.nome_razao_social || data['RAZAO SOCIAL'] || data['RAZÃO SOCIAL'] || ''
    ),
    nome_fantasia: normalizeText(data.nome_fantasia || data['NOME FANTASIA'] || '') || null,
    cpf_cnpj: cpfCnpjRaw || null,
    tipo_pessoa: tipoPessoa,
    inscricao_estadual: normalizeText(data.inscricao_estadual || data['INSCRIÇÃO ESTADUAL'] || data.IE || '') || null,
    email: normalizeText(data.email || data.EMAIL || data['E-MAIL'] || '').toLowerCase() || null,
    telefone: normalizePhone(data.telefone || data.FONE || data.CELULAR || '') || null,
    contato: normalizeText(data.contato || data.CONTATO || '') || null,
    logradouro: normalizeText(data.logradouro || data.endereco || data.ENDEREÇO || data.ENDERECO || '') || null,
    numero: normalizeText(data.numero || data.NÚMERO || data.NUMERO || '') || null,
    complemento: normalizeText(data.complemento || data.COMPLEMENTO || '') || null,
    bairro: normalizeText(data.bairro || data.BAIRRO || '') || null,
    cidade: normalizeText(data.cidade || data.CIDADE || '') || null,
    uf: normalizeText(data.uf || data.ESTADO || data.UF || '').toUpperCase().slice(0, 2) || null,
    cep: normalizeCep(data.cep || data.CEP || '') || null,
    observacoes: normalizeText(data.observacoes || data.OBSERVAÇÕES || data.OBSERVACOES || '') || null,
  };

  if (!normalizedData.nome_razao_social) errors.push('Nome/Razão Social do fornecedor é obrigatório.');
  if (cpfCnpjRaw && cpfCnpjRaw.length !== 11 && cpfCnpjRaw.length !== 14) {
    errors.push('CPF/CNPJ inválido (deve ter 11 ou 14 dígitos).');
  }
  if (!normalizedData.codigo_legado && !cpfCnpjRaw) {
    warnings.push('Sem chave legada nem CPF/CNPJ: risco de duplicidade.');
  }

  return { valid: errors.length === 0, errors, warnings, normalizedData };
}

/**
 * Validação para estoque inicial.
 */
export function validateEstoqueInicialImport(data: Record<string, unknown>): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const qtdResult = parseQuantidadeEstoque(data.quantidade || data.ESTOQUE || data.QTD);

  const dataEstoqueRaw = data.data_estoque_inicial || data['DATA ESTOQUE'] || data['DATA DO ESTOQUE'] || data.DATA || data['DATA INICIAL'] || null;
  const dataEstoqueResult = parseDateFlexible(dataEstoqueRaw);

  const normalizedData: Record<string, unknown> = {
    codigo_legado: normalizeText(
      data.codigo_legado || data['CODIGO LEGADO'] || data['CÓDIGO LEGADO'] || ''
    ) || null,
    codigo_produto: normalizeCodigoProduto(
      data.codigo_produto || data['CODIGO PRODUTO'] || data['CÓDIGO PRODUTO'] || data.SKU || data.CÓDIGO || data.CODIGO
    ),
    quantidade: qtdResult.value ?? 0,
    data_estoque_inicial: dataEstoqueResult.value || null,
    unidade_medida: normalizeText(data.unidade_medida || data.UN || data.UNIDADE) || 'UN',
    deposito: normalizeText(data.deposito || data.DEPÓSITO || data.LOCAL) || 'Geral',
    custo_unitario: parseDecimalFlexible(data.custo_unitario || data['CUSTO UNITÁRIO'] || data.CUSTO).value || null,
  };

  if (!normalizedData.codigo_legado && !normalizedData.codigo_produto) {
    errors.push('Código do produto (codigo_legado ou codigo_produto) é obrigatório.');
  }
  if (qtdResult.error) errors.push(qtdResult.error);
  if (normalizedData.quantidade < 0) errors.push('Quantidade não pode ser negativa.');
  if (!normalizedData.data_estoque_inicial) {
    warnings.push(dataEstoqueResult.error || 'Data do estoque inicial não informada; será usada a data atual.');
  }

  return { valid: errors.length === 0, errors, warnings, normalizedData };
}

/**
 * Validação para faturamento histórico (uma linha por item da NF).
 */
export function validateFaturamentoImport(data: Record<string, unknown>): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dataRef = parseDateFlexible(
    data.data || data.data_emissao || data.DATA || data['DATA EMISSÃO'] || data.EMISSÃO || data.EMISSAO
  );
  const valorUnitRef = parseDecimalFlexible(
    data.valor_unitario || data['VALOR UNITÁRIO'] || data['VALOR UNITARIO'] || data.VALOR
  );
  const qtdRef = parseDecimalFlexible(
    data.quantidade_nf || data['QUANTIDADE NF'] || data.quantidade || data.QTD || data.QUANTIDADE || 1
  );
  const valorTotalRef = parseDecimalFlexible(
    data.valor_total || data['VALOR TOTAL'] || data.TOTAL || 0
  );

  const cpfCnpjDest = normalizeCpfCnpj(
    data.cpf_cnpj || data['CPF/CNPJ'] || data.cpf_cnpj_destinatario || ''
  );

  const normalizedData: Record<string, unknown> = {
    numero_nota: normalizeText(data.numero_nota || data.NOTA || data.NF || data['NUMERO NOTA'] || ''),
    chave_acesso: normalizeText(data.chave_acesso || data['CHAVE ACESSO'] || data['CHAVE DE ACESSO'] || '') || null,
    data_emissao: dataRef.value,
    cliente_nome: normalizeText(data.cliente || data.CLIENTE || data.DESTINATÁRIO || data.DESTINATARIO || ''),
    cpf_cnpj_destinatario: cpfCnpjDest || null,
    municipio: normalizeText(data.municipio || data.MUNICÍPIO || data.CIDADE || '') || null,
    uf: normalizeText(data.uf || data.UF || data.ESTADO || '').toUpperCase().slice(0, 2) || null,
    // Item fields
    codigo_produto_nf: normalizeCodigoProduto(
      data.codigo_produto_nf || data['COD PRODUTO NF'] || data.codigo_produto || data.SKU || data.CÓDIGO || ''
    ) || null,
    codigo_legado_produto: normalizeText(data.codigo_legado_produto || data['CODIGO LEGADO'] || '') || null,
    nome_produto: normalizeText(data.nome_produto || data.PRODUTO || data['DESCRIÇÃO PRODUTO'] || data['DESCRICAO PRODUTO'] || '') || null,
    ncm: normalizeText(data.ncm || data.NCM) || null,
    cfop: normalizeText(data.cfop || data.CFOP) || null,
    cst: normalizeText(data.cst || data.CST) || null,
    unidade: normalizeText(data.unidade_medida || data.UN || data.UNIDADE) || 'UN',
    quantidade: qtdRef.value || 1,
    valor_unitario: valorUnitRef.value || 0,
    valor_total: valorTotalRef.value > 0
      ? valorTotalRef.value
      : (valorUnitRef.value || 0) * (qtdRef.value || 1),
    frete_valor: parseDecimalFlexible(data.frete_valor || data.FRETE).value || 0,
    icms_valor: parseDecimalFlexible(data.icms_valor || data.ICMS).value || 0,
    ipi_valor: parseDecimalFlexible(data.ipi_valor || data.IPI).value || 0,
    pis_valor: parseDecimalFlexible(data.pis_valor || data.PIS).value || 0,
    cofins_valor: parseDecimalFlexible(data.cofins_valor || data.COFINS).value || 0,
    custo_produto: parseDecimalFlexible(data.custo_produto || data['CUSTO PRODUTO']).value || 0,
    lucro: parseDecimalFlexible(data.lucro || data.LUCRO).value || 0,
    grupo: normalizeText(data.grupo || data.GRUPO || '') || null,
  };

  if (!normalizedData.numero_nota) errors.push('Número da nota fiscal é obrigatório.');
  if (!normalizedData.data_emissao) errors.push(dataRef.error || 'Data de emissão é obrigatória.');
  if (normalizedData.valor_total <= 0) {
    warnings.push('Valor total do item é zero ou não informado.');
  }
  if (!normalizedData.codigo_produto_nf && !normalizedData.codigo_legado_produto && !normalizedData.nome_produto) {
    warnings.push('Item sem identificação de produto (código ou nome).');
  }

  return { valid: errors.length === 0, errors, warnings, normalizedData };
}

/**
 * Validação para financeiro (contas a pagar/receber) — suporta aberto e baixado.
 */
export function validateFinanceiroImport(data: Record<string, unknown>): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dataVenc = parseDateFlexible(
    data.data_vencimento || data.VENCIMENTO || data['DATA VENCIMENTO'] || data['DATA DE VENCIMENTO']
  );
  const dataEmissao = parseDateFlexible(
    data.data_emissao || data['DATA EMISSÃO'] || data.EMISSAO || data.EMISSÃO
  );
  const dataPagamento = parseDateFlexible(
    data.data_pagamento || data['DATA PAGAMENTO'] || data['DATA BAIXA'] || data.BAIXA || data.PAGAMENTO
  );
  const valorRef = parseDecimalFlexible(data.valor || data.VALOR);
  const valorPagoRef = parseDecimalFlexible(data.valor_pago || data['VALOR PAGO'] || data.VLPAGO || null);

  // Normalizar tipo: CR→receber, CP→pagar
  const tipoRaw = normalizeText(
    data.tipo || data['TIPO TITULO'] || data['TIPO TÍTULO'] || data['PAGAR/RECEBER'] || data.PAGAR_RECEBER || ''
  ).toUpperCase();
  let tipo = 'receber';
  if (tipoRaw === 'CP' || tipoRaw === 'PAGAR' || tipoRaw === 'P') tipo = 'pagar';
  else if (tipoRaw === 'CR' || tipoRaw === 'RECEBER' || tipoRaw === 'R') tipo = 'receber';
  else if (tipoRaw) warnings.push(`Tipo não reconhecido: "${tipoRaw}". Usando "receber".`);

  // Determinar status: se há data de pagamento confiável → baixado; senão → aberto
  const isBaixado = !!(dataPagamento.value);
  const statusNorm = isBaixado ? 'baixado' : 'aberto';

  const normalizedData: Record<string, unknown> = {
    tipo,
    descricao: normalizeText(
      data.descricao || data.HISTORICO || data.HISTÓRICO || data.DESCRIÇÃO || data.DESCRICAO || data.titulo || data.TÍTULO || data.TITULO || ''
    ),
    titulo: normalizeText(data.titulo || data.TÍTULO || data.DOCUMENTO || data.DOC || data['NUMERO DOC'] || '') || null,
    parcela_numero: data.parcela ? parseInt(String(data.parcela).split('/')[0]) || null : null,
    parcela_total: data.parcela ? parseInt(String(data.parcela).split('/')[1]) || null : null,
    data_emissao: dataEmissao.value || null,
    data_vencimento: dataVenc.value,
    data_pagamento: dataPagamento.value || null,
    valor: valorRef.value || 0,
    valor_pago: valorPagoRef.value || null,
    status: statusNorm,
    forma_pagamento: normalizeText(data.forma_pagamento || data['FORMA PAGAMENTO'] || data['FORMA DE PAGAMENTO'] || '') || null,
    banco: normalizeText(data.banco || data.BANCO || '') || null,
    cpf_cnpj: normalizeCpfCnpj(data.cpf_cnpj || data['CPF/CNPJ'] || ''),
    codigo_legado_pessoa: normalizeText(data.codigo_legado_pessoa || data.codigo_legado || data['CODIGO LEGADO'] || '') || null,
    observacoes: normalizeText(data.observacoes || data.OBSERVAÇÕES || data.OBSERVACOES || '') || null,
  };

  if (!normalizedData.descricao) errors.push('Descrição/Histórico é obrigatório.');
  if (!normalizedData.data_vencimento) errors.push(dataVenc.error || 'Data de vencimento é obrigatória.');
  if (normalizedData.valor <= 0) errors.push('Valor deve ser maior que zero.');
  if (!normalizedData.cpf_cnpj && !normalizedData.codigo_legado_pessoa) {
    warnings.push('Sem CPF/CNPJ nem chave legada: título não poderá ser vinculado à pessoa.');
  }

  return { valid: errors.length === 0, errors, warnings, normalizedData };
}

