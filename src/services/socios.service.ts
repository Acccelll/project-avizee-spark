import { supabase } from "@/integrations/supabase/client";
import type {
  Socio,
  SocioParticipacao,
  SocioParametro,
  ApuracaoSocietaria,
  ApuracaoSocietariaItem,
  SocioRetirada,
} from "@/types/domain";

/* ───── Sócios ───── */
export async function listSocios(): Promise<Socio[]> {
  const { data, error } = await supabase.from("socios").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as Socio[];
}

export async function createSocio(payload: Partial<Socio>): Promise<Socio> {
  const { data, error } = await supabase.from("socios").insert(payload as never).select().single();
  if (error) throw error;
  return data as Socio;
}

export async function updateSocio(id: string, payload: Partial<Socio>): Promise<Socio> {
  const { data, error } = await supabase.from("socios").update(payload as never).eq("id", id).select().single();
  if (error) throw error;
  return data as Socio;
}

export async function removeSocio(id: string): Promise<void> {
  const { error } = await supabase.from("socios").delete().eq("id", id);
  if (error) throw error;
}

/* ───── Participações ───── */
export async function listSocioParticipacoes(socioId?: string): Promise<SocioParticipacao[]> {
  let q = supabase.from("socios_participacoes").select("*").order("vigencia_inicio", { ascending: false });
  if (socioId) q = q.eq("socio_id", socioId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SocioParticipacao[];
}

export async function createSocioParticipacao(payload: Partial<SocioParticipacao>): Promise<SocioParticipacao> {
  const { data, error } = await supabase.from("socios_participacoes").insert(payload as never).select().single();
  if (error) throw error;
  return data as SocioParticipacao;
}

export async function removeSocioParticipacao(id: string): Promise<void> {
  const { error } = await supabase.from("socios_participacoes").delete().eq("id", id);
  if (error) throw error;
}

/* ───── Parâmetros ───── */
export async function listSocioParametros(): Promise<SocioParametro[]> {
  const { data, error } = await supabase.from("socios_parametros").select("*").order("competencia", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SocioParametro[];
}

export async function upsertSocioParametro(payload: Partial<SocioParametro>): Promise<SocioParametro> {
  const { data, error } = await supabase.from("socios_parametros").upsert(payload as never, { onConflict: "competencia" }).select().single();
  if (error) throw error;
  return data as SocioParametro;
}

/* ───── Apurações ───── */
export async function listApuracoesSocietarias(): Promise<ApuracaoSocietaria[]> {
  const { data, error } = await supabase.from("apuracoes_societarias").select("*").order("competencia", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApuracaoSocietaria[];
}

export async function listApuracaoItens(apuracaoId: string): Promise<ApuracaoSocietariaItem[]> {
  const { data, error } = await supabase
    .from("apuracoes_societarias_itens")
    .select("*, socios(nome, cpf)")
    .eq("apuracao_id", apuracaoId);
  if (error) throw error;
  return (data ?? []) as ApuracaoSocietariaItem[];
}

export async function criarApuracaoSocietaria(competencia: string, lucroBase: number | null): Promise<string> {
  const { data, error } = await supabase.rpc("criar_apuracao_societaria", {
    p_competencia: competencia,
    p_lucro_base: lucroBase,
  });
  if (error) throw error;
  return data as string;
}

export async function recalcularApuracaoSocietaria(apuracaoId: string): Promise<void> {
  const { error } = await supabase.rpc("recalcular_apuracao_societaria", { p_apuracao_id: apuracaoId });
  if (error) throw error;
}

export async function fecharApuracaoSocietaria(apuracaoId: string): Promise<void> {
  const { error } = await supabase.rpc("fechar_apuracao_societaria", { p_apuracao_id: apuracaoId });
  if (error) throw error;
}

export async function reabrirApuracaoSocietaria(apuracaoId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("reabrir_apuracao_societaria", {
    p_apuracao_id: apuracaoId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function updateApuracaoBasic(id: string, payload: Partial<ApuracaoSocietaria>): Promise<ApuracaoSocietaria> {
  const { data, error } = await supabase.from("apuracoes_societarias").update(payload as never).eq("id", id).select().single();
  if (error) throw error;
  return data as ApuracaoSocietaria;
}

/* ───── Retiradas ───── */
export async function listSociosRetiradas(filtros?: {
  competencia?: string;
  socioId?: string;
  status?: string;
  tipo?: string;
}): Promise<SocioRetirada[]> {
  let q = supabase.from("socios_retiradas").select("*, socios(nome)").order("created_at", { ascending: false });
  if (filtros?.competencia) q = q.eq("competencia", filtros.competencia);
  if (filtros?.socioId) q = q.eq("socio_id", filtros.socioId);
  if (filtros?.status) q = q.eq("status", filtros.status);
  if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SocioRetirada[];
}

export async function createSocioRetirada(payload: Partial<SocioRetirada>): Promise<SocioRetirada> {
  const { data, error } = await supabase.from("socios_retiradas").insert(payload as never).select().single();
  if (error) throw error;
  return data as SocioRetirada;
}

export async function aprovarRetiradaSocio(id: string): Promise<void> {
  const { error } = await supabase.rpc("aprovar_retirada_socio", { p_retirada_id: id });
  if (error) throw error;
}

export async function gerarFinanceiroRetirada(params: {
  id: string;
  data_vencimento: string;
  conta_bancaria_id?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("gerar_financeiro_retirada", {
    p_retirada_id: params.id,
    p_data_vencimento: params.data_vencimento,
    p_conta_bancaria_id: params.conta_bancaria_id ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelarRetiradaSocio(id: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_retirada_socio", {
    p_retirada_id: id,
    p_motivo: motivo,
  });
  if (error) throw error;
}