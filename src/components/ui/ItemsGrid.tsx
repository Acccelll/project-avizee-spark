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

interface Props {
  items: GridItem[];
  onChange: (items: GridItem[]) => void;
  produtos: any[];
  title?: string;
  readOnly?: boolean;
}

const emptyItem = (): GridItem => ({
  produto_id: "", codigo: "", descricao: "", quantidade: 0, valor_unitario: 0, valor_total: 0,
});

export function ItemsGrid({ items, onChange, produtos, title = "Itens", readOnly = false }: Props) {
  const addItem = () => onChange([...items, emptyItem()]);
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: string, value: any) => {
    const next = [...items];
    const item = { ...next[idx], [field]: value };

    if (field === "produto_id" && value) {
      const prod = produtos.find((p: any) => p.id === value);
      if (prod) {
        item.codigo = prod.codigo_interno || "";
        item.descricao = prod.nome;
        item.valor_unitario = prod.preco_venda || 0;
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

  const produtoOptions = produtos.map((p: any) => ({
    id: p.id,
    label: p.nome,
    sublabel: [p.codigo_interno, p.unidade_medida].filter(Boolean).join(" • "),
    searchTerms: [p.codigo_interno, p.referencia_fornecedor].filter(Boolean),
  }));

  return (
    <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {!readOnly && (
          <Button type="button" size="sm" onClick={addItem} className="gap-1.5">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
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
                  <Input className="h-8 text-xs text-right font-mono" type="number" value={item.quantidade || ""} onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))} readOnly={readOnly} />
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
