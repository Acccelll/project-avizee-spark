import { useEffect } from "react";
import type { UseFormReset, UseFormGetValues, UseFormSetValue } from "react-hook-form";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import type { ProductWithForn } from "@/components/ui/DataSelector";
import {
  getOrcamentoById,
  listOrcamentoItens,
  listClientesAtivosOrcamento,
  listProdutosAtivosComFornecedores,
} from "@/services/orcamentos.service";
import { peekProximoNumeroOrcamento } from "@/types/rpc";
import { getUserFriendlyError, notifyError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import type { ClienteSnapshot } from "./types";

interface LoadArgs {
  id: string | undefined;
  isEdit: boolean;
  queryClient: QueryClient;
  produtos: ProductWithForn[];
  reset: UseFormReset<OrcamentoFormValues>;
  getValues: UseFormGetValues<OrcamentoFormValues>;
  setValue: UseFormSetValue<OrcamentoFormValues>;
  setClienteSnapshot: (snap: ClienteSnapshot) => void;
  setItems: (items: OrcamentoItem[]) => void;
  setPesoTotalOverride: (v: number | null) => void;
  setFreteSimulacaoId: (v: string | null) => void;
  setFreteTransportadoraId: (v: string | null) => void;
  setFreteOrigemFrete: (v: string | null) => void;
  setFreteServico: (v: string | null) => void;
  setFretePrazoEntregaDias: (v: number | null) => void;
  setFreteVolumes: (v: number) => void;
  setFreteAlturaCm: (v: number) => void;
  setFreteLarguraCm: (v: number) => void;
  setFreteComprimentoCm: (v: number) => void;
}

/**
 * Carga inicial do form:
 *  - garante caches de clientes/produtos prontos;
 *  - em edição: hidrata form, snapshot, itens (com fallback de variação) e frete;
 *  - em criação: faz peek do próximo número (número definitivo vem no save).
 * Reset/setValue são estáveis em RHF — exhaustive-deps suprimido.
 */
export function useOrcamentoLoad(args: LoadArgs) {
  const {
    id, isEdit, queryClient, produtos,
    reset, getValues, setValue,
    setClienteSnapshot, setItems, setPesoTotalOverride,
    setFreteSimulacaoId, setFreteTransportadoraId, setFreteOrigemFrete,
    setFreteServico, setFretePrazoEntregaDias, setFreteVolumes,
    setFreteAlturaCm, setFreteLarguraCm, setFreteComprimentoCm,
  } = args;

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          queryClient.ensureQueryData({
            queryKey: ["orcamento-form", "clientes-ativos"],
            queryFn: () => listClientesAtivosOrcamento(),
          }),
          queryClient.ensureQueryData({
            queryKey: ["orcamento-form", "produtos-ativos"],
            queryFn: () => listProdutosAtivosComFornecedores(),
          }),
        ]);

        if (isEdit) {
          const orc = await getOrcamentoById(id!).catch((orcError) => {
            logger.error("[OrcamentoForm] erro ao carregar orçamento:", orcError);
            toast.error("Erro ao carregar orçamento.", { description: getUserFriendlyError(orcError) });
            return null;
          });
          if (orc) {
            reset({
              numero: orc.numero || getValues("numero") || "",
              dataOrcamento: orc.data_orcamento,
              status: (orc.status === "confirmado" ? "pendente" : orc.status) as OrcamentoFormValues["status"],
              clienteId: orc.cliente_id || "",
              observacoes: orc.observacoes || "",
              observacoesInternas: orc.observacoes_internas || "",
              validade: orc.validade || "",
              desconto: orc.desconto || 0,
              impostoSt: orc.imposto_st || 0,
              impostoIpi: orc.imposto_ipi || 0,
              freteValor: orc.frete_valor || 0,
              outrasDespesas: orc.outras_despesas || 0,
              pagamento: orc.pagamento || "",
              prazoPagamento: orc.prazo_pagamento || "",
              prazoEntrega: orc.prazo_entrega || "",
              freteTipo: (orc.frete_tipo && ["CIF", "FOB", "sem_frete"].includes(orc.frete_tipo)) ? orc.frete_tipo : "",
              servicoFrete: orc.servico_frete || "",
              modalidade: orc.modalidade || "",
            });
            if (orc.cliente_snapshot) setClienteSnapshot(orc.cliente_snapshot as unknown as ClienteSnapshot);
            if (orc.frete_simulacao_id) setFreteSimulacaoId(orc.frete_simulacao_id);
            if (orc.transportadora_id) setFreteTransportadoraId(orc.transportadora_id);
            if (orc.origem_frete) setFreteOrigemFrete(orc.origem_frete);
            if (orc.servico_frete) setFreteServico(orc.servico_frete);
            if (orc.prazo_entrega_dias != null) setFretePrazoEntregaDias(orc.prazo_entrega_dias);
            if (orc.volumes != null) setFreteVolumes(orc.volumes);
            if (orc.altura_cm != null) setFreteAlturaCm(orc.altura_cm);
            if (orc.largura_cm != null) setFreteLarguraCm(orc.largura_cm);
            if (orc.comprimento_cm != null) setFreteComprimentoCm(orc.comprimento_cm);
            const itensData = await listOrcamentoItens(id!);
            if (itensData) {
              const produtosMap = new Map(produtos.map((p) => [p.id, p]));
              const hidratado = itensData.map((it) => {
                const variacaoSnapshot = (it as { variacao?: string | null }).variacao;
                if (variacaoSnapshot && String(variacaoSnapshot).trim()) return it;
                const prod = produtosMap.get(it.produto_id);
                const raw = prod ? (prod as { variacoes?: unknown }).variacoes : null;
                const fallback = Array.isArray(raw)
                  ? (raw as string[]).join(", ")
                  : typeof raw === "string"
                    ? raw
                    : "";
                return fallback ? { ...it, variacao: fallback } : it;
              });
              setItems(hidratado);
              const pesoCalc = hidratado.reduce(
                (s: number, it) => s + (Number((it as { peso_total?: number }).peso_total) || 0),
                0,
              );
              const pesoSalvo = Number((orc as { peso_total?: number | null }).peso_total ?? 0);
              if (Math.abs(pesoSalvo - pesoCalc) >= 0.01) {
                setPesoTotalOverride(pesoSalvo);
              }
            }
          } else if (orc !== null) {
            toast.error("Orçamento não encontrado.", { description: `Nenhum orçamento com ID ${id}.` });
          }
        } else {
          try {
            const novoNumero = await peekProximoNumeroOrcamento();
            if (!novoNumero) {
              toast.error("Não foi possível gerar o número do orçamento. Tente novamente.");
              return;
            }
            setValue("numero", novoNumero);
          } catch (numErr) {
            logger.error("[OrcamentoForm] peek_proximo_numero_orcamento falhou:", numErr);
            toast.error("Não foi possível gerar o número do orçamento. Tente novamente.");
            return;
          }
        }
      } catch (err: unknown) {
        logger.error("[OrcamentoForm] erro ao carregar dados:", err);
        notifyError(err);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset/setValue são estáveis (RHF)
  }, [id, isEdit]);
}