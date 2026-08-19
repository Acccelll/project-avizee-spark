import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { GridItem } from "@/components/ui/ItemsGrid";
import {
  useNFeXmlImport,
  type TraducaoLinha,
  type FornecedorMatchRef,
  type ClienteMatchRef,
  type ProdutoMatchRef,
} from "@/pages/fiscal/hooks/useNFeXmlImport";
import {
  emptyFiscalForm as emptyForm,
  type FiscalFormState as FiscalForm,
  type NfItemFiscalData,
} from "@/pages/fiscal/hooks/useFiscalNotaForm";
import { interpretarDocumentoServicoXml, type DocumentoServicoXmlInterpretado } from "@/pages/fiscal/hooks/documentoServicoXml";
import type { NotaFiscal } from "@/types/domain";

/** Estado de origem XML para banner e fluxos derivados. */
export interface XmlOriginInfo {
  fornecedorId: string;
  fornecedorNome: string;
  clienteId?: string;
  clienteNome?: string;
  tipo?: "entrada" | "saida";
  cobranca?: import("@/lib/nfeXmlParser").NFeCobranca;
}

interface PendingXmlImport {
  nfe: import("@/lib/nfeXmlParser").NFeData;
  tipo: "entrada" | "saida";
  fornecedorId: string;
  fornecedorNome: string;
  clienteId?: string;
  clienteNome?: string;
  fiscalMap: Record<number, NfItemFiscalData>;
  xmlText?: string;
  anexarNa?: NotaFiscal;
}

interface UseFiscalXmlImportArgs {
  fornecedores: FornecedorMatchRef[];
  clientes: ClienteMatchRef[];
  produtos: ProdutoMatchRef[];
  cnpjEmpresa: string | undefined;
  refetchFornecedores: () => Promise<unknown> | unknown;
  refetchClientes: () => Promise<unknown> | unknown;
  refetchProdutos: () => Promise<unknown> | unknown;
  setForm: React.Dispatch<React.SetStateAction<FiscalForm>>;
  setItems: React.Dispatch<React.SetStateAction<GridItem[]>>;
  setMode: (mode: "create" | "edit") => void;
  setSelected: (nf: NotaFiscal | null) => void;
  setItemContaContabil: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setItemFiscalData: React.Dispatch<React.SetStateAction<Record<number, NfItemFiscalData>>>;
  setParcelas: React.Dispatch<React.SetStateAction<number>>;
  setPrimeiroVencimento: React.Dispatch<React.SetStateAction<string>>;
  setParcelasPlano: React.Dispatch<React.SetStateAction<Array<{ numero: number; vencimento: string; valor: number }>>>;
  setModalOpen: (v: boolean) => void;
  setDrawerOpen: (v: boolean) => void;
}

