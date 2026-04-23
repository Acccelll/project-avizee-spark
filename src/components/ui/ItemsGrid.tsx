import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";

export interface GridItem {
  id?: string;
  produto_id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

/**
 * Minimum shape every product row must satisfy to feed the grid.
 * Callers can pass richer typed rows (e.g. `ProdutoOptionRow`) and they
 * remain typed end-to-end without `unknown as` bridges.
 */
export interface ItemsGridProdutoBase {
  id: string | number;
  nome?: string | null;
  codigo_interno?: string | null;
  unidade_medida?: string | null;
  preco_venda?: number | null;
  referencia_fornecedor?: string | null;
}

interface Props<TProd extends ItemsGridProdutoBase> {
  items: GridItem[];
  onChange: (items: GridItem[]) => void;
  produtos: TProd[];
  title?: string;
  readOnly?: boolean;
  /** Per-item validation errors keyed by item index */
  itemErrors?: Record<number, string>;
  /**
   * Override the default unit price when a product is selected.
   * Defaults to `preco_venda` when not provided.
   * Use this to supply `preco_custo` (or 0) in purchase contexts.
   */
  getDefaultUnitPrice?: (produto: TProd) => number;
}

const emptyItem = (): GridItem => ({
  produto_id: "", codigo: "", descricao: "", quantidade: 0, valor_unitario: 0, valor_total: 0,
});

export function ItemsGrid<TProd extends ItemsGridProdutoBase>({
  items, onChange, produtos, title = "Itens", readOnly = false, itemErrors = {}, getDefaultUnitPrice,
}: Props<TProd>) {
  const addItem = () => onChange([...items, emptyItem()]);
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: string, value: unknown) => {
    const next = [...items];
    const item = { ...next[idx], [field]: value };

    if (field === "produto_id" && value) {
      const prod = produtos.find((p) => String(p.id) === String(value));
      if (prod) {
        item.codigo = String(prod.codigo_interno || "");
        item.descricao = String(prod.nome || "");
        item.valor_unitario = getDefaultUnitPrice
          ? getDefaultUnitPrice(prod)
          : Number(prod.preco_venda || 0);
      }
    }

    if (field === "quantidade" || field === "valor_unitario") {
      const qty = field === "quantidade" ? Number(value) : item.quantidade;
      const price = field === "valor_unitario" ? Number(value) : item.valor_unitario;
      item.valor_total = qty * price;
    }

    next[idx] = item;
    onChange(next);
  };

  const total = items.reduce((s, i) => s + (i.valor_total || 0), 0);

  const produtoOptions = produtos.map((p) => ({
    id: String(p.id),
    label: String(p.nome || ""),
    sublabel: [p.codigo_interno, p.unidade_medida].filter(Boolean).join(" • "),
    searchTerms: [p.codigo_interno, p.referencia_fornecedor].filter(Boolean) as string[],
  }));

  return (
    <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {!readOnly && (
          <Button type="button" size="sm" onClick={addItem} className="gap-1.5 max-sm:h-11">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        )}
      </div>
      {/* Mobile: cards verticais (md:hidden) */}
      <div className="md:hidden p-3 space-y-3">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item adicionado</p>
        ) : items.map((item, idx) => (
          <div key={idx} className="rounded-lg border bg-background p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase mt-1">Item {idx + 1}</span>
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Remover item" onClick={() => removeItem(idx)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Produto</label>
              {readOnly ? (
                <p className="text-sm">{item.descricao}</p>
              ) : (
                <AutocompleteSearch
                  options={produtoOptions}
                  value={item.produto_id}
                  onChange={(id) => updateItem(idx, "produto_id", id)}
                  placeholder="Buscar produto..."
                />
              )}
              {item.codigo && (
                <p className="text-[11px] font-mono text-muted-foreground">Cód.: {item.codigo}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Qtd.</label>
                <Input
                  className={`h-11 text-right font-mono${itemErrors[idx] ? " border-destructive" : ""}`}
                  type="number"
                  value={item.quantidade || ""}
                  onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))}
                  readOnly={readOnly}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Unitário</label>
                <Input className="h-11 text-right font-mono" type="number" step="0.01" value={item.valor_unitario || ""} onChange={(e) => updateItem(idx, "valor_unitario", Number(e.target.value))} readOnly={readOnly} />
              </div>
            </div>
            {itemErrors[idx] && (
              <p className="text-[11px] text-destructive">{itemErrors[idx]}</p>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Total</span>
              <span className="font-mono text-sm font-semibold">R$ {item.valor_total.toFixed(2)}</span>
            </div>
          </div>
        ))}
        {items.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-accent/40 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Total geral</span>
            <span className="font-mono text-base font-bold text-primary">R$ {total.toFixed(2)}</span>
          </div>
        )}
      </div>
      {/* Desktop: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-accent/50 border-b">
              <th className="text-left text-xs font-semibold text-foreground uppercase tracking-wider px-3 py-2.5 w-[12%]">Código</th>
              <th className="text-left text-xs font-semibold text-foreground uppercase tracking-wider px-3 py-2.5 w-[35%]">Descrição</th>
              <th className="text-right text-xs font-semibold text-foreground uppercase tracking-wider px-3 py-2.5 w-[12%]">Qtd.</th>
              <th className="text-right text-xs font-semibold text-foreground uppercase tracking-wider px-3 py-2.5 w-[15%]">Unitário</th>
              <th className="text-right text-xs font-semibold text-foreground uppercase tracking-wider px-3 py-2.5 w-[15%]">Total</th>
              {!readOnly && <th className="w-[8%]"></th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={readOnly ? 5 : 6} className="text-center text-muted-foreground py-8 text-sm">Nenhum item adicionado</td></tr>
            ) : items.map((item, idx) => (
              <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-3 py-2">
                  <Input className="h-8 text-xs font-mono" value={item.codigo} onChange={(e) => updateItem(idx, "codigo", e.target.value)} readOnly={readOnly} />
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="text-sm">{item.descricao}</span>
                  ) : (
                    <AutocompleteSearch
                      options={produtoOptions}
                      value={item.produto_id}
                      onChange={(id) => updateItem(idx, "produto_id", id)}
                      placeholder="Buscar produto (nome, código)..."
                      className="min-w-[200px]"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Input
                    className={`h-8 text-xs text-right font-mono${itemErrors[idx] ? " border-destructive" : ""}`}
                    type="number"
                    value={item.quantidade || ""}
                    onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))}
                    readOnly={readOnly}
                  />
                  {itemErrors[idx] && (
                    <p className="mt-0.5 text-[10px] text-destructive">{itemErrors[idx]}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Input className="h-8 text-xs text-right font-mono" type="number" step="0.01" value={item.valor_unitario || ""} onChange={(e) => updateItem(idx, "valor_unitario", Number(e.target.value))} readOnly={readOnly} />
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm font-semibold">
                  R$ {item.valor_total.toFixed(2)}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-accent/30 border-t">
                <td colSpan={readOnly ? 4 : 4} className="px-3 py-2 text-right text-xs font-semibold uppercase">Total</td>
                <td className="px-3 py-2 text-right font-mono text-sm font-bold text-primary">R$ {total.toFixed(2)}</td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
