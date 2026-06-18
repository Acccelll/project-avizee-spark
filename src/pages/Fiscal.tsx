import { useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { OriginContextBanner } from "@/components/navigation/OriginContextBanner";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { calcularFaturaParaData } from "@/lib/cartaoFatura";
import { SummaryCard } from "@/components/SummaryCard";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";
import { MonthPicker } from "@/components/filters/MonthPicker";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/format";
import { FileText, FileDown, DollarSign, CheckCircle, Clock, ArrowLeftRight, MoreVertical, Eye, Edit as EditIcon, XCircle as XCircleIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useCan } from "@/hooks/useCan";
import { NotaFiscalDrawer } from "@/components/fiscal/NotaFiscalDrawer";
import { useFiscalFilters } from "@/pages/fiscal/hooks/useFiscalFilters";
import { useFiscalKpis } from "@/pages/fiscal/hooks/useFiscalKpis";
import {
  useNotasFiscaisPaged,
  useResetPageOnFiltersChange,
} from "@/pages/fiscal/hooks/useNotasFiscaisPaged";
import { FiscalChaveDialogsSlot } from "@/pages/fiscal/components/FiscalChaveDialogsSlot";
import { FiscalToolbarActions } from "@/pages/fiscal/components/FiscalToolbarActions";
import { FiscalTipoSwitchMobile } from "@/components/fiscal/FiscalTipoSwitchMobile";
import { FiscalDanfeViewer, type FiscalDanfeViewerHandle } from "@/pages/fiscal/components/FiscalDanfeViewer";
import { FiscalDevolucaoFlow, type FiscalDevolucaoFlowHandle } from "@/pages/fiscal/components/FiscalDevolucaoFlow";
import { NotaFiscalEditModal } from "@/components/fiscal/NotaFiscalEditModal";
import { useCanEditFinanceiroAvancado } from "@/hooks/useCanEditFinanceiroAvancado";
import {
  fiscalInternalStatusOptions,
  fiscalSefazStatusOptions,
  getFiscalInternalStatus,
  getFiscalSefazStatus,
} from "@/lib/fiscalStatus";
import { useFiscalVencimentosLoader } from "@/pages/fiscal/hooks/useFiscalVencimentos";
import { buildFiscalColumns } from "@/pages/fiscal/components/FiscalTableColumns";
import { useFiscalModalState } from "@/pages/fiscal/hooks/useFiscalModalState";
import type { NotaFiscal as NotaFiscalDomain } from "@/types/domain";
import { NfeCreateFormModal } from "@/pages/fiscal/components/NfeCreateFormModal";
import { FiscalKpisStrip } from "@/pages/fiscal/components/FiscalKpisStrip";
import { buildFiscalMobileRowActions } from "@/pages/fiscal/components/FiscalMobileRowActions";
import { useFiscalAutoOpen } from "@/pages/fiscal/hooks/useFiscalAutoOpen";
import { useFiscalLifecycleActions } from "@/pages/fiscal/hooks/useFiscalLifecycleActions";
import { useFiscalSubmit } from "@/pages/fiscal/hooks/useFiscalSubmit";
import { useFiscalXmlImport } from "@/pages/fiscal/hooks/useFiscalXmlImport";
import { FiscalXmlSlots } from "@/pages/fiscal/components/FiscalXmlSlots";

/**
 * Tipo canônico re-exportado de @/types/domain para preservar compat. local.
 * Centralização: Fase 3 do roadmap fiscal.
 */
export type NotaFiscal = NotaFiscalDomain;

const modeloLabels: Record<string, string> = {
  '55': 'NF-e', '65': 'NFC-e', '57': 'CT-e', '67': 'CT-e OS', 'nfse': 'NFS-e', 'outro': 'Outro'
};

const origemLabels: Record<string, string> = { manual: "Manual", pedido: "Pedido", xml_importado: "Importação XML" };

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

const Fiscal = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { can } = useCan();
  const canEstornarNF = can("faturamento_fiscal:cancelar") || can("faturamento_fiscal:admin_fiscal");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Filtro mês de emissão é elevado para o componente para que o range
  // possa ser empurrado server-side via `dateRange` e o LIMIT/OFFSET do
  // Supabase trabalhe sobre o conjunto já filtrado (Sprint 7.3 #11).
  const [emissaoMesState, setEmissaoMesState] = useState<string>("");
  const emissaoDateRange = useMemo(() => {
    if (!emissaoMesState) return null;
    const start = `${emissaoMesState}-01`;
    const [y, m] = emissaoMesState.split("-").map(Number);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    return { from: start, to: end };
  }, [emissaoMesState]);
  // Paginação server-side (Onda 8 / item 2.1). Substitui o `useSupabaseCrud`
  // que carregava até 1000 notas no cliente. Filtros, ordenação e busca
  // delegados à RPC `listar_notas_fiscais_ids`; KPIs continuam via `kpis_fiscal`.
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  // Fase 2: estado canônico do modal extraído para `useFiscalModalState`.
  const modalState = useFiscalModalState();
  const {
    fornecedores, clientes, produtos,
    refetchFornecedores, refetchClientes, refetchProdutos,
    ordensVenda, contasContabeis, cartoes,
    modalOpen, setModalOpen,
    mode, setMode,
    saving, setSaving,
    form, setForm,
    items, setItems,
    parcelas, setParcelas,
    primeiroVencimento, setPrimeiroVencimento,
    intervaloDias, setIntervaloDias,
    parcelasPlano, setParcelasPlano,
    itemContaContabil, setItemContaContabil,
    itemFiscalData, setItemFiscalData,
    valorProdutos, totalImpostos, totalNF,
    resetItensEParcelas,
  } = modalState;
  const [selected, setSelected] = useState<NotaFiscal | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [buscarChaveOpen, setBuscarChaveOpen] = useState(false);
  const [buscarChaveInicial, setBuscarChaveInicial] = useState<string | undefined>(undefined);
  const [scannerOpen, setScannerOpen] = useState(false);
  const danfeViewerRef = useRef<FiscalDanfeViewerHandle>(null);
  const devolucaoFlowRef = useRef<FiscalDevolucaoFlowHandle>(null);
  const [vencimentoNotaIds, setVencimentoNotaIds] = useState<Set<string> | null>(null);
  const { canEditAvancado } = useCanEditFinanceiroAvancado();

  // Bridge: `useFiscalAutoOpen` precisa apenas RESETAR esses setters,
  // mas o estado vive em `useFiscalXmlImport` (declarado adiante). Usamos
  // um ref para evitar TDZ — só é lido em callbacks (openCreate, etc.).
  const xmlBridgeRef = useRef<{
    setXmlOriginInfo: (v: null) => void;
    setTraducaoLinhas: (v: never[]) => void;
  } | null>(null);

  // Auto-open / deep-link / origem PC + carregamento de cnpjEmpresa.
  // Etapa 6.3 — extraído para `useFiscalAutoOpen`.
  const {
    cnpjEmpresa,
    openCreate,
    pedidoCompraOriginId,
    originPedidoNumero,
  } = useFiscalAutoOpen({
    setMode,
    setForm,
    setItems,
    setSelected,
    setParcelas,
    setItemContaContabil,
    setItemFiscalData,
    setModalOpen,
    setXmlOriginInfo: (v) => xmlBridgeRef.current?.setXmlOriginInfo(v),
    setTraducaoLinhas: (v) => xmlBridgeRef.current?.setTraducaoLinhas(v),
    setDrawerOpen,
    applyDeepLinkSelected: setSelected,
  });

  // Etapa 6.3 — Pipeline XML (import, anexação, tradução, quick-add).
  const xml = useFiscalXmlImport({
    fornecedores,
    clientes,
    produtos,
    cnpjEmpresa: cnpjEmpresa ?? undefined,
    refetchFornecedores,
    refetchClientes,
    refetchProdutos,
    setForm,
    setItems,
    setMode,
    setSelected,
    setItemContaContabil,
    setItemFiscalData,
    setParcelas,
    setPrimeiroVencimento,
    setParcelasPlano,
    setModalOpen,
    setDrawerOpen,
  });
  xmlBridgeRef.current = {
    setXmlOriginInfo: xml.setXmlOriginInfo as (v: null) => void,
    setTraducaoLinhas: xml.setTraducaoLinhas as (v: never[]) => void,
  };

  const openView = (n: NotaFiscal) => {
    setSelected(n);
    setDrawerOpen(true);
  };

  const openDanfe = (n: NotaFiscal) => danfeViewerRef.current?.open(n);

  const tipoParam = searchParams.get("tipo");
  // Drill-down from Dashboard: ?status=rascunho or ?status=pendente,rascunho.
  const statusUrlParam = searchParams.get("status");
  const statusFromUrl = useMemo(
    () => (statusUrlParam ? statusUrlParam.split(",").map((s) => s.trim()).filter(Boolean) : []),
    [statusUrlParam],
  );

  // Filtros, busca e chips encapsulados em hook (Fase 6 — refatoração Fiscal).
  const {
    filteredData,
    activeFilterChips: fiscalActiveFilters,
    consultaSearch,
    setConsultaSearch,
    tipoFilters,
    setTipoFilters,
    modeloFilters,
    setModeloFilters,
    statusFilters,
    setStatusFilters,
    origemFilters,
    setOrigemFilters,
    statusSefazFilters,
    setStatusSefazFilters,
    emissaoMes,
    setEmissaoMes,
    vencimentoMes,
    setVencimentoMes,
    removeFilter: handleRemoveFiscalFilter,
  } = useFiscalFilters([] as NotaFiscal[], {
    tipoFromUrl: tipoParam,
    statusFromUrl,
    vencimentoNotaIds,
    emissaoMesControlled: { value: emissaoMesState, onChange: setEmissaoMesState },
  });

  // Filtros server-side derivados dos estados controlados acima.
  const serverFilters = useMemo(
    () => ({
      dateFrom: emissaoDateRange?.from ?? null,
      dateTo: emissaoDateRange?.to ?? null,
      tipos: tipoParam ? [tipoParam] : (tipoFilters.length ? tipoFilters : null),
      status: statusFromUrl.length ? statusFromUrl : (statusFilters.length ? statusFilters : null),
      statusSefaz: statusSefazFilters.length ? statusSefazFilters : null,
      modelos: modeloFilters.length ? modeloFilters : null,
      origens: origemFilters.length ? origemFilters : null,
      search: consultaSearch || null,
    }),
    [emissaoDateRange, tipoParam, tipoFilters, statusFromUrl, statusFilters, statusSefazFilters, modeloFilters, origemFilters, consultaSearch],
  );

  useResetPageOnFiltersChange(serverFilters, setPage);

  // Ordenação server-side (RPC `listar_notas_fiscais_ids` aceita data_emissao, numero, valor_total, created_at)
  type FiscalSortKey = "data_emissao" | "numero" | "valor_total" | "created_at";
  const [sortKey, setSortKey] = useState<FiscalSortKey>("data_emissao");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const {
    data: pagedData,
    totalCount,
    loading,
    refetch: refetchPaged,
  } = useNotasFiscaisPaged(serverFilters, page, PAGE_SIZE, { orderBy: sortKey, ascending: sortAsc });

  // Aliases para preservar callsites legados que esperavam `useSupabaseCrud`.
  const data = pagedData;
  const fetchData = refetchPaged;

  // Etapa 6.3 — handlers de ciclo de vida + hidratação do form de edição.
  const {
    baixarXmlArquivado,
    handleConfirmar,
    handleEstornar,
    handleCancelarRascunho,
    handleInativar,
    openEdit,
    confirmDialog,
    invalidate,
    confirmarMutation,
  } = useFiscalLifecycleActions({
    fetchData,
    setMode,
    setSelected,
    setForm,
    setItems,
    setItemContaContabil,
    setItemFiscalData,
    setParcelas,
    setParcelasPlano,
    setModalOpen,
    data,
    selected,
  });

  const openDevolucao = (nf: NotaFiscal) => devolucaoFlowRef.current?.open(nf);

  // Etapa 6.3 — fluxo de salvar a NF (validações, financeiro, auto-confirm).
  const { handleSubmit } = useFiscalSubmit({
    form,
    items,
    mode,
    selected,
    parcelas,
    parcelasPlano,
    totalNF,
    valorProdutos,
    itemContaContabil,
    itemFiscalData,
    traducaoLinhas: xml.traducaoLinhas,
    xmlOriginInfo: xml.xmlOriginInfo,
    canEditAvancado,
    confirmarMutation,
    invalidate,
    setSaving,
    setModalOpen,
    fetchData,
  });

  // Frente 1 — extraído para `useFiscalVencimentosLoader`.
  useFiscalVencimentosLoader(vencimentoMes, setVencimentoNotaIds);

  // KPIs — agora vêm da RPC `kpis_fiscal`, refletindo o universo total filtrado
  // server-side (não apenas os 1000 primeiros que o hook traz). Isso garante
  // que cards continuem corretos quando a paginação real for ativada.
  const kpisDateRange = useMemo(() => {
    if (!emissaoMes) return { dateFrom: null as string | null, dateTo: null as string | null };
    const start = `${emissaoMes}-01`;
    const [y, m] = emissaoMes.split("-").map(Number);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    return { dateFrom: start, dateTo: end };
  }, [emissaoMes]);

  const { data: kpisRpc } = useFiscalKpis({
    dateFrom: kpisDateRange.dateFrom,
    dateTo: kpisDateRange.dateTo,
    tipos: tipoParam ? [tipoParam] : (tipoFilters.length ? tipoFilters : null),
    status: statusFromUrl.length ? statusFromUrl : (statusFilters.length ? statusFilters : null),
    modelos: modeloFilters.length ? modeloFilters : null,
    search: consultaSearch || null,
  });

  const kpis = useMemo(
    () => ({
      total: kpisRpc?.totalCount ?? 0,
      pendentes: kpisRpc?.pendente ?? 0,
      confirmadas: kpisRpc?.confirmadas_efetivas ?? 0,
      valorTotal: kpisRpc?.total_valor ?? 0,
    }),
    [kpisRpc],
  );

  const tipoOptions: MultiSelectOption[] = [{ label: "Entrada", value: "entrada" }, { label: "Saída", value: "saida" }];
  const modeloOptions: MultiSelectOption[] = Object.entries(modeloLabels).map(([v, l]) => ({ label: l, value: v }));
  const statusOptions: MultiSelectOption[] = fiscalInternalStatusOptions.map((value) => ({
    value,
    label: getFiscalInternalStatus(value).label,
  }));
  const origemOptions: MultiSelectOption[] = Object.entries(origemLabels).map(([v, l]) => ({ label: l, value: v }));
  const statusSefazOptions: MultiSelectOption[] = fiscalSefazStatusOptions.map((value) => ({
    value,
    label: getFiscalSefazStatus(value).label,
  }));

  const tipoConfig = tipoParam === "entrada"
    ? { title: "Notas de Entrada", subtitle: "Central de conferência e recebimento fiscal", addLabel: "Nova NF de Entrada", moduleKey: "notas-entrada", parceiroLabel: "Fornecedor" }
    : tipoParam === "saida"
    ? { title: "Notas de Saída", subtitle: "Notas fiscais de saída e faturamento", addLabel: "Nova NF de Saída", moduleKey: "notas-saida", parceiroLabel: "Cliente" }
    : { title: "Fiscal", subtitle: "Notas fiscais, faturas e documentos", addLabel: "Nova NF", moduleKey: "notas-fiscais", parceiroLabel: "Parceiro" };

  // Frente 1 — colunas e renderizadores extraídos para `buildFiscalColumns`.
  const columns = useMemo(
    () =>
      buildFiscalColumns({
        tipoParam,
        parceiroLabel: tipoConfig.parceiroLabel,
        isMobile,
      }),
    [tipoParam, tipoConfig.parceiroLabel, isMobile],
  );

  // Frente §6 — renderers mobile (primary/inline) extraídos para
  // `buildFiscalMobileRowActions`. Mantido como factory por render para
  // preservar o contrato funcional do DataTable sem mudanças de comportamento.
  const { renderPrimary: mobilePrimaryAction, renderInline: mobileInlineActions } =
    buildFiscalMobileRowActions({
      canEstornarNF,
      onConfirmar: handleConfirmar,
      onDanfe: openDanfe,
      onView: openView,
      onEditNavigate: (n) => navigate(`/fiscal/${n.id}`),
      onDevolucao: openDevolucao,
      onEstornar: handleEstornar,
      onBaixarXml: baixarXmlArquivado,
    });

  return (
    <><ModulePage title={tipoConfig.title} subtitle={tipoConfig.subtitle} addLabel={tipoConfig.addLabel} onAdd={openCreate}
        addButtonHelpId="fiscal.novoBtn"
        headerActions={
          <FiscalToolbarActions
            ref={xml.xmlInputRef}
            onXmlChange={xml.handleXmlImport}
            onImportClick={() => xml.xmlInputRef.current?.click()}
            onBuscarChaveClick={() => setBuscarChaveOpen(true)}
            onScannerClick={() => setScannerOpen(true)}
            compact={isMobile}
          />
        }
      >
        {pedidoCompraOriginId && (
          <OriginContextBanner
            originLabel={
              originPedidoNumero
                ? `Voltar ao Pedido de Compra ${originPedidoNumero}`
                : "Voltar ao Pedido de Compra"
            }
            onBack={() => navigate(`/pedidos-compra?drawer=pedido_compra:${pedidoCompraOriginId}`)}
            description="Vinculando NF de entrada deste pedido"
          />
        )}
        {tipoParam === "entrada" || tipoParam === "saida" ? (
          <FiscalTipoSwitchMobile current={tipoParam} />
        ) : null}
        <div data-help-id="fiscal.filtros">
        <AdvancedFilterBar
          searchValue={consultaSearch}
          onSearchChange={setConsultaSearch}
          searchPlaceholder="Número, chave de acesso…"
          activeFilters={fiscalActiveFilters}
          onRemoveFilter={handleRemoveFiscalFilter}
          onClearAll={() => { setTipoFilters([]); setModeloFilters([]); setStatusFilters([]); setOrigemFilters([]); setStatusSefazFilters([]); setEmissaoMes(""); setVencimentoMes(""); }}
          count={totalCount}
        >
          {!tipoParam && <MultiSelect options={tipoOptions} selected={tipoFilters} onChange={setTipoFilters} placeholder="Tipo" className="w-[150px]" />}
          <MultiSelect options={modeloOptions} selected={modeloFilters} onChange={setModeloFilters} placeholder="Modelos" className="w-[180px]" />
          <MultiSelect options={statusOptions} selected={statusFilters} onChange={setStatusFilters} placeholder="Status ERP" className="w-[180px]" />
          <MultiSelect options={origemOptions} selected={origemFilters} onChange={setOrigemFilters} placeholder="Origem" className="w-[180px]" />
          <MultiSelect options={statusSefazOptions} selected={statusSefazFilters} onChange={setStatusSefazFilters} placeholder="Status SEFAZ" className="w-[180px]" />
          <MonthPicker label="Emissão" value={emissaoMes} onChange={setEmissaoMes} />
          <MonthPicker label="Vencimento" value={vencimentoMes} onChange={setVencimentoMes} />
        </AdvancedFilterBar>
        </div>

        <FiscalKpisStrip
          kpis={kpis}
          isMobile={isMobile}
          pendenteFiltroAtivo={statusFilters.includes("pendente")}
          onTogglePendenteFilter={() =>
            setStatusFilters(statusFilters.includes("pendente") ? [] : ["pendente"])
          }
        />

        <div data-help-id="fiscal.tabela">
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          pageSize={PAGE_SIZE}
          serverPagination={{ page, setPage, totalCount, hasMore: (page + 1) * PAGE_SIZE < totalCount }}
          defaultSortKey={sortKey}
          defaultSortDir={sortAsc ? "asc" : "desc"}
          serverSortKey={sortKey}
          serverSortDir={sortAsc ? "asc" : "desc"}
          onServerSort={(key, dir) => {
            if (!key || !dir) {
              setSortKey("data_emissao");
              setSortAsc(false);
            } else {
              setSortKey(key as FiscalSortKey);
              setSortAsc(dir === "asc");
            }
            setPage(0);
          }}
          moduleKey={tipoConfig.moduleKey}
          showColumnToggle={true}
          onView={openView}
          onEdit={openEdit}
          emptyTitle={fiscalActiveFilters.length > 0 || consultaSearch ? "Nenhuma nota corresponde aos filtros" : "Nenhuma nota fiscal encontrada"}
          emptyDescription={fiscalActiveFilters.length > 0 || consultaSearch ? "Ajuste ou limpe os filtros para ver mais resultados." : "Importe um XML, busque por chave ou emita uma nova nota."}
          emptyAction={
            (fiscalActiveFilters.length > 0 || consultaSearch) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConsultaSearch("");
                  setTipoFilters([]);
                  setModeloFilters([]);
                  setStatusFilters([]);
                  setOrigemFilters([]);
                  setStatusSefazFilters([]);
                  setEmissaoMes("");
                  setVencimentoMes("");
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
          mobileStatusKey="status"
          mobileIdentifierKey="parceiro"
          mobilePrimaryAction={mobilePrimaryAction}
          mobileInlineActions={mobileInlineActions}
        />
        </div>
      </ModulePage>

      {/* Form Modal - Create */}
      <NfeCreateFormModal
        open={modalOpen && mode === "create"}
        onClose={() => { setModalOpen(false); xml.resetXmlOriginState(); }}
        form={form as unknown as Record<string, string | number | boolean>}
        setForm={(next) => setForm(next as unknown as typeof form)}
        items={items}
        setItems={setItems}
        itemContaContabil={itemContaContabil}
        setItemContaContabil={setItemContaContabil}
        parcelas={parcelas}
        setParcelas={setParcelas}
        primeiroVencimento={primeiroVencimento}
        setPrimeiroVencimento={setPrimeiroVencimento}
        intervaloDias={intervaloDias}
        setIntervaloDias={setIntervaloDias}
        parcelasPlano={parcelasPlano}
        setParcelasPlano={setParcelasPlano}
        saving={saving}
        onSubmit={handleSubmit}
        fornecedores={fornecedores}
        clientes={clientes}
        produtos={produtos}
        ordensVenda={ordensVenda}
        contasContabeis={contasContabeis}
        cartoes={cartoes}
        valorProdutos={valorProdutos}
        totalImpostos={totalImpostos}
        totalNF={totalNF}
        xmlOriginInfo={xml.xmlOriginInfo}
        traducaoLinhasCount={xml.traducaoLinhas.length}
        onAbrirTraducao={xml.openTraducaoEdit}
        onCriarProdutoQuick={xml.openQuickProdutoFromForm}
        onCriarFornecedorQuick={xml.openQuickFornecedorFromForm}
      />

      {/* Edit Modal */}
      {selected && (
        <NotaFiscalEditModal
          open={modalOpen && mode === "edit"}
          onClose={() => setModalOpen(false)}
          selected={selected}
          form={form}
          setForm={setForm}
          items={items}
          setItems={setItems}
          itemContaContabil={itemContaContabil}
          setItemContaContabil={setItemContaContabil}
          parcelas={parcelas}
          setParcelas={setParcelas}
          parcelasPlano={parcelasPlano}
          setParcelasPlano={setParcelasPlano}
          saving={saving}
          onSubmit={handleSubmit}
          onCancelarRascunho={selected.status === "pendente" ? handleCancelarRascunho : undefined}
          fornecedores={fornecedores}
          clientes={clientes}
          ordensVenda={ordensVenda}
          contasContabeis={contasContabeis}
          produtosCrud={produtos}
          valorProdutos={valorProdutos}
          totalImpostos={totalImpostos}
          totalNF={totalNF}
          cartoes={cartoes}
        />
      )}

      {/* View Drawer */}
      <NotaFiscalDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selected}
        onEdit={openEdit}
        onEditPagamento={(nf) => { setDrawerOpen(false); openEdit(nf); }}
        onDelete={handleInativar}
        onConfirmar={handleConfirmar}
        onEstornar={handleEstornar}
        onDevolucao={openDevolucao}
        onDanfe={(nf) => { setDrawerOpen(false); openDanfe(nf); }}
        onAnexarXml={xml.triggerAnexarXml}
        onPermanentlyDeleted={() => { setDrawerOpen(false); fetchData(); }}
        onRefresh={fetchData}
      />

      <FiscalDevolucaoFlow ref={devolucaoFlowRef} onSuccess={fetchData} />
      <FiscalDanfeViewer ref={danfeViewerRef} />

      {/* Busca de NF-e por chave de acesso (44 dígitos) — DistDFe local + sync SEFAZ */}
      <FiscalChaveDialogsSlot
        buscarChaveOpen={buscarChaveOpen}
        buscarChaveInicial={buscarChaveInicial}
        setBuscarChaveOpen={setBuscarChaveOpen}
        setBuscarChaveInicial={setBuscarChaveInicial}
        scannerOpen={scannerOpen}
        setScannerOpen={setScannerOpen}
        processarXmlImportado={xml.processarXmlImportado}
      />

      <FiscalXmlSlots xml={xml} produtos={produtos} />

      {confirmDialog}
    </>
  );
};

export default Fiscal;
