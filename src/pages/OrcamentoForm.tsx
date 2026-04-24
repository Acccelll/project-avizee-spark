import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { orcamentoSchema, type OrcamentoFormValues } from "@/lib/orcamentoSchema";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { OrcamentoItemsGrid, type OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import { OrcamentoInternalAnalysisPanel, type RentabilidadeScenarioConfig } from "@/components/Orcamento/OrcamentoInternalAnalysisPanel";
import { OrcamentoTotaisCard } from "@/components/Orcamento/OrcamentoTotaisCard";
import { OrcamentoCondicoesCard } from "@/components/Orcamento/OrcamentoCondicoesCard";
import { FreteSimuladorCard } from "@/components/Orcamento/FreteSimuladorCard";
import type { FreteSelecaoPayload } from "@/services/freteSimulacao.service";
import { OrcamentoSidebarSummary } from "@/components/Orcamento/OrcamentoSidebarSummary";
import { OrcamentoPdfTemplate } from "@/components/Orcamento/OrcamentoPdfTemplate";
import { OrcamentoPdfTemplateBrand } from "@/components/Orcamento/OrcamentoPdfTemplateBrand";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Eye, FileText, Copy, Plus, Search, Wand2, RefreshCw, CheckCircle2, AlertTriangle, CalendarDays, Clock, MoreHorizontal, LayoutTemplate, Mail, ChevronDown, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { JustCreatedBanner } from "@/components/JustCreatedBanner";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import { ClientSelector, type ProductWithForn } from "@/components/ui/DataSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { TemplateConfig } from "@/types/orcamento";
import { calcularRentabilidade, type InternalCostCandidate } from "@/lib/orcamentoRentabilidade";
import { getOrcamentoInternalAccess } from "@/lib/orcamentoInternalAccess";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useOrcamentoTemplates, type OrcamentoTemplate } from "@/pages/comercial/hooks/useOrcamentoTemplates";

interface ClienteSnapshot {
  nome_razao_social: string; nome_fantasia: string; cpf_cnpj: string;
  inscricao_estadual: string; email: string; telefone: string; celular: string;
  contato: string; logradouro: string; numero: string; bairro: string;
  cidade: string; uf: string; cep: string; codigo: string;
}

/** Payload para o parâmetro p_payload da RPC salvar_orcamento. */
interface SalvarOrcamentoPayload {
  numero: string;
  data_orcamento: string;
  status: string;
  cliente_id: string | null;
  validade: string | null;
  observacoes: string;
  observacoes_internas: string | null;
  desconto: number;
  imposto_st: number;
  imposto_ipi: number;
  frete_valor: number;
  outras_despesas: number;
  valor_total: number;
  quantidade_total: number;
  peso_total: number;
  pagamento: string;
  prazo_pagamento: string;
  prazo_entrega: string;
  frete_tipo: string;
  modalidade: string;
  cliente_snapshot: ClienteSnapshot;
  transportadora_id: string | null;
  frete_simulacao_id: string | null;
  origem_frete: string | null;
  servico_frete: string | null;
  prazo_entrega_dias: number | null;
  volumes: number | null;
  altura_cm: number | null;
  largura_cm: number | null;
  comprimento_cm: number | null;
}

/** Payload para cada item no parâmetro p_itens da RPC salvar_orcamento. */
interface SalvarOrcamentoItemPayload {
  produto_id: string | null;
  codigo_snapshot: string;
  descricao_snapshot: string;
  variacao: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  peso_unitario: number;
  peso_total: number;
}


const emptyCliente: ClienteSnapshot = {
  nome_razao_social: "", nome_fantasia: "", cpf_cnpj: "", inscricao_estadual: "",
  email: "", telefone: "", celular: "", contato: "", logradouro: "", numero: "",
  bairro: "", cidade: "", uf: "", cep: "", codigo: "",
};

