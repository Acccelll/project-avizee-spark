import { useEffect, useMemo, useState } from "react";
import { listCartoesAtivos, type CartaoCredito } from "@/services/cartoesCredito.service";
import {
  listOrdensVendaParaFiscal,
  listContasContabeisLancaveis,
} from "@/services/fiscal.service";
import { calcularTotalNF } from "@/lib/fiscal";
import type { GridItem } from "@/components/ui/ItemsGrid";
import type { ParcelaPlano } from "@/pages/fiscal/components/ParcelasFiscalEditor";
import {
  emptyFiscalForm,
  type FiscalFormState,
  type NfItemFiscalData,
} from "@/pages/fiscal/hooks/useFiscalNotaForm";
import type {
  FornecedorRefMin,
  ClienteRefMin,
  ProdutoRefMin,
  OrdemVendaRefMin,
  ContaContabilRefMin,
} from "@/pages/fiscal/components/NfeCreateFormModal";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";

/**
 * Estado canônico do modal de NF em `Fiscal.tsx` — extraído como parte da
 * Fase 2 da decomposição do god-component (mem://constraints/diretrizes-de-desenvolvimento).
 *
 * Escopo deliberadamente restrito a **state ownership** (useState + lookups +
 * derivados + reset helpers). Handlers de XML/tradução/lifecycle e o
 * `handleSubmit` permanecem em `Fiscal.tsx` por serem profundamente acoplados
 * a estado externo (traducaoLinhas, quick-adds, invalidate, navigate).
 */
export function useFiscalModalState() {
  const fornecedoresCrud = useSupabaseCrud<FornecedorRefMin>({ table: "fornecedores", paginationMode: "all" });
  const clientesCrud = useSupabaseCrud<ClienteRefMin>({ table: "clientes", paginationMode: "all" });
  const produtosCrud = useSupabaseCrud<ProdutoRefMin>({ table: "produtos", paginationMode: "all" });

  const [ordensVenda, setOrdensVenda] = useState<OrdemVendaRefMin[]>([]);
  const [contasContabeis, setContasContabeis] = useState<ContaContabilRefMin[]>([]);
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FiscalFormState>({ ...emptyFiscalForm });
  const [items, setItems] = useState<GridItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [parcelas, setParcelas] = useState(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState<string>("");
  const [intervaloDias, setIntervaloDias] = useState<number>(30);
  const [parcelasPlano, setParcelasPlano] = useState<ParcelaPlano[]>([]);
  const [itemContaContabil, setItemContaContabil] = useState<Record<number, string>>({});
  const [itemFiscalData, setItemFiscalData] = useState<Record<number, NfItemFiscalData>>({});

  // Lookups auxiliares (uma única vez na montagem).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ovs, contas, cs] = await Promise.all([
        listOrdensVendaParaFiscal(),
        listContasContabeisLancaveis(),
        listCartoesAtivos().catch(() => []),
      ]);
      if (cancelled) return;
      setOrdensVenda(ovs);
      setContasContabeis(contas);
      setCartoes(cs);
    })();
    return () => { cancelled = true; };
  }, []);

  // Derivados — regra unificada em `calcularTotalNF` (ICMS/PIS/COFINS são "por dentro").
  const valorProdutos = useMemo(
    () => items.reduce((s, i) => s + (i.valor_total || 0), 0),
    [items],
  );
  const totalImpostos = useMemo(
    () => Number(form.ipi_valor || 0) + Number(form.icms_st_valor || 0),
    [form.ipi_valor, form.icms_st_valor],
  );
  const totalNF = useMemo(
    () => calcularTotalNF(
      valorProdutos,
      Number(form.desconto_valor || 0),
      Number(form.icms_st_valor || 0),
      Number(form.ipi_valor || 0),
      Number(form.frete_valor || 0),
      Number(form.outras_despesas || 0),
    ),
    [valorProdutos, form.desconto_valor, form.icms_st_valor, form.ipi_valor, form.frete_valor, form.outras_despesas],
  );

  /** Reseta todo o estado de itens/parcelas/dados fiscais — usado por openCreate e openEdit. */
  const resetItensEParcelas = () => {
    setItems([]);
    setParcelas(1);
    setParcelasPlano([]);
    setItemContaContabil({});
    setItemFiscalData({});
  };

  return {
    // lookups
    fornecedores: fornecedoresCrud.data,
    refetchFornecedores: fornecedoresCrud.fetchData,
    clientes: clientesCrud.data,
    refetchClientes: clientesCrud.fetchData,
    produtos: produtosCrud.data,
    refetchProdutos: produtosCrud.fetchData,
    ordensVenda,
    contasContabeis,
    cartoes,
    // modal
    modalOpen, setModalOpen,
    mode, setMode,
    saving, setSaving,
    // form state
    form, setForm,
    items, setItems,
    parcelas, setParcelas,
    primeiroVencimento, setPrimeiroVencimento,
    intervaloDias, setIntervaloDias,
    parcelasPlano, setParcelasPlano,
    itemContaContabil, setItemContaContabil,
    itemFiscalData, setItemFiscalData,
    // derivados
    valorProdutos, totalImpostos, totalNF,
    // helpers
    resetItensEParcelas,
  };
}