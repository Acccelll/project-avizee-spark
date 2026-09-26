import { Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/pages/comercial/orcamento-form/types";

interface Props {
  status: string;
  onCriarRevisao: () => void | Promise<void>;
}

/**
 * Banner exibido no topo do form quando o orçamento está em status terminal
 * (convertido/rejeitado/expirado/cancelado/histórico). Edição é bloqueada;
 * único caminho é gerar uma nova revisão via RPC.
 */
export function LockedAlert({ status, onCriarRevisao }: Props) {
  const isPedido = status === "aprovado";
  return (
    <Alert variant="default" className="mb-4 border-warning/40 bg-warning/5">
      <Lock className="h-4 w-4" />
      <AlertTitle>{isPedido ? "Pedido registrado — itens travados" : "Orçamento bloqueado para edição"}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2 mt-1">
        <span>
          {isPedido ? (
            <>Para mudar quantidade ou preço, gere uma revisão. Quando a revisão virar pedido, esta versão é encerrada.</>
          ) : (
            <>Este orçamento está no status <strong>{STATUS_LABEL[status] || status}</strong> e não pode mais ser alterado.
            Para ajustar, gere uma nova revisão.</>
          )}
        </span>
        <Button size="sm" variant="outline" onClick={() => void onCriarRevisao()}>
          Criar revisão
        </Button>
      </AlertDescription>
    </Alert>
  );
}