export default function OrcamentoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pdfRef = useRef<HTMLDivElement>(null);
  const isEdit = !!id;
  const isMobile = useIsMobile();
  const { user, roles, extraPermissions } = useAuth();

  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(searchParams.get("preview") === "1");
  const [clientes, setClientes] = useState<Tables<"clientes">[]>([]);
  const [produtos, setProdutos] = useState<ProductWithForn[]>([]);
  const [precosEspeciais, setPrecosEspeciais] = useState<Tables<"precos_especiais">[]>([]);
  const [clienteSnapshot, setClienteSnapshot] = useState<ClienteSnapshot>(emptyCliente);
  const [items, setItems] = useState<OrcamentoItem[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [restoreDraftOpen, setRestoreDraftOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState<null | "usuario" | "equipe">(null);
  const [layoutTemplate, setLayoutTemplate] = useState<'classico' | 'marca'>('marca');
  const [previewZoom, setPreviewZoom] = useState<number>(0); // 0 = auto-fit
  const previewStageRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState<number>(1);
  const { confirm: confirmAction, dialog: confirmActionDialog } = useConfirmDialog();

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
  const [simDescontoGeral, setSimDescontoGeral] = useState(0);
  const [simFreteSeguro, setSimFreteSeguro] = useState(0);
  const [simPagamento, setSimPagamento] = useState('');
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState('Olá, segue orçamento atualizado para sua análise.');
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
  const valorSimulado = Math.max(0, valorTotal - simDescontoGeral + simFreteSeguro);
  const quantidadeTotal = items.reduce((sum, i) => sum + (i.quantidade || 0), 0);
  const pesoTotal = items.reduce((sum, i) => sum + (i.peso_total || 0), 0);
  const internalAccess = useMemo(() => getOrcamentoInternalAccess(roles, extraPermissions), [roles, extraPermissions]);

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
    if (!supabase) {
      toast.error("Serviço de banco de dados não disponível. Verifique a configuração.");
      return;
    }
    const loadData = async () => {
      try {
        const [clientesRes, produtosRes] = await Promise.all([
          supabase.from("clientes").select("*").eq("ativo", true).order("nome_razao_social"),
          supabase.from("produtos").select("*, produtos_fornecedores(*, fornecedores(nome_razao_social))").eq("ativo", true).order("nome"),
        ]);
        setClientes(clientesRes.data || []);
        setProdutos(produtosRes.data || []);

        if (isEdit) {
          const { data: orc, error: orcError } = await supabase.from("orcamentos").select("*").eq("id", id).maybeSingle();
          if (orcError) {
            console.error("[OrcamentoForm] erro ao carregar orçamento:", orcError);
            toast.error("Erro ao carregar orçamento.", { description: orcError.message });
          } else if (orc) {
            reset({
              numero: orc.numero,
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
            const { data: itensData } = await supabase.from("orcamentos_itens").select("*").eq("orcamento_id", id);
            if (itensData) setItems(itensData);
          } else {
            toast.error("Orçamento não encontrado.", { description: `Nenhum orçamento com ID ${id}.` });
          }
        } else {
          const { data: novoNumero, error: numErr } = await supabase.rpc('proximo_numero_orcamento');
          if (numErr || !novoNumero) {
            console.error('[OrcamentoForm] proximo_numero_orcamento falhou:', numErr);
            toast.error('Não foi possível gerar o número do orçamento. Tente novamente.');
            return;
          }
          setValue('numero', novoNumero);
        }
      } catch (err: unknown) {
        console.error("[OrcamentoForm] erro ao carregar dados:", err);
        toast.error(getUserFriendlyError(err));
      }
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset/setValue are stable react-hook-form refs
  }, [id, isEdit]);

  const handleClienteChange = useCallback(async (cId: string) => {
    setValue('clienteId', cId);
    const c = clientes.find((cl) => cl.id === cId);
    if (c) {
      setClienteSnapshot({
        nome_razao_social: c.nome_razao_social || "", nome_fantasia: c.nome_fantasia || "",
        cpf_cnpj: c.cpf_cnpj || "", inscricao_estadual: c.inscricao_estadual || "",
        email: c.email || "", telefone: c.telefone || "", celular: c.celular || "",
        contato: c.contato || "", logradouro: c.logradouro || "", numero: c.numero || "",
        bairro: c.bairro || "", cidade: c.cidade || "", uf: c.uf || "",
        cep: c.cep || "", codigo: c.id?.substring(0, 6) || "",
      });
      // Auto-fill payment preferences: prioriza FK forma_pagamento_id (descrição via join);
      // mantém leitura legada de forma_pagamento_padrao como fallback até backfill estar completo.
      if (!pagamento) {
        let descricaoForma: string | null = null;
        if (c.forma_pagamento_id) {
          const { data: fp } = await supabase
            .from("formas_pagamento")
            .select("descricao")
            .eq("id", c.forma_pagamento_id)
            .maybeSingle();
          descricaoForma = fp?.descricao ?? null;
        }
        const fallback = descricaoForma ?? c.forma_pagamento_padrao ?? null;
        if (fallback) setValue('pagamento', fallback);
      }
      if (c.prazo_preferencial && !prazoPagamento) setValue('prazoPagamento', `${c.prazo_preferencial} dias`);
      if (c.prazo_padrao && !prazoPagamento && !c.prazo_preferencial) setValue('prazoPagamento', `${c.prazo_padrao} dias`);

      // Load special prices for this client (only active and within validity period)
      const today = new Date().toISOString().slice(0, 10);
      supabase.from("precos_especiais")
        .select("*")
        .eq("cliente_id", cId)
        .eq("ativo", true)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${today}`)
        .or(`vigencia_inicio.is.null,vigencia_inicio.lte.${today}`)
        .then(({ data }) => {
          const rules = data || [];
          setPrecosEspeciais(rules as Tables<"precos_especiais">[]);

          // Recalculate prices for existing items if they have special prices
          if (items.length > 0) {
            let applied = false;
            const nextItems = items.map(item => {
              if (!item.produto_id) return item;
              const rule = rules.find((r: { produto_id: string }) => r.produto_id === item.produto_id);
              if (rule) {
                const ruleAny = rule as { preco_especial?: number };
                if (ruleAny.preco_especial && Number(ruleAny.preco_especial) > 0) {
                  const newPrice = Number(ruleAny.preco_especial);
                  applied = true;
                  return { ...item, valor_unitario: newPrice, valor_total: item.quantidade * newPrice };
                }
              }
              return item;
            });
            setItems(nextItems);
            if (applied) {
              toast.info("Preços recalculados com base nas regras do cliente selecionado");
            }
          }
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

  const applyDraft = (draft: Record<string, unknown>) => {
    reset({
      numero: (draft.numero as string) || '',
      dataOrcamento: (draft.dataOrcamento as string) || new Date().toISOString().split('T')[0],
      status: ((draft.status as OrcamentoFormValues['status']) || 'rascunho'),
      clienteId: (draft.clienteId as string) || '',
      validade: (draft.validade as string) || '',
      desconto: Number(draft.desconto) || 0,
      impostoSt: Number(draft.impostoSt) || 0,
      impostoIpi: Number(draft.impostoIpi) || 0,
      freteValor: Number(draft.freteValor) || 0,
      outrasDespesas: Number(draft.outrasDespesas) || 0,
      pagamento: (draft.pagamento as string) || '',
      prazoPagamento: (draft.prazoPagamento as string) || '',
      prazoEntrega: (draft.prazoEntrega as string) || '',
      freteTipo: (draft.freteTipo as string) || '',
      servicoFrete: (draft.servicoFrete as string) || '',
      modalidade: (draft.modalidade as string) || '',
      observacoes: (draft.observacoes as string) || '',
      observacoesInternas: (draft.observacoesInternas as string) || '',
    });
    setClienteSnapshot((draft.clienteSnapshot as ClienteSnapshot) || emptyCliente);
    setItems((draft.items as OrcamentoItem[]) || []);
  };

  // Templates: estado e persistência isolados em hook (Fase 5 — comercial-modelo).
  const { templates, saveTemplate: persistTemplate } = useOrcamentoTemplates(user?.id);

  const saveTemplate = async (escopo: "usuario" | "equipe") => {
    const payload: TemplateConfig = {
      items,
      pagamento,
      prazoPagamento,
      prazoEntrega,
      modalidade,
      freteTipo: servicoFrete || freteTipo,
      observacoes,
      observacoes_internas: observacoesInternas,
    };
    const ok = await persistTemplate({
      nome: templateName,
      escopo,
      payload,
      onConfirmOverwrite: () =>
        confirmAction({
          title: "Sobrescrever template?",
          description: "Template com este nome já existe. Deseja sobrescrever?",
          confirmLabel: "Sobrescrever",
          confirmVariant: "destructive",
        }),
    });
    if (ok) setTemplateName("");
  };

  const applyTemplate = (tpl: OrcamentoTemplate) => {
    setItems(tpl.payload.items || []);
    setValue('pagamento', tpl.payload.pagamento || '');
    setValue('prazoPagamento', tpl.payload.prazoPagamento || '');
    setValue('prazoEntrega', tpl.payload.prazoEntrega || '');
    setValue('modalidade', tpl.payload.modalidade || '');
    // Templates antigos podem ter texto livre em freteTipo; tratá-lo como servicoFrete.
    if (['CIF','FOB','sem_frete'].includes(tpl.payload.freteTipo || '')) {
      setValue('freteTipo', tpl.payload.freteTipo || '');
    } else {
      setValue('servicoFrete', tpl.payload.freteTipo || '');
    }
    setValue('observacoes', tpl.payload.observacoes || '');
    setValue('observacoesInternas', tpl.payload.observacoes_internas || '');
    toast.success(`Template '${tpl.nome}' aplicado`);
  };

  const buildOrcamentoPayload = (override?: Partial<{ numero: string; status: string; validade: string | null }>) => {
    const formValues = getValues();
    return {
      numero: override?.numero ?? formValues.numero,
      data_orcamento: formValues.dataOrcamento,
      status: override?.status ?? formValues.status,
      cliente_id: formValues.clienteId || null,
      validade: override?.validade !== undefined ? override.validade : (formValues.validade || null),
      observacoes: formValues.observacoes,
      observacoes_internas: formValues.observacoesInternas || null,
      desconto: formValues.desconto,
      imposto_st: formValues.impostoSt,
      imposto_ipi: formValues.impostoIpi,
      frete_valor: formValues.freteValor,
      outras_despesas: formValues.outrasDespesas,
      valor_total: valorTotal,
      quantidade_total: quantidadeTotal,
      peso_total: pesoTotal,
      pagamento: formValues.pagamento,
      prazo_pagamento: formValues.prazoPagamento,
      prazo_entrega: formValues.prazoEntrega,
      // frete_tipo aceita só CIF/FOB/sem_frete; texto livre vai para servico_frete.
      frete_tipo: ['CIF','FOB','sem_frete'].includes(formValues.freteTipo || '') ? formValues.freteTipo : (formValues.modalidade || ''),
      modalidade: formValues.modalidade,
      cliente_snapshot: clienteSnapshot,
      transportadora_id: freteTransportadoraId || null,
      frete_simulacao_id: freteSimulacaoId || null,
      origem_frete: freteOrigemFrete || null,
      servico_frete: formValues.servicoFrete || freteServico || null,
      prazo_entrega_dias: fretePrazoEntregaDias || null,
      volumes: freteVolumes || null,
      altura_cm: freteAlturaCm || null,
      largura_cm: freteLarguraCm || null,
      comprimento_cm: freteComprimentoCm || null,
    };
  };

  const handleSave = async () => {
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

    // Verificar itens não vinculados (importados sem produto_id)
    const unlinkedItems = items.filter(i => i._unlinked || (!i.produto_id && (i.codigo_snapshot || i.descricao_snapshot)));
    if (unlinkedItems.length > 0) {
      toast.error(
        `Existem ${unlinkedItems.length} item(ns) não vinculado(s).`,
        { description: "Vincule ou remova os itens marcados em vermelho antes de salvar." },
      );
      return;
    }

    // Exigir pelo menos um item válido
    const validItems = items.filter(i => i.produto_id);
    if (validItems.length === 0) {
      toast.error("Adicione ao menos um item ao orçamento antes de salvar.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildOrcamentoPayload();

      const itemsPayload = validItems.map(i => ({
        produto_id: i.produto_id, codigo_snapshot: i.codigo_snapshot,
        descricao_snapshot: i.descricao_snapshot, variacao: i.variacao || null,
        quantidade: i.quantidade, unidade: i.unidade, valor_unitario: i.valor_unitario,
        valor_total: i.valor_total, peso_unitario: i.peso_unitario || 0, peso_total: i.peso_total || 0,
      }));

      const { data: orcId, error } = await supabase.rpc('salvar_orcamento', {
        p_id: isEdit ? id : null,
        p_payload: payload as unknown as never,
        p_itens: itemsPayload as unknown as never,
      });
      if (error) throw error;

      localStorage.removeItem(draftKey);
      if (user?.id) {
        try {
          await supabase.from("orcamento_drafts")
            .delete()
            .eq("usuario_id", user.id)
            .eq("draft_key", draftKey);
        } catch {/* ignore */}
      }
      toast.success(isEdit ? "Orçamento atualizado com sucesso" : "Orçamento criado com sucesso", {
        description: `Registro ${payload.numero} salvo.`,
        action: { label: "Visualizar", onClick: () => navigate(orcId ? `/orcamentos/${orcId}` : "/orcamentos") },
      });
      if (!isEdit && orcId) navigate(`/orcamentos/${orcId}?created=1`, { replace: true });
    } catch (err: unknown) {
      console.error('[orcamento]', err);
      toast.error(getUserFriendlyError(err));
    }
    setSaving(false);
  };

  const handleDuplicate = async () => {
    if (!id) { toast.error("Salve o orçamento antes de duplicar"); return; }
    const unlinkedItems = items.filter(i => i._unlinked || (!i.produto_id && (i.codigo_snapshot || i.descricao_snapshot)));
    if (unlinkedItems.length > 0) {
      toast.error(
        `Existem ${unlinkedItems.length} item(ns) não vinculado(s).`,
        { description: "Vincule ou remova os itens marcados em vermelho antes de duplicar." },
      );
      return;
    }
    const validItems = items.filter(i => i.produto_id);
    if (validItems.length === 0) {
      toast.error("Adicione ao menos um item ao orçamento antes de duplicar.");
      return;
    }
    try {
      const { data: newNumero, error: numErr } = await supabase.rpc('proximo_numero_orcamento');
      if (numErr || !newNumero) {
        console.error('[orcamento] duplicar — proximo_numero_orcamento falhou:', numErr);
        toast.error('Não foi possível gerar o número do orçamento. Tente novamente.');
        return;
      }
      // Compartilha a forma do payload com `handleSave` via override.
      const payload = buildOrcamentoPayload({
        numero: newNumero,
        status: "rascunho",
        validade: null,
      });

      const itemsPayload = validItems.map(i => ({
        produto_id: i.produto_id, codigo_snapshot: i.codigo_snapshot,
        descricao_snapshot: i.descricao_snapshot, variacao: i.variacao || null,
        quantidade: i.quantidade, unidade: i.unidade, valor_unitario: i.valor_unitario,
        valor_total: i.valor_total, peso_unitario: i.peso_unitario || 0, peso_total: i.peso_total || 0,
      }));

      const { data: orcId, error } = await supabase.rpc('salvar_orcamento', {
        p_id: null,
        p_payload: payload as unknown as never,
        p_itens: itemsPayload as unknown as never,
      });
      if (error) throw error;

      toast.success(`Duplicado: ${payload.numero}`);
      navigate(`/orcamentos/${orcId}`, { replace: true });
    } catch (err: unknown) {
      console.error('[orcamento] duplicar:', err);
      toast.error(getUserFriendlyError(err));
    }
  };

  const handleGeneratePdf = async () => {
    setPreviewOpen(true);
    // Aguardar a renderização do preview antes de capturar o PDF.
    const capture = async () => {
      if (!pdfRef.current) return;
      try {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);
        const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, backgroundColor: "#fff" });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        const safeCliente = (clienteSnapshot.nome_razao_social || "CLIENTE")
          .toUpperCase()
          .replace(/[\\/:*?"<>|]/g, "")
          .trim();
        pdf.save(`${numero || "ORCAMENTO"} - ${safeCliente}.pdf`);
        toast.success("PDF gerado com sucesso!");
      } catch (err: unknown) {
        toast.error(getUserFriendlyError(err));
      }
    };
    // Usar requestAnimationFrame duplo para garantir que o DOM foi pintado antes da captura.
    requestAnimationFrame(() => requestAnimationFrame(() => { capture(); }));
  };

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
        const { data } = await supabase
          .from("orcamento_drafts")
          .select("payload")
          .eq("usuario_id", user.id)
          .eq("draft_key", draftKey)
          .maybeSingle();
        if (cancelled) return;
        if (data?.payload) { setRestoreDraftOpen(true); return; }
      }
      const saved = localStorage.getItem(draftKey);
      if (!cancelled && saved) setRestoreDraftOpen(true);
    })();
    return () => { cancelled = true; };
  }, [draftKey, isEdit, user?.id]);

  // Autosave: tenta servidor (orcamento_drafts), com fallback para localStorage em caso de erro.
  useEffect(() => {
    const timer = setInterval(async () => {
      const { numero: n, clienteId: cid } = getValues();
      if (!n && !cid && items.length === 0) return;
      const payload = buildDraftPayload();
      const serialized = JSON.stringify(payload);
      let serverOk = false;
      if (user?.id) {
        try {
          const { error } = await supabase
            .from("orcamento_drafts")
            .upsert(
              { usuario_id: user.id, draft_key: draftKey, payload: payload as unknown as Json },
              { onConflict: "usuario_id,draft_key" },
            );
          if (!error) serverOk = true;
        } catch {/* fallback abaixo */}
      }
      if (!serverOk) {
        try { localStorage.setItem(draftKey, serialized); } catch {/* quota */}
      }
      setLastAutoSaveAt(new Date().toISOString());
    }, 30000);
    return () => clearInterval(timer);
  }, [buildDraftPayload, draftKey, getValues, items.length, user?.id]);

  useEffect(() => {
    supabase.from('empresa_config').select('*').limit(1).single().then(({ data }) => {
      if (data) setEmpresaConfig(data as unknown as Record<string, string>);
    });
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
      title={isEdit ? `Editando Orçamento${numero ? ` — ${numero}` : ""}` : "Novo Orçamento"}
      subtitle={isEdit ? "Revisão e ajuste da proposta comercial" : "Criação e emissão da proposta comercial"}
      actions={
        <>
        {/* Mobile: Salvar + menu "Mais" */}
        <div className="flex items-center gap-2 md:hidden">
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" aria-label="Mais ações">
                <MoreHorizontal className="w-4 h-4" />
                <span>Mais</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
                <Eye className="w-4 h-4 mr-2" />Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleGeneratePdf}>
                <FileText className="w-4 h-4 mr-2" />Gerar PDF
              </DropdownMenuItem>
              {templates.length > 0 && <DropdownMenuSeparator />}
              {templates.length > 0 && <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Templates</DropdownMenuLabel>}
              {templates.slice(0, 5).map((tpl) => (
                <DropdownMenuItem key={tpl.id} onSelect={() => applyTemplate(tpl)}>
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  <span className="truncate">{tpl.nome}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { setTemplateName(''); setTemplateDialogOpen('usuario'); }}>
                <Wand2 className="w-4 h-4 mr-2" />Salvar como meu template
              </DropdownMenuItem>
              {isEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleDuplicate}>
                    <Copy className="w-4 h-4 mr-2" />Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setMailModalOpen(true)} disabled={!clienteSnapshot.email}>
                    <Mail className="w-4 h-4 mr-2" />Reenviar por e-mail
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="hidden items-center gap-2 md:flex md:flex-wrap">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : isEdit && status !== "rascunho" ? "Salvar" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2"><Eye className="w-4 h-4" />Visualizar</Button>
          <Button variant="secondary" onClick={handleGeneratePdf} className="gap-2"><FileText className="w-4 h-4" />Gerar PDF</Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1.5">
                <LayoutTemplate className="w-4 h-4" />Templates<ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Aplicar template</DropdownMenuLabel>
              {templates.length === 0 && (
                <DropdownMenuItem disabled>Nenhum template salvo</DropdownMenuItem>
              )}
              {templates.map((tpl) => (
                <DropdownMenuItem key={tpl.id} onClick={() => applyTemplate(tpl)}>
                  <span className="truncate">{tpl.nome}</span>
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">{tpl.escopo}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { setTemplateName(''); setTemplateDialogOpen('usuario'); }}>
                <Wand2 className="w-4 h-4 mr-2" />Salvar como meu…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setTemplateName(''); setTemplateDialogOpen('equipe'); }}>
                <Wand2 className="w-4 h-4 mr-2" />Compartilhar com equipe…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {(isEdit) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais ações"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDuplicate}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMailModalOpen(true)} disabled={!clienteSnapshot.email}>
                  <Mail className="w-4 h-4 mr-2" />Reenviar por e-mail
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        </>
      }
      meta={
        <>
          {isEdit && numero && (
            <JustCreatedBanner
              message={`Orçamento ${numero} criado. Adicione itens para concluir a proposta.`}
              ctaLabel="Ir para itens"
              onCta={() => document.getElementById("orcamento-itens")?.scrollIntoView({ behavior: "smooth" })}
            />
          )}
          {/* Edit-mode context banner — desktop */}
          {isEdit && (
            <div className="hidden md:flex items-center flex-wrap gap-x-6 gap-y-2 rounded-xl border bg-card/60 px-5 py-3 text-sm shadow-soft">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Orçamento</span>
                <span className="font-mono font-bold text-primary">{numero || "—"}</span>
              </div>
              {clienteSnapshot.nome_razao_social && (
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cliente</span>
                  <span className="font-medium truncate max-w-[200px]">{clienteSnapshot.nome_razao_social}</span>
                </div>
              )}
              <StatusBadge status={status} />
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Emissão: <span className="text-foreground font-medium">{formatDate(dataOrcamento)}</span></span>
              </div>
              {validade && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Validade: <span className={`font-medium ${new Date(validade) < new Date(new Date().toDateString()) ? "text-destructive" : "text-foreground"}`}>{formatDate(validade)}</span></span>
                </div>
              )}
              {lastAutoSaveAt && (
                <div className="text-xs text-muted-foreground">
                  Autosave às {new Date(lastAutoSaveAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              <div className="ml-auto font-bold text-base text-primary font-mono">{formatCurrency(valorTotal)}</div>
            </div>
          )}

          {isMobile && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Orçamento</p>
                <p className="mt-1 font-mono text-sm font-semibold">{numero || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                <p className="mt-1 text-base font-semibold">{formatCurrency(valorTotal)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                <p className="mt-1 truncate text-sm">{clienteSnapshot.nome_razao_social || 'Selecione um cliente'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Itens</p>
                <p className="mt-1 text-sm">{items.filter(i => i.produto_id).length} item(ns)</p>
              </div>
              {isEdit && (
                <div className="col-span-2 flex items-center gap-2 pt-1 border-t">
                  <StatusBadge status={status} />
                  {validade && <span className="text-xs text-muted-foreground">Válido até {formatDate(validade)}</span>}
                </div>
              )}
            </div>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 pb-24 md:pb-0">
        <div className="lg:col-span-8 space-y-5">
          {/* Identificação do Orçamento */}
          <div className="bg-card rounded-xl border shadow-soft p-5">
            <h3 className="font-semibold text-foreground mb-4">Identificação do Orçamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nº Orçamento</Label>
                <div className="relative">
                  <Input
                    {...register('numero')}
                    className={`font-mono pr-8 ${fieldErrors.numero ? "border-destructive" : numero ? "border-success" : ""}`}
                  />
                  {numero && !fieldErrors.numero && <CheckCircle2 className="h-4 w-4 text-success absolute right-2 top-1/2 -translate-y-1/2" />}
                  {fieldErrors.numero && <AlertTriangle className="h-4 w-4 text-destructive absolute right-2 top-1/2 -translate-y-1/2" />}
                </div>
                {fieldErrors.numero && <p className="text-[11px] text-destructive">{fieldErrors.numero.message}</p>}
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Data de Emissão</Label><Input type="date" {...register('dataOrcamento')} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rascunho">Rascunho</SelectItem>
                        <SelectItem value="pendente">Aguardando Aprovação</SelectItem>
                        <SelectItem value="aprovado">Aprovado</SelectItem>
                        <SelectItem value="convertido">Convertido em Pedido</SelectItem>
                        <SelectItem value="rejeitado">Rejeitado</SelectItem>
                        <SelectItem value="expirado">Expirado</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-[11px] text-muted-foreground">Fluxo: Rascunho → Aguardando aprovação → Aprovado → Convertido em pedido</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Validade</Label>
                <Input type="date" {...register('validade')} />
                <p className="text-[11px] text-muted-foreground">Data limite para o cliente aceitar.</p>
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="bg-card rounded-xl border shadow-soft p-5">
            <h3 className="font-semibold text-foreground mb-4">Cliente</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs">Buscar Cliente</Label>
                  <div className="flex gap-2">
                    <AutocompleteSearch
                      options={clienteOptions}
                      value={clienteId}
                      onChange={handleClienteChange}
                      placeholder="Buscar por nome ou CNPJ..."
                      className="flex-1"
                      onCreateNew={() => setQuickAddOpen(true)}
                      createNewLabel="Cadastrar novo cliente"
                    />
                    {clienteId && !fieldErrors.clienteId && <CheckCircle2 className="h-4 w-4 text-success mt-3" />}
                    <ClientSelector
                      clientes={clientes}
                      onSelect={(c) => handleClienteChange(c.id)}
                      trigger={
                        <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Ver lista completa">
                          <Search className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setQuickAddOpen(true)} title="Cadastrar novo cliente">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Código</Label><Input value={clienteSnapshot.codigo} readOnly className="bg-accent/30 font-mono text-xs" /></div>
              </div>
              {fieldErrors.clienteId && <p className="text-[11px] text-destructive">{fieldErrors.clienteId.message}</p>}
              {clienteId && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm bg-accent/20 rounded-lg p-3">
                  <div className="md:col-span-2 space-y-0.5"><Label className="text-xs text-muted-foreground">Razão Social</Label><p className="font-medium text-sm leading-tight">{clienteSnapshot.nome_razao_social}</p></div>
                  <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">CNPJ/CPF</Label><p className="font-mono text-xs">{clienteSnapshot.cpf_cnpj || "—"}</p></div>
                  <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Cidade/UF</Label><p className="text-sm">{clienteSnapshot.cidade ? `${clienteSnapshot.cidade}/${clienteSnapshot.uf}` : "—"}</p></div>
                  {clienteSnapshot.email && <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Email</Label><p className="text-xs truncate">{clienteSnapshot.email}</p></div>}
                  {clienteSnapshot.telefone && <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Telefone</Label><p className="text-xs">{clienteSnapshot.telefone}</p></div>}
                </div>
              )}
              {clienteId && (clienteSnapshot.logradouro || clienteSnapshot.bairro || clienteSnapshot.cep) && (
                <div className="rounded-lg border border-dashed bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Endereço</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="md:col-span-2 space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Logradouro</Label>
                      <p className="text-sm leading-tight">{clienteSnapshot.logradouro || "—"}{clienteSnapshot.numero ? `, ${clienteSnapshot.numero}` : ""}</p>
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Bairro</Label>
                      <p className="text-sm">{clienteSnapshot.bairro || "—"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">CEP</Label>
                      <p className="font-mono text-xs">{clienteSnapshot.cep || "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <OrcamentoItemsGrid
            items={items}
            onChange={setItems}
            produtos={produtos}
            precosEspeciais={precosEspeciais}
          />

          <OrcamentoInternalAnalysisPanel
            baseAnalysis={baseAnalysis}
            scenarioAnalysis={scenarioAnalysis}
            items={items}
            onItemsChange={setItems}
            scenarioConfig={scenarioConfig}
            onScenarioConfigChange={setScenarioConfig}
            access={internalAccess}
          />

          <OrcamentoTotaisCard
            totalProdutos={totalProdutos}
            pesoTotal={pesoTotal}
            form={{ valor_total: valorTotal, desconto, imposto_st: impostoSt, imposto_ipi: impostoIpi, frete_valor: freteValor, outras_despesas: outrasDespesas }}
            onChange={handleTotalChange}
          />

          <FreteSimuladorCard
            orcamentoId={id || null}
            clienteId={clienteId}
            cepDestino={clienteSnapshot.cep}
            pesoTotal={pesoTotal}
            valorMercadoria={totalProdutos}
            simulacaoId={freteSimulacaoId}
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

          <OrcamentoCondicoesCard
            form={{ quantidade_total: quantidadeTotal, peso_total: pesoTotal, pagamento, prazo_pagamento: prazoPagamento, prazo_entrega: prazoEntrega, servico_frete: servicoFrete || '', modalidade }}
            onChange={handleCondicaoChange}
          />

          <div className="bg-card rounded-xl border shadow-soft p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Observações do Orçamento</h3>
              <Textarea {...register('observacoes')}
                placeholder="Texto livre para observações comerciais, instruções, validade, condições extras, etc."
                className="min-h-[100px]" />
              <p className="text-xs text-muted-foreground mt-1.5">✓ Este texto <strong>aparecerá</strong> no PDF e no link enviado ao cliente.</p>
            </div>
            <div className="border-t pt-4">
              <h3 className="font-semibold text-foreground mb-1">Observações Internas</h3>
              <p className="text-xs text-muted-foreground mb-2">🔒 Uso exclusivo da equipe — <strong>não aparece</strong> para o cliente, no PDF nem no link público.</p>
              <Textarea {...register('observacoesInternas')}
                placeholder="Notas internas: margem, estratégia de negociação, alertas para a equipe, etc."
                className="min-h-[80px] border-dashed" />
            </div>
          </div>
        </div>

        <div className="hidden lg:col-span-4 lg:block">
          <OrcamentoSidebarSummary
            status={status} numero={numero} clienteNome={clienteSnapshot.nome_razao_social}
            qtdItens={items.filter(i => i.produto_id).length} totalProdutos={totalProdutos}
            freteValor={freteValor} valorTotal={valorTotal}
            pesoTotal={pesoTotal} validade={validade} isEdit={isEdit}
            onSave={handleSave} onPreview={() => setPreviewOpen(true)}
            onGeneratePdf={handleGeneratePdf} saving={saving}
          />
          <div className="mt-4 rounded-xl border bg-card p-4 space-y-3">
            <h4 className="font-semibold">Simulador de Condições</h4>
            <div className="space-y-2">
              <Label className="text-xs">Desconto geral adicional</Label>
              <Input type="number" value={simDescontoGeral} onChange={(e) => setSimDescontoGeral(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Acréscimo frete/seguro</Label>
              <Input type="number" value={simFreteSeguro} onChange={(e) => setSimFreteSeguro(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Forma de pagamento simulada</Label>
              <Input value={simPagamento} onChange={(e) => setSimPagamento(e.target.value)} placeholder="Ex.: 30/60/90" />
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p>Total atual: <strong>{formatCurrency(valorTotal)}</strong></p>
              <p>Total simulado: <strong>{formatCurrency(valorSimulado)}</strong></p>
            </div>
          </div>
          {isEdit && (
            <div className="mt-4 rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Ações Comerciais</h4>
                <Button variant="outline" size="sm" onClick={() => setMailModalOpen(true)}>Reenviar por e-mail</Button>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p>• Criado em: <span className="text-foreground font-medium">{formatDate(dataOrcamento)}</span></p>
                {validade && <p>• Validade: <span className={`font-medium ${new Date(validade) < new Date(new Date().toDateString()) ? "text-destructive" : "text-foreground"}`}>{formatDate(validade)}</span></p>}
                <p className="text-xs mt-2">Use "Reenviar por e-mail" para notificar o cliente sobre este orçamento.</p>
              </div>
            </div>
          )}
        </div>
      </div>


        {isMobile && (
          <>
            {/* Spacer para evitar que o footer sticky cubra conteúdo final */}
            <div aria-hidden className="h-32 lg:hidden" />
            {/* Footer sticky mobile — Total + Salvar sempre visíveis */}
            <div
              className={cn(
                "fixed inset-x-0 bottom-0 z-40 lg:hidden",
                "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80",
                "border-t shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)]",
                "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              )}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-primary font-mono leading-tight truncate">
                    {formatCurrency(valorTotal)}
                  </p>
                </div>
                <div className="text-right text-[11px] text-muted-foreground leading-tight">
                  <p>{items.filter(i => i.produto_id).length} item(ns)</p>
                  {pesoTotal > 0 && <p>{pesoTotal.toFixed(2)} kg</p>}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <Button onClick={handleSave} disabled={saving} className="h-11 gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setPreviewOpen(true)} className="h-11 w-11" aria-label="Visualizar">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="secondary" size="icon" onClick={handleGeneratePdf} className="h-11 w-11" aria-label="Gerar PDF">
                  <FileText className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[1100px] w-[95vw] max-h-[95vh] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Pré-visualização do Orçamento</DialogTitle>
            <DialogDescription>Visualize como o orçamento será impresso ou enviado ao cliente.</DialogDescription>
          </DialogHeader>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-card">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <h3 className="font-semibold text-sm truncate">Pré-visualização — {(numero || "").replace(/^ORC/i, "ORC ")}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Select value={layoutTemplate} onValueChange={(v: 'classico' | 'marca') => setLayoutTemplate(v)}>
                <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marca">Marca AviZee</SelectItem>
                  <SelectItem value="classico">Clássico (laranja)</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-0.5 border rounded-md h-8 px-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom((z) => Math.max(0.4, (z || autoScale) - 0.1))} aria-label="Diminuir zoom">
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <button type="button" onClick={() => setPreviewZoom(0)} className="text-[11px] tabular-nums px-1.5 min-w-[42px] text-center hover:text-primary" title="Ajustar à tela">
                  {Math.round((previewZoom || autoScale) * 100)}%
                </button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom((z) => Math.min(2, (z || autoScale) + 0.1))} aria-label="Aumentar zoom">
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom(0)} aria-label="Ajustar">
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen(false)} className="h-8">Fechar</Button>
              <Button size="sm" onClick={handleGeneratePdf} className="gap-1.5 h-8"><FileText className="w-3.5 h-3.5" />Baixar PDF</Button>
            </div>
          </div>
          {/* Stage A4 com auto-fit */}
          <div ref={previewStageRef} className="flex-1 overflow-auto bg-muted/40 p-6">
            <div
              className="mx-auto bg-white shadow-2xl"
              style={{
                width: "210mm",
                transform: `scale(${previewZoom || autoScale})`,
                transformOrigin: "top center",
                marginBottom: `calc(297mm * ${(previewZoom || autoScale) - 1} * -1)`,
              }}
            >
              {layoutTemplate === 'marca' ? (
                <OrcamentoPdfTemplateBrand
                  ref={pdfRef} numero={numero} data={dataOrcamento} cliente={clienteSnapshot}
                  items={items.filter(i => i.produto_id)} totalProdutos={totalProdutos}
                  desconto={desconto} impostoSt={impostoSt} impostoIpi={impostoIpi}
                  freteValor={freteValor} outrasDespesas={outrasDespesas} valorTotal={valorTotal}
                  quantidadeTotal={quantidadeTotal} pesoTotal={pesoTotal} pagamento={pagamento}
                  prazoPagamento={prazoPagamento} prazoEntrega={prazoEntrega} freteTipo={freteTipo}
                  modalidade={modalidade} observacoes={observacoes}
                  empresa={empresaConfig || undefined}
                />
              ) : (
                <OrcamentoPdfTemplate
                  ref={pdfRef} numero={numero} data={dataOrcamento} cliente={clienteSnapshot}
                  items={items.filter(i => i.produto_id)} totalProdutos={totalProdutos}
                  desconto={desconto} impostoSt={impostoSt} impostoIpi={impostoIpi}
                  freteValor={freteValor} outrasDespesas={outrasDespesas} valorTotal={valorTotal}
                  quantidadeTotal={quantidadeTotal} pesoTotal={pesoTotal} pagamento={pagamento}
                  prazoPagamento={prazoPagamento} prazoEntrega={prazoEntrega} freteTipo={freteTipo}
                  modalidade={modalidade} observacoes={observacoes}
                  empresa={empresaConfig || undefined}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mailModalOpen} onOpenChange={setMailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reenviar orçamento por e-mail</DialogTitle>
            <DialogDescription>Edite a mensagem antes de enviar.</DialogDescription>
          </DialogHeader>
          {clienteSnapshot.email ? (
            <p className="text-sm text-muted-foreground">Enviando para: <span className="font-medium text-foreground">{clienteSnapshot.email}</span></p>
          ) : (
            <p className="text-sm text-destructive">Cliente não possui e-mail cadastrado.</p>
          )}
          <Textarea value={emailTemplate} onChange={(e) => setEmailTemplate(e.target.value)} className="min-h-32" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMailModalOpen(false)}>Cancelar</Button>
            <Button
              disabled={!clienteSnapshot.email}
              onClick={async () => {
                if (!clienteSnapshot.email || !id) return;
                try {
                  const { enviarOrcamentoPorEmail } = await import('@/services/orcamentos.service');
                  await enviarOrcamentoPorEmail(id, clienteSnapshot.email, emailTemplate);
                  setMailModalOpen(false);
                } catch (err: unknown) {
                  toast.error(getUserFriendlyError(err));
                }
              }}
            >Enviar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {isMobile && (
        <div className="fixed inset-x-0 bottom-[4.9rem] z-30 border-t border-border bg-background/95 px-3 py-3 backdrop-blur md:hidden">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)} className="h-11 rounded-xl text-xs">Preview</Button>
            <Button variant="secondary" onClick={handleGeneratePdf} className="h-11 rounded-xl text-xs">PDF</Button>
            <Button onClick={handleSave} disabled={saving} className="h-11 rounded-xl text-xs">
              {saving ? 'Salvando...' : isEdit && status !== "rascunho" ? 'Salvar Alt.' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}


      <Dialog open={restoreDraftOpen} onOpenChange={setRestoreDraftOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restaurar rascunho não finalizado?</DialogTitle>
            <DialogDescription>Encontramos um rascunho salvo automaticamente para este orçamento.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                localStorage.removeItem(draftKey);
                if (user?.id) {
                  try {
                    await supabase.from("orcamento_drafts")
                      .delete()
                      .eq("usuario_id", user.id)
                      .eq("draft_key", draftKey);
                  } catch {/* ignore */}
                }
                setRestoreDraftOpen(false);
              }}
            >Descartar</Button>
            <Button
              onClick={async () => {
                let payload: unknown = null;
                if (user?.id) {
                  const { data } = await supabase
                    .from("orcamento_drafts")
                    .select("payload")
                    .eq("usuario_id", user.id)
                    .eq("draft_key", draftKey)
                    .maybeSingle();
                  if (data?.payload) payload = data.payload;
                }
                if (!payload) {
                  const raw = localStorage.getItem(draftKey);
                  if (raw) { try { payload = JSON.parse(raw); } catch {/* ignore */} }
                }
                if (payload) applyDraft(payload as Parameters<typeof applyDraft>[0]);
                setRestoreDraftOpen(false);
              }}
              className="gap-2"
            ><RefreshCw className="h-4 w-4" />Restaurar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <QuickAddClientModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async (newId) => {
          // Reload clients list and select the new one
          const { data: freshClientes } = await supabase.from("clientes").select("*").eq("ativo", true).order("nome_razao_social");
          setClientes(freshClientes || []);
          handleClienteChange(newId);
        }}
      />

      <Dialog open={templateDialogOpen !== null} onOpenChange={(open) => !open && setTemplateDialogOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{templateDialogOpen === 'equipe' ? 'Compartilhar template com a equipe' : 'Salvar como meu template'}</DialogTitle>
            <DialogDescription>Dê um nome para identificar este template ao reutilizá-lo em novos orçamentos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tpl-name" className="text-xs">Nome do template</Label>
            <Input
              id="tpl-name"
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex.: Orçamento padrão SP"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTemplateDialogOpen(null)}>Cancelar</Button>
            <Button
              disabled={!templateName.trim()}
              onClick={async () => {
                const escopo = templateDialogOpen!;
                await saveTemplate(escopo);
                setTemplateDialogOpen(null);
              }}
            >Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {confirmActionDialog}

      {/* Footer sticky mobile com Total + Salvar */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t z-40 px-3 py-3 flex items-center justify-between gap-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Total</p>
          <p className="mt-0.5 text-base font-bold text-primary tabular-nums">{formatCurrency(valorTotal)}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="h-11 px-6 gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </PageShell>
  );
}
