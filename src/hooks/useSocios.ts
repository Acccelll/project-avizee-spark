import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import type { Socio, SocioParticipacao, SocioParametro, ApuracaoSocietaria, ApuracaoSocietariaItem, SocioRetirada } from "@/types/domain";

const inv = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all(INVALIDATION_KEYS.socios.map((k) => qc.invalidateQueries({ queryKey: [k] })));

/* ───── Sócios ───── */
export function useSocios() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["socios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("socios").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Socio[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<Socio>) => {
      const { data, error } = await supabase.from("socios").insert(payload as never).select().single();
      if (error) throw error;
      return data as Socio;
    },
    onSuccess: async () => { await inv(qc); toast.success("Sócio cadastrado"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Socio> & { id: string }) => {
      const { data, error } = await supabase.from("socios").update(payload as never).eq("id", id).select().single();
      if (error) throw error;
      return data as Socio;
    },
    onSuccess: async () => { await inv(qc); toast.success("Sócio atualizado"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("socios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { await inv(qc); toast.success("Sócio excluído"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  return { socios: query.data ?? [], loading: query.isLoading, refetch: query.refetch, create, update, remove };
}

/* ───── Participações ───── */
export function useSocioParticipacoes(socioId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["socios_participacoes", socioId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("socios_participacoes").select("*").order("vigencia_inicio", { ascending: false });
      if (socioId) q = q.eq("socio_id", socioId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SocioParticipacao[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<SocioParticipacao>) => {
      const { data, error } = await supabase.from("socios_participacoes").insert(payload as never).select().single();
      if (error) throw error;
      return data as SocioParticipacao;
    },
    onSuccess: async () => { await inv(qc); toast.success("Participação registrada"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("socios_participacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { await inv(qc); toast.success("Participação removida"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  return { participacoes: query.data ?? [], loading: query.isLoading, create, remove };
}

/* ───── Parâmetros (pró-labore por competência) ───── */
export function useSocioParametros() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["socios_parametros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("socios_parametros").select("*").order("competencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SocioParametro[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<SocioParametro>) => {
      const { data, error } = await supabase.from("socios_parametros").upsert(payload as never, { onConflict: "competencia" }).select().single();
      if (error) throw error;
      return data as SocioParametro;
    },
    onSuccess: async () => { await inv(qc); toast.success("Parâmetro salvo"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  return { parametros: query.data ?? [], loading: query.isLoading, upsert };
}

/* ───── Apurações ───── */
export function useApuracoesSocietarias(competencia?: string) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["apuracoes_societarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apuracoes_societarias").select("*").order("competencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApuracaoSocietaria[];
    },
  });

  const itens = useQuery({
    enabled: !!competencia,
    queryKey: ["apuracoes_societarias_itens", competencia],
    queryFn: async () => {
      if (!competencia) return [];
      const ap = list.data?.find((a) => a.competencia === competencia);
      if (!ap) return [];
      const { data, error } = await supabase
        .from("apuracoes_societarias_itens")
        .select("*, socios(nome, cpf)")
        .eq("apuracao_id", ap.id);
      if (error) throw error;
      return (data ?? []) as ApuracaoSocietariaItem[];
    },
  });

  const criar = useMutation({
    mutationFn: async (params: { competencia: string; lucro_base?: number | null }) => {
      const { data, error } = await supabase.rpc("criar_apuracao_societaria", {
        p_competencia: params.competencia,
        p_lucro_base: params.lucro_base ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => { await inv(qc); toast.success("Apuração criada"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const recalcular = useMutation({
    mutationFn: async (apuracaoId: string) => {
      const { error } = await supabase.rpc("recalcular_apuracao_societaria", { p_apuracao_id: apuracaoId });
      if (error) throw error;
    },
    onSuccess: async () => { await inv(qc); toast.success("Apuração recalculada"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const fechar = useMutation({
    mutationFn: async (apuracaoId: string) => {
      const { error } = await supabase.rpc("fechar_apuracao_societaria", { p_apuracao_id: apuracaoId });
      if (error) throw error;
    },
    onSuccess: async () => { await inv(qc); toast.success("Apuração fechada"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const reabrir = useMutation({
    mutationFn: async (params: { id: string; motivo: string }) => {
      const { error } = await supabase.rpc("reabrir_apuracao_societaria", {
        p_apuracao_id: params.id,
        p_motivo: params.motivo,
      });
      if (error) throw error;
    },
    onSuccess: async () => { await inv(qc); toast.success("Apuração reaberta"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const updateBasic = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ApuracaoSocietaria> & { id: string }) => {
      const { data, error } = await supabase.from("apuracoes_societarias").update(payload as never).eq("id", id).select().single();
      if (error) throw error;
      return data as ApuracaoSocietaria;
    },
    onSuccess: async () => { await inv(qc); toast.success("Apuração atualizada"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  return {
    apuracoes: list.data ?? [],
    loadingList: list.isLoading,
    itens: itens.data ?? [],
    loadingItens: itens.isLoading,
    criar, recalcular, fechar, reabrir, updateBasic,
  };
}

/* ───── Retiradas ───── */
export function useSociosRetiradas(filtros?: { competencia?: string; socioId?: string; status?: string; tipo?: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["socios_retiradas", filtros],
    queryFn: async () => {
      let q = supabase.from("socios_retiradas").select("*, socios(nome)").order("created_at", { ascending: false });
      if (filtros?.competencia) q = q.eq("competencia", filtros.competencia);
      if (filtros?.socioId) q = q.eq("socio_id", filtros.socioId);
      if (filtros?.status) q = q.eq("status", filtros.status);
      if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SocioRetirada[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<SocioRetirada>) => {
      const { data, error } = await supabase.from("socios_retiradas").insert(payload as never).select().single();
      if (error) throw error;
      return data as SocioRetirada;
    },
    onSuccess: async () => { await inv(qc); toast.success("Retirada registrada"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("aprovar_retirada_socio", { p_retirada_id: id });
      if (error) throw error;
    },
    onSuccess: async () => { await inv(qc); toast.success("Retirada aprovada"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const gerarFinanceiro = useMutation({
    mutationFn: async (params: { id: string; data_vencimento: string; conta_bancaria_id?: string | null }) => {
      const { data, error } = await supabase.rpc("gerar_financeiro_retirada", {
        p_retirada_id: params.id,
        p_data_vencimento: params.data_vencimento,
        p_conta_bancaria_id: params.conta_bancaria_id ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => { await inv(qc); toast.success("Lançamento financeiro gerado"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const cancelar = useMutation({
    mutationFn: async (params: { id: string; motivo: string }) => {
      const { error } = await supabase.rpc("cancelar_retirada_socio", {
        p_retirada_id: params.id,
        p_motivo: params.motivo,
      });
      if (error) throw error;
    },
    onSuccess: async () => { await inv(qc); toast.success("Retirada cancelada"); },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  return { retiradas: query.data ?? [], loading: query.isLoading, create, aprovar, gerarFinanceiro, cancelar };
}