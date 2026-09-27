import { Badge } from "@/components/ui/badge";
import { CANAL_LABEL, type CanalVenda } from "@/services/comercial/pedidoDireto.service";

/** Selo do canal de venda; some para pedidos vindos de orçamento. */
export function CanalBadge({ canal, className }: { canal: string | null | undefined; className?: string }) {
  if (!canal || canal === "orcamento") return null;
  return (
    <Badge variant="secondary" className={`h-4 px-1.5 text-[10px] font-normal ${className ?? ""}`}>
      {CANAL_LABEL[canal as CanalVenda] ?? canal}
    </Badge>
  );
}
