import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orcamentoSchema, type OrcamentoFormValues } from "@/lib/orcamentoSchema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { OrcamentoItemsGrid, type OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import { OrcamentoInternalAnalysisPanel, type RentabilidadeScenarioConfig } from "@/components/Orcamento/OrcamentoInternalAnalysisPanel";
import { OrcamentoTotaisCard } from "@/components/Orcamento/OrcamentoTotaisCard";
import { OrcamentoCondicoesCard } from "@/components/Orcamento/OrcamentoCondicoesCard";
import { FreteSimuladorCard } from "@/components/Orcamento/FreteSimuladorCard";
import type { FreteSelecaoPayload } from "@/services/freteSimulacao.service";
import { OrcamentoSidebarSummary } from "@/components/Orcamento/OrcamentoSidebarSummary";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { FileText, CheckCircle2, CalendarDays, Clock, BarChart3, Truck, CreditCard } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { MobileSection } from "@/pages/comercial/orcamento-form/MobileSection";
import { IdentificacaoCard } from "@/pages/comercial/orcamento-form/IdentificacaoCard";
import { ClienteCard } from "@/pages/comercial/orcamento-form/ClienteCard";
import { ActionsToolbar } from "@/pages/comercial/orcamento-form/ActionsToolbar";
import {
  emptyCliente,
  STATUS_LABEL,
  type ClienteSnapshot,
} from "@/pages/comercial/orcamento-form/types";
import { JustCreatedBanner } from "@/components/JustCreatedBanner";
import { generateOrcamentoPdf, buildOrcamentoPdfBlob } from "@/pages/comercial/orcamento-form/pdfUtils";
import { buildOrcamentoPayload as buildOrcamentoPayloadHelper } from "@/pages/comercial/orcamento-form/buildPayload";
import { applyOrcamentoDraft } from "@/pages/comercial/orcamento-form/draftTemplate";
import { TemplateSaveDialog } from "@/pages/comercial/orcamento-form/TemplateSaveDialog";
import { useOrcamentoFormTemplates } from "@/pages/comercial/orcamento-form/useOrcamentoFormTemplates";
import { EnviarEmailDialog, type MailStep } from "@/pages/comercial/orcamento-form/EnviarEmailDialog";
import { PreviewDialog, OffscreenPdfTemplate, type OrcamentoPdfData } from "@/pages/comercial/orcamento-form/PreviewDialog";
import { RestoreDraftDialog } from "@/pages/comercial/orcamento-form/RestoreDraftDialog";
import { MobileStickyFooter } from "@/pages/comercial/orcamento-form/MobileStickyFooter";
import { mapClienteToSnapshot, recalcItemsWithSpecialPrices } from "@/pages/comercial/orcamento-form/clienteHelpers";
import {
  validateOrcamentoItems,
  mapItemsToPayload,
  persistOrcamento,
} from "@/pages/comercial/orcamento-form/saveHelpers";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import { type ProductWithForn } from "@/components/ui/DataSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useCan } from "@/hooks/useCan";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency, formatDate, formatWeightKg } from "@/lib/format";
import { TemplateConfig } from "@/types/orcamento";
import { calcularRentabilidade, type InternalCostCandidate } from "@/lib/orcamentoRentabilidade";
import { getOrcamentoInternalAccess } from "@/lib/orcamentoInternalAccess";
import { getUserFriendlyError, notifyError } from "@/utils/errorMessages";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { logger } from "@/lib/logger";
import {
  listClientesAtivosOrcamento,
  listProdutosAtivosComFornecedores,
  getOrcamentoById,
  listOrcamentoItens,
  getFormaPagamentoDescricao,
  listPrecosEspeciaisAtuais,
  deleteOrcamentoDraft,
} from "@/services/orcamentos.service";
import { getEmpresaConfig } from "@/services/fiscal.service";
import { peekProximoNumeroOrcamento } from "@/types/rpc";
import { type RegraPrecoEspecial } from "@/lib/precos-especiais";
import {
  upsertOrcamentoDraft,
  hasOrcamentoDraft,
  criarRevisaoOrcamento,
} from "@/services/orcamentos.service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
export default function OrcamentoForm() {
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

  const [saving, setSaving] = useState(false);
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
  const [autoScale, setAutoScale] = useState<number>(1);
  const { confirm: confirmAction, dialog: confirmActionDialog } = useConfirmDialog();

  // Auto-fit do preview A4 ao container do stage (largura E altura)
  useEffect(() => {
    if (!previewOpen) return;
    const el = previewStageRef.current;
    if (!el) return;
    const A4_WIDTH_PX = 794;  // 210mm @ 96dpi
    const A4_HEIGHT_PX = 1123; // 297mm @ 96dpi
    const PAD = 32; // padding interno do stage
    const compute = () => {
      const w = Math.max(0, el.clientWidth - PAD);
      const h = Math.max(0, el.clientHeight - PAD);
      const s = Math.min(w / A4_WIDTH_PX, h / A4_HEIGHT_PX);
      if (Number.isFinite(s) && s > 0) {
        setAutoScale(Math.min(1.5, Math.max(0.25, s)));
      }
    };
    // Pequeno delay para o dialog terminar a animação de abertura/fullscreen
    const t = window.setTimeout(compute, 50);
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [previewOpen, previewFullscreen]);

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
  // antes da conversão em pedido. "convertido", "rejeitado", "expirado" e
  // "cancelado" permanecem como snapshot histórico — exigem nova revisão.
  const LOCKED_STATUSES = new Set([
    "convertido",
    "rejeitado",
    "expirado",
    "cancelado",
    "historico",
  ]);
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
    // Garante que o status atual sempre apareça (ex.: "convertido" em orçamento já convertido).
    if (status && !base.some((o) => o.value === status)) {
      base.push({ value: status, label: STATUS_LABEL[status] || status });
    }
    return base;
  }, [canApprove, status]);

  const productCostMap = useMemo(() => {
    const map = new Map<string, InternalCostCandidate>();
    for (const product of produtos) {
      const fornecedores = product.produtos_fornecedores || [];
      const lastPurchase = [...fornecedores]
        .filter((row) => row.preco_compra && Number(row.preco_compra) > 0)
        .sort((a, b) => {
          const ua = (a as { ultima_compra?: string | null }).ultima_compra;
          const ub = (b as { ultima_compra?: string | null }).ultima_compra;
          const dateA = ua ? new Date(ua).getTime() : 0;
          const dateB = ub ? new Date(ub).getTime() : 0;
          return dateB - dateA;
        })[0];

      map.set(product.id, {
        productCost: product.preco_custo,
        lastPurchaseCost: lastPurchase?.preco_compra ?? null,
        avgCost: null,
      });
    }
    return map;
  }, [produtos]);

  const baseAnalysis = useMemo(() => calcularRentabilidade(
    items,
    {
      descontoGlobal: desconto,
      frete: freteValor,
      impostoSt,
      impostoIpi,
      outrasDespesas,
    },
    (item) => ({
      ...(productCostMap.get(item.produto_id) || {}),
      manualCost: item.custo_manual_unitario ?? null,
    }),
  ), [items, desconto, freteValor, impostoSt, impostoIpi, outrasDespesas, productCostMap]);

  const scenarioItems = useMemo(() => items.map((item) => {
    const useScenarioItem = Boolean(item.usar_cenario);
    const priceAdjusted = item.valor_unitario * (1 + (scenarioConfig.reajusteGlobalPrecoPercent || 0) / 100);
    return {
      ...item,
      valor_unitario: useScenarioItem && item.preco_simulado_unitario != null ? item.preco_simulado_unitario : priceAdjusted,
      desconto_percentual: useScenarioItem && item.desconto_simulado_percentual != null
        ? item.desconto_simulado_percentual
        : (item.desconto_percentual || 0),
      frete_rateado_simulado_unitario: useScenarioItem ? item.frete_rateado_simulado_unitario : null,
      imposto_rateado_simulado_unitario: useScenarioItem ? item.imposto_rateado_simulado_unitario : null,
      outros_custos_simulados_unitario: useScenarioItem ? item.outros_custos_simulados_unitario : null,
    };
  }), [items, scenarioConfig.reajusteGlobalPrecoPercent]);

  const scenarioAnalysis = useMemo(() => calcularRentabilidade(
    scenarioItems,
    {
      descontoGlobal: scenarioConfig.descontoGlobalSimulado || desconto,
      frete: scenarioConfig.freteSimulado || freteValor,
      impostoSt: (scenarioConfig.impostosSimulados || (impostoSt + impostoIpi)),
      impostoIpi: 0,
      outrasDespesas: scenarioConfig.outrosCustosSimulados || outrasDespesas,
    },
    (item) => {
      const baseCandidate = productCostMap.get(item.produto_id) || {};
      const costFactor = 1 + (scenarioConfig.reajusteGlobalCustoPercent || 0) / 100;
      return {
        productCost: baseCandidate.productCost != null ? baseCandidate.productCost * costFactor : null,
        lastPurchaseCost: baseCandidate.lastPurchaseCost != null ? baseCandidate.lastPurchaseCost * costFactor : null,
        avgCost: baseCandidate.avgCost != null ? baseCandidate.avgCost * costFactor : null,
        manualCost: item.usar_cenario && item.custo_simulado != null ? item.custo_simulado : item.custo_manual_unitario ?? null,
      };
    },
  ), [scenarioItems, scenarioConfig, desconto, freteValor, impostoSt, impostoIpi, outrasDespesas, productCostMap]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // clientes/produtos vêm de useQuery (cacheado 5min); apenas garantimos
        // que estão prontos antes de prosseguir com o load do orçamento.
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
              // Defesa: se a leitura retornar `numero` vazio (cache/replicação
              // logo após o save), preservamos o valor que o form já tinha
              // para evitar que o campo "pisque" em branco.
              numero: orc.numero || getValues("numero") || "",
              dataOrcamento: orc.data_orcamento,
              status: (orc.status === 'confirmado' ? 'pendente' : orc.status) as OrcamentoFormValues['status'],
              clienteId: orc.cliente_id || '',
              observacoes: orc.observacoes || '',
              observacoesInternas: orc.observacoes_internas || '',
              validade: orc.validade || '',
              desconto: orc.desconto || 0,
              impostoSt: orc.imposto_st || 0,
              impostoIpi: orc.imposto_ipi || 0,
              freteValor: orc.frete_valor || 0,
              outrasDespesas: orc.outras_despesas || 0,
              pagamento: orc.pagamento || '',
              prazoPagamento: orc.prazo_pagamento || '',
              prazoEntrega: orc.prazo_entrega || '',
              freteTipo: (orc.frete_tipo && ['CIF','FOB','sem_frete'].includes(orc.frete_tipo)) ? orc.frete_tipo : '',
              servicoFrete: orc.servico_frete || '',
              modalidade: orc.modalidade || '',
            });
            if (orc.cliente_snapshot) setClienteSnapshot(orc.cliente_snapshot as unknown as ClienteSnapshot);
            // Load frete simulator state (colunas tipadas)
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
              // Defesa em profundidade: se o snapshot `variacao` estiver vazio mas o produto
              // vinculado tiver `variacoes` cadastradas, usamos esse texto para exibir ao cliente.
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
              // Hidrata override de peso: se o peso salvo difere do somatório
              // dos itens (>= 0.01 kg), o usuário sobrescreveu manualmente.
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
            // Peek: apenas previsão. Número definitivo é gerado no save (RPC salvar_orcamento).
            const novoNumero = await peekProximoNumeroOrcamento();
            if (!novoNumero) {
              toast.error('Não foi possível gerar o número do orçamento. Tente novamente.');
              return;
            }
            setValue('numero', novoNumero);
          } catch (numErr) {
            logger.error('[OrcamentoForm] peek_proximo_numero_orcamento falhou:', numErr);
            toast.error('Não foi possível gerar o número do orçamento. Tente novamente.');
            return;
          }
        }
      } catch (err: unknown) {
        logger.error("[OrcamentoForm] erro ao carregar dados:", err);
        notifyError(err);
      }
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset/setValue are stable react-hook-form refs
  }, [id, isEdit]);

  const handleClienteChange = useCallback(async (cId: string) => {
    setValue('clienteId', cId);
    const c = clientes.find((cl) => cl.id === cId);
    if (c) {
      setClienteSnapshot(mapClienteToSnapshot(c));
      // Auto-fill payment preferences: prioriza FK forma_pagamento_id (descrição via join);
      // mantém leitura legada de forma_pagamento_padrao como fallback até backfill estar completo.
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

      // Load special prices for this client (only active and within validity period)
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
          console.error("[orcamento] preços especiais:", err);
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

  // Templates: estado, persistência e handlers consolidados no hook do form.
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

  const handleSave = async () => {
    // Guard de status: apenas status finais (LOCKED_STATUSES) são imutáveis.
    // rascunho/pendente/aprovado permanecem editáveis para ajustes antes da conversão.
    if (isLocked) {
      toast.error(`Orçamento "${status}" não pode ser editado.`, {
        description: "Use \"Criar revisão\" no drawer para gerar uma nova versão.",
      });
      return;
    }
    // Guard de permissão: bloquear escolha manual de "aprovado"/"convertido" no Select.
    const formStatus = getValues().status;
    if (formStatus === "aprovado" && !canApprove) {
      toast.error("Você não tem permissão para aprovar orçamentos.", {
        description: "Use o fluxo de aprovação na lista de orçamentos.",
      });
      return;
    }
    if (formStatus === "convertido") {
      toast.error("Conversão em pedido deve ser feita pela lista de orçamentos.");
      return;
    }
    // Validar formulário via react-hook-form
    const valid = await trigger(['numero', 'clienteId']);
    if (!valid) {
      toast.error("Preencha os campos obrigatórios para salvar.", { description: "Verifique número e cliente." });
      return;
    }
    const { numero, clienteId } = getValues();
    if (!numero || !clienteId) {
      toast.error("Preencha os campos obrigatórios para salvar.", { description: "Verifique número e cliente." });
      return;
    }

    const itemsCheck = validateOrcamentoItems(items, "salvar");
    if (!itemsCheck.ok) {
      toast.error(itemsCheck.error!.title, itemsCheck.error!.description ? { description: itemsCheck.error!.description } : undefined);
      return;
    }
    const validItems = itemsCheck.validItems;

    setSaving(true);
    try {
      const payload = buildOrcamentoPayload();
      const { orcId, numero: numeroSalvo } = await persistOrcamento({
        id: isEdit ? id! : null,
        payload,
        itens: mapItemsToPayload(validItems),
        fetchServerNumero: !isEdit,
      });

      localStorage.removeItem(draftKey);
      if (user?.id) {
        try {
          await deleteOrcamentoDraft(user.id, draftKey);
        } catch {/* ignore */}
      }
      // Reflete o número definitivo (gerado server-side via proximo_numero_orcamento())
      // no campo do form — pode diferir do peek se houve criação concorrente.
      if (!isEdit && numeroSalvo) setValue("numero", numeroSalvo);
      // Invalida caches para que a lista (Orcamentos) e dashboard reflitam
      // a inclusão/edição sem F5. Inclui também filtros server-side.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orcamentos"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success(isEdit ? "Orçamento atualizado com sucesso" : "Orçamento criado com sucesso", {
        description: `Registro ${numeroSalvo} salvo.`,
        action: { label: "Visualizar", onClick: () => navigate(orcId ? `/orcamentos/${orcId}` : "/orcamentos") },
      });
      if (!isEdit && orcId) navigate(`/orcamentos/${orcId}?created=1`, { replace: true });
    } catch (err: unknown) {
      logger.error('[orcamento]', err);
      notifyError(err);
    }
    setSaving(false);
  };

  const handleDuplicate = async () => {
    if (!id) { toast.error("Salve o orçamento antes de duplicar"); return; }
    const itemsCheck = validateOrcamentoItems(items, "duplicar");
    if (!itemsCheck.ok) {
      toast.error(itemsCheck.error!.title, itemsCheck.error!.description ? { description: itemsCheck.error!.description } : undefined);
      return;
    }
    const validItems = itemsCheck.validItems;
    try {
      // Compartilha a forma do payload com `handleSave` via override.
      // numero vazio => `salvar_orcamento` gera atomicamente via `proximo_numero_orcamento()`.
      const payload = buildOrcamentoPayload({
        numero: "",
        status: "rascunho",
        validade: null,
      });
      const { orcId, numero: numeroDup } = await persistOrcamento({
        id: null,
        payload,
        itens: mapItemsToPayload(validItems),
        fetchServerNumero: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success(`Duplicado: ${numeroDup}`);
      navigate(`/orcamentos/${orcId}`, { replace: true });
    } catch (err: unknown) {
      logger.error('[orcamento] duplicar:', err);
      notifyError(err);
    }
  };

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


  // Restauração de rascunho: tenta servidor, faz fallback para localStorage.
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    (async () => {
      if (user?.id) {
        const has = await hasOrcamentoDraft(user.id, draftKey).catch(() => false);
        if (cancelled) return;
        if (has) { setRestoreDraftOpen(true); return; }
      }
      const saved = localStorage.getItem(draftKey);
      if (!cancelled && saved) setRestoreDraftOpen(true);
    })();
    return () => { cancelled = true; };
  }, [draftKey, isEdit, user?.id]);

  // Autosave: tenta servidor (orcamento_drafts), com fallback para localStorage em caso de erro.
  useEffect(() => {
    const timer = setInterval(async () => {
      // Não autosalva drafts de orçamentos já em status terminal/aprovado.
      if (isEdit && status && status !== 'rascunho') return;
      const { numero: n, clienteId: cid } = getValues();
      if (!n && !cid && items.length === 0) return;
      const payload = buildDraftPayload();
      const serialized = JSON.stringify(payload);
      let serverOk = false;
      if (user?.id) {
        try {
          await upsertOrcamentoDraft(user.id, draftKey, payload);
          serverOk = true;
        } catch {/* fallback abaixo */}
      }
      if (!serverOk) {
        try { localStorage.setItem(draftKey, serialized); } catch {/* quota */}
      }
      setLastAutoSaveAt(new Date().toISOString());
    }, 30000);
    return () => clearInterval(timer);
  }, [buildDraftPayload, draftKey, getValues, items.length, user?.id, isEdit, status]);

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

  return (
    <PageShell
      backTo="/orcamentos"
      title={isEdit ? (isMobile ? "Editar Orçamento" : `Editando Orçamento${numero ? ` — ${numero}` : ""}`) : "Novo Orçamento"}
      subtitle={
        isMobile && isEdit && numero
          ? `${numero} · ${STATUS_LABEL[status] || status}`
          : isEdit
          ? "Revisão e ajuste da proposta comercial"
          : "Criação e emissão da proposta comercial"
      }
      actions={
        <ActionsToolbar
          saving={saving}
          isEdit={isEdit}
          isLocked={isLocked}
          templates={templates}
          onSave={handleSave}
          onPreview={() => setPreviewOpen(true)}
          onGeneratePdf={handleGeneratePdf}
          onDuplicate={handleDuplicate}
          onCriarRevisao={async () => {
            if (!id) return;
            try {
              const novoId = await criarRevisaoOrcamento(id);
              if (novoId) {
                toast.success("Revisão criada.");
                navigate(`/orcamentos/${novoId}`, { replace: true });
              }
            } catch (err) { notifyError(err); }
          }}
          onApplyTemplate={applyTemplate}
          onOpenTemplateDialog={openTemplateDialog}
        />
      }
      meta={
        <EditMetaBanner
          isEdit={isEdit}
          isMobile={isMobile}
          numero={numero}
          status={status}
          clienteSnapshot={clienteSnapshot}
          dataOrcamento={dataOrcamento}
          validade={validade}
          lastAutoSaveAt={lastAutoSaveAt}
          valorTotal={valorTotal}
          pesoTotal={pesoTotal}
          items={items}
        />
      }
    >
      {isEdit && status && isLocked && (
        <Alert variant="default" className="mb-4 border-warning/40 bg-warning/5">
          <Lock className="h-4 w-4" />
          <AlertTitle>Orçamento bloqueado para edição</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2 mt-1">
            <span>
              Este orçamento está no status <strong>{status}</strong> e não pode mais ser alterado.
              Para ajustar, gere uma nova revisão.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!id) return;
                try {
                  const novoId = await criarRevisaoOrcamento(id);
                  if (novoId) {
                    toast.success("Revisão criada.");
                    navigate(`/orcamentos/${novoId}`, { replace: true });
                  }
                } catch (err) { notifyError(err); }
              }}
            >
              Criar revisão
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 pb-32 lg:pb-0">
        <div className={cn("lg:col-span-8 space-y-5", isLocked && "[&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed")}>
        <fieldset disabled={isLocked} className="space-y-5 disabled:opacity-70 contents">
          <IdentificacaoCard
            register={register}
            control={control}
            fieldErrors={fieldErrors}
            numero={numero}
            status={status}
            id={id}
            isLocked={isLocked}
            statusOptions={statusOptions}
          />

          <ClienteCard
            clienteOptions={clienteOptions}
            clientes={clientes}
            clienteId={clienteId}
            clienteSnapshot={clienteSnapshot}
            fieldErrors={fieldErrors}
            onClienteChange={handleClienteChange}
            onQuickAdd={() => setQuickAddOpen(true)}
          />

          <OrcamentoItemsGrid
            items={items}
            onChange={setItems}
            produtos={produtos}
            precosEspeciais={precosEspeciais}
          />

          <MobileSection title="Análise Interna" icon={BarChart3} summary="Margem · Cenário" defaultOpen={false}>
            <OrcamentoInternalAnalysisPanel
              baseAnalysis={baseAnalysis}
              scenarioAnalysis={scenarioAnalysis}
              items={items}
              onItemsChange={setItems}
              scenarioConfig={scenarioConfig}
              onScenarioConfigChange={setScenarioConfig}
              access={internalAccess}
            />
          </MobileSection>

          <OrcamentoTotaisCard
            totalProdutos={totalProdutos}
            pesoTotal={pesoTotalCalculado}
            pesoOverride={pesoTotalOverride}
            onPesoOverrideChange={setPesoTotalOverride}
            form={{ valor_total: valorTotal, desconto, imposto_st: impostoSt, imposto_ipi: impostoIpi, frete_valor: freteValor, outras_despesas: outrasDespesas }}
            onChange={handleTotalChange}
            freteSimulacaoId={freteSimulacaoId}
            freteServico={freteServico || servicoFrete || null}
            onClearFrete={() => {
              setValue('freteValor', 0);
              setValue('servicoFrete', '');
              setFreteSimulacaoId(null);
            }}
          />

          <MobileSection
            title="Frete"
            icon={Truck}
            summary={freteValor > 0 ? formatCurrency(freteValor) : "Sem frete definido"}
            defaultOpen={false}
          >
          <FreteSimuladorCard
            orcamentoId={id || null}
            clienteId={clienteId}
            cepDestino={clienteSnapshot.cep}
            pesoTotal={pesoTotal}
            valorMercadoria={totalProdutos}
            simulacaoId={freteSimulacaoId}
            onEmbalagemPesoChange={setPesoEmbalagemTotal}
            onSelect={(payload: FreteSelecaoPayload) => {
              setValue('freteValor', payload.freteValor);
              // freteTipo guarda apenas modalidade (CIF/FOB/sem_frete); descrição vai para servicoFrete.
              setValue('servicoFrete', payload.servicoFrete || payload.freteTipo);
              if (payload.modalidade && ['CIF','FOB','sem_frete'].includes(payload.modalidade)) {
                setValue('freteTipo', payload.modalidade);
              }
              setValue('prazoEntrega', payload.prazoEntrega);
              setValue('modalidade', payload.modalidade || modalidade);
              setFreteSimulacaoId(payload.freteSimulacaoId);
              setFreteTransportadoraId(payload.transportadoraId);
              setFreteOrigemFrete(payload.origemFrete);
              setFreteServico(payload.servicoFrete);
              setFretePrazoEntregaDias(payload.prazoEntregaDias);
              setFreteVolumes(payload.volumes);
              setFreteAlturaCm(payload.alturaCm);
              setFreteLarguraCm(payload.larguraCm);
              setFreteComprimentoCm(payload.comprimentoCm);
            }}
          />
          </MobileSection>

          <MobileSection title="Condições Comerciais" icon={CreditCard} defaultOpen>
            <OrcamentoCondicoesCard
              form={{ quantidade_total: quantidadeTotal, peso_total: pesoTotal, pagamento, prazo_pagamento: prazoPagamento, prazo_entrega: prazoEntrega, servico_frete: servicoFrete || '', modalidade }}
              onChange={handleCondicaoChange}
            />
          </MobileSection>

          <MobileSection title="Observações" icon={FileText} defaultOpen={false}>
          <div className="bg-card rounded-xl border shadow-soft p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Observações do Orçamento</h3>
              <Textarea {...register('observacoes')} disabled={isLocked}
                placeholder="Texto livre para observações comerciais, instruções, validade, condições extras, etc."
                className="min-h-[100px]" />
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-success shrink-0" aria-hidden />
                Este texto <strong>aparecerá</strong> no PDF e no link enviado ao cliente.
              </p>
            </div>
            <div className="border-t pt-4">
              <h3 className="font-semibold text-foreground mb-1">Observações Internas</h3>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                Uso exclusivo da equipe — <strong>não aparece</strong> para o cliente, no PDF nem no link público.
              </p>
              <Textarea {...register('observacoesInternas')} disabled={isLocked}
                placeholder="Notas internas: margem, estratégia de negociação, alertas para a equipe, etc."
                className="min-h-[80px] border-dashed" />
            </div>
          </div>
          </MobileSection>
        </fieldset>
        </div>

        <div className="hidden lg:col-span-4 lg:block">
          <OrcamentoSidebarSummary
            qtdItens={items.filter(i => i.produto_id).length} totalProdutos={totalProdutos}
            freteValor={freteValor} valorTotal={valorTotal}
            pesoTotal={pesoTotal} validade={validade}
          />
          {isEdit && (
            <div className="mt-4 rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Compartilhamento da proposta</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!id) return;
                    try {
                      const { ensurePublicToken } = await import('@/services/orcamentos.service');
                      const token = await ensurePublicToken(id);
                      const link = `${window.location.origin}/orcamento-publico?token=${token}`;
                      await navigator.clipboard.writeText(link);
                      toast.success('Link público copiado!');
                    } catch (err: unknown) {
                      notifyError(err);
                    }
                  }}
                >
                  Copiar link público
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!id) return;
                    try {
                      const { ensurePublicToken } = await import('@/services/orcamentos.service');
                      const token = await ensurePublicToken(id);
                      window.open(`${window.location.origin}/orcamento-publico?token=${token}`, '_blank');
                    } catch (err: unknown) {
                      notifyError(err);
                    }
                  }}
                >
                  Abrir link público
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMailModalOpen(true)}
                  disabled={!clienteSnapshot.email}
                  title={!clienteSnapshot.email ? "Cliente sem e-mail cadastrado" : undefined}
                >
                  Reenviar por e-mail
                </Button>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p>• Criado em: <span className="text-foreground font-medium">{formatDate(dataOrcamento)}</span></p>
                {validade && <p>• Validade: <span className={`font-medium ${new Date(validade) < new Date(new Date().toDateString()) ? "text-destructive" : "text-foreground"}`}>{formatDate(validade)}</span></p>}
              </div>
            </div>
          )}
        </div>
      </div>


        {/* Footer sticky mobile consolidado — único, acima do MobileBottomNav */}

      {/* Resumo compacto fixo — visível apenas entre md e lg (sem sidebar) */}
      <div
        className="hidden md:flex lg:hidden fixed inset-x-0 z-20 items-center justify-between gap-4 border-t bg-background/95 backdrop-blur px-6 py-3 shadow-[0_-4px_12px_-4px_hsl(var(--border))]"
        style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground">
            {items.filter((i) => i.produto_id).length}{" "}
            {items.filter((i) => i.produto_id).length === 1 ? "item" : "itens"}
          </span>
          {pesoTotal > 0 && (
            <span className="text-muted-foreground">{formatWeightKg(pesoTotal)}</span>
          )}
          {validade && (
            <span className={new Date(validade) < new Date(new Date().toDateString()) ? "text-destructive font-medium" : "text-muted-foreground"}>
              Val. {formatDate(validade)}
            </span>
          )}
        </div>
        <div className="font-bold text-lg font-mono text-primary">
          {formatCurrency(valorTotal)}
        </div>
      </div>

      {(() => {
        const pdfData: OrcamentoPdfData = {
          numero, dataOrcamento, clienteSnapshot, items,
          totalProdutos, desconto, impostoSt, impostoIpi, freteValor, outrasDespesas, valorTotal,
          quantidadeTotal, pesoTotal, pagamento, prazoPagamento, prazoEntrega,
          freteTipo, servicoFrete, modalidade, observacoes, empresaConfig,
        };
        return (
          <>
            <PreviewDialog
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              fullscreen={previewFullscreen}
              onToggleFullscreen={() => setPreviewFullscreen((v) => !v)}
              layout={layoutTemplate}
              onLayoutChange={setLayoutTemplate}
              zoom={previewZoom}
              onZoomChange={setPreviewZoom}
              autoScale={autoScale}
              stageRef={previewStageRef}
              pdfRef={pdfRef}
              data={pdfData}
              onDownloadPdf={handleGeneratePdf}
            />
            <OffscreenPdfTemplate ref={offscreenPdfRef} data={pdfData} layout={layoutTemplate} />
          </>
        );
      })()}

      <EnviarEmailDialog
        open={mailModalOpen}
        onOpenChange={setMailModalOpen}
        mailStep={mailStep}
        setMailStep={setMailStep}
        mailError={mailError}
        setMailError={setMailError}
        emailTemplate={emailTemplate}
        setEmailTemplate={setEmailTemplate}
        clienteSnapshot={clienteSnapshot}
        orcamentoId={id ?? null}
        numero={numero}
        validade={validade}
        valorTotal={valorTotal}
        buildPdfBlob={buildPdfBlob}
      />

      {/* (footer mobile único renderizado abaixo) */}

      <RestoreDraftDialog
        open={restoreDraftOpen}
        onOpenChange={setRestoreDraftOpen}
        draftKey={draftKey}
        userId={user?.id}
        applyDraft={(payload) => applyDraft(payload as Parameters<typeof applyDraft>[0])}
      />

      <QuickAddClientModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async (newId) => {
          // Invalida o cache de clientes ativos para refletir o novo cadastro.
          await queryClient.invalidateQueries({ queryKey: ["orcamento-form", "clientes-ativos"] });
          handleClienteChange(newId);
        }}
      />

      <TemplateSaveDialog
        open={templateDialogOpen}
        onOpenChange={(open) => !open && setTemplateDialogOpen(null)}
        name={templateName}
        onNameChange={setTemplateName}
        onConfirm={saveTemplate}
      />

      {confirmActionDialog}

      <MobileStickyFooter
        items={items}
        valorTotal={valorTotal}
        saving={saving}
        onSave={handleSave}
        onPreview={() => setPreviewOpen(true)}
        onGeneratePdf={handleGeneratePdf}
      />
    </PageShell>
  );
}
