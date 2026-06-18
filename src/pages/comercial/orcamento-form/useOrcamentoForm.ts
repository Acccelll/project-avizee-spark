import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orcamentoSchema, type OrcamentoFormValues } from "@/lib/orcamentoSchema";
import { type OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import { type RentabilidadeScenarioConfig } from "@/components/Orcamento/OrcamentoInternalAnalysisPanel";
import { type ProductWithForn } from "@/components/ui/DataSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useCan } from "@/hooks/useCan";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { Tables } from "@/integrations/supabase/types";
import { TemplateConfig } from "@/types/orcamento";
import { getOrcamentoInternalAccess } from "@/lib/orcamentoInternalAccess";
import { notifyError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import {
  listClientesAtivosOrcamento,
  listProdutosAtivosComFornecedores,
  getFormaPagamentoDescricao,
  listPrecosEspeciaisAtuais,
} from "@/services/orcamentos.service";
import { getEmpresaConfig } from "@/services/fiscal.service";
import { type RegraPrecoEspecial } from "@/lib/precos-especiais";
import {
  emptyCliente,
  STATUS_LABEL,
  type ClienteSnapshot,
} from "@/pages/comercial/orcamento-form/types";
import { mapClienteToSnapshot, recalcItemsWithSpecialPrices } from "@/pages/comercial/orcamento-form/clienteHelpers";
import { useOrcamentoRentabilidade } from "@/pages/comercial/orcamento-form/useOrcamentoRentabilidade";
import { usePreviewAutoScale } from "@/pages/comercial/orcamento-form/usePreviewAutoScale";
import { useOrcamentoDraft } from "@/pages/comercial/orcamento-form/useOrcamentoDraft";
import { useOrcamentoLoad } from "@/pages/comercial/orcamento-form/useOrcamentoLoad";
import { useOrcamentoSave } from "@/pages/comercial/orcamento-form/useOrcamentoSave";
import { useOrcamentoFormTemplates } from "@/pages/comercial/orcamento-form/useOrcamentoFormTemplates";
import { buildOrcamentoPayload as buildOrcamentoPayloadHelper } from "@/pages/comercial/orcamento-form/buildPayload";
import { applyOrcamentoDraft } from "@/pages/comercial/orcamento-form/draftTemplate";
import { generateOrcamentoPdf, buildOrcamentoPdfBlob } from "@/pages/comercial/orcamento-form/pdfUtils";
import { type MailStep } from "@/pages/comercial/orcamento-form/EnviarEmailDialog";

const LOCKED_STATUSES = new Set([
  "convertido",
  "rejeitado",
  "expirado",
  "cancelado",
  "historico",
]);

/**
 * Hook orquestrador do formulário de Orçamento (criação e edição).
 *
 * Concentra estado, queries, mutations, cálculos derivados e handlers usados
 * pela página `OrcamentoForm.tsx`. Extraído na Etapa 6.1 para que a página
 * vire um shell de JSX (< 300 linhas) sem alterar comportamento.
 */
export function useOrcamentoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pdfRef = useRef<HTMLDivElement>(null);
  const offscreenPdfRef = useRef<HTMLDivElement>(null);
  const isEdit = !!id;
  const isMobile = useIsMobile();
  const { user, roles, extraPermissions } = useAuth();
  const { can } = useCan();
  const isAdmin = roles.includes("admin");
  const canApprove = isAdmin || can("orcamentos:aprovar");

  const [previewOpen, setPreviewOpen] = useState(searchParams.get("preview") === "1");
  const queryClient = useQueryClient();
  // Lookups cacheados (5min) — evitam recarregar a lista a cada navegação para o form.
  const { data: clientes = [] } = useQuery<Tables<"clientes">[]>({
    queryKey: ["orcamento-form", "clientes-ativos"],
    queryFn: () => listClientesAtivosOrcamento(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: produtos = [] } = useQuery<ProductWithForn[]>({
    queryKey: ["orcamento-form", "produtos-ativos"],
    queryFn: () => listProdutosAtivosComFornecedores() as unknown as Promise<ProductWithForn[]>,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const [precosEspeciais, setPrecosEspeciais] = useState<Tables<"precos_especiais">[]>([]);
  const [clienteSnapshot, setClienteSnapshot] = useState<ClienteSnapshot>(emptyCliente);
  const [items, setItems] = useState<OrcamentoItem[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [restoreDraftOpen, setRestoreDraftOpen] = useState(false);
  const [layoutTemplate, setLayoutTemplate] = useState<'classico' | 'marca'>('marca');
  const [previewZoom, setPreviewZoom] = useState<number>(0); // 0 = auto-fit
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const autoScale = usePreviewAutoScale(previewStageRef, previewOpen, previewFullscreen);
  const { confirm: confirmAction, dialog: confirmActionDialog } = useConfirmDialog();

  // Ao alternar para fullscreen, voltar para auto-fit para enquadrar tudo
  useEffect(() => {
    if (previewOpen) setPreviewZoom(0);
  }, [previewFullscreen, previewOpen]);

  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    reset,
    trigger,
    formState: { errors: fieldErrors },
  } = useForm<OrcamentoFormValues>({
    resolver: zodResolver(orcamentoSchema),
    mode: 'onChange',
    defaultValues: {
      numero: '',
      dataOrcamento: new Date().toISOString().split('T')[0],
      status: 'rascunho',
      clienteId: '',
      validade: '',
      desconto: 0,
      impostoSt: 0,
      impostoIpi: 0,
      freteValor: 0,
      outrasDespesas: 0,
      pagamento: '',
      prazoPagamento: '',
      prazoEntrega: '',
      freteTipo: '',
      servicoFrete: '',
      modalidade: '',
      observacoes: '',
      observacoesInternas: '',
    },
  });

  const {
    numero,
    dataOrcamento,
    status,
    clienteId,
    validade,
    desconto,
    impostoSt,
    impostoIpi,
    freteValor,
    outrasDespesas,
    pagamento,
    prazoPagamento,
    prazoEntrega,
    freteTipo,
    servicoFrete,
    modalidade,
    observacoes,
    observacoesInternas,
  } = watch();

  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState('Olá, segue orçamento atualizado para sua análise.');
  // Stepper de envio de e-mail: idle → pdf → upload → email → done
  const [mailStep, setMailStep] = useState<MailStep>('idle');
  const [mailError, setMailError] = useState<string | null>(null);
  const [empresaConfig, setEmpresaConfig] = useState<Record<string, string> | null>(null);
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<string | null>(null);

  // Dados de frete do simulador
  const [freteSimulacaoId, setFreteSimulacaoId] = useState<string | null>(null);
  const [freteTransportadoraId, setFreteTransportadoraId] = useState<string | null>(null);
  const [freteOrigemFrete, setFreteOrigemFrete] = useState<string | null>(null);
  const [freteServico, setFreteServico] = useState<string | null>(null);
  const [fretePrazoEntregaDias, setFretePrazoEntregaDias] = useState<number | null>(null);
  const [freteVolumes, setFreteVolumes] = useState<number>(1);
  const [freteAlturaCm, setFreteAlturaCm] = useState<number>(15);
  const [freteLarguraCm, setFreteLarguraCm] = useState<number>(10);
  const [freteComprimentoCm, setFreteComprimentoCm] = useState<number>(30);
  const [pesoEmbalagemTotal, setPesoEmbalagemTotal] = useState<number>(0);
  const [pesoTotalOverride, setPesoTotalOverride] = useState<number | null>(null);

  const [scenarioConfig, setScenarioConfig] = useState<RentabilidadeScenarioConfig>({
    freteSimulado: 0,
    impostosSimulados: 0,
    outrosCustosSimulados: 0,
    descontoGlobalSimulado: 0,
    reajusteGlobalPrecoPercent: 0,
    reajusteGlobalCustoPercent: 0,
    nomeCenario: "",
  });

  const draftKey = useMemo(() => `orcamento:draft:${id || 'novo'}:${user?.id || 'anon'}`, [id, user?.id]);

  const totalProdutos = items.reduce((sum, i) => sum + (i.valor_total || 0), 0);
  const valorTotal = totalProdutos - desconto + impostoSt + impostoIpi + freteValor + outrasDespesas;
  const quantidadeTotal = items.reduce((sum, i) => sum + (i.quantidade || 0), 0);
  const pesoTotalItens = items.reduce((sum, i) => sum + (i.peso_total || 0), 0);
  const pesoTotalCalculado = pesoTotalItens + (pesoEmbalagemTotal || 0);
  const pesoTotal = pesoTotalOverride !== null ? pesoTotalOverride : pesoTotalCalculado;
  const internalAccess = useMemo(() => getOrcamentoInternalAccess(roles, extraPermissions), [roles, extraPermissions]);

  // isLocked: somente estados terminais/derivados são imutáveis.
  // "rascunho", "pendente" e "aprovado" continuam editáveis para permitir ajustes
  // antes da conversão em pedido.
  const isLocked = isEdit && !!status && LOCKED_STATUSES.has(status);

  // Opções de status filtradas por permissão. "Convertido" nunca é selecionável manualmente.
  const statusOptions = useMemo(() => {
    const base: { value: string; label: string }[] = [
      { value: "rascunho", label: "Rascunho" },
      { value: "pendente", label: "Aguardando Aprovação" },
      { value: "cancelado", label: "Cancelado" },
    ];
    if (canApprove) {
      base.push(
        { value: "aprovado", label: "Aprovado" },
        { value: "rejeitado", label: "Rejeitado" },
        { value: "expirado", label: "Expirado" },
      );
    }
    if (status && !base.some((o) => o.value === status)) {
      base.push({ value: status, label: STATUS_LABEL[status] || status });
    }
    return base;
  }, [canApprove, status]);

  const { baseAnalysis, scenarioAnalysis } = useOrcamentoRentabilidade({
    produtos,
    items,
    desconto,
    freteValor,
    impostoSt,
    impostoIpi,
    outrasDespesas,
    scenarioConfig,
  });

  useOrcamentoLoad({
    id, isEdit, queryClient, produtos,
    reset, getValues, setValue,
    setClienteSnapshot, setItems, setPesoTotalOverride,
    setFreteSimulacaoId, setFreteTransportadoraId, setFreteOrigemFrete,
    setFreteServico, setFretePrazoEntregaDias, setFreteVolumes,
    setFreteAlturaCm, setFreteLarguraCm, setFreteComprimentoCm,
  });

  const handleClienteChange = useCallback(async (cId: string) => {
    setValue('clienteId', cId);
    const c = clientes.find((cl) => cl.id === cId);
    if (c) {
      setClienteSnapshot(mapClienteToSnapshot(c));
      if (!pagamento) {
        let descricaoForma: string | null = null;
        if (c.forma_pagamento_id) {
          descricaoForma = await getFormaPagamentoDescricao(c.forma_pagamento_id);
        }
        const fallback = descricaoForma ?? c.forma_pagamento_padrao ?? null;
        if (fallback) setValue('pagamento', fallback);
      }
      if (c.prazo_preferencial && !prazoPagamento) setValue('prazoPagamento', `${c.prazo_preferencial} DDL`);
      if (c.prazo_padrao && !prazoPagamento && !c.prazo_preferencial) setValue('prazoPagamento', `${c.prazo_padrao} DDL`);

      listPrecosEspeciaisAtuais(cId)
        .then((rules) => {
          const tipadas = rules as Tables<"precos_especiais">[];
          setPrecosEspeciais(tipadas);
          const { items: next, changedCount } = recalcItemsWithSpecialPrices(
            items,
            tipadas as RegraPrecoEspecial[],
          );
          if (changedCount > 0) {
            setItems(next);
            toast.info("Preços recalculados com base nas regras do cliente selecionado");
          }
        })
        .catch((err) => {
          logger.error("[orcamento] preços especiais:", err);
          notifyError(err);
        });
    } else {
      setPrecosEspeciais([]);
    }
  }, [clientes, pagamento, prazoPagamento, items, setValue]);

  const buildDraftPayload = useCallback(() => ({
    ...getValues(),
    clienteSnapshot,
    items,
    savedAt: new Date().toISOString(),
  }), [getValues, clienteSnapshot, items]);

  const applyDraft = (draft: Record<string, unknown>) =>
    applyOrcamentoDraft(draft, { reset, setClienteSnapshot, setItems });

  const {
    templates,
    templateName,
    setTemplateName,
    templateDialogOpen,
    setTemplateDialogOpen,
    openTemplateDialog,
    saveTemplate,
    applyTemplate,
  } = useOrcamentoFormTemplates({
    userId: user?.id,
    getTemplatePayload: (): TemplateConfig => ({
      items,
      pagamento,
      prazoPagamento,
      prazoEntrega,
      modalidade,
      freteTipo: servicoFrete || freteTipo,
      observacoes,
      observacoes_internas: observacoesInternas,
    }),
    setValue,
    setItems,
    confirmAction,
  });

  const buildOrcamentoPayload = (
    override?: Partial<{ numero: string; status: string; validade: string | null }>,
  ) =>
    buildOrcamentoPayloadHelper({
      formValues: getValues(),
      isEdit,
      totals: { valorTotal, quantidadeTotal, pesoTotal },
      clienteSnapshot,
      frete: {
        transportadoraId: freteTransportadoraId,
        simulacaoId: freteSimulacaoId,
        origem: freteOrigemFrete,
        servico: freteServico,
        prazoDias: fretePrazoEntregaDias,
        volumes: freteVolumes,
        alturaCm: freteAlturaCm,
        larguraCm: freteLarguraCm,
        comprimentoCm: freteComprimentoCm,
      },
      override,
    });

  const { saving, handleSave, handleDuplicate } = useOrcamentoSave({
    id, isEdit, isLocked, status, canApprove, draftKey,
    userId: user?.id, items,
    trigger, getValues, setValue,
    buildOrcamentoPayload,
    queryClient, navigate,
  });

  const handleGeneratePdf = async () => {
    generateOrcamentoPdf({
      node: offscreenPdfRef.current,
      numero,
      clienteNome: clienteSnapshot.nome_razao_social,
    });
  };

  // Gera o PDF como Blob (sem download) — usado para anexar em e-mail.
  const buildPdfBlob = (): Promise<Blob | null> =>
    buildOrcamentoPdfBlob(offscreenPdfRef.current);

  const handleTotalChange = (field: string, value: number) => {
    const fieldMap: Record<string, keyof OrcamentoFormValues> = {
      desconto: 'desconto',
      imposto_st: 'impostoSt',
      imposto_ipi: 'impostoIpi',
      frete_valor: 'freteValor',
      outras_despesas: 'outrasDespesas',
    };
    const key = fieldMap[field];
    if (key) setValue(key, value);
  };

  const handleCondicaoChange = (field: string, value: string) => {
    const fieldMap: Record<string, keyof OrcamentoFormValues> = {
      pagamento: 'pagamento',
      prazo_pagamento: 'prazoPagamento',
      prazo_entrega: 'prazoEntrega',
      servico_frete: 'servicoFrete',
      modalidade: 'modalidade',
    };
    const key = fieldMap[field];
    if (key) setValue(key, value);
  };

  useOrcamentoDraft({
    draftKey,
    isEdit,
    status,
    userId: user?.id,
    items,
    getValues,
    buildDraftPayload,
    setRestoreDraftOpen,
    setLastAutoSaveAt,
  });

  useEffect(() => {
    getEmpresaConfig()
      .then((data) => {
        if (data) setEmpresaConfig(data as unknown as Record<string, string>);
      })
      .catch(() => {/* opcional — não bloqueia o form */});
  }, []);

  const clienteOptions = clientes.map((c) => ({
    id: c.id,
    label: c.nome_razao_social,
    sublabel: `${c.cpf_cnpj || "sem documento"} ${Number(c.limite_credito || 0) > 10000 ? "· Cliente Premium - 10% desconto" : ""}`.trim(),
    rightMeta: c.cidade ? `${c.cidade}/${c.uf || ""}` : undefined,
    searchTerms: [c.nome_razao_social, c.nome_fantasia, c.cpf_cnpj].filter(Boolean) as string[],
  }));

  return {
    // ids/contexto
    id, navigate, isEdit, isMobile, user, queryClient,
    // form rhf
    register, control, setValue, fieldErrors,
    // valores observados
    numero, dataOrcamento, status, clienteId, validade,
    desconto, impostoSt, impostoIpi, freteValor, outrasDespesas,
    pagamento, prazoPagamento, prazoEntrega,
    freteTipo, servicoFrete, modalidade, observacoes,
    // estado de itens/cliente
    items, setItems, clienteSnapshot, clienteOptions, clientes,
    precosEspeciais,
    // lookups
    produtos,
    // totais/derivados
    totalProdutos, valorTotal, quantidadeTotal, pesoTotal, pesoTotalCalculado,
    pesoTotalOverride, setPesoTotalOverride, setPesoEmbalagemTotal,
    // status/lock
    isLocked, statusOptions,
    // frete sim
    freteSimulacaoId, setFreteSimulacaoId, freteServico,
    setFreteTransportadoraId, setFreteOrigemFrete, setFreteServico,
    setFretePrazoEntregaDias, setFreteVolumes, setFreteAlturaCm,
    setFreteLarguraCm, setFreteComprimentoCm,
    // rentabilidade
    baseAnalysis, scenarioAnalysis, scenarioConfig, setScenarioConfig, internalAccess,
    // handlers
    handleClienteChange, handleTotalChange, handleCondicaoChange,
    handleGeneratePdf, buildPdfBlob,
    // save
    saving, handleSave, handleDuplicate,
    // dialogs/sheets
    previewOpen, setPreviewOpen,
    previewFullscreen, setPreviewFullscreen,
    layoutTemplate, setLayoutTemplate,
    previewZoom, setPreviewZoom,
    autoScale, previewStageRef, pdfRef, offscreenPdfRef,
    mailModalOpen, setMailModalOpen, mailStep, setMailStep,
    mailError, setMailError, emailTemplate, setEmailTemplate,
    quickAddOpen, setQuickAddOpen,
    restoreDraftOpen, setRestoreDraftOpen,
    draftKey, applyDraft, lastAutoSaveAt, empresaConfig,
    // templates
    templates, templateName, setTemplateName,
    templateDialogOpen, setTemplateDialogOpen,
    openTemplateDialog, saveTemplate, applyTemplate,
    // confirm
    confirmActionDialog,
  };
}