import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type FonteFrete = 'correios' | 'cliente_vinculada' | 'manual';

/** Preset de caixa/embalagem persistido em app_configuracoes */
export interface CaixaEmbalagem {
  id: string;
  nome: string;
  altura_cm: number;
  largura_cm: number;
  comprimento_cm: number;
  peso_kg?: number | null;
}

const CAIXAS_CONFIG_KEY = 'frete:caixas_embalagem';

export async function listarCaixasEmbalagem(): Promise<CaixaEmbalagem[]> {
  const { data } = await supabase
    .from('app_configuracoes')
    .select('valor')
    .eq('chave', CAIXAS_CONFIG_KEY)
    .maybeSingle();
  if (!data?.valor) return [];
  return (data.valor as unknown as CaixaEmbalagem[]) || [];
}

export async function salvarCaixasEmbalagem(caixas: CaixaEmbalagem[]): Promise<void> {
  await supabase.from('app_configuracoes').upsert(
    { chave: CAIXAS_CONFIG_KEY, valor: caixas as unknown as import('@/integrations/supabase/types').Json, updated_at: new Date().toISOString() } as never,
    { onConflict: 'chave' }
  );
}

export interface ClienteTransportadoraComTransportadora {
  id: string;
  cliente_id: string;
  transportadora_id: string;
  modalidade: string | null;
  prazo_medio: string | null;
  prioridade: number | null;
  ativo: boolean;
  transportadoras: Pick<
    Tables<'transportadoras'>,
    'id' | 'nome_razao_social' | 'nome_fantasia' | 'modalidade' | 'prazo_medio'
  >;
}

export interface FreteOpcaoLocal {
  id?: string;
  simulacao_id?: string;
  transportadora_id?: string | null;
  fonte: FonteFrete;
  servico: string | null;
  codigo?: string | null;
  modalidade: string | null;
  prazo_dias: number | null;
  valor_frete: number;
  valor_adicional?: number | null;
  valor_total: number;
  selecionada: boolean;
  observacoes?: string | null;
  /** Dados brutos retornados pelos Correios ou outro payload */
  payload_raw?: Record<string, unknown> | null;
  /** Nome da transportadora — apenas para exibição, não persiste */
  transportadora_nome?: string | null;
}

export interface SimulacaoDimensoes {
  volumes: number;
  altura_cm: number;
  largura_cm: number;
  comprimento_cm: number;
}

export interface FreteSelecaoPayload {
  freteValor: number;
  freteTipo: string;
  prazoEntrega: string;
  modalidade: string | null;
  transportadoraId: string | null;
  origemFrete: FonteFrete;
  servicoFrete: string | null;
  prazoEntregaDias: number | null;
  freteSimulacaoId: string | null;
  volumes: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
}

type FreteSimulacaoRow = Tables<"frete_simulacoes">;

// ---------------------------------------------------------------
// getEmpresaCepOrigem
// ---------------------------------------------------------------

export async function getEmpresaCepOrigem(): Promise<string> {
  const { data } = await supabase
    .from('empresa_config')
    .select('cep')
    .limit(1)
    .maybeSingle();
  return (data?.cep || '').replace(/\D/g, '');
}

// ---------------------------------------------------------------
// getClienteTransportadoras
// ---------------------------------------------------------------

export async function getClienteTransportadoras(
  clienteId: string
): Promise<ClienteTransportadoraComTransportadora[]> {
  const { data, error } = await supabase
    .from('cliente_transportadoras')
    .select(
      `id, cliente_id, transportadora_id, modalidade, prazo_medio, prioridade, ativo,
       transportadoras(id, nome_razao_social, nome_fantasia, modalidade, prazo_medio)`
    )
    .eq('cliente_id', clienteId)
    .eq('ativo', true)
    .order('prioridade', { ascending: true });

  if (error) throw new Error(`Erro ao buscar transportadoras do cliente: ${error.message}`);
  return (data || []) as unknown as ClienteTransportadoraComTransportadora[];
}

// ---------------------------------------------------------------
// criarOuAtualizarSimulacao
// ---------------------------------------------------------------

export interface CriarSimulacaoPayload {
  origemTipo: 'orcamento' | 'pedido';
  origemId: string;
  clienteId?: string | null;
  cepOrigem: string;
  cepDestino: string;
  pesoTotal: number;
  valorMercadoria?: number;
  volumes?: number;
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;
}

