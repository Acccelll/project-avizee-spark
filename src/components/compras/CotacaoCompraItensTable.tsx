/**
 * Subcomponente: tabela de itens da cotação de compra.
 */
import { useMemo } from 'react';
import type { CotacaoItem, Proposta } from './cotacaoCompraTypes';

interface CotacaoCompraItensTableProps {
  items: CotacaoItem[];
  /** Propostas da cotação — usadas para mostrar contagem por item. */
  propostas?: Proposta[];
}

export function CotacaoCompraItensTable({ items, propostas = [] }: CotacaoCompraItensTableProps) {
  const propostasPorItem = useMemo(() => {
    const map = new Map<string, number>();
    propostas.forEach((p) => {
      if (!p.item_id) return;
      map.set(p.item_id, (map.get(p.item_id) ?? 0) + 1);
    });
    return map;
  }, [propostas]);
  const showPropostas = propostas.length > 0 || items.some((i) => (propostasPorItem.get(i.id) ?? 0) > 0);
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum item cadastrado nesta cotação.
      </div>
    );
  }

  return (
    <>
    {/* Mobile: cards verticais */}
    <div className="md:hidden space-y-2">
      {items.map((item, idx) => (
        <div key={item.id} className="rounded-lg border bg-card p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm leading-tight">{item.produtos?.nome || "—"}</p>
              <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                #{idx + 1} · {item.produtos?.codigo_interno || item.produtos?.sku || "—"}
              </p>
              {showPropostas && (() => {
                const count = propostasPorItem.get(item.id) ?? 0;
                return (
                  <p className={`text-[11px] mt-0.5 ${count > 0 ? "text-success" : "text-muted-foreground"}`}>
                    {count > 0 ? `${count} ${count === 1 ? "proposta" : "propostas"}` : "Aguardando proposta"}
                  </p>
                );
              })()}
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm font-semibold">{item.quantidade}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{item.unidade || "UN"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
    {/* Desktop: tabela */}
    <div className="hidden md:block rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">#</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Produto</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Cód.</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase">Qtd</th>
            <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase">Un</th>
            {showPropostas && (
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase">Propostas</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{idx + 1}</td>
              <td className="px-3 py-2 font-medium max-w-[180px]">
                <span className="truncate block">{item.produtos?.nome || "—"}</span>
              </td>
              <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                {item.produtos?.codigo_interno || item.produtos?.sku || "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{item.quantidade}</td>
              <td className="px-3 py-2 text-center text-xs text-muted-foreground">{item.unidade || "UN"}</td>
              {showPropostas && (
                <td className="px-3 py-2 text-center text-xs">
                  {(() => {
                    const count = propostasPorItem.get(item.id) ?? 0;
                    if (count > 0) {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
                          {count} {count === 1 ? "proposta" : "propostas"}
                        </span>
                      );
                    }
                    return <span className="text-muted-foreground">Aguardando</span>;
                  })()}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
