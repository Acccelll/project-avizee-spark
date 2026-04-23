/**
 * Subcomponente: tabela de itens da cotação de compra.
 */
import type { CotacaoItem } from './cotacaoCompraTypes';

interface CotacaoCompraItensTableProps {
  items: CotacaoItem[];
}

export function CotacaoCompraItensTable({ items }: CotacaoCompraItensTableProps) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
