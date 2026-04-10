import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, Tag, Info, AlertTriangle, CheckCircle2, Copy, GripVertical, Upload } from "lucide-react";
import { ProductSelector } from "@/components/ui/DataSelector";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ProductWithForn extends Tables<"produtos"> {
  produtos_fornecedores?: (Tables<"produtos_fornecedores"> & { fornecedores?: { nome_razao_social: string } | null })[];
}

export interface OrcamentoItem {
  id?: string;
  produto_id: string;
  codigo_snapshot: string;
  descricao_snapshot: string;
  variacao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  desconto_percentual?: number;
  valor_total: number;
  peso_unitario: number;
  peso_total: number;
  override_justificativa?: string;
  cost_source?: "ultimo_custo_compra" | "custo_medio" | "custo_manual_cotacao" | "custo_produto";
  custo_manual_unitario?: number;
  observacao_interna_margem?: string;
  custo_base_padrao?: number | null;
  usa_custo_simulado?: boolean;
  custo_simulado?: number | null;
  preco_simulado_unitario?: number | null;
  desconto_simulado_percentual?: number | null;
  outros_custos_simulados_unitario?: number | null;
  frete_rateado_simulado_unitario?: number | null;
  imposto_rateado_simulado_unitario?: number | null;
  usar_cenario?: boolean;
  origem_custo_padrao?: string | null;
  origem_custo_analise?: string | null;
}

interface Props {
  items: OrcamentoItem[];
  onChange: (items: OrcamentoItem[]) => void;
  produtos: ProductWithForn[];
  precosEspeciais?: Tables<"precos_especiais">[];
}

const emptyItem = (): OrcamentoItem => ({
  produto_id: "", codigo_snapshot: "", descricao_snapshot: "", variacao: "",
  quantidade: 1, unidade: "UN", valor_unitario: 0, desconto_percentual: 0, valor_total: 0,
  peso_unitario: 0, peso_total: 0,
});

