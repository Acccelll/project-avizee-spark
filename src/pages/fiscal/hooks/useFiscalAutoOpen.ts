import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getEmpresaConfig } from "@/services/fiscal/empresaConfig.service";
import { getPedidoCompraResumo } from "@/services/fiscal.service";
import {
  emptyFiscalForm as emptyForm,
  type FiscalFormState as FiscalForm,
  type NfItemFiscalData,
} from "@/pages/fiscal/hooks/useFiscalNotaForm";
import type { NotaFiscal } from "@/types/domain";
import type { GridItem } from "@/components/ui/ItemsGrid";

export interface UseFiscalAutoOpenArgs {
  // Setters do estado canônico do modal/form.
  setMode: (m: "create" | "edit") => void;
  setForm: (f: FiscalForm) => void;
  setItems: (items: GridItem[]) => void;
  setSelected: (n: NotaFiscal | null) => void;
  setParcelas: (n: number) => void;
  setItemContaContabil: (m: Record<number, string>) => void;
  setItemFiscalData: (m: Record<number, NfItemFiscalData>) => void;
  setModalOpen: (open: boolean) => void;
  setXmlOriginInfo: (info: null) => void;
  setTraducaoLinhas: (linhas: never[]) => void;
  setDrawerOpen: (open: boolean) => void;
  // Drawer/setSelected também precisam para deep-link `?nf=`.
  applyDeepLinkSelected: (nf: NotaFiscal) => void;
}

export interface UseFiscalAutoOpenApi {
  cnpjEmpresa: string | null;
  pedidoCompraOriginId: string | null;
  fornecedorOriginId: string | null;
  tipoOriginParam: string | null;
  originPedidoNumero: string | null;
  openCreate: () => void;
}

/**
 * Extrai os efeitos colaterais de inicialização da página Fiscal:
 *  - Carrega o CNPJ da empresa uma vez (usado pelo importador de XML).
 *  - Trata o atalho `?new=1` (one-shot) abrindo o modal de criação.
 *  - Trata o deep-link `?nf=:id` carregando a NF e abrindo o drawer de visualização.
 *  - Trata a origem `?pedido_compra_id=...&tipo=entrada` pré-preenchendo o form.
 *
 * Mantém comportamento 1:1 com o god-component anterior — apenas isola a
 * orquestração para que a página vire shell de JSX (Etapa 6.3).
 */
export function useFiscalAutoOpen(args: UseFiscalAutoOpenArgs): UseFiscalAutoOpenApi {
  const {
    setMode, setForm, setItems, setSelected, setParcelas,
    setItemContaContabil, setItemFiscalData,
    setModalOpen, setXmlOriginInfo, setTraducaoLinhas,
    setDrawerOpen, applyDeepLinkSelected,
  } = args;

  const [searchParams, setSearchParams] = useSearchParams();
  const [cnpjEmpresa, setCnpjEmpresa] = useState<string | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [originPedidoNumero, setOriginPedidoNumero] = useState<string | null>(null);

  const pedidoCompraOriginId = searchParams.get("pedido_compra_id");
  const fornecedorOriginId = searchParams.get("fornecedor_id");
  const tipoOriginParam = searchParams.get("tipo");

  // Carrega CNPJ da empresa uma única vez (empresa_config opcional).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getEmpresaConfig();
        if (!cancelled) setCnpjEmpresa((cfg as { cnpj?: string | null } | null)?.cnpj ?? null);
      } catch {
        // empresa_config ausente: import seguirá como entrada por default.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openCreate = () => {
    setMode("create");
    setForm({ ...emptyForm });
    setItems([]);
    setSelected(null);
    setParcelas(1);
    setItemContaContabil({});
    setItemFiscalData({});
    setXmlOriginInfo(null);
    setTraducaoLinhas([]);
    setModalOpen(true);
  };

  // ?new=1 — atalho one-shot para abrir o modal de emissão.
  useEffect(() => {
    if (autoOpened) return;
    if (searchParams.get("new") !== "1") return;
    setAutoOpened(true);
    openCreate();
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- atalho ?new=1 one-shot
  }, [searchParams, autoOpened]);

  // Deep-link ?nf=:id — carrega NF e abre drawer de visualização.
  useEffect(() => {
    const nfId = searchParams.get("nf");
    if (!nfId) return;
    let cancelled = false;
    (async () => {
      const { data: row, error } = await supabase
        .from("notas_fiscais")
        .select(
          "*, fornecedores(nome_razao_social, cpf_cnpj), clientes(nome_razao_social), ordens_venda(numero)",
        )
        .eq("id", nfId)
        .maybeSingle();
      if (cancelled || error || !row) return;
      applyDeepLinkSelected(row as unknown as NotaFiscal);
      setDrawerOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("nf");
      setSearchParams(next, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot via querystring
  }, [searchParams]);

  // Origem Pedido de Compra: pré-preenche NF de entrada.
  useEffect(() => {
    if (autoOpened || !pedidoCompraOriginId || tipoOriginParam !== "entrada") return;
    let cancelled = false;
    (async () => {
      const pc = await getPedidoCompraResumo(pedidoCompraOriginId).catch(() => null);
      if (cancelled) return;
      setOriginPedidoNumero(pc?.numero ?? null);
      setMode("create");
      setForm({
        ...emptyForm,
        tipo: "entrada",
        fornecedor_id: fornecedorOriginId || pc?.fornecedor_id || "",
        observacoes: pc?.numero ? `Recebimento do Pedido de Compra ${pc.numero}` : "",
      });
      setItems([]);
      setSelected(null);
      setParcelas(1);
      setItemContaContabil({});
      setItemFiscalData({});
      setModalOpen(true);
      setAutoOpened(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot por querystring
  }, [pedidoCompraOriginId, fornecedorOriginId, tipoOriginParam, autoOpened]);

  return {
    cnpjEmpresa,
    pedidoCompraOriginId,
    fornecedorOriginId,
    tipoOriginParam,
    originPedidoNumero,
    openCreate,
  };
}