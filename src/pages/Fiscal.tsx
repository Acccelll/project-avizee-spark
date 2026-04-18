import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/FormModal";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { Upload } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { ItemsGrid, type GridItem } from "@/components/ui/ItemsGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { formatCurrency, formatDate } from "@/lib/format";
import { FileText, DollarSign, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { parseNFeXml, type NFeData } from "@/lib/nfeXmlParser";
import { DanfeViewer } from "@/components/DanfeViewer";
import { DevolucaoDialog } from "@/components/fiscal/DevolucaoDialog";
import { NotaFiscalDrawer } from "@/components/fiscal/NotaFiscalDrawer";
import { confirmarNotaFiscal, estornarNotaFiscal, registrarEventoFiscal, verificarDuplicidadeChave } from "@/services/fiscal.service";
import { NotaFiscalEditModal } from "@/components/fiscal/NotaFiscalEditModal";
import { useActionLock } from "@/hooks/useActionLock";

export interface NotaFiscal {
  id: string; tipo: string; numero: string; serie: string; chave_acesso: string;
  data_emissao: string; fornecedor_id: string; cliente_id: string;
  valor_total: number; status: string; forma_pagamento: string; condicao_pagamento: string;
  observacoes: string; ativo: boolean; movimenta_estoque: boolean; gera_financeiro: boolean;
  ordem_venda_id: string | null; conta_contabil_id: string | null;
  modelo_documento: string; nf_referenciada_id: string | null; tipo_operacao: string;
  frete_valor: number; icms_valor: number; ipi_valor: number; pis_valor: number;
  cofins_valor: number; icms_st_valor: number; desconto_valor: number; outras_despesas: number;
  origem?: string; status_sefaz?: string; natureza_operacao?: string;
  fornecedores?: { nome_razao_social: string; cpf_cnpj: string };
  clientes?: { nome_razao_social: string };
  ordens_venda?: { numero: string };
}

interface FiscalForm {
  tipo: string;
  numero: string;
  serie: string;
  chave_acesso: string;
  data_emissao: string;
  fornecedor_id: string;
  cliente_id: string;
  valor_total: number;
  status: string;
  observacoes: string;
  movimenta_estoque: boolean;
  gera_financeiro: boolean;
  forma_pagamento: string;
  condicao_pagamento: string;
  ordem_venda_id: string;
  conta_contabil_id: string;
  modelo_documento: string;
  frete_valor: number;
  icms_valor: number;
  ipi_valor: number;
  pis_valor: number;
  cofins_valor: number;
  icms_st_valor: number;
  desconto_valor: number;
  outras_despesas: number;
  origem: string;
  [key: string]: string | number | boolean;
}

const emptyForm: FiscalForm = {
  tipo: "entrada", numero: "", serie: "1", chave_acesso: "", data_emissao: new Date().toISOString().split("T")[0],
  fornecedor_id: "", cliente_id: "", valor_total: 0, status: "pendente", observacoes: "",
  movimenta_estoque: true, gera_financeiro: true, forma_pagamento: "", condicao_pagamento: "a_vista",
  ordem_venda_id: "", conta_contabil_id: "", modelo_documento: "55",
  frete_valor: 0, icms_valor: 0, ipi_valor: 0, pis_valor: 0, cofins_valor: 0,
  icms_st_valor: 0, desconto_valor: 0, outras_despesas: 0, origem: "manual",
};

const modeloLabels: Record<string, string> = {
  '55': 'NF-e', '65': 'NFC-e', '57': 'CT-e', '67': 'CT-e OS', 'nfse': 'NFS-e', 'outro': 'Outro'
};

const origemLabels: Record<string, string> = { manual: "Manual", pedido: "Pedido", importacao_xml: "Importação XML" };
const statusSefazLabels: Record<string, string> = { nao_enviada: "Não Enviada", pendente_envio: "Pendente Envio", em_processamento: "Em Processamento", autorizada: "Autorizada", rejeitada: "Rejeitada", cancelada_sefaz: "Cancelada SEFAZ", inutilizada: "Inutilizada", importada_externa: "Importada Externa" };

interface FornecedorRef { id: string; nome_razao_social: string; cpf_cnpj: string | null; }
interface ClienteRef { id: string; nome_razao_social: string; cpf_cnpj: string | null; }
interface ProdutoRef { id: string; nome: string; sku: string | null; codigo_interno: string | null; }
interface OrdemVendaRef { id: string; numero: string; clientes?: { nome_razao_social: string } | null; }
interface ContaContabilRef { id: string; codigo: string; descricao: string; }
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

/** Fiscal fields preserved per item index across edits. */
interface NfItemFiscalData {
  cfop?: string | null; cst?: string | null; ncm?: string | null; unidade?: string | null;
  descricao?: string | null; icms_valor?: number | null; icms_aliquota?: number | null;
  icms_base?: number | null; ipi_valor?: number | null; ipi_aliquota?: number | null;
  pis_valor?: number | null; pis_aliquota?: number | null; base_pis?: number | null;
  cofins_valor?: number | null; cofins_aliquota?: number | null; base_cofins?: number | null;
  valor_st?: number | null; base_st?: number | null;
  csosn?: string | null; cst_pis?: string | null; cst_cofins?: string | null;
  cst_ipi?: string | null; desconto?: number | null; codigo_produto?: string | null;
}

interface DevolucaoItem extends NfItemRow { qtd_devolver: number; nome: string; }

const Fiscal = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, loading, create, update, remove, fetchData } = useSupabaseCrud<NotaFiscal>({
    table: "notas_fiscais", select: "*, fornecedores(nome_razao_social, cpf_cnpj), clientes(nome_razao_social), ordens_venda(numero)"
  });
  const fornecedoresCrud = useSupabaseCrud<FornecedorRef>({ table: "fornecedores" });
  const clientesCrud = useSupabaseCrud<ClienteRef>({ table: "clientes" });
  const produtosCrud = useSupabaseCrud<ProdutoRef>({ table: "produtos" });
  const [ordensVenda, setOrdensVenda] = useState<OrdemVendaRef[]>([]);
  const [contasContabeis, setContasContabeis] = useState<ContaContabilRef[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<NotaFiscal | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState({ ...emptyForm });
  const [items, setItems] = useState<GridItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [parcelas, setParcelas] = useState(1);
  const [searchParams] = useSearchParams();
  const [consultaSearch, setConsultaSearch] = useState("");
  const [itemContaContabil, setItemContaContabil] = useState<Record<number, string>>({});
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const [danfeOpen, setDanfeOpen] = useState(false);
  const [danfeData, setDanfeData] = useState<Record<string, unknown> | null>(null);
  const [modeloFilters, setModeloFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tipoFilters, setTipoFilters] = useState<string[]>([]);
  const [origemFilters, setOrigemFilters] = useState<string[]>([]);
  const [statusSefazFilters, setStatusSefazFilters] = useState<string[]>([]);
  const [itemFiscalData, setItemFiscalData] = useState<Record<number, NfItemFiscalData>>({});
  // Devolução
  const [devolucaoModalOpen, setDevolucaoModalOpen] = useState(false);
  const [devolucaoNF, setDevolucaoNF] = useState<NotaFiscal | null>(null);
  const [devolucaoItens, setDevolucaoItens] = useState<DevolucaoItem[]>([]);

  const valorProdutos = items.reduce((s, i) => s + (i.valor_total || 0), 0);
  const totalImpostos = Number(form.icms_valor || 0) + Number(form.ipi_valor || 0) + Number(form.pis_valor || 0) + Number(form.cofins_valor || 0) + Number(form.icms_st_valor || 0);
  const totalNF = valorProdutos + Number(form.frete_valor || 0) + totalImpostos + Number(form.outras_despesas || 0) - Number(form.desconto_valor || 0);

  useEffect(() => {
    const load = async () => {
      const [{ data: ovs }, { data: contas }] = await Promise.all([
        supabase.from("ordens_venda").select("id, numero, cliente_id, clientes(nome_razao_social)").eq("ativo", true).in("status", ["aprovada", "em_separacao"]).order("numero"),
        supabase.from("contas_contabeis").select("id, codigo, descricao").eq("ativo", true).eq("aceita_lancamento", true).order("codigo"),
      ]);
      setOrdensVenda(ovs || []);
      setContasContabeis(contas || []);
    };
    load();
  }, []);

  const confirmarLock = useActionLock();
  const estornarLock = useActionLock();

  const openCreate = () => { setMode("create"); setForm({ ...emptyForm }); setItems([]); setSelected(null); setParcelas(1); setItemContaContabil({}); setItemFiscalData({}); setModalOpen(true); };
  const openEdit = async (n: NotaFiscal) => {
    setMode("edit"); setSelected(n);
    setForm({
      tipo: n.tipo, numero: n.numero, serie: n.serie || "1", chave_acesso: n.chave_acesso || "",
      data_emissao: n.data_emissao, fornecedor_id: n.fornecedor_id || "", cliente_id: n.cliente_id || "",
      valor_total: n.valor_total, status: n.status, observacoes: n.observacoes || "",
      movimenta_estoque: n.movimenta_estoque !== false, gera_financeiro: n.gera_financeiro !== false,
      forma_pagamento: n.forma_pagamento || "", condicao_pagamento: n.condicao_pagamento || "a_vista",
      ordem_venda_id: n.ordem_venda_id || "", conta_contabil_id: n.conta_contabil_id || "",
      modelo_documento: n.modelo_documento || "55",
      frete_valor: n.frete_valor || 0, icms_valor: n.icms_valor || 0, ipi_valor: n.ipi_valor || 0,
      pis_valor: n.pis_valor || 0, cofins_valor: n.cofins_valor || 0, icms_st_valor: n.icms_st_valor || 0,
      desconto_valor: n.desconto_valor || 0, outras_despesas: n.outras_despesas || 0,
      origem: n.origem || "manual",
    });
    const { data: itens } = await supabase.from("notas_fiscais_itens")
      .select("*, produtos(nome, sku)").eq("nota_fiscal_id", n.id);
    const itensTyped = (itens || []) as unknown as NfItemRow[];
    const loadedItems = itensTyped.map((i) => ({
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

  const openView = (n: NotaFiscal) => {
    setSelected(n);
    setDrawerOpen(true);
  };

  const openDanfe = async (n: NotaFiscal) => {
    const { data: itens } = await supabase.from("notas_fiscais_itens")
      .select("*, produtos(nome, sku)").eq("nota_fiscal_id", n.id);
    const { data: empresa } = await supabase.from("empresa_config").select("*").limit(1).single();
    setDanfeData({
      numero: n.numero, serie: n.serie, chave_acesso: n.chave_acesso,
      data_emissao: n.data_emissao, tipo: n.tipo, status: n.status,
      emitente: n.tipo === "saida" && empresa ? { nome: empresa.razao_social, cnpj: empresa.cnpj, endereco: empresa.logradouro, cidade: empresa.cidade, uf: empresa.uf } : (n.fornecedores ? { nome: n.fornecedores.nome_razao_social, cnpj: n.fornecedores.cpf_cnpj } : undefined),
      destinatario: n.tipo === "saida" && n.clientes ? { nome: n.clientes.nome_razao_social } : (empresa ? { nome: empresa.razao_social, cnpj: empresa.cnpj } : undefined),
      itens: ((itens || []) as unknown as NfItemRow[]).map((i) => ({ descricao: i.produtos?.nome || "", quantidade: i.quantidade, valor_unitario: i.valor_unitario, cfop: i.cfop, cst: i.cst, icms_valor: i.icms_valor, ipi_valor: i.ipi_valor, pis_valor: i.pis_valor, cofins_valor: i.cofins_valor })),
      valor_total: n.valor_total, frete_valor: n.frete_valor, icms_valor: n.icms_valor,
      ipi_valor: n.ipi_valor, pis_valor: n.pis_valor, cofins_valor: n.cofins_valor,
      desconto_valor: n.desconto_valor, outras_despesas: n.outras_despesas,
      observacoes: n.observacoes, forma_pagamento: n.forma_pagamento, condicao_pagamento: n.condicao_pagamento,
    });
    setDanfeOpen(true);
  };

  const handleConfirmar = async (nf: NotaFiscal) => {
    await confirmarLock.run(async () => {
      try {
        await confirmarNotaFiscal({ nf, parcelas });
        toast.success("Nota fiscal confirmada! Estoque e financeiro atualizados.");
        fetchData();
      } catch (err: unknown) {
        console.error('[fiscal] confirmar NF:', err);
        toast.error(getUserFriendlyError(err));
      }
    });
  };

  const handleEstornar = async (nf: NotaFiscal) => {
    if (!window.confirm(`Deseja estornar a NF ${nf.numero}? Isso reverterá movimentos de estoque e lançamentos financeiros vinculados.`)) return;
    await estornarLock.run(async () => {
      try {
        await estornarNotaFiscal(nf);
        toast.success(`NF ${nf.numero} estornada! Estoque e financeiro revertidos.`);
        fetchData();
      } catch (err: unknown) {
        console.error('[fiscal] estornar NF:', err);
        toast.error(getUserFriendlyError(err));
      }
    });
  };

  const handleCancelarRascunho = async () => {
    if (!selected) return;
    if (!window.confirm(`Cancelar o rascunho da NF ${selected.numero}? Esta ação não pode ser desfeita.`)) return;
    try {
      await supabase.from("notas_fiscais").update({ status: "cancelada" }).eq("id", selected.id);
      await registrarEventoFiscal({
        nota_fiscal_id: selected.id,
        tipo_evento: "cancelamento_rascunho",
        status_anterior: selected.status,
        status_novo: "cancelada",
        descricao: `Rascunho da NF ${selected.numero} cancelado pelo usuário.`,
      });
      toast.success("Rascunho cancelado.");
      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      console.error('[fiscal] cancelar rascunho:', err);
      toast.error(getUserFriendlyError(err));
    }
  };

  const buildNfItemsPayload = (nfId: string) => items.map((i, idx) => {
    if (!i.produto_id) {
      throw new Error(`Item ${idx + 1} sem vínculo de produto. Vincule todos os itens antes de salvar.`);
    }
    const fiscal = itemFiscalData[idx] || {};
    return {
      nota_fiscal_id: nfId,
      produto_id: i.produto_id,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      conta_contabil_id: itemContaContabil[idx] || null,
      cfop: fiscal.cfop ?? null,
      cst: fiscal.cst ?? null,
      ncm: fiscal.ncm ?? null,
      unidade: fiscal.unidade ?? null,
      descricao: fiscal.descricao ?? i.descricao ?? null,
      icms_valor: fiscal.icms_valor ?? null,
      icms_aliquota: fiscal.icms_aliquota ?? null,
      icms_base: fiscal.icms_base ?? null,
      ipi_valor: fiscal.ipi_valor ?? null,
      ipi_aliquota: fiscal.ipi_aliquota ?? null,
      pis_valor: fiscal.pis_valor ?? null,
      pis_aliquota: fiscal.pis_aliquota ?? null,
      base_pis: fiscal.base_pis ?? null,
      cofins_valor: fiscal.cofins_valor ?? null,
      cofins_aliquota: fiscal.cofins_aliquota ?? null,
      base_cofins: fiscal.base_cofins ?? null,
      valor_st: fiscal.valor_st ?? null,
      base_st: fiscal.base_st ?? null,
      csosn: fiscal.csosn ?? null,
      cst_pis: fiscal.cst_pis ?? null,
      cst_cofins: fiscal.cst_cofins ?? null,
      cst_ipi: fiscal.cst_ipi ?? null,
      desconto: fiscal.desconto ?? null,
      codigo_produto: fiscal.codigo_produto ?? i.codigo ?? null,
    };
  });

  const handleSaveAndConfirm = async () => {
    if (!form.numero) { toast.error("Número é obrigatório"); return; }
    if (form.tipo === "entrada" && !form.fornecedor_id) { toast.error("Fornecedor é obrigatório para notas de entrada"); return; }
    if (form.tipo === "saida" && !form.cliente_id) { toast.error("Cliente é obrigatório para notas de saída"); return; }
    if (items.length === 0) { toast.error("Adicione ao menos um item antes de confirmar"); return; }
    const unlinkedCount = items.filter(i => !i.produto_id).length;
    if (unlinkedCount > 0) { toast.error(`${unlinkedCount} item(ns) sem produto vinculado. Vincule todos os itens antes de confirmar.`); return; }
    if (!selected) return;
    setSaving(true);
    try {
      const itemsPayload = buildNfItemsPayload(selected.id);
      const savedTotal = totalNF || form.valor_total;
      const payload = {
        ...form,
        fornecedor_id: form.fornecedor_id || null,
        cliente_id: form.cliente_id || null,
        ordem_venda_id: form.ordem_venda_id || null,
        conta_contabil_id: form.conta_contabil_id || null,
        valor_total: savedTotal,
      };
      await Promise.all([
        supabase.from("notas_fiscais").update(payload as never).eq("id", selected.id),
        supabase.from("notas_fiscais_itens").delete().eq("nota_fiscal_id", selected.id),
      ]);
      if (items.length > 0) {
        await supabase.from("notas_fiscais_itens").insert(itemsPayload as never);
      }
      const nfForConfirm = { ...selected, ...payload, valor_total: savedTotal };
      await confirmarNotaFiscal({ nf: nfForConfirm as NotaFiscal, parcelas });
      toast.success("Nota fiscal salva e confirmada! Estoque e financeiro atualizados.");
      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      console.error('[fiscal] salvar e confirmar NF:', err);
      toast.error(getUserFriendlyError(err));
    }
    setSaving(false);
  };

  const handleXmlImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const xmlText = await file.text();
      const nfe: NFeData = parseNFeXml(xmlText);

      // Check for duplicate access key
      if (nfe.chaveAcesso) {
        const isDuplicate = await verificarDuplicidadeChave(nfe.chaveAcesso);
        if (isDuplicate) {
          toast.error(`XML já importado anteriormente (chave: ${nfe.chaveAcesso.slice(0, 12)}…). Importação abortada.`);
          if (xmlInputRef.current) xmlInputRef.current.value = "";
          return;
        }
      }

      let fornecedorId = "";
      if (nfe.emitente.cnpj) {
        const cnpjClean = nfe.emitente.cnpj.replace(/\D/g, "");
        const matched = fornecedoresCrud.data.find((f) => (f.cpf_cnpj || "").replace(/\D/g, "") === cnpjClean);
        if (matched) { fornecedorId = matched.id; toast.info(`Fornecedor identificado: ${matched.nome_razao_social}`); }
        else { toast.info(`Fornecedor CNPJ ${nfe.emitente.cnpj} não encontrado no cadastro. Preencha manualmente.`); }
      }
      const mappedItems: GridItem[] = nfe.itens.map((nfeItem) => {
        const matchedProd = produtosCrud.data.find((p) => p.codigo_interno === nfeItem.codigo || p.sku === nfeItem.codigo);
        return { produto_id: matchedProd?.id || "", codigo: nfeItem.codigo, descricao: matchedProd?.nome || nfeItem.descricao, quantidade: nfeItem.quantidade, valor_unitario: nfeItem.valorUnitario, valor_total: nfeItem.valorTotal };
      });
      // Preserve fiscal fields from XML import
      const xmlFiscalMap: Record<number, NfItemFiscalData> = {};
      nfe.itens.forEach((nfeItem, idx) => {
        xmlFiscalMap[idx] = {
          cfop: nfeItem.cfop || null,
          ncm: nfeItem.ncm || null,
          unidade: nfeItem.unidade || null,
          icms_valor: nfeItem.icms || null,
          ipi_valor: nfeItem.ipi || null,
          pis_valor: nfeItem.pis || null,
          cofins_valor: nfeItem.cofins || null,
          descricao: nfeItem.descricao || null,
          codigo_produto: nfeItem.codigo || null,
        };
      });
      setForm({ ...emptyForm, tipo: "entrada", numero: nfe.numero, serie: nfe.serie, chave_acesso: nfe.chaveAcesso, data_emissao: nfe.dataEmissao || new Date().toISOString().split("T")[0], fornecedor_id: fornecedorId, frete_valor: nfe.valorFrete, icms_valor: nfe.icmsTotal, ipi_valor: nfe.ipiTotal, pis_valor: nfe.pisTotal, cofins_valor: nfe.cofinsTotal, icms_st_valor: nfe.icmsStTotal, desconto_valor: nfe.valorDesconto, outras_despesas: nfe.valorOutrasDespesas, valor_total: nfe.valorTotal, origem: "importacao_xml" });
      setItems(mappedItems); setMode("create"); setSelected(null); setItemContaContabil({}); setItemFiscalData(xmlFiscalMap); setModalOpen(true);
      const unmatchedCount = mappedItems.filter((i) => !i.produto_id).length;
      if (unmatchedCount > 0) toast.warning(`${unmatchedCount} item(ns) não foram vinculados automaticamente. Vincule manualmente antes de salvar.`);
      else toast.success("XML importado com sucesso! Todos os itens foram vinculados.");
    } catch (err: unknown) {
      console.error("[fiscal] XML import:", err);
      toast.error(`Erro ao importar XML: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (xmlInputRef.current) xmlInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero) { toast.error("Número é obrigatório"); return; }
    if (form.tipo === "entrada" && !form.fornecedor_id) { toast.error("Fornecedor é obrigatório para notas de entrada"); return; }
    if (form.tipo === "saida" && !form.cliente_id) { toast.error("Cliente é obrigatório para notas de saída"); return; }
    const unlinkedCount = items.filter(i => !i.produto_id).length;
    if (unlinkedCount > 0) {
      toast.error(`${unlinkedCount} item(ns) sem produto vinculado. Vincule todos os itens ou remova-os antes de salvar.`);
      return;
    }
    setSaving(true);
    try {
      const savedTotal = totalNF || form.valor_total;
      const payload = { ...form, fornecedor_id: form.fornecedor_id || null, cliente_id: form.cliente_id || null, ordem_venda_id: form.ordem_venda_id || null, conta_contabil_id: form.conta_contabil_id || null, valor_total: savedTotal, valor_produtos: valorProdutos };
      let nfId = selected?.id;
      if (mode === "create") {
        const { data: newNf, error } = await supabase.from("notas_fiscais").insert(payload as never).select().single();
        if (error) throw error;
        nfId = newNf.id;
        // Register creation event
        await registrarEventoFiscal({
          nota_fiscal_id: nfId,
          tipo_evento: form.origem === "importacao_xml" ? "importacao_xml" : "criacao",
          status_novo: "pendente",
          descricao: form.origem === "importacao_xml"
            ? `NF ${form.numero} criada via importação de XML.`
            : `NF ${form.numero} criada manualmente.`,
          payload_resumido: { valor_total: savedTotal, itens: items.length },
        });
      } else if (selected) {
        await Promise.all([
          supabase.from("notas_fiscais").update(payload as never).eq("id", selected.id),
          supabase.from("notas_fiscais_itens").delete().eq("nota_fiscal_id", selected.id),
        ]);
        // Register edit event
        await registrarEventoFiscal({
          nota_fiscal_id: selected.id,
          tipo_evento: "edicao",
          descricao: `NF ${form.numero} editada. Novo total: R$ ${savedTotal.toFixed(2)}.`,
          payload_resumido: { valor_total: savedTotal, itens: items.length },
        });
      }
      if (items.length > 0 && nfId) {
        const itemsPayload = buildNfItemsPayload(nfId);
        await supabase.from("notas_fiscais_itens").insert(itemsPayload as never);
      }
      toast.success("Nota fiscal salva!"); setModalOpen(false); fetchData();
    } catch (err: unknown) { console.error('[fiscal] salvar NF:', err); toast.error(getUserFriendlyError(err)); }
    setSaving(false);
  };

  const openDevolucao = async (nf: NotaFiscal) => {
    const { data: itens } = await supabase.from("notas_fiscais_itens").select("*, produtos(nome, sku)").eq("nota_fiscal_id", nf.id);
    setDevolucaoNF(nf);
    setDevolucaoItens(((itens || []) as unknown as NfItemRow[]).map((i) => ({ ...i, qtd_devolver: 0, nome: i.produtos?.nome || "—" })));
    setDevolucaoModalOpen(true);
  };

  const tipoParam = searchParams.get("tipo");
  const filteredData = useMemo(() => {
    const query = consultaSearch.trim().toLowerCase();
    return data.filter((n) => {
      if (tipoParam && n.tipo !== tipoParam) return false;
      if (tipoFilters.length > 0 && !tipoFilters.includes(n.tipo)) return false;
      if (modeloFilters.length > 0 && !modeloFilters.includes(n.modelo_documento || "55")) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(n.status)) return false;
      if (origemFilters.length > 0 && !origemFilters.includes(n.origem || "manual")) return false;
      if (statusSefazFilters.length > 0 && !statusSefazFilters.includes(n.status_sefaz || "nao_enviada")) return false;
      if (!query) return true;
      const parceiro = n.tipo === "entrada" ? n.fornecedores?.nome_razao_social : n.clientes?.nome_razao_social;
      const haystack = [n.numero, n.serie, n.chave_acesso, parceiro, n.ordens_venda?.numero].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [consultaSearch, data, tipoParam, modeloFilters, statusFilters, tipoFilters, origemFilters, statusSefazFilters]);

  // KPIs — sobre os dados filtrados (consistente com a grid)
  const kpis = useMemo(() => {
    const total = filteredData.length;
    const pendentes = filteredData.filter(n => n.status === "pendente").length;
    const confirmadas = filteredData.filter(n => n.status === "confirmada").length;
    const valorTotal = filteredData.reduce((s, n) => s + Number(n.valor_total || 0), 0);
    return { total, pendentes, confirmadas, valorTotal };
  }, [filteredData]);

  const fiscalActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    tipoFilters.forEach(f => chips.push({ key: "tipo", label: "Tipo", value: [f], displayValue: f === "entrada" ? "Entrada" : "Saída" }));
    modeloFilters.forEach(f => chips.push({ key: "modelo", label: "Modelo", value: [f], displayValue: modeloLabels[f] || f }));
    statusFilters.forEach(f => chips.push({ key: "status", label: "Status", value: [f], displayValue: f.charAt(0).toUpperCase() + f.slice(1) }));
    origemFilters.forEach(f => chips.push({ key: "origem", label: "Origem", value: [f], displayValue: origemLabels[f] || f }));
    statusSefazFilters.forEach(f => chips.push({ key: "status_sefaz", label: "SEFAZ", value: [f], displayValue: statusSefazLabels[f] || f }));
    return chips;
  }, [tipoFilters, modeloFilters, statusFilters, origemFilters, statusSefazFilters]);

  const handleRemoveFiscalFilter = (key: string, value?: string) => {
    if (key === "tipo") setTipoFilters(prev => prev.filter(v => v !== value));
    if (key === "modelo") setModeloFilters(prev => prev.filter(v => v !== value));
    if (key === "status") setStatusFilters(prev => prev.filter(v => v !== value));
    if (key === "origem") setOrigemFilters(prev => prev.filter(v => v !== value));
    if (key === "status_sefaz") setStatusSefazFilters(prev => prev.filter(v => v !== value));
  };

  const tipoOptions: MultiSelectOption[] = [{ label: "Entrada", value: "entrada" }, { label: "Saída", value: "saida" }];
  const modeloOptions: MultiSelectOption[] = Object.entries(modeloLabels).map(([v, l]) => ({ label: l, value: v }));
  const statusOptions: MultiSelectOption[] = [
    { label: "Pendente", value: "pendente" },
    { label: "Rascunho", value: "rascunho" },
    { label: "Importada", value: "importada" },
    { label: "Confirmada", value: "confirmada" },
    { label: "Autorizada", value: "autorizada" },
    { label: "Rejeitada", value: "rejeitada" },
    { label: "Cancelada", value: "cancelada" },
    { label: "Cancelada SEFAZ", value: "cancelada_sefaz" },
    { label: "Inutilizada", value: "inutilizada" },
  ];
  const origemOptions: MultiSelectOption[] = Object.entries(origemLabels).map(([v, l]) => ({ label: l, value: v }));
  const statusSefazOptions: MultiSelectOption[] = Object.entries(statusSefazLabels).map(([v, l]) => ({ label: l, value: v }));

  const tipoConfig = tipoParam === "entrada"
    ? { title: "Notas de Entrada", subtitle: "Central de conferência e recebimento fiscal", addLabel: "Nova NF de Entrada", moduleKey: "notas-entrada", parceiroLabel: "Fornecedor" }
    : tipoParam === "saida"
    ? { title: "Notas de Saída", subtitle: "Notas fiscais de saída e faturamento", addLabel: "Nova NF de Saída", moduleKey: "notas-saida", parceiroLabel: "Cliente" }
    : { title: "Fiscal", subtitle: "Notas fiscais, faturas e documentos", addLabel: "Nova NF", moduleKey: "notas-fiscais", parceiroLabel: "Parceiro" };

  const fiscalStatusMap: Record<string, { label: string; className: string }> = {
    pendente:        { label: "Pendente",        className: "bg-warning/10 text-warning border-warning/20" },
    confirmada:      { label: "Confirmada",      className: "bg-success/10 text-success border-success/20" },
    cancelada:       { label: "Cancelada",       className: "bg-destructive/10 text-destructive border-destructive/20" },
    importada:       { label: "Importada",       className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800" },
    autorizada:      { label: "Autorizada",      className: "bg-success/10 text-success border-success/20" },
    rejeitada:       { label: "Rejeitada",       className: "bg-destructive/10 text-destructive border-destructive/20" },
    cancelada_sefaz: { label: "Cancelada SEFAZ", className: "bg-destructive/10 text-destructive border-destructive/20" },
    inutilizada:     { label: "Inutilizada",     className: "bg-muted text-muted-foreground border-muted" },
    rascunho:        { label: "Rascunho",        className: "bg-muted text-muted-foreground border-muted" },
  };

  const renderFiscalStatus = (n: NotaFiscal) => {
    const cfg = fiscalStatusMap[n.status] ?? { label: n.status, className: "bg-muted text-muted-foreground border-muted" };
    return (
      <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
        {cfg.label}
      </Badge>
    );
  };

  const parceiroLabel = tipoConfig.parceiroLabel;

  const columns = [
    {
      key: "numero",
      label: "Nº Nota",
      render: (n: NotaFiscal) => (
        <span className="font-mono text-sm font-bold text-primary">{n.numero}</span>
      ),
    },
    {
      key: "parceiro",
      label: parceiroLabel,
      render: (n: NotaFiscal) => {
        // Devolução de saída: NF de entrada gerada a partir de uma saída.
        // It carries cliente_id (not fornecedor_id), so we resolve correctly.
        const nome =
          n.tipo === "entrada" && n.tipo_operacao === "devolucao" && n.clientes?.nome_razao_social
            ? n.clientes.nome_razao_social
            : n.tipo === "entrada"
            ? n.fornecedores?.nome_razao_social || "—"
            : n.clientes?.nome_razao_social || "—";
        return <span className="font-medium">{nome}</span>;
      },
    },
    {
      key: "data_emissao",
      label: "Emissão",
      sortable: true,
      render: (n: NotaFiscal) => formatDate(n.data_emissao),
    },
    {
      key: "status",
      label: "Status",
      render: renderFiscalStatus,
    },
    {
      key: "valor_total",
      label: "Total",
      sortable: true,
      render: (n: NotaFiscal) => (
        <span className="font-semibold font-mono">{formatCurrency(Number(n.valor_total))}</span>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      hidden: !!tipoParam,
      render: (n: NotaFiscal) => n.tipo === "entrada" ? "Entrada" : "Saída",
    },
    {
      key: "serie",
      label: "Série",
      hidden: true,
      render: (n: NotaFiscal) => (
        <span className="font-mono text-xs text-muted-foreground">{n.serie || "1"}</span>
      ),
    },
    {
      key: "modelo",
      label: "Modelo",
      hidden: true,
      render: (n: NotaFiscal) => (
        <span className="text-xs font-mono font-medium">{modeloLabels[n.modelo_documento || "55"] || n.modelo_documento}</span>
      ),
    },
    {
      key: "operacao",
      label: "Operação",
      hidden: true,
      render: (n: NotaFiscal) => {
        if ((n.tipo_operacao || "normal") === "devolucao")
          return <span className="text-xs text-warning font-medium">Devolução</span>;
        return <span className="text-xs text-muted-foreground">Normal</span>;
      },
    },
    {
      key: "chave_acesso",
      label: "Chave de Acesso",
      hidden: true,
      render: (n: NotaFiscal) =>
        n.chave_acesso
          ? <span className="font-mono text-xs text-muted-foreground">
              {n.chave_acesso.length > 12 ? `${n.chave_acesso.slice(0, 8)}…${n.chave_acesso.slice(-4)}` : n.chave_acesso}
            </span>
          : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "ov",
      label: "Pedido Vinc.",
      hidden: true,
      render: (n: NotaFiscal) =>
        n.ordens_venda?.numero
          ? <span className="font-mono text-xs">{n.ordens_venda.numero}</span>
          : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "origem",
      label: "Origem",
      render: (n: NotaFiscal) => (
        <Badge variant="outline" className="text-xs capitalize">
          {origemLabels[n.origem || "manual"] || n.origem || "Manual"}
        </Badge>
      ),
    },
    {
      key: "status_sefaz",
      label: "SEFAZ",
      render: (n: NotaFiscal) => {
        const sf = n.status_sefaz || "nao_enviada";
        const sfClass = sf === "autorizada" ? "text-success border-success/30" : sf === "rejeitada" ? "text-destructive border-destructive/30" : "text-muted-foreground border-muted";
        return <Badge variant="outline" className={`text-xs ${sfClass}`}>{statusSefazLabels[sf] || sf}</Badge>;
      },
    },
  ];

  return (
    <><ModulePage title={tipoConfig.title} subtitle={tipoConfig.subtitle} addLabel={tipoConfig.addLabel} onAdd={openCreate}
        headerActions={<>
          <input ref={xmlInputRef} type="file" accept=".xml" className="hidden" onChange={handleXmlImport} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => xmlInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Importar XML
          </Button>
        </>}
      >
        <AdvancedFilterBar
          searchValue={consultaSearch}
          onSearchChange={setConsultaSearch}
          searchPlaceholder="Buscar por número, chave ou parceiro..."
          activeFilters={fiscalActiveFilters}
          onRemoveFilter={handleRemoveFiscalFilter}
          onClearAll={() => { setTipoFilters([]); setModeloFilters([]); setStatusFilters([]); setOrigemFilters([]); setStatusSefazFilters([]); }}
          count={filteredData.length}
        >
          {!tipoParam && <MultiSelect options={tipoOptions} selected={tipoFilters} onChange={setTipoFilters} placeholder="Tipo" className="w-[150px]" />}
          <MultiSelect options={modeloOptions} selected={modeloFilters} onChange={setModeloFilters} placeholder="Modelos" className="w-[180px]" />
          <MultiSelect options={statusOptions} selected={statusFilters} onChange={setStatusFilters} placeholder="Status" className="w-[180px]" />
          <MultiSelect options={origemOptions} selected={origemFilters} onChange={setOrigemFilters} placeholder="Origem" className="w-[180px]" />
          <MultiSelect options={statusSefazOptions} selected={statusSefazFilters} onChange={setStatusSefazFilters} placeholder="SEFAZ" className="w-[180px]" />
        </AdvancedFilterBar>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard title="Total de NFs" value={String(kpis.total)} icon={FileText} variationType="neutral" variation="registros" />
          <SummaryCard title="Valor Total" value={formatCurrency(kpis.valorTotal)} icon={DollarSign} variationType="neutral" variation="acumulado" />
          <SummaryCard title="Pendentes" value={String(kpis.pendentes)} icon={Clock} variationType={kpis.pendentes > 0 ? "negative" : "neutral"} variation="aguardando confirmação" />
          <SummaryCard title="Confirmadas" value={String(kpis.confirmadas)} icon={CheckCircle} variationType="positive" variation="processadas" />
        </div>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey={tipoConfig.moduleKey}
          showColumnToggle={true}
          onView={openView}
          onEdit={openEdit}
        />
      </ModulePage>

      {/* Form Modal - Create */}
      <FormModal open={modalOpen && mode === "create"} onClose={() => setModalOpen(false)} title="Nova Nota Fiscal" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2"><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Modelo</Label>
              <Select value={form.modelo_documento || "55"} onValueChange={(v) => setForm({ ...form, modelo_documento: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="55">NF-e (Modelo 55)</SelectItem><SelectItem value="65">NFC-e (Modelo 65)</SelectItem><SelectItem value="57">CT-e (Modelo 57)</SelectItem><SelectItem value="67">CT-e OS (Modelo 67)</SelectItem><SelectItem value="nfse">NFS-e (Serviço)</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Número *</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} required className="font-mono" /></div>
            <div className="space-y-2"><Label>Série</Label><Input value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} /></div>
            <div className="space-y-2"><Label>Data Emissão</Label><Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
          </div>
          <div className="col-span-2 space-y-2"><Label>Chave de Acesso</Label><Input value={form.chave_acesso} onChange={(e) => setForm({ ...form, chave_acesso: e.target.value })} className="font-mono text-xs" /></div>
          <div className="bg-accent/30 rounded-lg p-4 space-y-3">
            {form.tipo === "entrada" ? (
              <><Label className="text-sm font-semibold">Fornecedor</Label><AutocompleteSearch options={fornecedoresCrud.data.map((f) => ({ id: f.id, label: f.nome_razao_social, sublabel: f.cpf_cnpj }))} value={form.fornecedor_id} onChange={(id) => setForm({ ...form, fornecedor_id: id })} placeholder="Buscar fornecedor..." /></>
            ) : (
              <><Label className="text-sm font-semibold">Cliente</Label><AutocompleteSearch options={clientesCrud.data.map((c) => ({ id: c.id, label: c.nome_razao_social, sublabel: c.cpf_cnpj }))} value={form.cliente_id} onChange={(id) => setForm({ ...form, cliente_id: id })} placeholder="Buscar cliente..." /></>
            )}
          </div>
          {form.tipo === "saida" && ordensVenda.length > 0 && (
            <div className="space-y-2"><Label>Pedido (opcional)</Label>
              <Select value={form.ordem_venda_id || "none"} onValueChange={(v) => setForm({ ...form, ordem_venda_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Vincular a um Pedido..." /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{ordensVenda.map((ov) => (<SelectItem key={ov.id} value={ov.id}>{ov.numero} — {ov.clientes?.nome_razao_social || ""}</SelectItem>))}</SelectContent></Select>
            </div>
          )}
          <ItemsGrid items={items} onChange={setItems} produtos={produtosCrud.data as unknown as Record<string, unknown>[]} title="Itens da Nota" />
          {items.length > 0 && contasContabeis.length > 0 && (
            <div className="space-y-2"><Label className="text-sm font-semibold">Conta Contábil por Item</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground min-w-[120px] truncate">{item.descricao || `Item ${idx + 1}`}</span>
                    <Select value={itemContaContabil[idx] || "none"} onValueChange={(v) => setItemContaContabil(prev => ({ ...prev, [idx]: v === "none" ? "" : v }))}><SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Conta contábil..." /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem>{contasContabeis.map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo} - {c.descricao}</SelectItem>))}</SelectContent></Select>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3"><Label className="text-sm font-semibold">Frete, Impostos e Despesas</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[{ label: "Frete", key: "frete_valor" }, { label: "ICMS", key: "icms_valor" }, { label: "IPI", key: "ipi_valor" }, { label: "PIS", key: "pis_valor" }, { label: "COFINS", key: "cofins_valor" }, { label: "ICMS-ST", key: "icms_st_valor" }, { label: "Desconto", key: "desconto_valor" }, { label: "Outras Despesas", key: "outras_despesas" }].map(({ label, key }) => (
                <div key={key} className="space-y-1"><Label className="text-xs">{label}</Label><Input type="number" step="0.01" value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="h-8 text-xs" /></div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2"><Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="cartao">Cartão</SelectItem><SelectItem value="pix">PIX</SelectItem><SelectItem value="transferencia">Transferência</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Condição</Label>
              <Select value={form.condicao_pagamento} onValueChange={(v) => setForm({ ...form, condicao_pagamento: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a_vista">À Vista</SelectItem><SelectItem value="a_prazo">A Prazo</SelectItem></SelectContent></Select>
            </div>
            {form.condicao_pagamento === "a_prazo" && <div className="space-y-2"><Label>Nº Parcelas</Label><Input type="number" min={1} max={48} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} /></div>}
            <div className="space-y-2 flex items-end gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={form.movimenta_estoque} onChange={(e) => setForm({ ...form, movimenta_estoque: e.target.checked })} className="rounded" />Mov. Estoque</label>
              <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={form.gera_financeiro} onChange={(e) => setForm({ ...form, gera_financeiro: e.target.checked })} className="rounded" />Gera Financeiro</label>
            </div>
          </div>
          {contasContabeis.length > 0 && (
            <div className="space-y-2"><Label>Conta Contábil Geral (fallback para itens sem conta)</Label>
              <Select value={form.conta_contabil_id || "none"} onValueChange={(v) => setForm({ ...form, conta_contabil_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Vincular conta contábil..." /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem>{contasContabeis.map((c) => (<SelectItem key={c.id} value={c.id}>{c.codigo} - {c.descricao}</SelectItem>))}</SelectContent></Select>
            </div>
          )}
          <div className="bg-accent/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Produtos:</span><span className="font-mono font-semibold">{formatCurrency(valorProdutos)}</span></div>
            {Number(form.frete_valor || 0) > 0 && <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Frete:</span><span className="font-mono">{formatCurrency(Number(form.frete_valor))}</span></div>}
            {totalImpostos > 0 && <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Impostos:</span><span className="font-mono">{formatCurrency(totalImpostos)}</span></div>}
            {Number(form.desconto_valor || 0) > 0 && <div className="flex justify-between items-center text-sm text-destructive"><span>Desconto:</span><span className="font-mono">-{formatCurrency(Number(form.desconto_valor))}</span></div>}
            <div className="flex justify-between items-center text-sm font-bold border-t pt-2"><span>Total da NF:</span><span className="font-mono text-lg">{formatCurrency(totalNF)}</span></div>
            {form.condicao_pagamento === "a_prazo" && parcelas > 1 && <div className="flex justify-between items-center text-xs text-muted-foreground"><span>{parcelas}× de</span><span className="font-mono font-semibold">{formatCurrency(totalNF / parcelas)}</span></div>}
          </div>
          {!form.gera_financeiro && <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">⚠️ "Gera Financeiro" está desmarcado — esta NF <strong>não</strong> gerará lançamentos financeiros ao ser confirmada.</div>}
          <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </FormModal>

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
          saving={saving}
          onSubmit={handleSubmit}
          onSaveAndConfirm={selected.status === "pendente" ? handleSaveAndConfirm : undefined}
          onCancelarRascunho={selected.status === "pendente" ? handleCancelarRascunho : undefined}
          fornecedores={fornecedoresCrud.data}
          clientes={clientesCrud.data}
          ordensVenda={ordensVenda}
          contasContabeis={contasContabeis}
          produtosCrud={produtosCrud.data}
          valorProdutos={valorProdutos}
          totalImpostos={totalImpostos}
          totalNF={totalNF}
        />
      )}

      {/* View Drawer */}
      <NotaFiscalDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selected}
        onEdit={openEdit}
        onDelete={(id) => remove(id)}
        onConfirmar={handleConfirmar}
        onEstornar={handleEstornar}
        onDevolucao={openDevolucao}
        onDanfe={(nf) => { setDrawerOpen(false); openDanfe(nf); }}
      />

      {/* Devolução Dialog */}
      <DevolucaoDialog
        open={devolucaoModalOpen}
        onOpenChange={setDevolucaoModalOpen}
        devolucaoNF={devolucaoNF}
        devolucaoItens={devolucaoItens}
        setDevolucaoItens={setDevolucaoItens as unknown as (itens: unknown[]) => void}
        onSuccess={fetchData}
      />

      <DanfeViewer open={danfeOpen} onClose={() => setDanfeOpen(false)} data={danfeData as never} />
    </>
  );
};

export default Fiscal;
