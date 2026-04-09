import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { OrcamentoItemsGrid, type OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import { OrcamentoInternalAnalysisPanel, type RentabilidadeScenarioConfig } from "@/components/Orcamento/OrcamentoInternalAnalysisPanel";
import { OrcamentoTotaisCard } from "@/components/Orcamento/OrcamentoTotaisCard";
import { OrcamentoCondicoesCard } from "@/components/Orcamento/OrcamentoCondicoesCard";
import { FreteCorreiosCard } from "@/components/Orcamento/FreteCorreiosCard";
import { OrcamentoSidebarSummary } from "@/components/Orcamento/OrcamentoSidebarSummary";
import { OrcamentoPdfTemplate } from "@/components/Orcamento/OrcamentoPdfTemplate";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, Eye, FileText, Copy, Plus, Search, Wand2, RefreshCw, CheckCircle2, AlertTriangle, CalendarDays, Clock } from "lucide-react";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import { ClientSelector, type ProductWithForn } from "@/components/ui/DataSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { TemplateConfig } from "@/types/orcamento";
import { calcularRentabilidade, type InternalCostCandidate } from "@/lib/orcamentoRentabilidade";
import { getOrcamentoInternalAccess } from "@/lib/orcamentoInternalAccess";

interface ClienteSnapshot {
  nome_razao_social: string; nome_fantasia: string; cpf_cnpj: string;
  inscricao_estadual: string; email: string; telefone: string; celular: string;
  contato: string; logradouro: string; numero: string; bairro: string;
  cidade: string; uf: string; cep: string; codigo: string;
}


const TEAM_TEMPLATE_KEY = "orcamento_template:shared";

interface OrcamentoTemplate {
  id: string;
  nome: string;
  escopo: "usuario" | "equipe";
  payload: TemplateConfig;
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
  const { user, roles } = useAuth();

  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(searchParams.get("preview") === "1");
  const [clientes, setClientes] = useState<Tables<"clientes">[]>([]);
  const [produtos, setProdutos] = useState<ProductWithForn[]>([]);
  const [precosEspeciais, setPrecosEspeciais] = useState<Tables<"precos_especiais">[]>([]);