export function OrcamentoItemsGrid({ items, onChange, produtos, precosEspeciais }: Props) {
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const addItem = () => onChange([...items, emptyItem()]);

  const getProductOptions = () => produtos.map((p) => ({
    id: p.id,
    label: p.nome,
    sublabel: `${p.sku || p.codigo_interno || ""} · ${formatCurrency(p.preco_venda || 0)}`,
    rightMeta: `Estoque: ${p.estoque_atual ?? 0}`,
    imageUrl: null,
    searchTerms: [p.sku, p.codigo_interno, p.nome].filter(Boolean) as string[],
  }));

  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const duplicateItem = (idx: number) => {
    const source = items[idx];
    if (source.produto_id && items.some((item, i) => i !== idx && item.produto_id === source.produto_id)) {
      toast.warning("Item já incluso no orçamento. Edite a quantidade na linha existente.");
      return;
    }
    const { id: _id, ...itemWithoutId } = source;
    onChange([...items.slice(0, idx + 1), itemWithoutId, ...items.slice(idx + 1)]);
  };

  const recalc = (item: OrcamentoItem) => {
    const qty = Number(item.quantidade || 0);
    const unit = Number(item.valor_unitario || 0);
    const desconto = Number(item.desconto_percentual || 0);
    const subtotal = qty * unit * (1 - desconto / 100);
    return { ...item, valor_total: subtotal, peso_total: qty * (item.peso_unitario || 0) };
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const next = [...items];
    let item = { ...next[idx], [field]: value };

    if (field === "produto_id" && value) {
      const alreadyExists = items.some((it, i) => i !== idx && it.produto_id === value);
      if (alreadyExists) {
        toast.warning("Item já incluso no orçamento. Edite a quantidade na linha existente.");
        return;
      }
      const prod = produtos.find((p: any) => p.id === value);
        if (prod) {
        item.codigo_snapshot = prod.sku || prod.codigo_interno || "";
        item.descricao_snapshot = prod.nome;
        item.unidade = prod.unidade_medida || "UN";
          item.peso_unitario = prod.peso || 0;
          item.custo_base_padrao = prod.preco_custo ?? null;
          item.usa_custo_simulado = false;
          item.custo_simulado = null;
          item.preco_simulado_unitario = null;
          item.desconto_simulado_percentual = null;
          item.outros_custos_simulados_unitario = null;
          item.frete_rateado_simulado_unitario = null;
          item.imposto_rateado_simulado_unitario = null;
          item.usar_cenario = false;
          item.origem_custo_padrao = "cadastro_produto";
          item.origem_custo_analise = "cadastro_produto";

        const precoEspecial = precosEspeciais?.find((p) => p.produto_id === value);
        const precoBase = prod.preco_venda || 0;
        if (precoEspecial) {
          if (precoEspecial.preco_especial && Number(precoEspecial.preco_especial) > 0) {
            item.valor_unitario = Number(precoEspecial.preco_especial);
          } else {
            item.valor_unitario = precoBase;
          }
          toast.info(`Preço especial para este cliente aplicado em ${prod.nome}`);
        } else {
          item.valor_unitario = precoBase;
        }
      }
    }

    if (field === "valor_unitario" && precosEspeciais?.some((p) => p.produto_id === item.produto_id)) {
      item.override_justificativa = item.override_justificativa || "";
    }

    item = recalc(item);
    next[idx] = item;
    onChange(next);
  };

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + Number(item.valor_total || 0), 0), [items]);
  const activeDetailProduct = produtos.find((p) => p.id === detailProductId);
  const productMap = useMemo(() => {
    const map = new Map<string, ProductWithForn>();
    const addTerm = (term: string | null | undefined, product: ProductWithForn) => {
      if (!term) return;
      map.set(term.toLowerCase(), product);
    };

    for (const prod of produtos) {
      addTerm(prod.sku, prod);
      addTerm(prod.codigo_interno, prod);
      addTerm(prod.nome, prod);
    }

    return map;
  }, [produtos]);

  const onDropIndex = (targetIndex: number) => {
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    const next = [...items];
    const [moved] = next.splice(draggingIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDraggingIndex(null);
    onChange(next);
  };

  const importFromText = async () => {
    const lines = importText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: OrcamentoItem[] = [];
    let skipped = 0;

    for (let index = 0; index < lines.length; index += 1) {
      if (index > 0 && index % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const line = lines[index];
      const [codigo = "", descricao = "", qtd = "1", unit = "0"] = line.split(/[;|,]/).map((p) => p.trim());
      const codigoKey = codigo.toLowerCase();
      const descricaoKey = descricao.toLowerCase();

      let prod = productMap.get(codigoKey);
      if (!prod && descricaoKey) {
        prod = productMap.get(descricaoKey);
      }
      if (!prod && codigoKey) {
        prod = produtos.find((p) =>
          String(p.nome || "").toLowerCase().includes(codigoKey) ||
          String(p.sku || "").toLowerCase().includes(codigoKey) ||
          String(p.codigo_interno || "").toLowerCase().includes(codigoKey),
        );
      }

      if (prod?.id) {
        const alreadyInList = items.some((it) => it.produto_id === prod!.id) ||
          parsed.some((it) => it.produto_id === prod!.id);
        if (alreadyInList) {
          skipped += 1;
          continue;
        }
      }

      parsed.push(recalc({
        ...emptyItem(),
        produto_id: prod?.id || "",
        codigo_snapshot: codigo || prod?.sku || prod?.codigo_interno || "",
        descricao_snapshot: descricao || prod?.nome || "",
        quantidade: Number(qtd) || 1,
        valor_unitario: Number(unit) || Number(prod?.preco_venda || 0),
        peso_unitario: Number(prod?.peso || 0),
      }));
    }

    onChange([...items, ...parsed]);
    setImportText("");
    setImportOpen(false);
    if (skipped > 0) {
      toast.success(`${parsed.length} itens importados`, {
        description: `${skipped} item(ns) ignorado(s) por já estarem no orçamento.`,
      });
    } else {
      toast.success(`${parsed.length} itens importados`);
    }
  };

  return (
    <div className="bg-card rounded-xl border shadow-soft overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-foreground">Itens do Orçamento</h3>
        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-muted/30 px-2 py-1 text-xs font-medium">Parcial: {formatCurrency(subtotal)}</div>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-1"><Upload className="h-3.5 w-3.5" />Importar texto</Button>
          <Button size="sm" onClick={addItem} className="gap-1.5"><Plus className="w-4 h-4" />Adicionar Item</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px]">
          <thead>
            <tr className="bg-accent/50 border-b">
              <th className="w-8" />
              <th className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2.5">Código</th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2.5">Descrição</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider px-3 py-2.5">Qtd.</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider px-3 py-2.5">Unitário</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider px-3 py-2.5">Desc. %</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider px-3 py-2.5">Subtotal</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider px-3 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground py-8 text-sm">Nenhum item adicionado</td></tr>
            ) : items.map((item, idx) => {
              const prod = produtos.find((p) => p.id === item.produto_id);
              const lowStock = item.quantidade > 0 && (prod?.estoque_atual ?? 0) <= item.quantidade;
              const hasSpecial = precosEspeciais?.some((p) => p.produto_id === item.produto_id);
              return (
                <tr
                  key={idx}
                  className={`border-b ${lowStock ? "bg-warning/10" : "hover:bg-muted/20"}`}
                  draggable
                  onDragStart={() => setDraggingIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropIndex(idx)}
                >
                  <td className="px-2 text-muted-foreground"><GripVertical className="h-4 w-4" /></td>
                  <td className="px-3 py-2"><Input className="h-8 text-xs font-mono" value={item.codigo_snapshot} onChange={(e) => updateItem(idx, "codigo_snapshot", e.target.value)} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 items-center">
                      <AutocompleteSearch options={getProductOptions()} value={item.produto_id} onChange={(val) => updateItem(idx, "produto_id", val)} placeholder="Buscar produto..." className="flex-1" onCreateNew={() => window.open('/produtos', '_blank')} createNewLabel="Produto não encontrado? Cadastrar" />
                      <ProductSelector produtos={produtos} onSelect={(p) => updateItem(idx, "produto_id", p.id)} trigger={<Button variant="outline" size="icon" className="h-8 w-8"><Search className="h-3 w-3" /></Button>} />
                      {item.produto_id && <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDetailProductId(item.produto_id)}><Info className="h-3 w-3" /></Button>}
                    </div>
                    {hasSpecial && <p className="text-[11px] text-primary mt-1">Preço especial para este cliente aplicado.</p>}
                  </td>
                  <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={item.quantidade || ""} onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))} /></td>
                  <td className="px-3 py-2">
                    <Input type="number" className="h-8 text-right" value={item.valor_unitario || ""} onChange={(e) => updateItem(idx, "valor_unitario", Number(e.target.value))} />
                    {hasSpecial && (
                      <div className="mt-1">
                        <Input
                          placeholder="Justificativa de override"
                          className={`h-7 text-xs ${item.valor_unitario !== (prod?.preco_venda || 0) && !item.override_justificativa ? 'border-destructive' : ''}`}
                          value={item.override_justificativa || ''}
                          onChange={(e) => updateItem(idx, 'override_justificativa', e.target.value)}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2"><Input type="number" className="h-8 text-right" value={item.desconto_percentual || 0} onChange={(e) => updateItem(idx, "desconto_percentual", Number(e.target.value))} /></td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.valor_total || 0)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => duplicateItem(idx)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                    {lowStock ? <span className="inline-flex mt-1 items-center gap-1 text-[11px] text-warning"><AlertTriangle className="h-3.5 w-3.5" />Estoque baixo</span> : <span className="inline-flex mt-1 items-center gap-1 text-[11px] text-success"><CheckCircle2 className="h-3.5 w-3.5" />OK</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ViewDrawerV2 open={!!detailProductId} onClose={() => setDetailProductId(null)} title={activeDetailProduct?.nome || "Detalhes do Produto"}>
        {activeDetailProduct ? (
          <div className="space-y-2 text-sm">
            <p><strong>Código:</strong> {activeDetailProduct.sku || activeDetailProduct.codigo_interno || "—"}</p>
            <p><strong>Estoque atual:</strong> {activeDetailProduct.estoque_atual ?? 0}</p>
            <p><strong>Preço sugerido:</strong> {formatCurrency(activeDetailProduct.preco_venda || 0)}</p>
            <p><strong>Descrição:</strong> {activeDetailProduct.descricao || "Sem descrição"}</p>
          </div>
        ) : null}
      </ViewDrawerV2>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importação rápida de itens</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Cole uma linha por item no formato: Código;Descrição;Quantidade;Unitário</p>
          <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} className="min-h-40" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={importFromText}>Importar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
