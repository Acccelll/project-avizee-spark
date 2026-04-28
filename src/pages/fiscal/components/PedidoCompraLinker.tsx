import { useEffect, useState } from "react";
import { Link2, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  desvincularNFPedidoCompra,
  listPedidosCompraParaVincular,
  vincularNFPedidoCompra,
} from "@/services/fiscal.service";
import { getUserFriendlyError, notifyError } from "@/utils/errorMessages";
import { formatCurrency } from "@/lib/format";

interface PedidoOption {
  id: string;
  numero: string | null;
  valor_total: number | null;
  status: string | null;
  fornecedor_nome: string | null;
  data_pedido: string | null;
  isSuggestion?: boolean;
}

interface PedidoCompraLinkerProps {
  notaFiscalId: string;
  fornecedorId: string | null;
  pedidoCompraIdAtual: string | null;
  disabled?: boolean;
  /** Valor total da NF — usado para sugerir pedidos com valor próximo (±0,01). */
  nfValorTotal?: number | null;
  /** Data de emissão da NF — usada para sugerir pedidos em janela de ±15 dias. */
  nfDataEmissao?: string | null;
}

/**
 * Vincula uma NF de entrada a um Pedido de Compra. Após o vínculo, dispara a
 * RPC `vincular_nf_pedido_compra`, que:
 *   - atualiza `notas_fiscais.pedido_compra_id`
 *   - recalcula a soma de NFs do PO
 *   - ajusta `pedidos_compra.status` para `recebido_parcial` ou `recebido_total`
 */
export function PedidoCompraLinker({
  notaFiscalId,
  fornecedorId,
  pedidoCompraIdAtual,
  disabled,
  nfValorTotal,
  nfDataEmissao,
}: PedidoCompraLinkerProps) {
  const qc = useQueryClient();
  const [pedidos, setPedidos] = useState<PedidoOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(pedidoCompraIdAtual);
  const [pending, setPending] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);

  useEffect(() => {
    setSelectedId(pedidoCompraIdAtual);
  }, [pedidoCompraIdAtual]);

  useEffect(() => {
    if (!fornecedorId) {
      setPedidos([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      let baseOpts: PedidoOption[] = [];
      try {
        const list = await listPedidosCompraParaVincular(fornecedorId);
        baseOpts = list.map((p) => ({ ...p }));
      } catch (err) {
        if (cancelled) return;
        notifyError(err);
        setLoadingList(false);
        return;
      }
      if (cancelled) return;

      // Marcar sugestões: valor_total ≈ nfValorTotal (±0,01) e
      // data_pedido ∈ [nfDataEmissao - 15d, nfDataEmissao]
      const nfValor = typeof nfValorTotal === "number" ? nfValorTotal : null;
      const nfData = nfDataEmissao ? new Date(nfDataEmissao) : null;
      const lowerBound = nfData
        ? new Date(nfData.getTime() - 15 * 24 * 60 * 60 * 1000)
        : null;

      const matches = (p: PedidoOption): boolean => {
        if (nfValor !== null && p.valor_total !== null) {
          if (Math.abs(Number(p.valor_total) - nfValor) > 0.01) return false;
        }
        if (lowerBound && nfData && p.data_pedido) {
          const dp = new Date(p.data_pedido);
          if (dp < lowerBound || dp > nfData) return false;
        }
        return nfValor !== null || lowerBound !== null;
      };

      const annotated = baseOpts.map((p) => ({ ...p, isSuggestion: matches(p) }));
      // Sugestões primeiro, depois ordem original
      annotated.sort((a, b) => Number(b.isSuggestion ?? false) - Number(a.isSuggestion ?? false));
      setPedidos(annotated);

      // Auto-seleciona quando há exatamente 1 sugestão e não há vínculo prévio
      if (!pedidoCompraIdAtual && !autoApplied) {
        const suggestions = annotated.filter((p) => p.isSuggestion);
        if (suggestions.length === 1) {
          setSelectedId(suggestions[0].id);
          setAutoApplied(true);
          toast.info(
            `Pedido #${suggestions[0].numero ?? suggestions[0].id.slice(0, 8)} sugerido automaticamente.`,
          );
        }
      }
      setLoadingList(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só queremos rebuscar quando o trio (fornecedor, valor, data) muda; setters/toast usados via closure
  }, [fornecedorId, nfValorTotal, nfDataEmissao]);

  const handleVincular = async () => {
    if (!selectedId) return;
    setPending(true);
    try {
      await vincularNFPedidoCompra({ notaFiscalId, pedidoCompraId: selectedId });
      toast.success("NF vinculada ao pedido de compra. Status do PO atualizado.");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
      qc.invalidateQueries({ queryKey: ["pedidos_compra"] });
    } catch (err) {
      notifyError(err);
    } finally {
      setPending(false);
    }
  };

  const handleDesvincular = async () => {
    setPending(true);
    try {
      await desvincularNFPedidoCompra(notaFiscalId);
      setSelectedId(null);
      toast.success("Vínculo removido.");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
    } catch (err) {
      notifyError(err);
    } finally {
      setPending(false);
    }
  };

  if (!fornecedorId) {
    return (
      <p className="text-xs text-muted-foreground">
        Defina um fornecedor para habilitar o vínculo com pedido de compra.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={selectedId ?? ""}
        onValueChange={(v) => setSelectedId(v || null)}
        disabled={disabled || pending || loadingList}
      >
        <SelectTrigger className="h-8 w-[260px] text-xs">
          <SelectValue
            placeholder={loadingList ? "Carregando pedidos…" : "Selecione um pedido"}
          />
        </SelectTrigger>
        <SelectContent>
          {pedidos.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Nenhum pedido disponível.
            </div>
          )}
          {pedidos.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">#{p.numero ?? p.id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(Number(p.valor_total ?? 0))}
                </span>
                {p.status && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    {p.status}
                  </Badge>
                )}
                {p.isSuggestion && (
                  <Badge variant="default" className="h-4 px-1 text-[10px]">
                    sugestão
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="default"
        className="gap-1.5"
        disabled={
          disabled ||
          pending ||
          !selectedId ||
          selectedId === pedidoCompraIdAtual
        }
        onClick={handleVincular}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
        Vincular
      </Button>

      {pedidoCompraIdAtual && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={disabled || pending}
          onClick={handleDesvincular}
        >
          <Unlink className="h-3.5 w-3.5" />
          Desvincular
        </Button>
      )}
    </div>
  );
}