  const [numero, setNumero] = useState("");
  const [dataOrcamento, setDataOrcamento] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("rascunho");
  const [clienteId, setClienteId] = useState("");
  const [clienteSnapshot, setClienteSnapshot] = useState<ClienteSnapshot>(emptyCliente);
  const [items, setItems] = useState<OrcamentoItem[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [observacoesInternas, setObservacoesInternas] = useState("");
  const [validade, setValidade] = useState("");

  const [desconto, setDesconto] = useState(0);
  const [impostoSt, setImpostoSt] = useState(0);
  const [impostoIpi, setImpostoIpi] = useState(0);
  const [freteValor, setFreteValor] = useState(0);
  const [outrasDespesas, setOutrasDespesas] = useState(0);

  const [pagamento, setPagamento] = useState("");
  const [prazoPagamento, setPrazoPagamento] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [freteTipo, setFreteTipo] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [restoreDraftOpen, setRestoreDraftOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<OrcamentoTemplate[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{ numero?: string; clienteId?: string }>({});
  const [layoutTemplate, setLayoutTemplate] = useState<'simples' | 'completo' | 'logo'>('completo');
  const [simDescontoGeral, setSimDescontoGeral] = useState(0);
  const [simFreteSeguro, setSimFreteSeguro] = useState(0);
  const [simPagamento, setSimPagamento] = useState('');
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState('Olá, segue orçamento atualizado para sua análise.');
  const [empresaConfig, setEmpresaConfig] = useState<Record<string, string> | null>(null);
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
  const internalAccess = useMemo(() => getOrcamentoInternalAccess(roles), [roles]);

  const productCostMap = useMemo(() => {
    const map = new Map<string, InternalCostCandidate>();
    for (const product of produtos) {
      const fornecedores = product.produtos_fornecedores || [];
      const lastPurchase = [...fornecedores]
        .filter((row) => row.preco_compra && Number(row.preco_compra) > 0)
        .sort((a, b) => {
          const dateA = a.ultima_compra ? new Date(a.ultima_compra).getTime() : 0;
          const dateB = b.ultima_compra ? new Date(b.ultima_compra).getTime() : 0;
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
            console.error("[OrcamentoForm] erro ao carregar cotação:", orcError);
            toast.error("Erro ao carregar cotação.", { description: orcError.message });
          } else if (orc) {
            setNumero(orc.numero); setDataOrcamento(orc.data_orcamento); setStatus(orc.status);
            setClienteId(orc.cliente_id || ""); setObservacoes(orc.observacoes || "");
            setObservacoesInternas(orc.observacoes_internas || "");
            setValidade(orc.validade || ""); setDesconto(orc.desconto || 0);
            setImpostoSt(orc.imposto_st || 0); setImpostoIpi(orc.imposto_ipi || 0);
            setFreteValor(orc.frete_valor || 0); setOutrasDespesas(orc.outras_despesas || 0);
            setPagamento(orc.pagamento || ""); setPrazoPagamento(orc.prazo_pagamento || "");
            setPrazoEntrega(orc.prazo_entrega || ""); setFreteTipo(orc.frete_tipo || "");
            setModalidade(orc.modalidade || "");
            if (orc.cliente_snapshot) setClienteSnapshot(orc.cliente_snapshot as any);
            const { data: itensData } = await supabase.from("orcamentos_itens").select("*").eq("orcamento_id", id);
            if (itensData) setItems(itensData);
          } else {
            toast.error("Cotação não encontrada.", { description: `Nenhuma cotação com ID ${id}.` });
          }
        } else {
          const { count } = await supabase.from("orcamentos").select("*", { count: "exact", head: true });
          setNumero(`COT${String((count || 0) + 1).padStart(6, "0")}`);
        }
      } catch (err) {
        console.error("[OrcamentoForm] erro ao carregar dados:", err);
        toast.error("Erro ao carregar dados da cotação.", { description: "Verifique a conexão e tente novamente." });
      }
    };
    loadData();
  }, [id, isEdit]);

  const handleClienteChange = useCallback((cId: string) => {
    setClienteId(cId);
    const c = clientes.find((cl: any) => cl.id === cId);
    if (c) {
      setClienteSnapshot({
        nome_razao_social: c.nome_razao_social || "", nome_fantasia: c.nome_fantasia || "",
        cpf_cnpj: c.cpf_cnpj || "", inscricao_estadual: c.inscricao_estadual || "",
        email: c.email || "", telefone: c.telefone || "", celular: c.celular || "",
        contato: c.contato || "", logradouro: c.logradouro || "", numero: c.numero || "",
        bairro: c.bairro || "", cidade: c.cidade || "", uf: c.uf || "",
        cep: c.cep || "", codigo: c.id?.substring(0, 6) || "",
      });
      // Auto-fill payment preferences from client
      if (c.forma_pagamento_padrao && !pagamento) setPagamento(c.forma_pagamento_padrao);
      if (c.prazo_preferencial && !prazoPagamento) setPrazoPagamento(`${c.prazo_preferencial} dias`);
      if (c.prazo_padrao && !prazoPagamento && !c.prazo_preferencial) setPrazoPagamento(`${c.prazo_padrao} dias`);

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
          setPrecosEspeciais(rules);

          // Recalculate prices for existing items if they have special prices
          if (items.length > 0) {
            let applied = false;
            const nextItems = items.map(item => {
              if (!item.produto_id) return item;
              const rule = rules.find(r => r.produto_id === item.produto_id);
              if (rule) {
                let newPrice: number;
                if (rule.preco_especial && Number(rule.preco_especial) > 0) {
                  newPrice = Number(rule.preco_especial);
                } else {
                  return item;
                }
                applied = true;
                return { ...item, valor_unitario: newPrice, valor_total: item.quantidade * newPrice };
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
  }, [clientes, pagamento, prazoPagamento]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next: { numero?: string; clienteId?: string } = {};
      if (!numero.trim()) next.numero = "Informe o número da cotação.";
      if (!clienteId) next.clienteId = "Selecione um cliente.";
      setFieldErrors(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [numero, clienteId]);


  const buildDraftPayload = useCallback(() => ({
    numero, dataOrcamento, status, clienteId, clienteSnapshot, items, observacoes, observacoesInternas, validade,
    desconto, impostoSt, impostoIpi, freteValor, outrasDespesas,
    pagamento, prazoPagamento, prazoEntrega, freteTipo, modalidade,
    savedAt: new Date().toISOString(),
  }), [numero, dataOrcamento, status, clienteId, clienteSnapshot, items, observacoes, observacoesInternas, validade, desconto, impostoSt, impostoIpi, freteValor, outrasDespesas, pagamento, prazoPagamento, prazoEntrega, freteTipo, modalidade]);

  const applyDraft = (draft: any) => {
    setNumero(draft.numero || "");
    setDataOrcamento(draft.dataOrcamento || new Date().toISOString().split("T")[0]);
    setStatus(draft.status || "rascunho");
    setClienteId(draft.clienteId || "");
    setClienteSnapshot(draft.clienteSnapshot || emptyCliente);
    setItems(draft.items || []);
    setObservacoes(draft.observacoes || "");
    setObservacoesInternas(draft.observacoesInternas || "");
    setValidade(draft.validade || "");
    setDesconto(draft.desconto || 0);
    setImpostoSt(draft.impostoSt || 0);
    setImpostoIpi(draft.impostoIpi || 0);
    setFreteValor(draft.freteValor || 0);
    setOutrasDespesas(draft.outrasDespesas || 0);
    setPagamento(draft.pagamento || "");
    setPrazoPagamento(draft.prazoPagamento || "");
    setPrazoEntrega(draft.prazoEntrega || "");
    setFreteTipo(draft.freteTipo || "");
    setModalidade(draft.modalidade || "");
  };

  const saveTemplate = async (escopo: "usuario" | "equipe") => {
    if (!templateName.trim()) { toast.error("Informe um nome para o template"); return; }
    const key = escopo === "equipe" ? `${TEAM_TEMPLATE_KEY}:${templateName.trim()}` : `orcamento_template:${user?.id}:${templateName.trim()}`;
    const payload: TemplateConfig = {
      items,
      pagamento,
      prazoPagamento,
      prazoEntrega,
      modalidade,
      freteTipo,
      observacoes,
      observacoes_internas: observacoesInternas,
    };

    if (escopo === "equipe") {
      const { data: existing, error: existingError } = await supabase
        .from("app_configuracoes")
        .select("chave")
        .eq("chave", key)
        .maybeSingle();
      if (existingError) {
        toast.error("Não foi possível validar template existente.");
        return;
      }
      if (existing) {
        const shouldOverwrite = window.confirm("Template com este nome já existe. Deseja sobrescrever?");
        if (!shouldOverwrite) return;
      }
    }

    const templateRecord: OrcamentoTemplate = {
      id: key,
      nome: templateName.trim(),
      escopo,
      payload,
    };

    await (supabase.from("app_configuracoes") as any).upsert(
      { chave: key, valor: templateRecord, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    toast.success("Template salvo");
    setTemplateName("");
  };

  const applyTemplate = (tpl: OrcamentoTemplate) => {
    setItems(tpl.payload.items || []);
    setPagamento(tpl.payload.pagamento || "");
    setPrazoPagamento(tpl.payload.prazoPagamento || "");
    setPrazoEntrega(tpl.payload.prazoEntrega || "");
    setModalidade(tpl.payload.modalidade || "");
    setFreteTipo(tpl.payload.freteTipo || "");
    setObservacoes(tpl.payload.observacoes || "");
    setObservacoesInternas(tpl.payload.observacoes_internas || "");
    toast.success(`Template '${tpl.nome}' aplicado`);
  };

  const handleSave = async () => {
    if (!numero || !clienteId) {
      toast.error("Preencha os campos obrigatórios para salvar.", { description: "Verifique número e cliente." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        numero, data_orcamento: dataOrcamento, status, cliente_id: clienteId || null,
        validade: validade || null, observacoes, observacoes_internas: observacoesInternas || null,
        desconto, imposto_st: impostoSt,
        imposto_ipi: impostoIpi, frete_valor: freteValor, outras_despesas: outrasDespesas,
        valor_total: valorTotal, quantidade_total: quantidadeTotal, peso_total: pesoTotal,
        pagamento, prazo_pagamento: prazoPagamento, prazo_entrega: prazoEntrega,
        frete_tipo: freteTipo, modalidade, cliente_snapshot: clienteSnapshot,
      };

      let orcId = id;
      if (isEdit) {
        await supabase.from("orcamentos").update(payload as any).eq("id", id);
        await supabase.from("orcamentos_itens").delete().eq("orcamento_id", id);
      } else {
        const { data: newOrc, error } = await supabase.from("orcamentos").insert(payload as any).select().single();
        if (error) throw error;
        orcId = newOrc.id;
      }

      if (items.length > 0 && orcId) {
        const itemsPayload = items.filter(i => i.produto_id).map(i => ({
          orcamento_id: orcId, produto_id: i.produto_id, codigo_snapshot: i.codigo_snapshot,
          descricao_snapshot: i.descricao_snapshot, variacao: i.variacao || null,
          quantidade: i.quantidade, unidade: i.unidade, valor_unitario: i.valor_unitario,
          valor_total: i.valor_total, peso_unitario: i.peso_unitario || 0, peso_total: i.peso_total || 0,
        }));
        if (itemsPayload.length > 0) await supabase.from("orcamentos_itens").insert(itemsPayload);
      }

      localStorage.removeItem(draftKey);
      toast.success(isEdit ? "Orçamento atualizado com sucesso" : "Orçamento criado com sucesso", {
        description: `Registro ${numero} salvo.`,
        action: { label: "Visualizar", onClick: () => navigate(orcId ? `/cotacoes/${orcId}` : "/cotacoes") },
      });
      if (!isEdit && orcId) navigate(`/cotacoes/${orcId}`, { replace: true });
    } catch (err: any) {
      console.error('[orcamento]', err);
      toast.error("Erro ao salvar cotação.", { description: "Confira conexão, campos obrigatórios e tente novamente." });
    }
    setSaving(false);
  };

  const handleDuplicate = async () => {
    if (!id) { toast.error("Salve o orçamento antes de duplicar"); return; }
    try {
      const { count } = await supabase.from("orcamentos").select("*", { count: "exact", head: true });
      const newNumero = `COT${String((count || 0) + 1).padStart(6, "0")}`;
      const payload = {
        numero: newNumero, data_orcamento: new Date().toISOString().split("T")[0], status: "rascunho",
        cliente_id: clienteId || null, validade: null, observacoes, observacoes_internas: observacoesInternas || null,
        desconto, imposto_st: impostoSt,
        imposto_ipi: impostoIpi, frete_valor: freteValor, outras_despesas: outrasDespesas,
        valor_total: valorTotal, quantidade_total: quantidadeTotal, peso_total: pesoTotal,
        pagamento, prazo_pagamento: prazoPagamento, prazo_entrega: prazoEntrega,
        frete_tipo: freteTipo, modalidade, cliente_snapshot: clienteSnapshot,
      };
      const { data: newOrc, error } = await supabase.from("orcamentos").insert(payload as any).select().single();
      if (error) throw error;

      if (items.length > 0) {
        const itemsPayload = items.filter(i => i.produto_id).map(i => ({
          orcamento_id: newOrc.id, produto_id: i.produto_id, codigo_snapshot: i.codigo_snapshot,
          descricao_snapshot: i.descricao_snapshot, variacao: i.variacao || null,
          quantidade: i.quantidade, unidade: i.unidade, valor_unitario: i.valor_unitario,
          valor_total: i.valor_total, peso_unitario: i.peso_unitario || 0, peso_total: i.peso_total || 0,
        }));
        await supabase.from("orcamentos_itens").insert(itemsPayload);
      }

      toast.success(`Duplicado: ${newNumero}`);
      navigate(`/cotacoes/${newOrc.id}`, { replace: true });
    } catch (err: any) {
      console.error('[orcamento] duplicar:', err);
      toast.error("Erro ao duplicar cotação. Tente novamente.");
    }
  };

  const handleGeneratePdf = async () => {
    setPreviewOpen(true);
    setTimeout(async () => {
      if (!pdfRef.current) return;
      try {
        // Dynamically import heavy PDF libraries to keep the initial bundle lean.
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
        pdf.save(`${numero || "orcamento"}.pdf`);
        toast.success("PDF gerado com sucesso!");
      } catch {
        toast.error("Erro ao gerar PDF");
      }
    }, 500);
  };

  const handleTotalChange = (field: string, value: number) => {
    const setters: Record<string, (v: number) => void> = {
      desconto: setDesconto, imposto_st: setImpostoSt, imposto_ipi: setImpostoIpi,
      frete_valor: setFreteValor, outras_despesas: setOutrasDespesas,
    };
    setters[field]?.(value);
  };

  const handleCondicaoChange = (field: string, value: any) => {
    const setters: Record<string, (v: any) => void> = {
      pagamento: setPagamento, prazo_pagamento: setPrazoPagamento,
      prazo_entrega: setPrazoEntrega, frete_tipo: setFreteTipo, modalidade: setModalidade,
    };
    setters[field]?.(value);
  };


  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved && !isEdit) setRestoreDraftOpen(true);
  }, [draftKey, isEdit]);

  useEffect(() => {
    const timer = setInterval(() => {
      const payload = buildDraftPayload();
      localStorage.setItem(draftKey, JSON.stringify(payload));
    }, 30000);
    return () => clearInterval(timer);
  }, [buildDraftPayload, draftKey]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("app_configuracoes")
      .select("valor, chave")
      .or(`chave.like.orcamento_template:${user.id}:%,chave.like.${TEAM_TEMPLATE_KEY}:%`)
      .then(({ data }) => {
        const list = (data || [])
          .map((row) => row.valor as unknown as OrcamentoTemplate | null)
          .filter((row): row is OrcamentoTemplate => !!row?.id && !!row?.nome && !!row?.payload);
        setTemplates(list);
      });
  }, [user?.id]);

  useEffect(() => {
    supabase.from('empresa_config').select('*').limit(1).single().then(({ data }) => {
      if (data) setEmpresaConfig(data as any);
    });
  }, []);

  const clienteOptions = clientes.map((c: any) => ({
    id: c.id,
    label: c.nome_razao_social,
    sublabel: `${c.cpf_cnpj || "sem documento"} ${Number(c.limite_credito || 0) > 10000 ? "· Cliente Premium - 10% desconto" : ""}`.trim(),
    rightMeta: c.cidade ? `${c.cidade}/${c.uf || ""}` : undefined,
    searchTerms: [c.nome_razao_social, c.nome_fantasia, c.cpf_cnpj].filter(Boolean),
  }));

  return (
    <AppLayout>
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/cotacoes")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="page-title text-xl md:text-2xl">
              {isEdit ? `Editando Orçamento${numero ? ` — ${numero}` : ""}` : "Novo Orçamento"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isEdit ? "Revisão e ajuste de proposta comercial" : "Criação e emissão de proposta comercial"}
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:ml-12 md:flex md:flex-wrap">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : isEdit && status !== "rascunho" ? "Salvar Alterações" : "Salvar Rascunho"}
          </Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2"><Eye className="w-4 h-4" />Visualizar</Button>
          <Button variant="secondary" onClick={handleGeneratePdf} className="gap-2"><FileText className="w-4 h-4" />Gerar PDF</Button>
          {isEdit && <Button variant="outline" onClick={handleDuplicate} className="gap-2"><Copy className="w-4 h-4" />Duplicar</Button>}
          <Select onValueChange={(value) => { const tpl = templates.find((t) => t.id === value); if (tpl) applyTemplate(tpl); }}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Aplicar template" /></SelectTrigger><SelectContent>{templates.map((tpl) => <SelectItem key={tpl.id} value={tpl.id}>{tpl.nome} ({tpl.escopo})</SelectItem>)}</SelectContent></Select>
          <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Nome do template" className="w-[180px]" />
          <Button variant="outline" onClick={() => saveTemplate("usuario")} className="gap-2"><Wand2 className="w-4 h-4" />Salvar Meu</Button>
          <Button variant="outline" onClick={() => saveTemplate("equipe")} className="gap-2"><Wand2 className="w-4 h-4" />Compartilhar</Button>
        </div>

        {/* Edit-mode context banner — desktop */}
        {isEdit && (
          <div className="hidden md:flex md:ml-12 items-center flex-wrap gap-x-6 gap-y-2 rounded-xl border bg-card/60 px-5 py-3 text-sm shadow-soft">
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
            <div className="ml-auto font-bold text-base text-primary font-mono">{formatCurrency(valorTotal)}</div>
          </div>
        )}

        {isMobile && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cotação</p>
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
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-5">
          {/* Identificação do Orçamento */}
          <div className="bg-card rounded-xl border shadow-soft p-5">
            <h3 className="font-semibold text-foreground mb-4">Identificação do Orçamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nº Orçamento</Label>
                <div className="relative">
                  <Input
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className={`font-mono pr-8 ${fieldErrors.numero ? "border-destructive" : numero ? "border-success" : ""}`}
                  />
                  {numero && !fieldErrors.numero && <CheckCircle2 className="h-4 w-4 text-success absolute right-2 top-1/2 -translate-y-1/2" />}
                  {fieldErrors.numero && <AlertTriangle className="h-4 w-4 text-destructive absolute right-2 top-1/2 -translate-y-1/2" />}
                </div>
                {fieldErrors.numero && <p className="text-[11px] text-destructive">{fieldErrors.numero}</p>}
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Data de Emissão</Label><Input type="date" value={dataOrcamento} onChange={(e) => setDataOrcamento(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviado">Enviado ao Cliente</SelectItem>
                    <SelectItem value="confirmado">Aguardando Aprovação</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="convertido">Convertido em Pedido</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                    <SelectItem value="expirado">Expirado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Fluxo: Rascunho → Enviado → Aprovado → Convertido</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Validade</Label>
                <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
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
              {fieldErrors.clienteId && <p className="text-[11px] text-destructive">{fieldErrors.clienteId}</p>}
              {clienteId && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm bg-accent/20 rounded-lg p-3">
                  <div className="md:col-span-2 space-y-0.5"><Label className="text-xs text-muted-foreground">Razão Social</Label><p className="font-medium text-sm leading-tight">{clienteSnapshot.nome_razao_social}</p></div>
                  <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">CNPJ/CPF</Label><p className="font-mono text-xs">{clienteSnapshot.cpf_cnpj || "—"}</p></div>
                  <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Cidade/UF</Label><p className="text-sm">{clienteSnapshot.cidade ? `${clienteSnapshot.cidade}/${clienteSnapshot.uf}` : "—"}</p></div>
                  {clienteSnapshot.email && <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Email</Label><p className="text-xs truncate">{clienteSnapshot.email}</p></div>}
                  {clienteSnapshot.telefone && <div className="space-y-0.5"><Label className="text-xs text-muted-foreground">Telefone</Label><p className="text-xs">{clienteSnapshot.telefone}</p></div>}
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

          <FreteCorreiosCard
            cepDestino={clienteSnapshot.cep}
            pesoTotal={pesoTotal}
            onSelect={(valor, tipo, prazo) => {
              setFreteValor(valor);
              setFreteTipo(tipo);
              setPrazoEntrega(prazo);
            }}
          />

          <OrcamentoCondicoesCard
            form={{ quantidade_total: quantidadeTotal, peso_total: pesoTotal, pagamento, prazo_pagamento: prazoPagamento, prazo_entrega: prazoEntrega, frete_tipo: freteTipo, modalidade }}
            onChange={handleCondicaoChange}
          />

          <div className="bg-card rounded-xl border shadow-soft p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Observações do Orçamento</h3>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Texto livre para observações comerciais, instruções, validade, condições extras, etc."
                className="min-h-[100px]" />
              <p className="text-xs text-muted-foreground mt-1.5">✓ Este texto <strong>aparecerá</strong> no PDF e no link enviado ao cliente.</p>
            </div>
            <div className="border-t pt-4">
              <h3 className="font-semibold text-foreground mb-1">Observações Internas</h3>
              <p className="text-xs text-muted-foreground mb-2">🔒 Uso exclusivo da equipe — <strong>não aparece</strong> para o cliente, no PDF nem no link público.</p>
              <Textarea value={observacoesInternas} onChange={(e) => setObservacoesInternas(e.target.value)}
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
          <div className="rounded-2xl border bg-card p-4 shadow-sm lg:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resumo</p>
                <p className="mt-1 text-sm font-semibold">{clienteSnapshot.nome_razao_social || 'Sem cliente selecionado'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                <p className="mt-1 text-base font-semibold">{valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-accent/40 p-3 text-center text-xs">
              <div>
                <p className="font-semibold text-muted-foreground">Itens</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{items.filter(i => i.produto_id).length}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Qtd.</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{quantidadeTotal}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Peso</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{pesoTotal.toFixed(2)} kg</p>
              </div>
            </div>
          </div>
        )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Pré-visualização do Orçamento</DialogTitle>
            <DialogDescription>
              Visualize como o orçamento será impresso ou enviado ao cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-card z-10">
            <h3 className="font-semibold">Pré-visualização do Orçamento</h3>
            <div className="flex gap-2">
              <Select value={layoutTemplate} onValueChange={(v: any) => setLayoutTemplate(v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Simples</SelectItem>
                  <SelectItem value="completo">Completo</SelectItem>
                  <SelectItem value="logo">Com logo</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
              <Button size="sm" onClick={handleGeneratePdf} className="gap-1.5"><FileText className="w-3.5 h-3.5" />Baixar PDF</Button>
            </div>
          </div>
          <div className="flex justify-center p-4 bg-muted/30">
            <OrcamentoPdfTemplate
              ref={pdfRef} numero={numero} data={dataOrcamento} cliente={clienteSnapshot}
              items={items.filter(i => i.produto_id)} totalProdutos={totalProdutos}
              desconto={desconto} impostoSt={impostoSt} impostoIpi={impostoIpi}
              freteValor={freteValor} outrasDespesas={outrasDespesas} valorTotal={valorTotal}
              quantidadeTotal={quantidadeTotal} pesoTotal={pesoTotal} pagamento={pagamento}
              prazoPagamento={prazoPagamento} prazoEntrega={prazoEntrega} freteTipo={freteTipo}
              modalidade={modalidade} observacoes={`${observacoes}\nTemplate: ${layoutTemplate}`}
              empresa={empresaConfig || undefined}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mailModalOpen} onOpenChange={setMailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reenviar orçamento por e-mail</DialogTitle>
            <DialogDescription>Edite a mensagem antes de enviar.</DialogDescription>
          </DialogHeader>
          <Textarea value={emailTemplate} onChange={(e) => setEmailTemplate(e.target.value)} className="min-h-32" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMailModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => { toast.success('E-mail reenviado com sucesso'); setMailModalOpen(false); }}>Enviar</Button>
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
            <DialogDescription>Encontramos um rascunho salvo automaticamente para esta cotação.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { localStorage.removeItem(draftKey); setRestoreDraftOpen(false); }}>Descartar</Button>
            <Button onClick={() => { const raw = localStorage.getItem(draftKey); if (raw) applyDraft(JSON.parse(raw)); setRestoreDraftOpen(false); }} className="gap-2"><RefreshCw className="h-4 w-4" />Restaurar</Button>
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
    </AppLayout>
  );
}
