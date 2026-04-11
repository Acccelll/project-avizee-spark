import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import { hashParametros } from './utils';
import {
  fillRAWFinanceiro,
  fillRAWCaixa,
  fillRAWAgingCR,
  fillRAWAgingCP,
  fillRAWEstoque,
  fillRAWFopag,
  fillRAWBancos,
  fillRAWParametros,
} from './fillRawSheets';
import type { WorkbookParametros } from '@/types/workbook';

export interface GenerateWorkbookOptions {
  parametros: WorkbookParametros;
  geracaoId: string;
}

export async function generateWorkbook(options: GenerateWorkbookOptions): Promise<Blob> {
  const { parametros, geracaoId } = options;
  const { competenciaInicial, competenciaFinal } = parametros;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ERP AviZee';
  workbook.created = new Date();

  // Financeiro - lançamentos in period
  const { data: lancamentosData } = await supabase
    .from('financeiro_lancamentos')
    .select('id, tipo, data_vencimento, valor, valor_pago, saldo_restante, status, conta_contabil_id, contas_contabeis(descricao)')
    .gte('data_vencimento', competenciaInicial)
    .lte('data_vencimento', competenciaFinal)
    .eq('ativo', true);

  const financeiroRows = (lancamentosData ?? []).map((r: Record<string, unknown>) => ({
    tipo: String(r.tipo ?? ''),
    competencia: String(r.data_vencimento ?? '').slice(0, 7),
    data_vencimento: String(r.data_vencimento ?? ''),
    valor: Number(r.valor ?? 0),
    valor_pago: Number(r.valor_pago ?? 0),
    saldo_restante: Number(r.saldo_restante ?? 0),
    status: String(r.status ?? ''),
    conta_contabil_id: r.conta_contabil_id ? String(r.conta_contabil_id) : null,
    conta_descricao: (r.contas_contabeis as Record<string, unknown>)?.descricao
      ? String((r.contas_contabeis as Record<string, unknown>).descricao)
      : 'Sem Classificação',
  }));

  // Caixa movimentos
  const { data: caixaData } = await supabase
    .from('caixa_movimentos')
    .select('id, tipo, valor, conta_bancaria_id, contas_bancarias(descricao), created_at')
    .gte('created_at', competenciaInicial)
    .lte('created_at', competenciaFinal + 'T23:59:59');

  const caixaRows = (caixaData ?? []).map((r: Record<string, unknown>) => ({
    competencia: String(r.created_at ?? '').slice(0, 7),
    conta_bancaria_id: r.conta_bancaria_id ? String(r.conta_bancaria_id) : null,
    conta_descricao: (r.contas_bancarias as Record<string, unknown>)?.descricao
      ? String((r.contas_bancarias as Record<string, unknown>).descricao)
      : 'Caixa Geral',
    tipo: String(r.tipo ?? ''),
    total_valor: Number(r.valor ?? 0),
    qtd_movimentos: 1,
  }));

  // Aging CR
  const { data: agingCRData } = await supabase
    .from('financeiro_lancamentos')
    .select('id, data_vencimento, valor, valor_pago, saldo_restante, status, cliente_id')
    .eq('tipo', 'receber')
    .eq('ativo', true)
    .neq('status', 'pago');

  const agingCRRows = (agingCRData ?? []).map((r: Record<string, unknown>) => {
    const hoje = new Date();
    const venc = new Date(String(r.data_vencimento ?? ''));
    const diffDays = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
    let faixa = 'a_vencer';
    if (diffDays > 0 && diffDays <= 30) faixa = '1_30';
    else if (diffDays > 30 && diffDays <= 60) faixa = '31_60';
    else if (diffDays > 60 && diffDays <= 90) faixa = '61_90';
    else if (diffDays > 90) faixa = 'acima_90';
    return {
      id: String(r.id ?? ''),
      data_vencimento: String(r.data_vencimento ?? ''),
      valor: Number(r.valor ?? 0),
      valor_pago: Number(r.valor_pago ?? 0),
      saldo_aberto: Number(r.saldo_restante ?? r.valor ?? 0) - Number(r.valor_pago ?? 0),
      status: String(r.status ?? ''),
      parceiro_id: r.cliente_id ? String(r.cliente_id) : null,
      faixa_aging: faixa,
    };
  });

  // Aging CP
  const { data: agingCPData } = await supabase
    .from('financeiro_lancamentos')
    .select('id, data_vencimento, valor, valor_pago, saldo_restante, status, fornecedor_id')
    .eq('tipo', 'pagar')
    .eq('ativo', true)
    .neq('status', 'pago');

  const agingCPRows = (agingCPData ?? []).map((r: Record<string, unknown>) => {
    const hoje = new Date();
    const venc = new Date(String(r.data_vencimento ?? ''));
    const diffDays = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
    let faixa = 'a_vencer';
    if (diffDays > 0 && diffDays <= 30) faixa = '1_30';
    else if (diffDays > 30 && diffDays <= 60) faixa = '31_60';
    else if (diffDays > 60 && diffDays <= 90) faixa = '61_90';
    else if (diffDays > 90) faixa = 'acima_90';
    return {
      id: String(r.id ?? ''),
      data_vencimento: String(r.data_vencimento ?? ''),
      valor: Number(r.valor ?? 0),
      valor_pago: Number(r.valor_pago ?? 0),
      saldo_aberto: Number(r.saldo_restante ?? r.valor ?? 0) - Number(r.valor_pago ?? 0),
      status: String(r.status ?? ''),
      parceiro_id: r.fornecedor_id ? String(r.fornecedor_id) : null,
      faixa_aging: faixa,
    };
  });

  // Estoque
  const { data: estoqueData } = await supabase
    .from('produtos')
    .select('id, nome, sku, estoque_atual, preco_custo, grupo_id, grupos_produto(descricao)')
    .eq('ativo', true);

  const estoqueRows = (estoqueData ?? []).map((r: Record<string, unknown>) => ({
    produto_id: String(r.id ?? ''),
    nome: String(r.nome ?? ''),
    sku: r.sku ? String(r.sku) : null,
    quantidade: Number(r.estoque_atual ?? 0),
    custo_unitario: Number(r.preco_custo ?? 0),
    valor_total: Number(r.estoque_atual ?? 0) * Number(r.preco_custo ?? 0),
    grupo_id: r.grupo_id ? String(r.grupo_id) : null,
    grupo_descricao: (r.grupos_produto as Record<string, unknown>)?.descricao
      ? String((r.grupos_produto as Record<string, unknown>).descricao)
      : null,
  }));

  // FOPAG
  const { data: fopagData } = await supabase
    .from('folha_pagamento')
    .select('id, competencia, funcionario_id, salario_base, proventos, descontos, valor_liquido, status, funcionarios(nome, cargo, departamento)')
    .gte('competencia', competenciaInicial.slice(0, 7))
    .lte('competencia', competenciaFinal.slice(0, 7));

  const fopagRows = (fopagData ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    competencia: String(r.competencia ?? ''),
    funcionario_id: r.funcionario_id ? String(r.funcionario_id) : null,
    funcionario_nome: (r.funcionarios as Record<string, unknown>)?.nome
      ? String((r.funcionarios as Record<string, unknown>).nome)
      : null,
    cargo: (r.funcionarios as Record<string, unknown>)?.cargo
      ? String((r.funcionarios as Record<string, unknown>).cargo)
      : null,
    departamento: (r.funcionarios as Record<string, unknown>)?.departamento
      ? String((r.funcionarios as Record<string, unknown>).departamento)
      : null,
    salario_base: Number(r.salario_base ?? 0),
    proventos: Number(r.proventos ?? 0),
    descontos: Number(r.descontos ?? 0),
    valor_liquido: Number(r.valor_liquido ?? 0),
    status: r.status ? String(r.status) : null,
  }));

  // Bancos
  const { data: bancosData } = await supabase
    .from('contas_bancarias')
    .select('id, descricao, agencia, conta, saldo_atual, bancos(nome)')
    .eq('ativo', true);

  const bancosRows = (bancosData ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    descricao: String(r.descricao ?? ''),
    agencia: r.agencia ? String(r.agencia) : null,
    conta: r.conta ? String(r.conta) : null,
    saldo_atual: Number(r.saldo_atual ?? 0),
    banco_nome: (r.bancos as Record<string, unknown>)?.nome
      ? String((r.bancos as Record<string, unknown>).nome)
      : null,
  }));

  // Parâmetros
  const parametrosRows = [
    { chave: 'competencia_inicial', valor: competenciaInicial },
    { chave: 'competencia_final', valor: competenciaFinal },
    { chave: 'modo_geracao', valor: parametros.modoGeracao },
    { chave: 'gerado_em', valor: new Date().toISOString() },
    { chave: 'geracao_id', valor: geracaoId },
    { chave: 'hash', valor: hashParametros({ ...parametros }) },
  ];

  // Fill sheets
  fillRAWFinanceiro(workbook, financeiroRows);
  fillRAWCaixa(workbook, caixaRows);
  fillRAWAgingCR(workbook, agingCRRows);
  fillRAWAgingCP(workbook, agingCPRows);
  fillRAWEstoque(workbook, estoqueRows);
  fillRAWFopag(workbook, fopagRows);
  fillRAWBancos(workbook, bancosRows);
  fillRAWParametros(workbook, parametrosRows);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
