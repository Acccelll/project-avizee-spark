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
    <div className="rounded-lg border overflow-hidden">
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
  );
}