export async function criarOuAtualizarSimulacao(
  payload: CriarSimulacaoPayload,
  simulacaoIdExistente?: string | null
): Promise<string> {
  const row = {
    origem_tipo: payload.origemTipo,
    origem_id: payload.origemId,
    cliente_id: payload.clienteId || null,
    cep_origem: payload.cepOrigem || null,
    cep_destino: payload.cepDestino || null,
    peso_total: payload.pesoTotal || null,
    valor_mercadoria: payload.valorMercadoria || null,
    volumes: payload.volumes ?? 1,
    altura_cm: payload.alturaCm ?? null,
    largura_cm: payload.larguraCm ?? null,
    comprimento_cm: payload.comprimentoCm ?? null,
    status: 'rascunho' as const,
  };

  if (simulacaoIdExistente) {
    const { error } = await supabase
      .from('frete_simulacoes')
      .update(row)
      .eq('id', simulacaoIdExistente);
    if (error) throw new Error(`Erro ao atualizar simulação de frete: ${error.message}`);
    return simulacaoIdExistente;
  }

  const { data, error } = await supabase
    .from('frete_simulacoes')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(`Erro ao criar simulação de frete: ${error.message}`);
  return data.id;
}

// ---------------------------------------------------------------
// carregarSimulacaoPorOrigem
// ---------------------------------------------------------------

