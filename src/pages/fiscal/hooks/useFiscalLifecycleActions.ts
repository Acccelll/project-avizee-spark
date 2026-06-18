import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import { useActionLock } from "@/hooks/useActionLock";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useInvalidateAfterMutation } from "@/hooks/useInvalidateAfterMutation";
import { useIsMobile } from "@/hooks/use-mobile";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import {
  cancelarNotaFiscal,
  listNotaFiscalItensCompletos,
} from "@/services/fiscal.service";
import {
  useConfirmarNotaFiscal,
  useEstornarNotaFiscal,
} from "@/pages/fiscal/hooks/useNotaFiscalLifecycle";
import { canConfirmFiscal, canEstornarFiscal } from "@/lib/fiscalStatus";
import type { NotaFiscal } from "@/types/domain";
import type { GridItem } from "@/components/ui/ItemsGrid";
import type {
  FiscalFormState as FiscalForm,
  NfItemFiscalData,
} from "@/pages/fiscal/hooks/useFiscalNotaForm";
import type { ParcelaPlano } from "@/pages/fiscal/components/ParcelasFiscalEditor";

interface NfItemRow {
  id: string; produto_id: string; quantidade: number; valor_unitario: number;
  conta_contabil_id: string | null; cfop: string | null; cst: string | null;
  ncm: string | null; unidade: string | null; descricao: string | null;
  icms_valor: number | null; icms_aliquota: number | null; icms_base: number | null;
  ipi_valor: number | null; ipi_aliquota: number | null;
  pis_valor: number | null; pis_aliquota: number | null; base_pis: number | null;
  cofins_valor: number | null; cofins_aliquota: number | null; base_cofins: number | null;
  valor_st: number | null; base_st: number | null;
  csosn: string | null; cst_pis: string | null; cst_cofins: string | null; cst_ipi: string | null;
  desconto: number | null; codigo_produto: string | null;
  produtos?: { nome: string; sku: string } | null;
}

export interface UseFiscalLifecycleActionsArgs {
  fetchData: () => void;
  setMode: (m: "create" | "edit") => void;
  setSelected: (n: NotaFiscal | null) => void;
  setForm: (f: FiscalForm) => void;
  setItems: (i: GridItem[]) => void;
  setItemContaContabil: (m: Record<number, string>) => void;
  setItemFiscalData: (m: Record<number, NfItemFiscalData>) => void;
  setParcelas: (n: number) => void;
  setParcelasPlano: (p: ParcelaPlano[]) => void;
  setModalOpen: (open: boolean) => void;
  data: NotaFiscal[];
  selected: NotaFiscal | null;
}

/**
 * Centraliza handlers de ciclo de vida da NF: confirmar, estornar,
 * cancelar rascunho, inativar via grid, baixar XML arquivado e hidratar
 * o form para edição. Sem mudança de comportamento — apenas isolamento
 * para a página Fiscal virar shell (Etapa 6.3).
 */
