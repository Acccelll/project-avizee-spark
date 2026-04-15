import { useCallback, useState } from "react";
import { toast } from "sonner";
import { exportarParaExcel, exportarParaPdf } from "@/services/export.service";
import { processarEstorno } from "@/services/financeiro.service";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento } from "@/types/domain";
import type { LancamentoForm } from "@/pages/financeiro/types";

interface Params {
  filteredData: Lancamento[];
  getLancamentoStatus: (l: Lancamento) => string;
  create: (payload: any) => Promise<any>;
  update: (id: string, payload: any) => Promise<any>;
  fetchData: () => Promise<void>;
}

export function useFinanceiroActions({ filteredData, getLancamentoStatus, create, update, fetchData }: Params) {
  const [saving, setSaving] = useState(false);
  const [estornoTarget, setEstornoTarget] = useState<Lancamento | null>(null);
  const [estornoProcessing, setEstornoProcessing] = useState(false);
  const [estornoMotivo, setEstornoMotivo] = useState("");

  const handleSubmit = useCallback(
    async (mode: "create" | "edit", form: LancamentoForm, selected: Lancamento | null, onSuccess: () => void) => {
      if (!form.descricao || !form.valor) {
        toast.error("Descrição e valor são obrigatórios");
        return;
      }
      if (!form.data_vencimento) {
        toast.error("Data de vencimento é obrigatória");
        return;
      }
      if (form.status === "pago") {
        if (!form.data_pagamento) {
          toast.error("Data de pagamento é obrigatória para status Pago");
          return;
        }
        if (!form.forma_pagamento) {
          toast.error("Forma de pagamento é obrigatória para status Pago");
          return;
        }
        if (!form.conta_bancaria_id) {
          toast.error("Conta bancária é obrigatória para baixa");
          return;
        }
      }

      setSaving(true);

      try {
        const basePayload = {
          tipo: form.tipo,
          descricao: form.descricao,
          valor: form.valor,
          data_vencimento: form.data_vencimento,
          status: form.status,
          forma_pagamento: form.forma_pagamento || null,
          banco: form.banco || null,
          cartao: form.cartao || null,
          cliente_id: form.cliente_id || null,
          fornecedor_id: form.fornecedor_id || null,
          conta_bancaria_id: form.conta_bancaria_id || null,
          conta_contabil_id: form.conta_contabil_id || null,
          data_pagamento: form.data_pagamento || null,
          observacoes: form.observacoes || null,
        };

        if (mode === "create" && form.gerar_parcelas && form.num_parcelas > 1) {
          const numParcelas = Number(form.num_parcelas);
          const numP = numParcelas;
          const intervalo = Number(form.intervalo_dias) || 30;
          const valorParcela = Number((form.valor / numP).toFixed(2));
          const resto = Number((form.valor - valorParcela * numP).toFixed(2));
          const parentPayload = {
            ...basePayload,
            descricao: `${form.descricao} (agrupador)`,
            parcela_numero: 0,
            parcela_total: numP,
          };
          const parentResult = await create(parentPayload);
          const parentId = parentResult?.id ?? null;

          const parcelas = Array.from({ length: numP }, (_, i) => {
            const venc = new Date(form.data_vencimento);
            venc.setDate(venc.getDate() + intervalo * i);
            return {
              ...basePayload,
              descricao: `${form.descricao} - ${i + 1}/${numP}`,
              valor: i === numP - 1 ? valorParcela + resto : valorParcela,
              data_vencimento: venc.toISOString().split("T")[0],
              parcela_numero: i + 1,
              parcela_total: numP,
              documento_pai_id: parentId || null,
            };
          });

          const { error: parcelasError } = await supabase
            .from("financeiro_lancamentos")
            .insert(parcelas);
          if (parcelasError) throw parcelasError;

          toast.success(`${numParcelas} parcelas geradas com sucesso!`);
        } else if (mode === "create") {
          await create(basePayload);
        } else if (selected) {
          await update(selected.id, basePayload);
        }

        onSuccess();
      } catch (error) {
        console.error("[financeiro] erro ao salvar:", error);
        toast.error(getUserFriendlyError(error));
      } finally {
        setSaving(false);
      }
    },
    [create, update],
  );

  const handleEstorno = useCallback(async () => {
    if (!estornoTarget) return;
    if (!estornoMotivo.trim()) {
      toast.error("Informe o motivo do estorno");
      return;
    }

    setEstornoProcessing(true);
    const ok = await processarEstorno(estornoTarget.id, estornoMotivo.trim());
    setEstornoProcessing(false);

    if (ok) {
      setEstornoTarget(null);
      setEstornoMotivo("");
      await fetchData();
    }
  }, [estornoTarget, estornoMotivo, fetchData]);

  const handleExportar = useCallback(
    async (formato: "excel" | "pdf") => {
      const rows = filteredData.map((item) => ({
        Tipo: item.tipo === "receber" ? "A Receber" : "A Pagar",
        Descrição: item.descricao,
        Pessoa:
          item.tipo === "receber"
            ? (item.clientes?.nome_razao_social ?? "")
            : (item.fornecedores?.nome_razao_social ?? ""),
        Vencimento: item.data_vencimento,
        "Valor (R$)": Number(item.valor),
        Status: getLancamentoStatus(item),
        "Forma Pgto": item.forma_pagamento ?? "",
        Banco: item.contas_bancarias
          ? `${item.contas_bancarias.bancos?.nome ?? ""} - ${item.contas_bancarias.descricao}`
          : "",
      }));
      const opts = { titulo: "Contas a Pagar-Receber", rows };
      if (formato === "excel") await exportarParaExcel(opts);
      else await exportarParaPdf(opts);
    },
    [filteredData, getLancamentoStatus],
  );

  return {
    saving,
    handleSubmit,
    handleExportar,
    handleEstorno,
    estornoTarget,
    setEstornoTarget,
    estornoProcessing,
    estornoMotivo,
    setEstornoMotivo,
  };
}
