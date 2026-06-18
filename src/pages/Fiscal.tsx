import { useEffect, useMemo, useState, useRef } from "react";
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
import { supabase } from "@/integrations/supabase/client";
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
import {
  registrarEventoFiscal,
  listNotaFiscalItensCompletos,
  upsertNotaFiscalComItens,
} from "@/services/fiscal.service";
import { useNFeXmlImport } from "@/pages/fiscal/hooks/useNFeXmlImport";
import type { TraducaoLinha } from "@/pages/fiscal/hooks/useNFeXmlImport";
import { useFiscalFilters } from "@/pages/fiscal/hooks/useFiscalFilters";
import { useFiscalKpis } from "@/pages/fiscal/hooks/useFiscalKpis";
import {
  useNotasFiscaisPaged,
  useResetPageOnFiltersChange,
} from "@/pages/fiscal/hooks/useNotasFiscaisPaged";
import { TraducaoXmlDrawer } from "@/pages/fiscal/components/TraducaoXmlDrawer";
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
import {
  emptyFiscalForm as emptyForm,
  type FiscalFormState as FiscalForm,
  type NfItemFiscalData,
} from "@/pages/fiscal/hooks/useFiscalNotaForm";
import type { NotaFiscal as NotaFiscalDomain } from "@/types/domain";
import { QuickAddProductModal } from "@/components/QuickAddProductModal";
import { QuickAddSupplierModal } from "@/components/QuickAddSupplierModal";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import { NfeCreateFormModal } from "@/pages/fiscal/components/NfeCreateFormModal";
import { FiscalKpisStrip } from "@/pages/fiscal/components/FiscalKpisStrip";
import { buildFiscalMobileRowActions } from "@/pages/fiscal/components/FiscalMobileRowActions";
import { useFiscalAutoOpen } from "@/pages/fiscal/hooks/useFiscalAutoOpen";
import { useFiscalLifecycleActions } from "@/pages/fiscal/hooks/useFiscalLifecycleActions";
import { useFiscalSubmit } from "@/pages/fiscal/hooks/useFiscalSubmit";
import { logger } from "@/lib/logger";

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
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const anexarXmlInputRef = useRef<HTMLInputElement>(null);
  const [anexarTargetNf, setAnexarTargetNf] = useState<NotaFiscal | null>(null);
  const [buscarChaveOpen, setBuscarChaveOpen] = useState(false);
  const [buscarChaveInicial, setBuscarChaveInicial] = useState<string | undefined>(undefined);
  const [scannerOpen, setScannerOpen] = useState(false);
  const danfeViewerRef = useRef<FiscalDanfeViewerHandle>(null);
  const devolucaoFlowRef = useRef<FiscalDevolucaoFlowHandle>(null);
  const [vencimentoNotaIds, setVencimentoNotaIds] = useState<Set<string> | null>(null);
  // Tradução XML — etapa explícita de mapeamento entre o XML do fornecedor e o cadastro interno.
  const [traducaoLinhas, setTraducaoLinhas] = useState<TraducaoLinha[]>([]);
  const [traducaoOpen, setTraducaoOpen] = useState(false);
  const [traducaoReadOnly, setTraducaoReadOnly] = useState(false);
  /** Snapshot do resultado do XML aguardando confirmação da tradução (quando há pendência). */
  const [pendingXmlImport, setPendingXmlImport] = useState<{
    nfe: import("@/lib/nfeXmlParser").NFeData;
    tipo: "entrada" | "saida";
    fornecedorId: string;
    fornecedorNome: string;
    clienteId?: string;
    clienteNome?: string;
    fiscalMap: Record<number, NfItemFiscalData>;
    xmlText?: string;
    /** Quando preenchido, o XML deve ser anexado a esta NF existente em vez de criar uma nova. */
    anexarNa?: NotaFiscal;
  } | null>(null);
  /** True quando a NF aberta no modal foi originada de um XML — controla o banner. */
  const [xmlOriginInfo, setXmlOriginInfo] = useState<{
    fornecedorId: string;
    fornecedorNome: string;
    clienteId?: string;
    clienteNome?: string;
    tipo?: "entrada" | "saida";
    cobranca?: import("@/lib/nfeXmlParser").NFeCobranca;
  } | null>(null);
  // Quick-add disparado a partir do drawer de tradução XML
  const [quickProdutoLinhaIdx, setQuickProdutoLinhaIdx] = useState<number | null>(null);
  const [quickProdutoNome, setQuickProdutoNome] = useState("");
  // Quick-add de fornecedor a partir do XML (emitente não cadastrado)
  const [quickFornecedorOpen, setQuickFornecedorOpen] = useState(false);
  const [quickFornecedorDefaults, setQuickFornecedorDefaults] = useState<{
    nome_razao_social?: string;
    cpf_cnpj?: string;
    email?: string;
    telefone?: string;
  }>({});
  // Quick-add de cliente a partir do XML (destinatário não cadastrado em NF de saída)
  const [quickClienteOpen, setQuickClienteOpen] = useState(false);
  const [quickClienteDefaults, setQuickClienteDefaults] = useState<{
    nome_razao_social?: string;
    cpf_cnpj?: string;
    tipo_pessoa?: "F" | "J";
    inscricao_estadual?: string;
    email?: string;
    telefone?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  }>({});
  const { canEditAvancado } = useCanEditFinanceiroAvancado();

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
    setXmlOriginInfo: (v) => setXmlOriginInfo(v as never),
    setTraducaoLinhas: (v) => setTraducaoLinhas(v as never),
    setDrawerOpen,
    applyDeepLinkSelected: setSelected,
  });

  const { importXml } = useNFeXmlImport({
    fornecedores: fornecedores,
    produtos: produtos,
    clientes: clientes,
    cnpjEmpresa,
  });

  const openView = (n: NotaFiscal) => {
    setSelected(n);
    setDrawerOpen(true);
  };

  const openDanfe = (n: NotaFiscal) => danfeViewerRef.current?.open(n);

  /** Aplica o resultado da tradução ao form/items e abre o modal da NF. */
  const aplicarImportacaoXml = async (
    nfe: import("@/lib/nfeXmlParser").NFeData,
    tipo: "entrada" | "saida",
    fornecedorId: string,
    fornecedorNome: string,
    clienteId: string,
    clienteNome: string,
    linhas: TraducaoLinha[],
    fiscalMap: Record<number, NfItemFiscalData>,
    xmlText?: string,
    anexarNa?: NotaFiscal,
  ) => {
    const newItems: GridItem[] = linhas.map((t) => {
      const qtdInterna = t.fatorConversao > 0 ? t.xmlQuantidade * t.fatorConversao : t.xmlQuantidade;
      const vUnInterno = qtdInterna > 0 ? t.xmlValorTotal / qtdInterna : t.xmlValorUnitario;
      const matched = produtos.find((p) => p.id === t.produtoId);
      return {
        produto_id: t.produtoId,
        codigo: t.xmlCodigo,
        descricao: matched?.nome || t.xmlDescricao,
        quantidade: qtdInterna,
        valor_unitario: vUnInterno,
        valor_total: t.xmlValorTotal,
      };
    });
    // Quando o XML traz protocolo SEFAZ (procNFe autorizado), pré-marcamos
    // como já confirmada/autorizada — caso contrário fica como rascunho.
    const temProtocolo = !!nfe.protocolo;
    // Upload do XML cru ao Storage. Falha NÃO bloqueia importação.
    let caminhoXmlInicial = "";
    if (xmlText && nfe.chaveAcesso) {
      try {
        const { uploadNfeXml } = await import("@/services/fiscal/xmlStorage.service");
        const { path } = await uploadNfeXml({
          chave: nfe.chaveAcesso,
          tipo,
          xmlText,
          dataEmissao: nfe.dataEmissao,
        });
        caminhoXmlInicial = path;
      } catch (err) {
        logger.warn("[fiscal] falha ao arquivar XML no Storage:", err);
        toast.warning("XML importado, mas não foi arquivado no Storage (download original ficará indisponível).");
      }
    }
    const baseForm: typeof emptyForm = anexarNa
      ? {
          ...emptyForm,
          // Preserva campos não-fiscais da NF original.
          movimenta_estoque: anexarNa.movimenta_estoque !== false,
          gera_financeiro: anexarNa.gera_financeiro !== false,
          forma_pagamento: anexarNa.forma_pagamento || "",
          condicao_pagamento: anexarNa.condicao_pagamento || "a_vista",
          ordem_venda_id: anexarNa.ordem_venda_id || "",
          conta_contabil_id: anexarNa.conta_contabil_id || "",
          observacoes: anexarNa.observacoes || "",
        }
      : { ...emptyForm };
    setForm({
      ...baseForm,
      tipo,
      numero: nfe.numero,
      serie: nfe.serie,
      modelo_documento: nfe.modelo || "55",
      chave_acesso: nfe.chaveAcesso,
      data_emissao: nfe.dataEmissao || new Date().toISOString().split("T")[0],
      fornecedor_id: anexarNa
        ? (anexarNa.fornecedor_id || (tipo === "entrada" ? fornecedorId : ""))
        : (tipo === "entrada" ? fornecedorId : ""),
      cliente_id: anexarNa
        ? (anexarNa.cliente_id || (tipo === "saida" ? clienteId : ""))
        : (tipo === "saida" ? clienteId : ""),
      // Em anexação, preservamos o status atual da NF — só atualizamos status_sefaz
      // se o XML trouxer protocolo SEFAZ (substitui "nao_enviada" por "importada_externa").
      status: anexarNa ? anexarNa.status : (temProtocolo ? "importada" : "pendente"),
      status_sefaz: anexarNa
        ? (temProtocolo ? "importada_externa" : (anexarNa.status_sefaz || "nao_enviada"))
        : (temProtocolo ? "importada_externa" : "nao_enviada"),
      frete_valor: nfe.valorFrete,
      icms_valor: nfe.icmsTotal,
      ipi_valor: nfe.ipiTotal,
      pis_valor: nfe.pisTotal,
      cofins_valor: nfe.cofinsTotal,
      icms_st_valor: nfe.icmsStTotal,
      desconto_valor: nfe.valorDesconto,
      outras_despesas: nfe.valorOutrasDespesas,
      valor_total: nfe.valorTotal,
      origem: anexarNa ? "xml_anexado" : "xml_importado",
      caminho_xml: caminhoXmlInicial,
    });
    setItems(newItems);
    if (anexarNa) {
      setMode("edit");
      setSelected(anexarNa);
    } else {
      setMode("create");
      setSelected(null);
    }
    setItemContaContabil({});
    setItemFiscalData(fiscalMap);
    setTraducaoLinhas(linhas);
    setXmlOriginInfo({ tipo, fornecedorId, fornecedorNome, clienteId, clienteNome, cobranca: nfe.cobranca });
    // Pré-preenche condição/forma/vencimentos a partir das duplicatas do XML
    // (inclui o fallback parseado de infCpl "VENCT. dd/mm/aaaa").
    const dups = nfe.cobranca?.duplicatas ?? [];
    if (dups.length > 0) {
      const { mapTPagSefaz } = await import("@/lib/financeiro");
      const formaPag = nfe.cobranca?.tPag ? mapTPagSefaz(nfe.cobranca.tPag) : "boleto_dda";
      const primeiro = dups[0].vencimento || "";
      const intervalo = dups.length > 1 && dups[0].vencimento && dups[1].vencimento
        ? Math.max(
            1,
            Math.round(
              (new Date(dups[1].vencimento).getTime() - new Date(dups[0].vencimento).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 30;
      setForm((prev) => ({
        ...prev,
        condicao_pagamento: "a_prazo",
        forma_pagamento: prev.forma_pagamento || formaPag || "boleto_dda",
        data_vencimento: primeiro,
        intervalo_parcelas_dias: intervalo,
      }));
      setParcelas(dups.length);
      setPrimeiroVencimento(primeiro);
      setParcelasPlano(
        dups.map((d, i) => ({ numero: i + 1, vencimento: d.vencimento, valor: d.valor })),
      );
    }
    setModalOpen(true);
    if (anexarNa) {
      toast.info(
        `XML anexado à NF ${anexarNa.numero}. Revise os itens traduzidos e clique em Salvar para confirmar.`,
      );
    }
  };

  /** Persiste o de-para (produtos_fornecedores) para as linhas marcadas como "salvar tradução". */
  const salvarDeParaFornecedor = async (fornecedorId: string, linhas: TraducaoLinha[]) => {
    const aSalvar = linhas.filter((l) => l.salvarDePara && l.produtoId && l.xmlCodigo);
    if (aSalvar.length === 0 || !fornecedorId) return;
    try {
      const rows = aSalvar.map((l) => ({
        produto_id: l.produtoId,
        fornecedor_id: fornecedorId,
        referencia_fornecedor: l.xmlCodigo,
        descricao_fornecedor: l.xmlDescricao,
        unidade_fornecedor: l.xmlUnidade,
        fator_conversao: l.fatorConversao,
      }));
      // Upsert por (produto_id, fornecedor_id) — chave natural do de-para.
      const { error } = await supabase
        .from("produtos_fornecedores")
        .upsert(rows, { onConflict: "produto_id,fornecedor_id" });
      if (error) throw error;
    } catch (err) {
      logger.error("[fiscal] salvar de-para fornecedor:", err);
      toast.warning("NF importada, mas não foi possível salvar a tradução para o fornecedor.");
    }
  };

  const handleXmlImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await processarXmlImportado(file);
    } catch (err: unknown) {
      logger.error("[fiscal] XML import:", err);
      toast.error(`Erro ao importar XML: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (xmlInputRef.current) xmlInputRef.current.value = "";
  };

  /** Handler do input dedicado a anexar XML em uma NF existente. */
  const handleAnexarXmlChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const targetNf = anexarTargetNf;
    if (anexarXmlInputRef.current) anexarXmlInputRef.current.value = "";
    if (!file || !targetNf) return;
    try {
      await processarXmlParaAnexar(file, targetNf);
    } catch (err: unknown) {
      logger.error("[fiscal] anexar XML:", err);
      toast.error(`Erro ao anexar XML: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAnexarTargetNf(null);
    }
  };

  /**
   * Importa o XML reaproveitando o pipeline (parser + tradução), mas em vez de
   * criar uma nova NF, anexa o resultado a `targetNf`. Mantém o `fornecedor_id`
   * da NF existente e força `origem='xml_anexado'`.
   */
  const processarXmlParaAnexar = async (input: File | string, targetNf: NotaFiscal) => {
    const result = await importXml(input);
    if (!result) return;
    const { nfe, xmlText, tipo, fornecedorId, clienteId, fiscalMap, traducao, traducaoOk } = result;
    // Validação leve: NF de entrada precisa bater CNPJ do emitente com o fornecedor da NF.
    if (targetNf.tipo === "entrada" && tipo !== "entrada") {
      toast.error("XML não corresponde a uma NF de entrada (emitente é a própria empresa).");
      return;
    }
    const fornecedorParaAnexar = targetNf.fornecedor_id || fornecedorId || "";
    const clienteParaAnexar = targetNf.cliente_id || clienteId || "";
    const fornecedorNome =
      fornecedores.find((f) => f.id === fornecedorParaAnexar)?.nome_razao_social
      || nfe.emitente.razaoSocial
      || "—";
    const clienteNome =
      clientes.find((c) => c.id === clienteParaAnexar)?.nome_razao_social
      || nfe.destinatario?.razaoSocial
      || "—";

    setDrawerOpen(false);

    if (traducaoOk) {
      aplicarImportacaoXml(
        nfe,
        tipo,
        fornecedorParaAnexar,
        fornecedorNome,
        clienteParaAnexar,
        clienteNome,
        traducao,
        fiscalMap as Record<number, NfItemFiscalData>,
        xmlText,
        targetNf,
      );
    } else {
      setPendingXmlImport({
        nfe,
        tipo,
        fornecedorId: fornecedorParaAnexar,
        fornecedorNome,
        clienteId: clienteParaAnexar,
        clienteNome,
        fiscalMap: fiscalMap as Record<number, NfItemFiscalData>,
        xmlText,
        anexarNa: targetNf,
      });
      setTraducaoLinhas(traducao);
      setTraducaoReadOnly(false);
      setTraducaoOpen(true);
    }
  };

  /**
   * Núcleo do fluxo de importação de XML, agnóstico à origem (upload manual
   * ou consulta por chave de acesso). Centralizar aqui evita divergência
   * de UX (traducao drawer, quick-add fornecedor, fluxo de aplicação).
   */
  const processarXmlImportado = async (input: File | string) => {
      const result = await importXml(input);
      if (!result) {
        return;
      }
      const { nfe, xmlText, tipo, fornecedorId, clienteId, fiscalMap, traducao, traducaoOk } = result;
      const fornecedorNome = fornecedores.find((f) => f.id === fornecedorId)?.nome_razao_social || nfe.emitente.razaoSocial || "—";
      const clienteNome = clientes.find((c) => c.id === clienteId)?.nome_razao_social || nfe.destinatario?.razaoSocial || "—";

      // NF de saída sem cliente cadastrado → quick-add com dados do destinatário.
      if (tipo === "saida" && !clienteId && nfe.destinatario?.cpfCnpj) {
        const d = nfe.destinatario;
        setQuickClienteDefaults({
          nome_razao_social: d.razaoSocial || "",
          cpf_cnpj: d.cpfCnpj,
          tipo_pessoa: d.tipoPessoa,
          inscricao_estadual: d.inscricaoEstadual || "",
          email: d.email || "",
          telefone: d.telefone || "",
          cep: d.cep || "",
          logradouro: d.logradouro || "",
          numero: d.numero || "",
          bairro: d.bairro || "",
          cidade: d.municipio || "",
          uf: d.uf || "",
        });
        setPendingXmlImport({ nfe, tipo, fornecedorId: "", fornecedorNome: "", clienteId: "", clienteNome: d.razaoSocial || "", fiscalMap: fiscalMap as Record<number, NfItemFiscalData>, xmlText });
        setTraducaoLinhas(traducao);
        setQuickClienteOpen(true);
        toast.info(`Cliente ${d.cpfCnpj} não cadastrado. Cadastre rapidamente para continuar.`);
        return;
      }

      // NF de entrada sem fornecedor → quick-add com dados do emitente.
      if (tipo === "entrada" && !fornecedorId && nfe.emitente?.cnpj) {
        setQuickFornecedorDefaults({
          nome_razao_social: nfe.emitente.razaoSocial || "",
          cpf_cnpj: nfe.emitente.cnpj,
          email: (nfe.emitente as { email?: string }).email || "",
          telefone: (nfe.emitente as { telefone?: string }).telefone || "",
        });
        // Mantém pendingXmlImport para retomar após cadastro do fornecedor.
        setPendingXmlImport({ nfe, tipo, fornecedorId: "", fornecedorNome, clienteId: "", clienteNome: "", fiscalMap: fiscalMap as Record<number, NfItemFiscalData>, xmlText });
        setTraducaoLinhas(traducao);
        setQuickFornecedorOpen(true);
        toast.info(`Fornecedor ${nfe.emitente.cnpj} não cadastrado. Cadastre rapidamente para continuar.`);
        return;
      }

      if (traducaoOk) {
        // 100% OK → vai direto pro form. Banner permite reabrir em modo somente-leitura.
        aplicarImportacaoXml(nfe, tipo, fornecedorId, fornecedorNome, clienteId, clienteNome, traducao, fiscalMap as Record<number, NfItemFiscalData>, xmlText);
        toast.success("XML importado. Tradução automática aplicada.");
      } else {
        // Pendência → drawer obrigatório, segura abertura do form.
        setPendingXmlImport({ nfe, tipo, fornecedorId, fornecedorNome, clienteId, clienteNome, fiscalMap: fiscalMap as Record<number, NfItemFiscalData>, xmlText });
        setTraducaoLinhas(traducao);
        setTraducaoReadOnly(false);
        setTraducaoOpen(true);
      }
  };

  const handleTraducaoConfirm = async (linhas: TraducaoLinha[]) => {
    if (pendingXmlImport) {
      // Fluxo "tinha pendência": agora aplica e abre o form.
      const { nfe, tipo, fornecedorId, fornecedorNome, clienteId, clienteNome, fiscalMap, xmlText, anexarNa } = pendingXmlImport;
      if (tipo === "entrada") await salvarDeParaFornecedor(fornecedorId, linhas);
      aplicarImportacaoXml(nfe, tipo, fornecedorId, fornecedorNome, clienteId || "", clienteNome || "", linhas, fiscalMap, xmlText, anexarNa);
      setPendingXmlImport(null);
      setTraducaoOpen(false);
      toast.success(anexarNa
        ? `Tradução confirmada. Revise a anexação na NF ${anexarNa.numero} e salve.`
        : "Tradução confirmada. Revise a NF e salve.");
    } else if (xmlOriginInfo) {
      // Reabertura via banner em modo edição (caso usuário queira ajustar): atualiza items e salva de-para.
      await salvarDeParaFornecedor(xmlOriginInfo.fornecedorId, linhas);
      const newItems: GridItem[] = linhas.map((t) => {
        const qtdInterna = t.fatorConversao > 0 ? t.xmlQuantidade * t.fatorConversao : t.xmlQuantidade;
        const vUnInterno = qtdInterna > 0 ? t.xmlValorTotal / qtdInterna : t.xmlValorUnitario;
        const matched = produtos.find((p) => p.id === t.produtoId);
        return {
          produto_id: t.produtoId,
          codigo: t.xmlCodigo,
          descricao: matched?.nome || t.xmlDescricao,
          quantidade: qtdInterna,
          valor_unitario: vUnInterno,
          valor_total: t.xmlValorTotal,
        };
      });
      setItems(newItems);
      setTraducaoLinhas(linhas);
      setTraducaoOpen(false);
      toast.success("Tradução atualizada.");
    }
  };

  const handleTraducaoCancel = () => {
    setTraducaoOpen(false);
    if (pendingXmlImport) {
      setPendingXmlImport(null);
      toast.info("Importação de XML cancelada.");
    }
  };

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
    traducaoLinhas,
    xmlOriginInfo,
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
            ref={xmlInputRef}
            onXmlChange={handleXmlImport}
            onImportClick={() => xmlInputRef.current?.click()}
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
        onClose={() => { setModalOpen(false); setXmlOriginInfo(null); setTraducaoLinhas([]); }}
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
        xmlOriginInfo={xmlOriginInfo}
        traducaoLinhasCount={traducaoLinhas.length}
        onAbrirTraducao={() => { setTraducaoReadOnly(false); setTraducaoOpen(true); }}
        onCriarProdutoQuick={() => { setQuickProdutoLinhaIdx(-1); setQuickProdutoNome(""); }}
        onCriarFornecedorQuick={() => {
          setQuickFornecedorDefaults({});
          setQuickFornecedorOpen(true);
        }}
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
        onAnexarXml={(nf) => {
          setAnexarTargetNf(nf);
          // Pequeno delay para garantir que o ref já está montado antes do click.
          setTimeout(() => anexarXmlInputRef.current?.click(), 0);
        }}
        onPermanentlyDeleted={() => { setDrawerOpen(false); fetchData(); }}
        onRefresh={fetchData}
      />

      {/* Input dedicado para "Anexar XML" no drawer de uma NF existente. */}
      <input
        ref={anexarXmlInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={handleAnexarXmlChange}
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
        processarXmlImportado={processarXmlImportado}
      />

      {/* Tradução XML — etapa explícita XML→cadastro. Obrigatório com pendência, opcional via banner. */}
      <TraducaoXmlDrawer
        open={traducaoOpen}
        readOnly={traducaoReadOnly}
        fornecedorNome={pendingXmlImport?.fornecedorNome ?? xmlOriginInfo?.fornecedorNome ?? ""}
        fornecedorId={pendingXmlImport?.fornecedorId ?? xmlOriginInfo?.fornecedorId ?? ""}
        produtos={produtos}
        linhas={traducaoLinhas}
        onCancel={handleTraducaoCancel}
        onConfirm={handleTraducaoConfirm}
        onCreateProduto={(idx, nome) => {
          setQuickProdutoLinhaIdx(idx);
          setQuickProdutoNome(nome);
        }}
      />

      {/* Cadastro rápido de produto a partir do XML */}
      <QuickAddProductModal
        open={quickProdutoLinhaIdx !== null}
        defaultNome={quickProdutoNome}
        onClose={() => { setQuickProdutoLinhaIdx(null); setQuickProdutoNome(""); }}
        onCreated={async (produtoId) => {
          const idx = quickProdutoLinhaIdx;
          await refetchProdutos();
          if (idx !== null && idx >= 0) {
            setTraducaoLinhas((prev) => prev.map((l) =>
              l.index === idx ? { ...l, produtoId, matchStatus: "manual", pendente: false, salvarDePara: true } : l
            ));
          } else if (idx === -1) {
            // Entrada manual via ItemsGrid: anexa o novo produto à última linha do grid (ou cria uma).
            setItems((prev) => {
              const next = [...prev];
              const target = next.findIndex((i) => !i.produto_id);
              const matched = produtos.find((p) => p.id === produtoId) as { codigo_interno?: string; nome?: string; preco_custo?: number } | undefined;
              const row = {
                produto_id: produtoId,
                codigo: String(matched?.codigo_interno || ""),
                descricao: String(matched?.nome || ""),
                quantidade: 0,
                valor_unitario: Number(matched?.preco_custo || 0),
                valor_total: 0,
              };
              if (target >= 0) next[target] = row; else next.push(row);
              return next;
            });
          }
          setQuickProdutoLinhaIdx(null);
          setQuickProdutoNome("");
        }}
      />

      {/* Cadastro rápido de fornecedor a partir do XML */}
      <QuickAddSupplierModal
        open={quickFornecedorOpen}
        defaults={quickFornecedorDefaults}
        onClose={() => { setQuickFornecedorOpen(false); }}
        onCreated={async (fornecedorId) => {
          await refetchFornecedores();
          setQuickFornecedorOpen(false);
          // Retoma o fluxo de importação XML pendente
          if (pendingXmlImport) {
            const fornecedorNome = quickFornecedorDefaults.nome_razao_social || "";
            const newPending = { ...pendingXmlImport, fornecedorId, fornecedorNome };
            setPendingXmlImport(newPending);
            setTraducaoReadOnly(false);
            setTraducaoOpen(true);
          } else {
            // Cadastro inline a partir do form de NF: seleciona o novo fornecedor.
            setForm((prev) => ({ ...prev, fornecedor_id: fornecedorId }));
            toast.success("Fornecedor cadastrado e selecionado.");
          }
        }}
      />

      {/* Cadastro rápido de cliente a partir do XML (NF de saída) */}
      <QuickAddClientModal
        open={quickClienteOpen}
        defaults={quickClienteDefaults}
        onClose={() => setQuickClienteOpen(false)}
        onCreated={async (clienteId) => {
          await refetchClientes();
          setQuickClienteOpen(false);
          if (pendingXmlImport && pendingXmlImport.tipo === "saida") {
            const clienteNome = quickClienteDefaults.nome_razao_social || "";
            // Reaplica a importação agora com o cliente recém-criado.
            aplicarImportacaoXml(
              pendingXmlImport.nfe,
              "saida",
              "",
              "",
              clienteId,
              clienteNome,
              traducaoLinhas,
              pendingXmlImport.fiscalMap,
            );
            setPendingXmlImport(null);
            toast.success("Cliente cadastrado. NF de saída pronta para revisão.");
          } else {
            setForm((prev) => ({ ...prev, cliente_id: clienteId }));
            toast.success("Cliente cadastrado e selecionado.");
          }
        }}
      />

      {confirmDialog}
    </>
  );
};

export default Fiscal;
