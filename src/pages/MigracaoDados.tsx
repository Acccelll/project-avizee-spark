import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ImportacaoResumoCards } from "@/components/importacao/ImportacaoResumoCards";
import { ImportacaoTipoCard, CardImportStatus } from "@/components/importacao/ImportacaoTipoCard";
import { ImportacaoGrupoSection } from "@/components/importacao/ImportacaoGrupoSection";
import { ImportacaoLotesTable, ImportacaoLote } from "@/components/importacao/ImportacaoLotesTable";
import { UploadPlanilhaCard } from "@/components/importacao/UploadPlanilhaCard";
import { MapeamentoColunasForm } from "@/components/importacao/MapeamentoColunasForm";
import { PreviewImportacaoTable } from "@/components/importacao/PreviewImportacaoTable";
import { ErrosImportacaoPanel } from "@/components/importacao/ErrosImportacaoPanel";
import { PreviewXmlTable } from "@/components/importacao/PreviewXmlTable";
import { PreviewFaturamentoTable } from "@/components/importacao/PreviewFaturamentoTable";
import { PreviewFinanceiroTable } from "@/components/importacao/PreviewFinanceiroTable";
import { ReconciliacaoIndicadores } from "@/components/importacao/ReconciliacaoIndicadores";
import { ReconciliacaoDetalhe } from "@/components/importacao/ReconciliacaoDetalhe";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, RefreshCw, Database, ArrowRight, ArrowLeft, CheckCircle2, ChevronRight, FileUp, ClipboardCheck, ArrowRightCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useImportacaoCadastros } from "@/hooks/importacao/useImportacaoCadastros";
import { useImportacaoEstoque } from "@/hooks/importacao/useImportacaoEstoque";
import { useImportacaoXml } from "@/hooks/importacao/useImportacaoXml";
import { useImportacaoFaturamento } from "@/hooks/importacao/useImportacaoFaturamento";
import { useImportacaoFinanceiro } from "@/hooks/importacao/useImportacaoFinanceiro";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ImportSource, ImportType } from "@/hooks/importacao/types";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MigracaoDados() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [activeTab, setActiveTab] = useState("overview");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [currentLoteId, setCurrentLoteId] = useState<string | null>(null);
  const [selectedLote, setSelectedLote] = useState<ImportacaoLote | null>(null);
  const [isReconciliacaoOpen, setIsReconciliacaoOpen] = useState(false);

  const { data: lotes, loading: loadingLotes, fetchData: refreshLotes } = useSupabaseCrud<ImportacaoLote>({
    table: "importacao_lotes",
    hasAtivo: false,
    orderBy: "criado_em"
  });

  const [activeImportSource, setActiveImportSource] = useState<ImportSource>("cadastros");

  const hookCadastros = useImportacaoCadastros();
  const hookEstoque = useImportacaoEstoque();
  const hookXml = useImportacaoXml();
  const hookFaturamento = useImportacaoFaturamento();
  const hookFinanceiro = useImportacaoFinanceiro();

  const activeHook = activeImportSource === "cadastros" ? hookCadastros :
                    activeImportSource === "estoque" ? hookEstoque :
                    activeImportSource === "xml" ? hookXml :
                    activeImportSource === "faturamento" ? hookFaturamento : hookFinanceiro;

  const {
    file,
    sheets,
    currentSheet,
    headers,
    mapping,
    importType,
    previewData,
    isProcessing,
    onFileChange,
    onSheetChange,
    setMapping,
    setImportType,
    generatePreview,
    processImport,
    finalizeImport
  } = activeHook as any;

  const filteredLotes = lotes.filter(lote => {
    const matchesSearch = lote.arquivo_nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "todos" || lote.tipo_importacao === typeFilter;
    const matchesStatus = statusFilter === "todos" || lote.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Compute per-type card status and summary from lotes data
  const cardInfoMap = useMemo(() => {
    const getCardInfo = (tipoImportacao: string): {
      cardStatus: CardImportStatus;
      summary: {
        lastDate?: string;
        totalBatches?: number;
        pendingCount?: number;
        nextAction?: string;
      };
    } => {
      const typeLotes = lotes.filter(l => l.tipo_importacao === tipoImportacao);
      if (typeLotes.length === 0) {
        return { cardStatus: "nunca_importado", summary: { totalBatches: 0, nextAction: "Iniciar importação" } };
      }
      const sorted = [...typeLotes].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
      const latest = sorted[0];
      const pendingCount = typeLotes.filter(l => l.status === 'validado' || l.status === 'parcial').length;
      const lastDate = format(new Date(latest.criado_em), "dd/MM/yyyy", { locale: ptBR });

      let cardStatus: CardImportStatus;
      let nextAction: string;

      if (typeLotes.some(l => l.status === 'processando')) {
        cardStatus = "processando";
        nextAction = "Aguardando processamento";
      } else if (pendingCount > 0) {
        cardStatus = "pendente_conferencia";
        nextAction = "Conferir e confirmar lote pendente";
      } else if (latest.status === 'concluido' && (latest.total_erros || 0) > 0) {
        cardStatus = "concluido_com_alertas";
        nextAction = "Revisar alertas do lote concluído";
      } else if (latest.status === 'concluido') {
        cardStatus = "concluido";
        nextAction = "Verificar reconciliação";
      } else if ((latest.total_erros || 0) > 0) {
        cardStatus = "erro_recente";
        nextAction = "Revisar erros e reimportar";
      } else {
        cardStatus = "pronto";
        nextAction = "Pronto para nova importação";
      }

      return {
        cardStatus,
        summary: { lastDate, totalBatches: typeLotes.length, pendingCount, nextAction },
      };
    };

    return {
      produtos: getCardInfo("produtos"),
      clientes: getCardInfo("clientes"),
      fornecedores: getCardInfo("fornecedores"),
      estoque_inicial: getCardInfo("estoque_inicial"),
      financeiro: getCardInfo("financeiro_aberto"),
      faturamento: getCardInfo("faturamento"),
      compras_xml: getCardInfo("compras_xml"),
    };
  }, [lotes]);

  // Aggregate KPI metrics
  const kpiMetrics = useMemo(() => {
    const totalRegistrosImportados = lotes.reduce((acc, l) => acc + (l.total_importados || 0), 0);
    const totalRegistrosRejeitados = lotes.reduce((acc, l) => acc + (l.total_erros || 0), 0);
    const totalPendenciasConferencia = lotes.filter(l => l.status === 'validado' || l.status === 'parcial').length;
    const totalConcluidosComAlertas = lotes.filter(l => l.status === 'concluido' && (l.total_erros || 0) > 0).length;
    return { totalRegistrosImportados, totalRegistrosRejeitados, totalPendenciasConferencia, totalConcluidosComAlertas };
  }, [lotes]);

  // Compute next recommended migration step for the alert banner
  const nextMigrationStep = useMemo(() => {
    const baseTypes = ["produtos", "clientes", "fornecedores"];
    const allBaseDone = baseTypes.every(t =>
      lotes.some(l => l.tipo_importacao === t && l.status === 'concluido')
    );
    if (!lotes.some(l => l.tipo_importacao === 'produtos' && l.status === 'concluido')) {
      return "Inicie pelos Cadastros-base: importe Produtos, Clientes e Fornecedores primeiro.";
    }
    if (!allBaseDone) {
      return "Conclua os Cadastros-base (Produtos, Clientes, Fornecedores) antes de avançar.";
    }
    const hasPendingConferencia = lotes.some(l => l.status === 'validado' || l.status === 'parcial');
    if (hasPendingConferencia) {
      return "Existem lotes pendentes de conferência. Revise antes de prosseguir com novas cargas.";
    }
    if (!lotes.some(l => l.tipo_importacao === 'estoque_inicial' && l.status === 'concluido')) {
      return "Cadastros concluídos. Próximo passo recomendado: Estoque Inicial e Financeiro em Aberto.";
    }
    return "Migração em andamento. Verifique a aba de Conferência & Reconciliação para acompanhar o progresso.";
  }, [lotes]);

  const handleRefresh = () => {
    refreshLotes();
    toast.info("Dados atualizados.");
  };

  const handleOpenImport = (type: string) => {
    if (type === "estoque_inicial") {
      setActiveImportSource("estoque");
    } else if (type === "compras_xml") {
      setActiveImportSource("xml");
    } else if (type === "faturamento") {
      setActiveImportSource("faturamento");
      setImportType("produtos" as any); // fallback dummy
    } else if (type === "financeiro") {
      setActiveImportSource("financeiro");
      setImportType("produtos" as any); // fallback dummy
    } else {
      setActiveImportSource("cadastros");
      setImportType(type as ImportType);
    }
    setStep(1);
    setIsImportModalOpen(true);
  };

  const handleNextStep = async () => {
    if (activeImportSource !== 'xml' && step === 1 && !file) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }

    if (activeImportSource === 'xml' && step === 1 && hookXml.files.length === 0) {
      toast.error("Selecione os arquivos XML primeiro.");
      return;
    }

    if (step === 1 && activeImportSource === 'xml') {
      setStep(3);
      return;
    }

    if (step === 2) {
      if (activeImportSource === 'estoque') {
        await hookEstoque.generatePreview();
      } else if (activeImportSource === 'faturamento') {
        await hookFaturamento.generatePreview();
      } else if (activeImportSource === 'financeiro') {
        await hookFinanceiro.generatePreview();
      } else {
        hookCadastros.generatePreview();
      }
    }

    if (step === 3) {
      const loteId = await processImport();
      if (!loteId) return;
      setCurrentLoteId(loteId);
    }

    setStep(s => s + 1);
  };

  const handleFinalize = async () => {
    setIsConfirmOpen(true);
  };

  const onConfirmCarga = async () => {
    setIsConfirmOpen(false);
    const success = await finalizeImport(currentLoteId || undefined);
    if (success) {
      setIsImportModalOpen(false);
      refreshLotes();
      setActiveTab("lotes");
    }
  };

  const resetModal = () => {
    setIsImportModalOpen(false);
    setStep(1);
    setCurrentLoteId(null);
  };

  const handleViewLote = (id: string) => {
    const lote = lotes.find(l => l.id === id);
    if (lote) {
      setSelectedLote(lote);
      setIsReconciliacaoOpen(true);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Migração de Dados</h1>
              <p className="text-sm text-muted-foreground">
                Central de importação, saneamento e carga de dados legados.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loadingLotes ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Aviso de Segurança */}
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 font-bold">Atenção — Módulo de Carga Inicial Controlada</AlertTitle>
          <AlertDescription className="text-amber-700 text-xs space-y-1">
            <p>
              Esta área é destinada exclusivamente para a migração de dados de sistemas legados.
              A importação pode causar duplicidade se SKUs, CPFs ou CNPJs não forem conferidos previamente.
              <strong> Valide os dados no ambiente de staging antes de confirmar a carga definitiva.</strong>
            </p>
            {lotes.length > 0 && (
              <p className="flex items-center gap-1.5 pt-1">
                <ArrowRightCircle className="h-3.5 w-3.5 shrink-0" />
                <span><strong>Próximo passo recomendado:</strong> {nextMigrationStep}</span>
              </p>
            )}
          </AlertDescription>
        </Alert>

        {/* Resumo */}
        <ImportacaoResumoCards
          totalBatches={lotes.length}
          totalProcessed={lotes.filter(l => l.status === 'concluido').length}
          totalErrors={lotes.reduce((acc, curr) => acc + (curr.total_erros || 0), 0)}
          totalPending={lotes.filter(l => ['validado', 'parcial', 'processando'].includes(l.status)).length}
          totalRegistrosImportados={kpiMetrics.totalRegistrosImportados}
          totalRegistrosRejeitados={kpiMetrics.totalRegistrosRejeitados}
          totalPendenciasConferencia={kpiMetrics.totalPendenciasConferencia}
          totalConcluidosComAlertas={kpiMetrics.totalConcluidosComAlertas}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
            <TabsTrigger value="overview">Tipos de Importação</TabsTrigger>
            <TabsTrigger value="lotes">Lotes de Importação</TabsTrigger>
            <TabsTrigger value="reconciliacao">Conferência & Reconciliação</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-8">
            {/* Fluxo orientativo */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground bg-muted/30 rounded-md px-4 py-2 border">
              <span className="font-semibold text-foreground">Fluxo recomendado:</span>
              {[
                "Cadastros-base",
                "Saldos iniciais",
                "Histórico / documentos",
                "Conferência & Reconciliação",
                "Confirmação de carga",
              ].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-1">
                  <span>{step}</span>
                  {i < arr.length - 1 && <ChevronRight className="h-3 w-3 shrink-0" />}
                </span>
              ))}
            </div>

            {/* Grupo 1 — Cadastros-base */}
            <ImportacaoGrupoSection
              order={1}
              title="Cadastros-base"
              description="— importe primeiro"
              colorClass="bg-blue-100 text-blue-700"
            >
              <ImportacaoTipoCard
                type="produtos"
                title="Produtos"
                description="Importação de SKUs, descrições, preços e NCM via Excel."
                criticidade="estrutural"
                cardStatus={cardInfoMap.produtos.cardStatus}
                summary={cardInfoMap.produtos.summary}
                onImport={() => handleOpenImport("produtos")}
                onViewBatches={() => { setTypeFilter("produtos"); setActiveTab("lotes"); }}
              />
              <ImportacaoTipoCard
                type="clientes"
                title="Clientes"
                description="Carga de base de clientes com CPF/CNPJ e contatos."
                criticidade="cadastral"
                cardStatus={cardInfoMap.clientes.cardStatus}
                summary={cardInfoMap.clientes.summary}
                onImport={() => handleOpenImport("clientes")}
                onViewBatches={() => { setTypeFilter("clientes"); setActiveTab("lotes"); }}
              />
              <ImportacaoTipoCard
                type="fornecedores"
                title="Fornecedores"
                description="Cadastro de fornecedores legados para compras e fiscal."
                criticidade="cadastral"
                cardStatus={cardInfoMap.fornecedores.cardStatus}
                summary={cardInfoMap.fornecedores.summary}
                onImport={() => handleOpenImport("fornecedores")}
                onViewBatches={() => { setTypeFilter("fornecedores"); setActiveTab("lotes"); }}
              />
            </ImportacaoGrupoSection>

            {/* Grupo 2 — Posição inicial / saldos */}
            <ImportacaoGrupoSection
              order={2}
              title="Posição inicial / Saldos"
              description="— recomendado após cadastros-base"
              colorClass="bg-orange-100 text-orange-700"
            >
              <ImportacaoTipoCard
                type="estoque_inicial"
                title="Estoque Inicial"
                description="Carga de saldos iniciais de inventário por depósito."
                criticidade="operacional"
                dependencies={["Produtos"]}
                cardStatus={cardInfoMap.estoque_inicial.cardStatus}
                summary={cardInfoMap.estoque_inicial.summary}
                onImport={() => handleOpenImport("estoque_inicial")}
                onViewBatches={() => { setTypeFilter("estoque_inicial"); setActiveTab("lotes"); }}
              />
              <ImportacaoTipoCard
                type="financeiro"
                title="Financeiro em Aberto"
                description="Carga de contas a pagar e receber pendentes."
                criticidade="financeiro"
                dependencies={["Clientes", "Fornecedores"]}
                cardStatus={cardInfoMap.financeiro.cardStatus}
                summary={cardInfoMap.financeiro.summary}
                onImport={() => handleOpenImport("financeiro")}
                onViewBatches={() => { setTypeFilter("financeiro_aberto"); setActiveTab("lotes"); }}
              />
            </ImportacaoGrupoSection>

            {/* Grupo 3 — Histórico / documentos */}
            <ImportacaoGrupoSection
              order={3}
              title="Histórico / Documentos"
              description="— recomendado após cadastros e saldos"
              colorClass="bg-purple-100 text-purple-700"
            >
              <ImportacaoTipoCard
                type="faturamento"
                title="Faturamento Histórico"
                description="Importação de histórico de vendas de sistemas legados."
                criticidade="historico"
                dependencies={["Produtos", "Clientes"]}
                cardStatus={cardInfoMap.faturamento.cardStatus}
                summary={cardInfoMap.faturamento.summary}
                onImport={() => handleOpenImport("faturamento")}
                onViewBatches={() => { setTypeFilter("faturamento"); setActiveTab("lotes"); }}
              />
              <ImportacaoTipoCard
                type="compras_xml"
                title="Compras por XML"
                description="Processamento em lote de arquivos XML de notas de compra."
                criticidade="fiscal"
                dependencies={["Produtos", "Fornecedores"]}
                cardStatus={cardInfoMap.compras_xml.cardStatus}
                summary={cardInfoMap.compras_xml.summary}
                onImport={() => handleOpenImport("compras_xml")}
                onViewBatches={() => { setTypeFilter("compras_xml"); setActiveTab("lotes"); }}
              />
            </ImportacaoGrupoSection>
          </TabsContent>

          <TabsContent value="lotes" className="mt-0 space-y-4">
            {/* Filtros */}
            <div className="flex flex-col md:flex-row items-center gap-3 bg-card p-4 rounded-md border">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome do arquivo..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="produtos">Produtos</SelectItem>
                    <SelectItem value="clientes">Clientes</SelectItem>
                    <SelectItem value="fornecedores">Fornecedores</SelectItem>
                    <SelectItem value="estoque_inicial">Estoque Inicial</SelectItem>
                    <SelectItem value="faturamento">Faturamento</SelectItem>
                    <SelectItem value="financeiro_aberto">Financeiro</SelectItem>
                    <SelectItem value="compras_xml">Compras por XML</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="validado">Validado</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="processando">Processando</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="icon" title="Mais filtros">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ImportacaoLotesTable
              lotes={filteredLotes}
              isLoading={loadingLotes}
              onView={handleViewLote}
              onImport={(id) => {
                 const lote = lotes.find(l => l.id === id);
                 if (lote) {
                    if (lote.tipo_importacao === 'estoque_inicial') setActiveImportSource("estoque");
                    else if (lote.tipo_importacao === 'compras_xml') setActiveImportSource("xml");
                    else if (lote.tipo_importacao === 'faturamento') setActiveImportSource("faturamento");
                    else if (lote.tipo_importacao === 'financeiro_aberto') setActiveImportSource("financeiro");
                    else {
                      setActiveImportSource("cadastros");
                      setImportType(lote.tipo_importacao as ImportType);
                    }
                 }
                 setCurrentLoteId(id);
                 setStep(4);
                 setIsImportModalOpen(true);
              }}
              onDelete={(id) => toast.error("Exclusão não implementada")}
            />
          </TabsContent>

          <TabsContent value="reconciliacao" className="mt-0 space-y-6">
            {/* Header da seção */}
            <div className="flex items-start gap-3 bg-card p-4 rounded-lg border">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Conferência & Reconciliação de Carga</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Parte central do fluxo de migração. Confira os totais migrados por categoria,
                  identifique inconsistências, revise lotes pendentes e confirme ou descarte cargas antes
                  de consolidar os dados no sistema operacional.
                </p>
              </div>
            </div>

            {/* Indicadores por categoria */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Registros por categoria
              </h4>
              <ReconciliacaoIndicadores lotes={lotes} />
            </div>

            {/* Lotes pendentes de conferência */}
            {kpiMetrics.totalPendenciasConferencia > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold tracking-tight">
                    Lotes pendentes de conferência
                  </h4>
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                    {kpiMetrics.totalPendenciasConferencia}
                  </span>
                </div>
                <ImportacaoLotesTable
                  lotes={lotes.filter(l => l.status === 'validado' || l.status === 'parcial')}
                  isLoading={loadingLotes}
                  onView={handleViewLote}
                  onImport={(id) => {
                    const lote = lotes.find(l => l.id === id);
                    if (lote) {
                      if (lote.tipo_importacao === 'estoque_inicial') setActiveImportSource("estoque");
                      else if (lote.tipo_importacao === 'compras_xml') setActiveImportSource("xml");
                      else if (lote.tipo_importacao === 'faturamento') setActiveImportSource("faturamento");
                      else if (lote.tipo_importacao === 'financeiro_aberto') setActiveImportSource("financeiro");
                      else {
                        setActiveImportSource("cadastros");
                        setImportType(lote.tipo_importacao as ImportType);
                      }
                    }
                    setCurrentLoteId(id);
                    setStep(4);
                    setIsImportModalOpen(true);
                  }}
                />
              </div>
            )}

            {/* Últimos lotes para conferência */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold tracking-tight">Histórico recente de lotes</h4>
              <ImportacaoLotesTable
                lotes={lotes.slice(0, 10)}
                isLoading={loadingLotes}
                onView={handleViewLote}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de Importação */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                Importar {activeImportSource === 'xml' ? 'Compras por XML' :
                          activeImportSource === 'faturamento' ? 'Faturamento Histórico' :
                          activeImportSource === 'financeiro' ? 'Financeiro em Aberto' :
                          importType?.charAt(0).toUpperCase() + importType?.slice(1)}
              </DialogTitle>
              <DialogDescription>
                Siga os passos abaixo para realizar a carga de dados de sistemas legados para o ERP AviZee.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between px-8 py-4 bg-muted/30 rounded-lg">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className="flex items-center">
                  <div className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full border-2 font-bold text-sm transition-colors",
                    step === s ? "bg-primary text-primary-foreground border-primary" :
                    step > s ? "bg-emerald-500 text-white border-emerald-500" : "border-muted-foreground/30 text-muted-foreground"
                  )}>
                    {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                  </div>
                  {s < 4 && <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground/30" />}
                </div>
              ))}
            </div>

            <div className="flex-grow overflow-auto py-4">
              {step === 1 && (
                <div className="space-y-4">
                  <UploadPlanilhaCard
                    onFileChange={activeImportSource === 'xml' ? hookXml.onFilesChange : onFileChange}
                    fileName={activeImportSource === 'xml' ? (hookXml.files.length > 0 ? `${hookXml.files.length} arquivo(s) selecionado(s)` : undefined) : file?.name}
                    isProcessing={isProcessing}
                  />
                  {activeImportSource !== 'xml' && sheets.length > 0 && (
                    <div className="space-y-2">
                      <Label>Selecione a aba da planilha:</Label>
                      <Select value={currentSheet} onValueChange={(val) => onSheetChange(val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a aba" />
                        </SelectTrigger>
                        <SelectContent>
                          {sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-sm text-amber-800">
                    Mapeie as colunas da sua planilha para os campos correspondentes no sistema.
                  </div>
                  <MapeamentoColunasForm
                    headers={headers}
                    importType={activeImportSource === 'faturamento' ? 'produtos' :
                                activeImportSource === 'financeiro' ? 'clientes' : importType}
                    mapping={mapping}
                    onMappingChange={(f, c) => setMapping(prev => ({ ...prev, [f]: c }))}
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  {activeImportSource === 'xml' ? (
                    <PreviewXmlTable data={hookXml.xmlData} />
                  ) : activeImportSource === 'faturamento' ? (
                    <PreviewFaturamentoTable data={hookFaturamento.previewData} />
                  ) : activeImportSource === 'financeiro' ? (
                    <PreviewFinanceiroTable data={hookFinanceiro.previewData} />
                  ) : (
                    <>
                      <ErrosImportacaoPanel data={previewData} />
                      <PreviewImportacaoTable data={previewData} importType={importType} />
                    </>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="p-4 bg-emerald-100 rounded-full">
                    <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Tudo pronto!</h3>
                    <p className="text-muted-foreground max-w-md">
                      Os dados foram validados e estão no ambiente de staging.
                      Clique em <strong>Confirmar Carga</strong> para inserir definitivamente no sistema.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="space-y-2 mb-4">
                <Progress value={undefined} className="h-2" />
                <p className="text-[10px] text-center text-muted-foreground animate-pulse">Processando dados, por favor aguarde...</p>
              </div>
            )}

            <DialogFooter className="border-t pt-4">
              <Button variant="ghost" onClick={resetModal} disabled={isProcessing}>Cancelar</Button>
              <div className="flex-grow" />
              {step > 1 && step < 4 && (
                <Button variant="outline" onClick={() => {
                  if (activeImportSource === 'xml' && step === 3) setStep(1);
                  else setStep(s => s - 1);
                }} disabled={isProcessing}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
              )}
              {step < 4 ? (
                <Button onClick={handleNextStep} disabled={isProcessing || (activeImportSource === 'xml' ? hookXml.files.length === 0 : !file)}>
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleFinalize} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
                  Confirmar Carga Final
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ReconciliacaoDetalhe
          lote={selectedLote}
          isOpen={isReconciliacaoOpen}
          onClose={() => {
            setIsReconciliacaoOpen(false);
            setSelectedLote(null);
          }}
        />

        {/* Confirmação de Carga */}
        <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Carga de Dados?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá inserir os registros validados definitivamente nas tabelas operacionais do sistema.
                Certifique-se de que revisou as inconsistências no passo anterior.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Revisar mais uma vez</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirmCarga} className="bg-emerald-600 hover:bg-emerald-700">
                Confirmar Carga
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
