import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError, notifyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import type { Socio, SocioParticipacao, SocioParametro, ApuracaoSocietaria, ApuracaoSocietariaItem, SocioRetirada } from "@/types/domain";
import * as svc from "@/services/socios.service";

const inv = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all(INVALIDATION_KEYS.socios.map((k) => qc.invalidateQueries({ queryKey: [k] })));

/* ───── Sócios ───── */
export function useSocios() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["socios"],
    queryFn: () => svc.listSocios(),
  });

  const create = useMutation({
    mutationFn: (payload: Partial<Socio>) => svc.createSocio(payload),
    onSuccess: async () => { await inv(qc); toast.success("Sócio cadastrado"); },
    onError: (e) => notifyError(e),
  });

  const update = useMutation({
    mutationFn: ({ id, ...payload }: Partial<Socio> & { id: string }) => svc.updateSocio(id, payload),
    onSuccess: async () => { await inv(qc); toast.success("Sócio atualizado"); },
    onError: (e) => notifyError(e),
  });

  const remove = useMutation({
    mutationFn: (id: string) => svc.removeSocio(id),
    onSuccess: async () => { await inv(qc); toast.success("Sócio excluído"); },
    onError: (e) => notifyError(e),
  });

  return { socios: query.data ?? [], loading: query.isLoading, refetch: query.refetch, create, update, remove };
}

/* ───── Participações ───── */
export function useSocioParticipacoes(socioId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["socios_participacoes", socioId ?? "all"],
    queryFn: () => svc.listSocioParticipacoes(socioId),
  });

  const create = useMutation({
    mutationFn: (payload: Partial<SocioParticipacao>) => svc.createSocioParticipacao(payload),
    onSuccess: async () => { await inv(qc); toast.success("Participação registrada"); },
    onError: (e) => notifyError(e),
  });

  const remove = useMutation({
    mutationFn: (id: string) => svc.removeSocioParticipacao(id),
    onSuccess: async () => { await inv(qc); toast.success("Participação removida"); },
    onError: (e) => notifyError(e),
  });

  return { participacoes: query.data ?? [], loading: query.isLoading, create, remove };
}

/* ───── Parâmetros (pró-labore por competência) ───── */
export function useSocioParametros() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["socios_parametros"],
    queryFn: () => svc.listSocioParametros(),
  });

  const upsert = useMutation({
    mutationFn: (payload: Partial<SocioParametro>) => svc.upsertSocioParametro(payload),
    onSuccess: async () => { await inv(qc); toast.success("Parâmetro salvo"); },
    onError: (e) => notifyError(e),
  });

  return { parametros: query.data ?? [], loading: query.isLoading, upsert };
}

/* ───── Apurações ───── */
export function useApuracoesSocietarias(competencia?: string) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["apuracoes_societarias"],
    queryFn: () => svc.listApuracoesSocietarias(),
  });

  const itens = useQuery({
    enabled: !!competencia,
    queryKey: ["apuracoes_societarias_itens", competencia],
    queryFn: async () => {
      if (!competencia) return [];
      const ap = list.data?.find((a) => a.competencia === competencia);
      if (!ap) return [];
      return svc.listApuracaoItens(ap.id);
    },
  });

  const criar = useMutation({
    mutationFn: (params: { competencia: string; lucro_base?: number | null }) =>
      svc.criarApuracaoSocietaria(params.competencia, params.lucro_base ?? null),
    onSuccess: async () => { await inv(qc); toast.success("Apuração criada"); },
    onError: (e) => notifyError(e),
  });

  const recalcular = useMutation({
    mutationFn: (apuracaoId: string) => svc.recalcularApuracaoSocietaria(apuracaoId),
    onSuccess: async () => { await inv(qc); toast.success("Apuração recalculada"); },
    onError: (e) => notifyError(e),
  });

  const fechar = useMutation({
    mutationFn: (apuracaoId: string) => svc.fecharApuracaoSocietaria(apuracaoId),
    onSuccess: async () => { await inv(qc); toast.success("Apuração fechada"); },
    onError: (e) => notifyError(e),
  });

  const reabrir = useMutation({
    mutationFn: (params: { id: string; motivo: string }) =>
      svc.reabrirApuracaoSocietaria(params.id, params.motivo),
    onSuccess: async () => { await inv(qc); toast.success("Apuração reaberta"); },
    onError: (e) => notifyError(e),
  });

  const updateBasic = useMutation({
    mutationFn: ({ id, ...payload }: Partial<ApuracaoSocietaria> & { id: string }) =>
      svc.updateApuracaoBasic(id, payload),
    onSuccess: async () => { await inv(qc); toast.success("Apuração atualizada"); },
    onError: (e) => notifyError(e),
  });

  return {
    apuracoes: list.data ?? [],
    loadingList: list.isLoading,
    itens: (itens.data ?? []) as ApuracaoSocietariaItem[],
    loadingItens: itens.isLoading,
    criar, recalcular, fechar, reabrir, updateBasic,
  };
}

/* ───── Retiradas ───── */
export function useSociosRetiradas(filtros?: { competencia?: string; socioId?: string; status?: string; tipo?: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["socios_retiradas", filtros],
    queryFn: () => svc.listSociosRetiradas(filtros),
  });

  const create = useMutation({
    mutationFn: (payload: Partial<SocioRetirada>) => svc.createSocioRetirada(payload),
    onSuccess: async () => { await inv(qc); toast.success("Retirada registrada"); },
    onError: (e) => notifyError(e),
  });

  const aprovar = useMutation({
    mutationFn: (id: string) => svc.aprovarRetiradaSocio(id),
    onSuccess: async () => { await inv(qc); toast.success("Retirada aprovada"); },
    onError: (e) => notifyError(e),
  });

  const gerarFinanceiro = useMutation({
    mutationFn: (params: { id: string; data_vencimento: string; conta_bancaria_id?: string | null }) =>
      svc.gerarFinanceiroRetirada(params),
    onSuccess: async () => { await inv(qc); toast.success("Lançamento financeiro gerado"); },
    onError: (e) => notifyError(e),
  });

  const cancelar = useMutation({
    mutationFn: (params: { id: string; motivo: string }) =>
      svc.cancelarRetiradaSocio(params.id, params.motivo),
    onSuccess: async () => { await inv(qc); toast.success("Retirada cancelada"); },
    onError: (e) => notifyError(e),
  });

  return { retiradas: query.data ?? [], loading: query.isLoading, create, aprovar, gerarFinanceiro, cancelar };
}