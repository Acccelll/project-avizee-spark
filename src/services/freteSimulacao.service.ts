import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type FreteSimulacao = Database["public"]["Tables"]["frete_simulacoes"]["Row"];
export type FreteSimulacaoOpcao = Database["public"]["Tables"]["frete_simulacoes_opcoes"]["Row"];

type FreteFonte = "correios" | "cliente_vinculada" | "manual";
type OrigemTipo = "orcamento" | "pedido";

export interface ClienteTransportadoraPreferencial {
  id: string;
  prioridade: number | null;
  modalidade: string | null;
  prazo_medio: string | null;
  transportadora_id: string;
  transportadora_nome: string;
}

export interface SimulacaoPayload {
  origem_tipo: OrigemTipo;
  origem_id: string;
  cliente_id?: string | null;
  cep_origem?: string | null;
  cep_destino?: string | null;
  peso_total?: number | null;
  volumes?: number | null;
  altura_cm?: number | null;
  largura_cm?: number | null;
  comprimento_cm?: number | null;
  valor_mercadoria?: number | null;
  status?: string;
}

export interface OpcaoPayload {
  id?: string;
  transportadora_id?: string | null;
  fonte: FreteFonte;
  servico?: string | null;
  codigo?: string | null;
  modalidade?: string | null;
  prazo_dias?: number | null;
  valor_frete: number;
  valor_adicional?: number | null;
  valor_total?: number;
  payload_raw?: Json | null;
  observacoes?: string | null;
}

interface CorreiosOption {
  servico: string;
  codigo: string;
  valor: number;
  prazo: number;
  erro?: string;
}

export async function getEmpresaCepOrigem(): Promise<string> {
  const { data, error } = await supabase.from("empresa_config").select("cep").maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.cep || "").replace(/\D/g, "");
}

export async function getClienteTransportadoras(clienteId: string): Promise<ClienteTransportadoraPreferencial[]> {
  if (!clienteId) return [];

  const { data, error } = await supabase
    .from("cliente_transportadoras")
    .select("id, prioridade, modalidade, prazo_medio, transportadora_id, transportadoras(nome_fantasia, nome_razao_social)")
    .eq("cliente_id", clienteId)
    .eq("ativo", true)
    .order("prioridade", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const transportadora = Array.isArray(row.transportadoras) ? row.transportadoras[0] : row.transportadoras;
    return {
      id: row.id,
      prioridade: row.prioridade,
      modalidade: row.modalidade,
      prazo_medio: row.prazo_medio,
      transportadora_id: row.transportadora_id,
      transportadora_nome: transportadora?.nome_fantasia || transportadora?.nome_razao_social || "Transportadora",
    };
  });
}

export async function criarOuAtualizarSimulacao(payload: SimulacaoPayload): Promise<FreteSimulacao> {
  const existing = await carregarSimulacaoPorOrigem(payload.origem_tipo, payload.origem_id);

  if (existing) {
    const { data, error } = await supabase
      .from("frete_simulacoes")
      .update({ ...payload, status: payload.status || existing.status })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase.from("frete_simulacoes").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function consultarCorreios(payload: {
  cepOrigem: string;
  cepDestino: string;
  peso: number;
  comprimento: number;
  altura: number;
  largura: number;
}): Promise<CorreiosOption[]> {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string || "").replace(/\/$/, "");
  const url = `${supabaseUrl}/functions/v1/correios-api?action=cotacao_multi`;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Erro ${res.status}`);
  }

  return (await res.json()) as CorreiosOption[];
}

export async function salvarOpcoesSimulacao(simulacaoId: string, opcoes: OpcaoPayload[]): Promise<FreteSimulacaoOpcao[]> {
  if (!opcoes.length) return [];

  const payload = opcoes.map((opcao) => ({
    simulacao_id: simulacaoId,
    transportadora_id: opcao.transportadora_id || null,
    fonte: opcao.fonte,
    servico: opcao.servico || null,
    codigo: opcao.codigo || null,
    modalidade: opcao.modalidade || null,
    prazo_dias: opcao.prazo_dias ?? null,
    valor_frete: opcao.valor_frete,
    valor_adicional: opcao.valor_adicional ?? 0,
    valor_total: opcao.valor_total ?? opcao.valor_frete + (opcao.valor_adicional ?? 0),
    payload_raw: opcao.payload_raw ?? null,
    observacoes: opcao.observacoes ?? null,
  }));

  const { data, error } = await supabase.from("frete_simulacoes_opcoes").insert(payload).select();
  if (error) throw new Error(error.message);
  return data || [];
}

export async function carregarSimulacaoPorOrigem(origemTipo: OrigemTipo, origemId: string): Promise<FreteSimulacao | null> {
  const { data, error } = await supabase
    .from("frete_simulacoes")
    .select("*")
    .eq("origem_tipo", origemTipo)
    .eq("origem_id", origemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function carregarOpcoesSimulacao(simulacaoId: string): Promise<FreteSimulacaoOpcao[]> {
  const { data, error } = await supabase
    .from("frete_simulacoes_opcoes")
    .select("*")
    .eq("simulacao_id", simulacaoId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function selecionarOpcaoFrete(simulacaoId: string, opcaoId: string, orcamentoId: string, dimensoes?: {
  volumes?: number;
  altura_cm?: number | null;
  largura_cm?: number | null;
  comprimento_cm?: number | null;
}): Promise<void> {
  const { error: clearError } = await supabase
    .from("frete_simulacoes_opcoes")
    .update({ selecionada: false })
    .eq("simulacao_id", simulacaoId);

  if (clearError) throw new Error(clearError.message);

  const { data: opcao, error: optError } = await supabase
    .from("frete_simulacoes_opcoes")
    .update({ selecionada: true })
    .eq("id", opcaoId)
    .select()
    .single();

  if (optError) throw new Error(optError.message);

  const { error: simError } = await supabase
    .from("frete_simulacoes")
    .update({ opcao_escolhida_id: opcaoId, status: "fechado" })
    .eq("id", simulacaoId);

  if (simError) throw new Error(simError.message);

  const freteTipo = opcao.fonte === "correios" ? `CORREIOS (${opcao.servico || "Serviço"})` : (opcao.servico || "FRETE");

  const { error: orcError } = await supabase
    .from("orcamentos")
    .update({
      frete_valor: opcao.valor_total,
      frete_tipo: freteTipo,
      modalidade: opcao.modalidade,
      transportadora_id: opcao.transportadora_id,
      origem_frete: opcao.fonte,
      servico_frete: opcao.servico,
      prazo_entrega_dias: opcao.prazo_dias,
      frete_simulacao_id: simulacaoId,
      volumes: dimensoes?.volumes ?? 1,
      altura_cm: dimensoes?.altura_cm ?? null,
      largura_cm: dimensoes?.largura_cm ?? null,
      comprimento_cm: dimensoes?.comprimento_cm ?? null,
    })
    .eq("id", orcamentoId);

  if (orcError) throw new Error(orcError.message);
}

export async function prepararFreteRemessaPorPedido(ordemVendaId: string) {
  const { data, error } = await supabase
    .from("ordens_venda")
    .select("transportadora_id, servico_frete, frete_valor, peso_total, volumes, frete_simulacao_id")
    .eq("id", ordemVendaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    transportadora_id: data.transportadora_id,
    servico: data.servico_frete,
    valor_frete: data.frete_valor,
    peso: data.peso_total,
    volumes: data.volumes,
    frete_simulacao_id: data.frete_simulacao_id,
  };
}
