import { normalizeText, normalizeCodigoProduto, normalizeCpfCnpj, normalizeMoneyBR, normalizeDateBR } from './normalizers';
import { parseDecimalFlexible, parseDateFlexible, parseQuantidadeEstoque } from './parsers';

/**
 * Resultado da validação de importação.
 */
export interface ImportValidationResult<T = any> {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  normalizedData: T;
}

/**
 * Validação genérica para produtos.
 */
export function validateProdutoImport(data: any): ImportValidationResult {
  const errors: string[] = [];
  const normalizedData: any = {
    codigo_interno: normalizeCodigoProduto(data.codigo_interno || data.SKU || data.CÓDIGO || data.codigo),
    nome: normalizeText(data.nome || data.DESCRIÇÃO || data.DESCRICAO),
    preco_venda: parseDecimalFlexible(data.preco_venda || data.PREÇO || data.VALOR).value || 0,
    preco_custo: parseDecimalFlexible(data.preco_custo || data.CUSTO).value || 0,
    unidade_medida: normalizeText(data.unidade_medida || data.UN || data.UNIDADE) || 'UN',
    ncm: normalizeText(data.ncm || data.NCM),
    gtin: normalizeText(data.gtin || data.GTIN || data.EAN),
  };

  if (!normalizedData.codigo_interno) errors.push('Código do produto é obrigatório.');
  if (!normalizedData.nome) errors.push('Nome/Descrição do produto é obrigatório.');
  if (normalizedData.preco_venda <= 0) errors.push('Preço de venda deve ser maior que zero.');

  return {
    valid: errors.length === 0,
    errors,
    normalizedData,
  };
}

/**
 * Validação para clientes.
 */
export function validateClienteImport(data: any): ImportValidationResult {
  const errors: string[] = [];
  const normalizedData: any = {
    nome: normalizeText(data.nome || data.RAZAO_SOCIAL || data.RAZÃO_SOCIAL),
    cpf_cnpj: normalizeCpfCnpj(data.cpf_cnpj || data.CPF || data.CNPJ),
    email: normalizeText(data.email || data.EMAIL || data.E_MAIL).toLowerCase(),
    telefone: normalizeText(data.telefone || data.FONE || data.CELULAR),
    cidade: normalizeText(data.cidade || data.CIDADE),
    uf: normalizeText(data.uf || data.ESTADO || data.UF).toUpperCase(),
  };

  if (!normalizedData.nome) errors.push('Nome do cliente é obrigatório.');
  if (normalizedData.cpf_cnpj && normalizedData.cpf_cnpj.length !== 11 && normalizedData.cpf_cnpj.length !== 14) {
    errors.push('CPF/CNPJ inválido (deve ter 11 ou 14 dígitos).');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedData,
  };
}

/**
 * Validação para fornecedores.
 */
export function validateFornecedorImport(data: any): ImportValidationResult {
  // Mesma lógica básica do cliente para propósitos de staging
  const result = validateClienteImport(data);
  return result;
}

/**
 * Validação para estoque inicial.
 */
export function validateEstoqueInicialImport(data: any): ImportValidationResult {
  const errors: string[] = [];
  const qtdResult = parseQuantidadeEstoque(data.quantidade || data.ESTOQUE || data.QTD);

  const normalizedData: any = {
    codigo_produto: normalizeCodigoProduto(data.codigo_produto || data.SKU || data.CÓDIGO),
    quantidade: qtdResult.value || 0,
    unidade_medida: normalizeText(data.unidade_medida || data.UN || data.UNIDADE) || 'UN',
    deposito: normalizeText(data.deposito || data.DEPÓSITO || data.LOCAL) || 'Geral',
  };

  if (!normalizedData.codigo_produto) errors.push('Código do produto é obrigatório.');
  if (qtdResult.error) errors.push(qtdResult.error);
  if (normalizedData.quantidade < 0) errors.push('Quantidade não pode ser negativa.');

  return {
    valid: errors.length === 0,
    errors,
    normalizedData,
  };
}

/**
 * Validação para faturamento histórico.
 */
export function validateFaturamentoImport(data: any): ImportValidationResult {
  const errors: string[] = [];
  const dataRef = parseDateFlexible(data.data || data.DATA || data.EMISSÃO);
  const valorRef = parseDecimalFlexible(data.valor || data.VALOR || data.TOTAL);

  const normalizedData: any = {
    numero_nota: normalizeText(data.numero_nota || data.NOTA || data.DOC),
    data_emissao: dataRef.value,
    valor_total: valorRef.value || 0,
    cliente_nome: normalizeText(data.cliente || data.CLIENTE || data.NOME),
  };

  if (!normalizedData.data_emissao) errors.push(dataRef.error || 'Data de emissão é obrigatória.');
  if (normalizedData.valor_total <= 0) errors.push('Valor total deve ser maior que zero.');

  return {
    valid: errors.length === 0,
    errors,
    normalizedData,
  };
}

/**
 * Validação para financeiro (contas a pagar/receber).
 */
export function validateFinanceiroImport(data: any): ImportValidationResult {
  const errors: string[] = [];
  const dataVenc = parseDateFlexible(data.data_vencimento || data.VENCIMENTO);
  const valorRef = parseDecimalFlexible(data.valor || data.VALOR);

  const normalizedData: any = {
    descricao: normalizeText(data.descricao || data.HISTORICO || data.HISTÓRICO),
    data_vencimento: dataVenc.value,
    valor: valorRef.value || 0,
    tipo: (normalizeText(data.tipo || data.PAGAR_RECEBER) || 'receber').toLowerCase(),
    status: (normalizeText(data.status || data.SITUACAO) || 'aberto').toLowerCase(),
  };

  if (!normalizedData.descricao) errors.push('Descrição é obrigatória.');
  if (!normalizedData.data_vencimento) errors.push(dataVenc.error || 'Data de vencimento é obrigatória.');
  if (normalizedData.valor <= 0) errors.push('Valor deve ser maior que zero.');

  return {
    valid: errors.length === 0,
    errors,
    normalizedData,
  };
}