export function useFiscalLifecycleActions(args: UseFiscalLifecycleActionsArgs) {
  const {
    fetchData, setMode, setSelected, setForm, setItems,
    setItemContaContabil, setItemFiscalData,
    setParcelas, setParcelasPlano, setModalOpen,
    data, selected,
  } = args;

  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const confirmarLock = useActionLock();
  const estornarLock = useActionLock();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const invalidate = useInvalidateAfterMutation();
  const confirmarMutation = useConfirmarNotaFiscal();
  const estornarMutation = useEstornarNotaFiscal();

  const baixarXmlArquivado = async (n: NotaFiscal) => {
    const path = (n as { caminho_xml?: string | null }).caminho_xml;
    if (!path) { toast.error("XML não arquivado para esta NF."); return; }
    try {
      const { triggerDownloadNfeXml } = await import("@/services/fiscal/xmlStorage.service");
      await triggerDownloadNfeXml({ path, filename: `${n.chave_acesso || n.numero}.xml` });
    } catch (err) {
      logger.error("[fiscal] baixar XML:", err);
      toast.error(`Não foi possível baixar o XML: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleConfirmar = async (nf: NotaFiscal) => {
    if (!canConfirmFiscal(nf.status)) {
      toast.error(`NF ${nf.numero} não está em estado confirmável.`);
      return;
    }
    const ok = await confirm({
      title: "Concluir lançamento da NF",
      description: `Concluir o lançamento da NF ${nf.numero}? O ERP movimentará estoque e gerará o financeiro conforme a configuração da nota. (Notas com condição financeira completa são concluídas automaticamente no salvar — esta ação é o fallback para pendências.)`,
      confirmLabel: "Concluir lançamento",
      confirmVariant: "default",
    });
    if (!ok) return;
    await confirmarLock.run(async () => {
      try {
        await confirmarMutation.mutateAsync({ nfId: nf.id, tipoDocumento: (nf as { tipo_documento?: "nfe" | "nfse" | "cte" }).tipo_documento ?? "nfe" });
        toast.success(`NF ${nf.numero} confirmada com sucesso. Impactos operacionais aplicados.`);
        fetchData();
        await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
      } catch (err: unknown) {
        logger.error('[fiscal] confirmar NF:', err);
        notifyError(err);
      }
    });
  };

  const handleEstornar = async (nf: NotaFiscal) => {
    if (!canEstornarFiscal(nf.status)) {
      toast.error(`NF ${nf.numero} não está em estado estornável.`);
      return;
    }
    const ok = await confirm({
      title: "Estornar nota fiscal",
      description: `Estorno da NF ${nf.numero}: o sistema reverterá os movimentos de estoque, cancelará lançamentos financeiros e recalculará faturamento vinculado.`,
      confirmLabel: "Estornar",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    await estornarLock.run(async () => {
      try {
        await estornarMutation.mutateAsync({ nfId: nf.id });
        toast.success(`NF ${nf.numero} estornada! Estoque e financeiro revertidos.`);
        fetchData();
        await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
      } catch (err: unknown) {
        logger.error('[fiscal] estornar NF:', err);
        notifyError(err);
      }
    });
  };

  const handleCancelarRascunho = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Cancelar rascunho",
      description: `Cancelar o rascunho da NF ${selected.numero}? Esta ação não pode ser desfeita.`,
      confirmLabel: "Cancelar rascunho",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    try {
      await cancelarNotaFiscal(selected.id, `Rascunho da NF ${selected.numero} cancelado pelo usuário.`);
      toast.success("Rascunho inativado com sucesso.");
      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      logger.error('[fiscal] cancelar rascunho:', err);
      notifyError(err);
    }
  };

  const handleInativar = async (nfId: string) => {
    const nf = data.find((item) => item.id === nfId);
    if (!nf) return;
    if (!canConfirmFiscal(nf.status)) {
      toast.error("Inativação permitida apenas para notas em preparação (rascunho/pendente).");
      return;
    }
    const ok = await confirm({
      title: "Inativar rascunho fiscal",
      description: `A NF ${nf.numero} será inativada no ERP. Esta ação não cancela eventos na SEFAZ.`,
      confirmLabel: "Inativar",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    try {
      await cancelarNotaFiscal(nfId, `NF ${nf.numero} inativada via grid.`);
      toast.success(`NF ${nf.numero} inativada.`);
      fetchData();
    } catch (err: unknown) {
      logger.error('[fiscal] inativar NF:', err);
      notifyError(err);
    }
  };

  /**
   * Hidrata o form de edição com os dados da NF + itens completos.
   * Em mobile redireciona para a página dedicada (`/fiscal/:id/editar`) por
   * incompatibilidade com modal (alinhado a mem://produto/quando-drawer-quando-pagina).
   */
  const openEdit = async (n: NotaFiscal) => {
    if (isMobile) { navigate(`/fiscal/${n.id}/editar`); return; }
    setMode("edit"); setSelected(n);
    setForm({
      tipo: n.tipo, numero: n.numero, serie: n.serie || "1", chave_acesso: n.chave_acesso || "",
      data_emissao: n.data_emissao, fornecedor_id: n.fornecedor_id || "", cliente_id: n.cliente_id || "",
      valor_total: n.valor_total, status: n.status, observacoes: n.observacoes || "",
      movimenta_estoque: n.movimenta_estoque !== false, gera_financeiro: n.gera_financeiro !== false,
      forma_pagamento: n.forma_pagamento || "", condicao_pagamento: n.condicao_pagamento || "a_vista",
      ordem_venda_id: n.ordem_venda_id || "", conta_contabil_id: n.conta_contabil_id || "",
      modelo_documento: n.modelo_documento || "55",
      cartao_id: (n as { cartao_id?: string | null }).cartao_id || "",
      frete_valor: n.frete_valor || 0, icms_valor: n.icms_valor || 0, ipi_valor: n.ipi_valor || 0,
      pis_valor: n.pis_valor || 0, cofins_valor: n.cofins_valor || 0, icms_st_valor: n.icms_st_valor || 0,
      desconto_valor: n.desconto_valor || 0, outras_despesas: n.outras_despesas || 0,
      origem: n.origem || "manual",
      data_vencimento: (n as { data_vencimento?: string | null }).data_vencimento || "",
      intervalo_parcelas_dias: (n as { intervalo_parcelas_dias?: number | null }).intervalo_parcelas_dias || 30,
    });
    const numParc = Math.max(1, Number((n as { numero_parcelas?: number | null }).numero_parcelas) || 1);
    setParcelas(numParc);
    const planoExistente = (n as { parcelas?: unknown }).parcelas;
    if (Array.isArray(planoExistente) && planoExistente.length > 0) {
      setParcelasPlano(planoExistente as ParcelaPlano[]);
    } else {
      setParcelasPlano([]);
    }
    const itens = await listNotaFiscalItensCompletos(n.id).catch(() => []);
    const itensTyped = itens as unknown as NfItemRow[];
    const loadedItems: GridItem[] = itensTyped.map((i) => ({
      id: i.id, produto_id: i.produto_id, codigo: i.produtos?.sku || "",
      descricao: i.produtos?.nome || "", quantidade: i.quantidade,
      valor_unitario: i.valor_unitario, valor_total: i.quantidade * i.valor_unitario,
    }));
    setItems(loadedItems);
    const contaMap: Record<number, string> = {};
    const fiscalMap: Record<number, NfItemFiscalData> = {};
    itensTyped.forEach((i, idx) => {
      if (i.conta_contabil_id) contaMap[idx] = i.conta_contabil_id;
      fiscalMap[idx] = {
        cfop: i.cfop, cst: i.cst, ncm: i.ncm, unidade: i.unidade,
        descricao: i.descricao, icms_valor: i.icms_valor, icms_aliquota: i.icms_aliquota,
        icms_base: i.icms_base, ipi_valor: i.ipi_valor, ipi_aliquota: i.ipi_aliquota,
        pis_valor: i.pis_valor, pis_aliquota: i.pis_aliquota, base_pis: i.base_pis,
        cofins_valor: i.cofins_valor, cofins_aliquota: i.cofins_aliquota, base_cofins: i.base_cofins,
        valor_st: i.valor_st, base_st: i.base_st,
        csosn: i.csosn, cst_pis: i.cst_pis, cst_cofins: i.cst_cofins, cst_ipi: i.cst_ipi,
        desconto: i.desconto, codigo_produto: i.codigo_produto,
      };
    });
    setItemContaContabil(contaMap);
    setItemFiscalData(fiscalMap);
    setModalOpen(true);
  };

  return {
    baixarXmlArquivado,
    handleConfirmar,
    handleEstornar,
    handleCancelarRascunho,
    handleInativar,
    openEdit,
    confirmDialog,
    invalidate,
    confirmarMutation,
  };
}