import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrarPedidoDialog } from "@/components/orcamentos/RegistrarPedidoDialog";
import { PedidoClienteResumo } from "@/components/orcamentos/PedidoClienteResumo";
import { FaturamentoPedido } from "@/components/orcamentos/FaturamentoPedido";
import { canRegistrarPedido, isPedidoOrcamento } from "@/lib/comercialWorkflow";
import { getOrcamentoById } from "@/services/orcamentos.service";

interface Props {
  orcamentoId: string;
  clienteNome?: string | null;
  clienteCpfCnpj?: string | null;
  /** Chamado depois de registrar: o form trava os itens. */
  onPedidoRegistrado: () => void;
}

/**
 * Quadro "Pedido do cliente" no formulário do orçamento. Lê os dados do
 * pedido direto do banco (não fazem parte do payload de salvar_orcamento).
 */
export function PedidoClienteCard({ orcamentoId, clienteNome, clienteCpfCnpj, onPedidoRegistrado }: Props) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"registrar" | "editar" | null>(null);
  const { data: orc } = useQuery({
    queryKey: ["orcamento-pedido", orcamentoId],
    queryFn: () => getOrcamentoById(orcamentoId),
  });

  if (!orc) return null;
  const podeRegistrar = canRegistrarPedido(orc.status, orc.pedido_registrado_em);
  const ehPedido = isPedidoOrcamento(orc.status) && !!orc.pedido_cliente;
  if (!podeRegistrar && !ehPedido) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardCheck className="h-4 w-4 text-primary" /> Pedido do cliente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ehPedido ? (
          <div className="space-y-4">
            <PedidoClienteResumo orcamento={orc} onEditar={() => setDialog("editar")} />
            <div className="border-t pt-3">
              <FaturamentoPedido
                orcamento={orc}
                onChanged={() => void qc.invalidateQueries({ queryKey: ["orcamento-pedido", orcamentoId] })}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Quando o cliente confirmar, registre o número do pedido ou OC. Salve as alterações do orçamento antes.
            </p>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setDialog("registrar")}>
              <ClipboardCheck className="h-4 w-4" /> Registrar pedido
            </Button>
          </div>
        )}
      </CardContent>
      <RegistrarPedidoDialog
        open={!!dialog}
        modo={dialog ?? "registrar"}
        onClose={() => setDialog(null)}
        orcamento={{
          id: orc.id,
          numero: orc.numero,
          cliente_id: orc.cliente_id,
          clienteNome,
          clienteCpfCnpj,
          valor_total: orc.valor_total,
          prazo_entrega_dias: orc.prazo_entrega_dias,
          pedido_cliente: orc.pedido_cliente,
          data_pedido_cliente: orc.data_pedido_cliente,
          previsao_despacho: orc.previsao_despacho,
        }}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ["orcamento-pedido", orcamentoId] });
          void qc.invalidateQueries({ queryKey: ["orcamentos"] });
          if (dialog === "registrar") onPedidoRegistrado();
        }}
      />
    </Card>
  );
}
