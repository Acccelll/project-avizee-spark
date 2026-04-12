import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ViewDrawerV2, ViewField } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Edit, Trash2, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { Compra } from "@/hooks/useCompras";
import { statusLabels } from "@/hooks/useCompras";

interface CompraItem {
  id?: string;
  produto_id?: string | null;
  quantidade?: number | null;
  valor_total?: number | null;
  produtos?: { nome?: string | null; sku?: string | null } | null;
}

interface ProdutoEstoque {
  id: string;
  estoque_atual: number | null;
  estoque_minimo: number | null;
}

interface CompraDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  selected: Compra | null;
  viewItems: CompraItem[];
  isCotacoesView: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function useEstoqueByProdutos(produtoIds: string[]) {
  return useQuery<ProdutoEstoque[]>({
    queryKey: ["estoque-drawer", produtoIds],
    queryFn: async () => {
      if (!produtoIds.length) return [];
      const { data, error } = await supabase
        .from("produtos")
        .select("id, estoque_atual, estoque_minimo")
        .in("id", produtoIds);
      if (error) throw new Error(error.message);
      return (data ?? []) as ProdutoEstoque[];
    },
    enabled: produtoIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}

function EstoqueBadge({ estoqueAtual, estoqueMinimo }: { estoqueAtual: number | null; estoqueMinimo: number | null }) {
  const atual = estoqueAtual ?? 0;
  const minimo = estoqueMinimo ?? 0;

  if (atual <= 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="ml-1.5 gap-1 bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30">
            <AlertOctagon className="w-3 h-3" /> Ruptura
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Estoque zerado — produto sem unidades disponíveis (atual: {atual})
        </TooltipContent>
      </Tooltip>
    );
  }

  if (minimo > 0 && atual <= minimo) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="ml-1.5 gap-1 bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">
            <AlertTriangle className="w-3 h-3" /> Estoque Crítico
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Estoque abaixo do mínimo (atual: {atual}, mínimo: {minimo})
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}

export function CompraDetailDrawer({
  open,
  onClose,
  selected,
  viewItems,
  isCotacoesView,
  onEdit,
  onDelete,
}: CompraDetailDrawerProps) {
  const navigate = useNavigate();

  const produtoIds = useMemo(
    () => viewItems.map((i) => i.produto_id).filter((id): id is string => !!id),
    [viewItems],
  );

  const { data: estoqueData = [] } = useEstoqueByProdutos(open ? produtoIds : []);

  const estoqueMap = new Map(estoqueData.map((e) => [e.id, e]));

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={isCotacoesView ? "Detalhes da Cotação de Compra" : "Detalhes da Compra"}
      actions={
        selected ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Editar compra">
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={onDelete}
                  aria-label="Excluir compra"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir</TooltipContent>
            </Tooltip>
          </>
        ) : undefined
      }
      badge={
        selected ? (
          <StatusBadge
            status={selected.status}
            label={statusLabels[selected.status] || selected.status}
          />
        ) : undefined
      }
      tabs={
        selected
          ? [
              {
                value: "dados",
                label: "Dados",
                content: (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <ViewField label="Número">
                        <span className="font-mono">{selected.numero}</span>
                      </ViewField>
                      <ViewField label="Data Compra">
                        {selected.data_compra
                          ? new Date(selected.data_compra).toLocaleDateString("pt-BR")
                          : "—"}
                      </ViewField>
                    </div>
                    <ViewField label="Fornecedor">
                      {selected.fornecedores?.nome_razao_social ? (
                        <RelationalLink type="fornecedor" id={selected.fornecedor_id ?? ""}>
                          {selected.fornecedores.nome_razao_social}
                        </RelationalLink>
                      ) : (
                        "—"
                      )}
                    </ViewField>
                    <div className="grid grid-cols-2 gap-4">
                      <ViewField label="Valor Total">
                        <span className="font-semibold font-mono">
                          {formatCurrency(Number(selected.valor_total || 0))}
                        </span>
                      </ViewField>
                      <ViewField label="Frete">
                        <span className="font-mono">
                          {formatCurrency(Number(selected.frete_valor || 0))}
                        </span>
                      </ViewField>
                    </div>
                    {selected.observacoes && (
                      <ViewField label="Observações">{selected.observacoes}</ViewField>
                    )}
                    {!isCotacoesView && selected.status === "entregue" && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        <p className="text-sm text-muted-foreground flex-1">
                          Compra recebida. Para registrar estoque e financeiro, acesse a nota
                          de entrada.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 shrink-0"
                          onClick={() => {
                            onClose();
                            navigate("/fiscal?tipo=entrada");
                          }}
                        >
                          Ir para Fiscal <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                value: "itens",
                label: `Itens (${viewItems.length})`,
                content: (
                  <div className="space-y-1">
                    {viewItems.length === 0 ? (
                      <EmptyState
                        icon={PackageOpen}
                        title="Nenhum item cadastrado"
                        description="Esta compra não possui itens registrados."
                        className="py-8"
                      />
                    ) : (
                      viewItems.map((i, idx) => {
                        const estoque = i.produto_id ? estoqueMap.get(i.produto_id) : undefined;
                        return (
                          <div
                            key={i.id ?? idx}
                            className="flex justify-between border-b py-2 text-sm last:border-b-0"
                          >
                            <div>
                              <div className="flex items-center flex-wrap gap-x-1">
                                <RelationalLink type="produto" id={i.produto_id ?? ""}>
                                  {i.produtos?.nome || "—"}
                                </RelationalLink>
                                {estoque && (
                                  <EstoqueBadge
                                    estoqueAtual={estoque.estoque_atual}
                                    estoqueMinimo={estoque.estoque_minimo}
                                  />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">
                                {i.produtos?.sku || "—"} × {i.quantidade}
                              </p>
                            </div>
                            <span className="font-mono font-semibold">
                              {formatCurrency(Number(i.valor_total))}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                ),
              },
            ]
          : undefined
      }
    />
  );
}
