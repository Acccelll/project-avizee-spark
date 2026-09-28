import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, TriangleAlert } from "lucide-react";
import { listAvisosInternosProdutos } from "@/services/produtos.service";
import { agruparAvisosInternos } from "@/lib/avisosInternos";

interface Props {
  produtoIds: Array<string | null | undefined>;
  className?: string;
}

/**
 * Lembrete para a equipe quando o orçamento/pedido tem item de grupo com aviso
 * interno (ex.: agulhas → "Informar o lote"). Uso exclusivo das telas internas:
 * não entra no PDF nem no link público.
 */
export function AvisosInternosAlert({ produtoIds, className }: Props) {
  const ids = useMemo(
    () => [...new Set(produtoIds.filter((id): id is string => !!id))].sort(),
    [produtoIds],
  );
  const { data = [] } = useQuery({
    queryKey: ["avisos-internos-produtos", ids],
    queryFn: () => listAvisosInternosProdutos(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const grupos = useMemo(() => agruparAvisosInternos(data), [data]);
  if (!ids.length || !grupos.length) return null;

  return (
    <div
      role="note"
      aria-label="Avisos internos do pedido"
      className={`rounded-xl border border-dashed border-warning/60 bg-warning/10 p-4 text-sm ${className ?? ""}`}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" aria-hidden />
        Aviso interno — <strong>não aparece</strong> para o cliente, no PDF nem no link público.
      </p>
      <ul className="space-y-2">
        {grupos.map((g) => (
          <li key={g.aviso}>
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />
              {g.aviso}
            </p>
            <p className="pl-6 text-xs text-muted-foreground">
              {g.itens.map((i) => i.rotulo).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