export function useFiscalXmlImport(args: UseFiscalXmlImportArgs) {
  const {
    fornecedores, clientes, produtos, cnpjEmpresa,
    refetchFornecedores, refetchClientes, refetchProdutos,
    setForm, setItems, setMode, setSelected,
    setItemContaContabil, setItemFiscalData,
    setParcelas, setPrimeiroVencimento, setParcelasPlano,
    setModalOpen, setDrawerOpen,
  } = args;

  const xmlInputRef = useRef<HTMLInputElement>(null);
  const anexarXmlInputRef = useRef<HTMLInputElement>(null);
  const [anexarTargetNf, setAnexarTargetNf] = useState<NotaFiscal | null>(null);
  const [traducaoLinhas, setTraducaoLinhas] = useState<TraducaoLinha[]>([]);
  const [traducaoOpen, setTraducaoOpen] = useState(false);
  const [traducaoReadOnly, setTraducaoReadOnly] = useState(false);
  const [pendingXmlImport, setPendingXmlImport] = useState<PendingXmlImport | null>(null);
  const [xmlOriginInfo, setXmlOriginInfo] = useState<XmlOriginInfo | null>(null);
  const [quickProdutoLinhaIdx, setQuickProdutoLinhaIdx] = useState<number | null>(null);
  const [quickProdutoNome, setQuickProdutoNome] = useState("");
  const [quickFornecedorOpen, setQuickFornecedorOpen] = useState(false);
  const [quickFornecedorDefaults, setQuickFornecedorDefaults] = useState<{
    nome_razao_social?: string; cpf_cnpj?: string; email?: string; telefone?: string;
  }>({});
  const [quickClienteOpen, setQuickClienteOpen] = useState(false);
  const [quickClienteDefaults, setQuickClienteDefaults] = useState<{
    nome_razao_social?: string; cpf_cnpj?: string; tipo_pessoa?: "F" | "J";
    inscricao_estadual?: string; email?: string; telefone?: string; cep?: string;
    logradouro?: string; numero?: string; bairro?: string; cidade?: string; uf?: string;
  }>({});

  const { importXml } = useNFeXmlImport({ fornecedores, produtos, clientes, cnpjEmpresa });

  const aplicarDocumentoServicoXml = async (
    xmlText: string,
    doc: DocumentoServicoXmlInterpretado,
    anexarNa?: NotaFiscal,
  ) => {
    const chave = String(doc.form.chave_acesso || "");
    if (!anexarNa && chave) {
      const { data: dup } = await supabase
        .from("notas_fiscais")
        .select("id, numero, status")
        .eq("chave_acesso", chave)
        .neq("status", "cancelada")
        .limit(1)
        .maybeSingle();
      if (dup) {
        toast.error(`Documento já importado (nº ${dup.numero || "—"}, status ${dup.status || "—"}).`);
        return;
      }
    }

    let caminhoXml = "";
    try {
      const { uploadFiscalXml } = await import("@/services/fiscal/xmlStorage.service");
      const storageTipo = doc.tipoDocumento === "nfse" ? "nfse" : doc.tipoDocumento === "cte_os" ? "cte-os" : "cte";
      const uploaded = await uploadFiscalXml({
        chave: doc.chaveArquivo,
        tipo: storageTipo,
        xmlText,
        dataEmissao: doc.dataEmissao,
      });
      caminhoXml = uploaded.path;
    } catch (err) {
      logger.warn("[fiscal] falha ao arquivar XML de serviço:", err);
      toast.warning("Documento preenchido, mas o XML original não pôde ser arquivado no Storage.");
    }

    const base: Record<string, unknown> = anexarNa
      ? {
          ...emptyForm,
          documento_id: anexarNa.id,
          movimenta_estoque: false,
          gera_financeiro: anexarNa.gera_financeiro !== false,
          forma_pagamento: anexarNa.forma_pagamento || "",
          condicao_pagamento: anexarNa.condicao_pagamento || "a_vista",
          conta_contabil_id: anexarNa.conta_contabil_id || "",
          observacoes: anexarNa.observacoes || "",
          fornecedor_id: anexarNa.fornecedor_id || doc.fornecedorId,
        }
      : { ...emptyForm };

    setForm({
      ...base,
      ...doc.form,
      fornecedor_id: anexarNa?.fornecedor_id || doc.fornecedorId,
      caminho_xml: caminhoXml,
      origem: "xml_importado",
    } as unknown as FiscalForm);
    setItems([]);
    setItemContaContabil({});
    setItemFiscalData({});
    setParcelas(1);
    setPrimeiroVencimento("");
    setParcelasPlano([]);
    setTraducaoLinhas([]);
    setXmlOriginInfo({ fornecedorId: anexarNa?.fornecedor_id || doc.fornecedorId, fornecedorNome: doc.fornecedorNome, tipo: "entrada" });
    if (anexarNa) { setMode("edit"); setSelected(anexarNa); setDrawerOpen(false); }
    else { setMode("create"); setSelected(null); }
    setModalOpen(true);

    if (!anexarNa && !doc.fornecedorId && doc.fornecedorDoc) {
      setQuickFornecedorDefaults({ nome_razao_social: doc.fornecedorNome, cpf_cnpj: doc.fornecedorDoc });
      setQuickFornecedorOpen(true);
      toast.info(`Prestador ${doc.fornecedorDoc} não cadastrado. Cadastre rapidamente para continuar.`);
    } else {
      toast.success(`${doc.tipoDocumento === "nfse" ? "NFS-e" : doc.tipoDocumento === "cte_os" ? "CT-e OS" : "CT-e"} preenchido automaticamente. Revise e salve.`);
    }
  };

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
      return { produto_id: t.produtoId, codigo: t.xmlCodigo, descricao: matched?.nome || t.xmlDescricao, quantidade: qtdInterna, valor_unitario: vUnInterno, valor_total: t.xmlValorTotal };
    });
    const temProtocolo = !!nfe.protocolo;
    let caminhoXmlInicial = "";
    if (xmlText && nfe.chaveAcesso) {
      try {
        const { uploadNfeXml } = await import("@/services/fiscal/xmlStorage.service");
        const { path } = await uploadNfeXml({ chave: nfe.chaveAcesso, tipo, xmlText, dataEmissao: nfe.dataEmissao });
        caminhoXmlInicial = path;
      } catch (err) {
        logger.warn("[fiscal] falha ao arquivar XML no Storage:", err);
        toast.warning("XML importado, mas não foi arquivado no Storage (download original ficará indisponível).");
      }
    }
    const baseForm: typeof emptyForm = anexarNa
      ? { ...emptyForm, movimenta_estoque: anexarNa.movimenta_estoque !== false, gera_financeiro: anexarNa.gera_financeiro !== false, forma_pagamento: anexarNa.forma_pagamento || "", condicao_pagamento: anexarNa.condicao_pagamento || "a_vista", ordem_venda_id: anexarNa.ordem_venda_id || "", conta_contabil_id: anexarNa.conta_contabil_id || "", observacoes: anexarNa.observacoes || "" }
      : { ...emptyForm };
    setForm({
      ...baseForm, tipo, numero: nfe.numero, serie: nfe.serie, modelo_documento: nfe.modelo || "55", chave_acesso: nfe.chaveAcesso,
      data_emissao: nfe.dataEmissao || new Date().toISOString().split("T")[0],
      fornecedor_id: anexarNa ? (anexarNa.fornecedor_id || (tipo === "entrada" ? fornecedorId : "")) : (tipo === "entrada" ? fornecedorId : ""),
      cliente_id: anexarNa ? (anexarNa.cliente_id || (tipo === "saida" ? clienteId : "")) : (tipo === "saida" ? clienteId : ""),
      status: (anexarNa ? anexarNa.status : (temProtocolo ? "importada" : "pendente")) ?? "pendente",
      status_sefaz: anexarNa ? (temProtocolo ? "importada_externa" : (anexarNa.status_sefaz || "nao_enviada")) : (temProtocolo ? "importada_externa" : "nao_enviada"),
      frete_valor: nfe.valorFrete, icms_valor: nfe.icmsTotal, ipi_valor: nfe.ipiTotal, pis_valor: nfe.pisTotal,
      cofins_valor: nfe.cofinsTotal, icms_st_valor: nfe.icmsStTotal, desconto_valor: nfe.valorDesconto,
      outras_despesas: nfe.valorOutrasDespesas, valor_total: nfe.valorTotal, origem: anexarNa ? "xml_anexado" : "xml_importado", caminho_xml: caminhoXmlInicial,
    });
    setItems(newItems);
    if (anexarNa) { setMode("edit"); setSelected(anexarNa); } else { setMode("create"); setSelected(null); }
    setItemContaContabil({}); setItemFiscalData(fiscalMap); setTraducaoLinhas(linhas);
    setXmlOriginInfo({ tipo, fornecedorId, fornecedorNome, clienteId, clienteNome, cobranca: nfe.cobranca });
    const dups = nfe.cobranca?.duplicatas ?? [];
    if (dups.length > 0) {
      const { mapTPagSefaz } = await import("@/lib/financeiro");
      const formaPag = nfe.cobranca?.tPag ? mapTPagSefaz(nfe.cobranca.tPag) : "boleto_dda";
      const primeiro = dups[0].vencimento || "";
      const intervalo = dups.length > 1 && dups[0].vencimento && dups[1].vencimento
        ? Math.max(1, Math.round((new Date(dups[1].vencimento).getTime() - new Date(dups[0].vencimento).getTime()) / (1000 * 60 * 60 * 24))) : 30;
      setForm((prev) => ({ ...prev, condicao_pagamento: "a_prazo", forma_pagamento: prev.forma_pagamento || formaPag || "boleto_dda", data_vencimento: primeiro, intervalo_parcelas_dias: intervalo }));
      setParcelas(dups.length); setPrimeiroVencimento(primeiro);
      setParcelasPlano(dups.map((d, i) => ({ numero: i + 1, vencimento: d.vencimento, valor: d.valor })));
    }
    setModalOpen(true);
    if (anexarNa) toast.info(`XML anexado à NF ${anexarNa.numero}. Revise os itens traduzidos e clique em Salvar para confirmar.`);
  };

  const salvarDeParaFornecedor = async (fornecedorId: string, linhas: TraducaoLinha[]) => {
    const aSalvar = linhas.filter((l) => l.salvarDePara && l.produtoId && l.xmlCodigo);
    if (aSalvar.length === 0 || !fornecedorId) return;
    try {
      const rows = aSalvar.map((l) => ({ produto_id: l.produtoId, fornecedor_id: fornecedorId, referencia_fornecedor: l.xmlCodigo, descricao_fornecedor: l.xmlDescricao, unidade_fornecedor: l.xmlUnidade, fator_conversao: l.fatorConversao }));
      const { error } = await supabase.from("produtos_fornecedores").upsert(rows, { onConflict: "produto_id,fornecedor_id" });
      if (error) throw error;
    } catch (err) {
      logger.error("[fiscal] salvar de-para fornecedor:", err);
      toast.warning("NF importada, mas não foi possível salvar a tradução para o fornecedor.");
    }
  };

  const processarXmlImportado = async (input: File | string) => {
    const xmlText = typeof input === "string" ? input : await input.text();
    const documentoServico = interpretarDocumentoServicoXml(xmlText, fornecedores);
    if (documentoServico) { await aplicarDocumentoServicoXml(xmlText, documentoServico); return; }

    const result = await importXml(xmlText);
    if (!result) return;
    const { nfe, tipo, fornecedorId, clienteId, fiscalMap, traducao, traducaoOk } = result;
    const fornecedorNome = fornecedores.find((f) => f.id === fornecedorId)?.nome_razao_social || nfe.emitente.razaoSocial || "—";
    const clienteNome = clientes.find((c) => c.id === clienteId)?.nome_razao_social || nfe.destinatario?.razaoSocial || "—";

    if (tipo === "saida" && !clienteId && nfe.destinatario?.cpfCnpj) {
      const d = nfe.destinatario;
      setQuickClienteDefaults({ nome_razao_social: d.razaoSocial || "", cpf_cnpj: d.cpfCnpj, tipo_pessoa: d.tipoPessoa, inscricao_estadual: d.inscricaoEstadual || "", email: d.email || "", telefone: d.telefone || "", cep: d.cep || "", logradouro: d.logradouro || "", numero: d.numero || "", bairro: d.bairro || "", cidade: d.municipio || "", uf: d.uf || "" });
      setPendingXmlImport({ nfe, tipo, fornecedorId: "", fornecedorNome: "", clienteId: "", clienteNome: d.razaoSocial || "", fiscalMap: fiscalMap as Record<number, NfItemFiscalData>, xmlText });
      setTraducaoLinhas(traducao); setQuickClienteOpen(true);
      toast.info(`Cliente ${d.cpfCnpj} não cadastrado. Cadastre rapidamente para continuar.`); return;
    }

    if (tipo === "entrada" && !fornecedorId && nfe.emitente?.cnpj) {
      setQuickFornecedorDefaults({ nome_razao_social: nfe.emitente.razaoSocial || "", cpf_cnpj: nfe.emitente.cnpj, email: (nfe.emitente as { email?: string }).email || "", telefone: (nfe.emitente as { telefone?: string }).telefone || "" });
      setPendingXmlImport({ nfe, tipo, fornecedorId: "", fornecedorNome, clienteId: "", clienteNome: "", fiscalMap: fiscalMap as Record<number, NfItemFiscalData>, xmlText });
      setTraducaoLinhas(traducao); setQuickFornecedorOpen(true);
      toast.info(`Fornecedor ${nfe.emitente.cnpj} não cadastrado. Cadastre rapidamente para continuar.`); return;
    }

    if (traducaoOk) {
      void aplicarImportacaoXml(nfe, tipo, fornecedorId, fornecedorNome, clienteId, clienteNome, traducao, fiscalMap as Record<number, NfItemFiscalData>, xmlText);
      toast.success("XML importado. Tradução automática aplicada.");
    } else {
      setPendingXmlImport({ nfe, tipo, fornecedorId, fornecedorNome, clienteId, clienteNome, fiscalMap: fiscalMap as Record<number, NfItemFiscalData>, xmlText });
      setTraducaoLinhas(traducao); setTraducaoReadOnly(false); setTraducaoOpen(true);
    }
  };

  const processarXmlParaAnexar = async (input: File | string, targetNf: NotaFiscal) => {
    const xmlText = typeof input === "string" ? input : await input.text();
    const documentoServico = interpretarDocumentoServicoXml(xmlText, fornecedores);
    if (documentoServico) { await aplicarDocumentoServicoXml(xmlText, documentoServico, targetNf); return; }

    const result = await importXml(xmlText);
    if (!result) return;
    const { nfe, tipo, fornecedorId, clienteId, fiscalMap, traducao, traducaoOk } = result;
    if (targetNf.tipo === "entrada" && tipo !== "entrada") { toast.error("XML não corresponde a uma NF de entrada (emitente é a própria empresa)."); return; }
    const fornecedorParaAnexar = targetNf.fornecedor_id || fornecedorId || "";
    const clienteParaAnexar = targetNf.cliente_id || clienteId || "";
    const fornecedorNome = fornecedores.find((f) => f.id === fornecedorParaAnexar)?.nome_razao_social || nfe.emitente.razaoSocial || "—";
    const clienteNome = clientes.find((c) => c.id === clienteParaAnexar)?.nome_razao_social || nfe.destinatario?.razaoSocial || "—";
    setDrawerOpen(false);
    if (traducaoOk) {
      void aplicarImportacaoXml(nfe, tipo, fornecedorParaAnexar, fornecedorNome, clienteParaAnexar, clienteNome, traducao, fiscalMap as Record<number, NfItemFiscalData>, xmlText, targetNf);
    } else {
      setPendingXmlImport({ nfe, tipo, fornecedorId: fornecedorParaAnexar, fornecedorNome, clienteId: clienteParaAnexar, clienteNome, fiscalMap: fiscalMap as Record<number, NfItemFiscalData>, xmlText, anexarNa: targetNf });
      setTraducaoLinhas(traducao); setTraducaoReadOnly(false); setTraducaoOpen(true);
    }
  };

  const handleXmlImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { await processarXmlImportado(file); }
    catch (err: unknown) { logger.error("[fiscal] XML import:", err); toast.error(`Erro ao importar XML: ${err instanceof Error ? err.message : String(err)}`); }
    if (xmlInputRef.current) xmlInputRef.current.value = "";
  };

  const handleAnexarXmlChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; const targetNf = anexarTargetNf;
    if (anexarXmlInputRef.current) anexarXmlInputRef.current.value = "";
    if (!file || !targetNf) return;
    try { await processarXmlParaAnexar(file, targetNf); }
    catch (err: unknown) { logger.error("[fiscal] anexar XML:", err); toast.error(`Erro ao anexar XML: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setAnexarTargetNf(null); }
  };

  const handleTraducaoConfirm = async (linhas: TraducaoLinha[]) => {
    if (pendingXmlImport) {
      const { nfe, tipo, fornecedorId, fornecedorNome, clienteId, clienteNome, fiscalMap, xmlText, anexarNa } = pendingXmlImport;
      if (tipo === "entrada") await salvarDeParaFornecedor(fornecedorId, linhas);
      void aplicarImportacaoXml(nfe, tipo, fornecedorId, fornecedorNome, clienteId || "", clienteNome || "", linhas, fiscalMap, xmlText, anexarNa);
      setPendingXmlImport(null); setTraducaoOpen(false);
      toast.success(anexarNa ? `Tradução confirmada. Revise a anexação na NF ${anexarNa.numero} e salve.` : "Tradução confirmada. Revise a NF e salve.");
    } else if (xmlOriginInfo) {
      await salvarDeParaFornecedor(xmlOriginInfo.fornecedorId, linhas);
      const newItems: GridItem[] = linhas.map((t) => {
        const qtdInterna = t.fatorConversao > 0 ? t.xmlQuantidade * t.fatorConversao : t.xmlQuantidade;
        const vUnInterno = qtdInterna > 0 ? t.xmlValorTotal / qtdInterna : t.xmlValorUnitario;
        const matched = produtos.find((p) => p.id === t.produtoId);
        return { produto_id: t.produtoId, codigo: t.xmlCodigo, descricao: matched?.nome || t.xmlDescricao, quantidade: qtdInterna, valor_unitario: vUnInterno, valor_total: t.xmlValorTotal };
      });
      setItems(newItems); setTraducaoLinhas(linhas); setTraducaoOpen(false); toast.success("Tradução atualizada.");
    }
  };

  const handleTraducaoCancel = () => { setTraducaoOpen(false); if (pendingXmlImport) { setPendingXmlImport(null); toast.info("Importação de XML cancelada."); } };

  const handleQuickFornecedorCreated = async (fornecedorId: string) => {
    await refetchFornecedores(); setQuickFornecedorOpen(false);
    if (pendingXmlImport) {
      const fornecedorNome = quickFornecedorDefaults.nome_razao_social || "";
      setPendingXmlImport({ ...pendingXmlImport, fornecedorId, fornecedorNome });
      setTraducaoReadOnly(false); setTraducaoOpen(true);
    } else {
      setForm((prev) => ({ ...prev, fornecedor_id: fornecedorId })); toast.success("Fornecedor cadastrado e selecionado.");
    }
  };

  const handleQuickClienteCreated = async (clienteId: string) => {
    await refetchClientes(); setQuickClienteOpen(false);
    if (pendingXmlImport && pendingXmlImport.tipo === "saida") {
      const clienteNome = quickClienteDefaults.nome_razao_social || "";
      void aplicarImportacaoXml(pendingXmlImport.nfe, "saida", "", "", clienteId, clienteNome, traducaoLinhas, pendingXmlImport.fiscalMap, pendingXmlImport.xmlText, pendingXmlImport.anexarNa);
      setPendingXmlImport(null); toast.success("Cliente cadastrado. NF de saída pronta para revisão.");
    } else { setForm((prev) => ({ ...prev, cliente_id: clienteId })); toast.success("Cliente cadastrado e selecionado."); }
  };

  const handleQuickProdutoCreated = async (produtoId: string) => {
    const idx = quickProdutoLinhaIdx; await refetchProdutos();
    if (idx !== null && idx >= 0) {
      setTraducaoLinhas((prev) => prev.map((l) => l.index === idx ? { ...l, produtoId, matchStatus: "manual", pendente: false, salvarDePara: true } : l));
    } else if (idx === -1) {
      setItems((prev) => {
        const next = [...prev]; const target = next.findIndex((i) => !i.produto_id);
        const matched = produtos.find((p) => p.id === produtoId) as { codigo_interno?: string; nome?: string; preco_custo?: number } | undefined;
        const row: GridItem = { produto_id: produtoId, codigo: String(matched?.codigo_interno || ""), descricao: String(matched?.nome || ""), quantidade: 0, valor_unitario: Number(matched?.preco_custo || 0), valor_total: 0 };
        if (target >= 0) next[target] = row; else next.push(row); return next;
      });
    }
    setQuickProdutoLinhaIdx(null); setQuickProdutoNome("");
  };

  const triggerAnexarXml = (nf: NotaFiscal) => { setAnexarTargetNf(nf); setTimeout(() => anexarXmlInputRef.current?.click(), 0); };
  const resetXmlOriginState = () => { setXmlOriginInfo(null); setTraducaoLinhas([]); };
  const openTraducaoEdit = () => { setTraducaoReadOnly(false); setTraducaoOpen(true); };
  const openQuickFornecedorFromForm = () => { setQuickFornecedorDefaults({}); setQuickFornecedorOpen(true); };
  const openQuickProdutoFromForm = () => { setQuickProdutoLinhaIdx(-1); setQuickProdutoNome(""); };

  return {
    xmlInputRef, anexarXmlInputRef, handleXmlImport, handleAnexarXmlChange, processarXmlImportado, triggerAnexarXml,
    traducaoLinhas, setTraducaoLinhas, traducaoOpen, traducaoReadOnly, handleTraducaoConfirm, handleTraducaoCancel, openTraducaoEdit,
    xmlOriginInfo, setXmlOriginInfo, resetXmlOriginState, pendingXmlImport,
    quickProdutoLinhaIdx, setQuickProdutoLinhaIdx, quickProdutoNome, setQuickProdutoNome, handleQuickProdutoCreated, openQuickProdutoFromForm,
    quickFornecedorOpen, setQuickFornecedorOpen, quickFornecedorDefaults, handleQuickFornecedorCreated, openQuickFornecedorFromForm,
    quickClienteOpen, setQuickClienteOpen, quickClienteDefaults, handleQuickClienteCreated,
  };
}