export async function carregarSimulacaoPorOrigem(
  origemTipo: 'orcamento' | 'pedido',
  origemId: string
): Promise<(FreteSimulacaoRow & { opcoes: FreteOpcaoLocal[] }) | null> {
  const { data: sim, error } = await supabase
    .from('frete_simulacoes')
    .select('*')
    .eq('origem_tipo', origemTipo)
    .eq('origem_id', origemId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Erro ao carregar simulação de frete: ${error.message}`);
  if (!sim) return null;

  const { data: opcoes } = await supabase
    .from('frete_simulacoes_opcoes')
    .select('*')
    .eq('simulacao_id', sim.id)
    .order('created_at', { ascending: true });

  return { ...sim, opcoes: (opcoes || []) as unknown as FreteOpcaoLocal[] };
}

// ---------------------------------------------------------------
// consultarCorreios
// ---------------------------------------------------------------

export interface CorreiosPayload {
  cepOrigem: string;
  cepDestino: string;
  peso: number;
  comprimento?: number;
  altura?: number;
  largura?: number;
}

export interface FreteCorreiosOpcao {
  servico: string;
  codigo: string;
  valor: number;
  prazo: number;
  erro?: string;
}

export async function consultarCorreios(
  payload: CorreiosPayload
): Promise<FreteCorreiosOpcao[]> {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string || '').replace(/\/$/, '');
  const url = `${supabaseUrl}/functions/v1/correios-api?action=cotacao_multi`;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(errBody || `Erro ${res.status}`);
  }

  return res.json();
}

// ---------------------------------------------------------------
// salvarOpcoesCorreios
// ---------------------------------------------------------------

export async function salvarOpcoesCorreios(
  simulacaoId: string,
  opcoes: FreteCorreiosOpcao[]
): Promise<FreteOpcaoLocal[]> {
  // Remove opções Correios antigas não selecionadas da simulação
  const { error: deleteError } = await supabase
    .from('frete_simulacoes_opcoes')
    .delete()
    .eq('simulacao_id', simulacaoId)
    .eq('fonte', 'correios')
    .eq('selecionada', false);

  if (deleteError) {
    console.warn('[freteSimulacao] falha ao remover opções Correios antigas:', deleteError);
  }

  const rows = opcoes.map((o) => ({
    simulacao_id: simulacaoId,
    fonte: 'correios' as const,
    servico: o.servico,
    codigo: o.codigo,
    prazo_dias: o.prazo,
    valor_frete: o.valor,
    valor_adicional: 0,
    valor_total: o.valor,
    selecionada: false,
    payload_raw: o as unknown as import('@/integrations/supabase/types').Json,
  }));

  const { data, error } = await supabase
    .from('frete_simulacoes_opcoes')
    .insert(rows)
    .select();
  if (error) throw new Error(`Erro ao salvar opções de frete Correios: ${error.message}`);
  return (data || []) as unknown as FreteOpcaoLocal[];
}

// ---------------------------------------------------------------
// salvarOpcaoTransportadora
// ---------------------------------------------------------------

export interface OpcaoTransportadoraPayload {
  simulacaoId: string;
  transportadoraId: string;
  servico?: string | null;
  modalidade?: string | null;
  prazoDias?: number | null;
  valorFrete: number;
  observacoes?: string | null;
}

export async function salvarOpcaoTransportadora(
  payload: OpcaoTransportadoraPayload
): Promise<FreteOpcaoLocal> {
  const { data, error } = await supabase
    .from('frete_simulacoes_opcoes')
    .insert({
      simulacao_id: payload.simulacaoId,
      transportadora_id: payload.transportadoraId,
      fonte: 'cliente_vinculada',
      servico: payload.servico || null,
      modalidade: payload.modalidade || null,
      prazo_dias: payload.prazoDias || null,
      valor_frete: payload.valorFrete,
      valor_adicional: 0,
      valor_total: payload.valorFrete,
      selecionada: false,
      observacoes: payload.observacoes || null,
    })
    .select()
    .single();
  if (error) throw new Error(`Erro ao salvar opção de transportadora: ${error.message}`);
  return data as unknown as FreteOpcaoLocal;
}

// ---------------------------------------------------------------
// salvarOpcaoManual
// ---------------------------------------------------------------

export interface OpcaoManualPayload {
  simulacaoId: string;
  servico?: string | null;
  modalidade?: string | null;
  prazoDias?: number | null;
  valorFrete: number;
  observacoes?: string | null;
}

export async function salvarOpcaoManual(
  payload: OpcaoManualPayload
): Promise<FreteOpcaoLocal> {
  const { data, error } = await supabase
    .from('frete_simulacoes_opcoes')
    .insert({
      simulacao_id: payload.simulacaoId,
      fonte: 'manual',
      servico: payload.servico || null,
      modalidade: payload.modalidade || null,
      prazo_dias: payload.prazoDias || null,
      valor_frete: payload.valorFrete,
      valor_adicional: 0,
      valor_total: payload.valorFrete,
      selecionada: false,
      observacoes: payload.observacoes || null,
    })
    .select()
    .single();
  if (error) throw new Error(`Erro ao salvar opção manual de frete: ${error.message}`);
  return data as unknown as FreteOpcaoLocal;
}

// ---------------------------------------------------------------
// removerOpcao
// ---------------------------------------------------------------

export async function removerOpcao(opcaoId: string): Promise<void> {
  const { error } = await supabase
    .from('frete_simulacoes_opcoes')
    .delete()
    .eq('id', opcaoId)
    .eq('selecionada', false);
  if (error) throw new Error(`Erro ao remover opção de frete: ${error.message}`);
}

// ---------------------------------------------------------------
// selecionarOpcaoFrete
// ---------------------------------------------------------------

export async function selecionarOpcaoFrete(
  simulacaoId: string,
  opcaoId: string,
  orcamentoId: string,
  opcao: FreteOpcaoLocal,
  dimensoes: SimulacaoDimensoes
): Promise<void> {
  // 1. Desmarca todas as opções da simulação
  await supabase
    .from('frete_simulacoes_opcoes')
    .update({ selecionada: false })
    .eq('simulacao_id', simulacaoId);

  // 2. Marca a selecionada
  await supabase
    .from('frete_simulacoes_opcoes')
    .update({ selecionada: true })
    .eq('id', opcaoId);

  // 3. Atualiza simulação com opcao_escolhida_id
  await supabase
    .from('frete_simulacoes')
    .update({ opcao_escolhida_id: opcaoId, status: 'finalizada' })
    .eq('id', simulacaoId);

  // 4. Atualiza orçamento
  const freteTipo = buildFreteTipo(opcao);
  const prazoStr = opcao.prazo_dias ? `${opcao.prazo_dias} dias` : '';

  await supabase
    .from('orcamentos')
    .update({
      frete_valor: opcao.valor_total,
      frete_tipo: freteTipo,
      modalidade: opcao.modalidade || null,
      transportadora_id: opcao.transportadora_id || null,
      origem_frete: opcao.fonte,
      servico_frete: opcao.servico || null,
      prazo_entrega: prazoStr || null,
      prazo_entrega_dias: opcao.prazo_dias || null,
      frete_simulacao_id: simulacaoId,
      volumes: dimensoes.volumes,
      altura_cm: dimensoes.altura_cm,
      largura_cm: dimensoes.largura_cm,
      comprimento_cm: dimensoes.comprimento_cm,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq('id', orcamentoId);
}

// ---------------------------------------------------------------
// Utilitário: pré-sugerir dados de remessa a partir de pedido
// ---------------------------------------------------------------

/**
 * Busca os dados de frete de um pedido (ordens_venda) para pré-preencher
 * uma remessa. Retorna null se não houver dados relevantes.
 *
 * Uso: ao abrir formulário de nova remessa vinculado a um pedido,
 * chame esta função e aplique os campos sugeridos.
 */
export async function sugerirDadosRemessaDePedido(pedidoId: string): Promise<{
  transportadora_id: string | null;
  servico: string | null;
  valor_frete: number | null;
  peso: number | null;
  volumes: number | null;
  frete_simulacao_id: string | null;
} | null> {
  const { data, error } = await supabase
    .from('ordens_venda')
    .select(
      'transportadora_id, servico_frete, frete_valor, peso_total, volumes, frete_simulacao_id' as never
    )
    .eq('id', pedidoId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as Record<string, unknown>;
  if (!row.transportadora_id && !row.frete_valor) return null;

  return {
    transportadora_id: row.transportadora_id as string | null,
    servico: row.servico_frete as string | null,
    valor_frete: row.frete_valor as number | null,
    peso: row.peso_total as number | null,
    volumes: row.volumes as number | null,
    frete_simulacao_id: row.frete_simulacao_id as string | null,
  };
}

// ---------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------

function buildFreteTipo(opcao: FreteOpcaoLocal): string {
  if (opcao.fonte === 'correios') {
    return `CORREIOS (${opcao.servico || ''})`;
  }
  if (opcao.fonte === 'cliente_vinculada' && opcao.transportadora_nome) {
    return opcao.transportadora_nome;
  }
  return opcao.servico || 'MANUAL';
}
