import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2, Edit, Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";

interface Props {
  clienteId?: string;
  produtoId?: string;
}

export function PrecosEspeciaisTab({ clienteId, produtoId }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [clientes, setClientes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);

  const [form, setForm] = useState({
    cliente_id: clienteId || "",
    produto_id: produtoId || "",
    preco_especial: 0,
    vigencia_inicio: "",
    vigencia_fim: "",
    observacao: "",
  });

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from("precos_especiais").select("*, clientes(nome_razao_social), produtos(nome, sku, preco_venda)").eq("ativo", true);
    if (clienteId) query = query.eq("cliente_id", clienteId);
    if (produtoId) query = query.eq("produto_id", produtoId);

    const { data } = await query.order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    if (!clienteId) {
      supabase.from("clientes").select("id, nome_razao_social").eq("ativo", true).then(({ data }) => setClientes(data || []));
    }
    if (!produtoId) {
      supabase.from("produtos").select("id, nome, sku").eq("ativo", true).then(({ data }) => setProdutos(data || []));
    }
  }, [clienteId, produtoId]);

  const handleSave = async () => {
    if (!form.cliente_id || !form.produto_id || !form.preco_especial) {
      toast.error("Preencha cliente, produto e preço");
      return;
    }

    try {
      if (editingId) {
        await supabase.from("precos_especiais").update(form).eq("id", editingId);
        toast.success("Regra de preço atualizada");
      } else {
        await supabase.from("precos_especiais").insert(form);
        toast.success("Nova regra de preço criada");
      }
      setEditingId(null);
      setShowAdd(false);
      setForm({
        cliente_id: clienteId || "",
        produto_id: produtoId || "",
        preco_especial: 0,
        vigencia_inicio: "",
        vigencia_fim: "",
        observacao: "",
      });
      fetchData();
    } catch (err) {
      toast.error("Erro ao salvar regra de preço");
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Deseja remover esta regra de preço?")) return;
    await supabase.from("precos_especiais").update({ ativo: false }).eq("id", id);
    toast.success("Regra removida");
    fetchData();
  };

  if (loading && items.length === 0) return <div className="p-4 text-center animate-pulse">Carregando regras...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Tag className="w-4 h-4" /> Regras de Preço Especial
        </h3>
        {!showAdd && !editingId && (
          <Button size="sm" onClick={() => setShowAdd(true)} className="h-8 gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        )}
      </div>

      {(showAdd || editingId) && (
        <div className="rounded-lg border bg-accent/20 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!clienteId && (
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <AutocompleteSearch
                  options={clientes.map(c => ({ id: c.id, label: c.nome_razao_social }))}
                  value={form.cliente_id}
                  onChange={(v) => setForm({...form, cliente_id: v})}
                  placeholder="Selecione o cliente..."
                />
              </div>
            )}
            {!produtoId && (
              <div className="space-y-1">
                <Label className="text-xs">Produto</Label>
                <AutocompleteSearch
                  options={produtos.map(p => ({ id: p.id, label: p.nome, sublabel: p.sku }))}
                  value={form.produto_id}
                  onChange={(v) => setForm({...form, produto_id: v})}
                  placeholder="Selecione o produto..."
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Preço Especial (R$)</Label>
              <Input
                type="number" step="0.01"
                value={form.preco_especial}
                onChange={(e) => setForm({...form, preco_especial: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Início Vigência</Label>
              <Input
                type="date"
                value={form.vigencia_inicio}
                onChange={(e) => setForm({...form, vigencia_inicio: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim Vigência</Label>
              <Input
                type="date"
                value={form.vigencia_fim}
                onChange={(e) => setForm({...form, vigencia_fim: e.target.value})}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Observação</Label>
              <Input
                value={form.observacao}
                onChange={(e) => setForm({...form, observacao: e.target.value})}
                placeholder="Ex: Contrato Anual, Promoção, etc."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setEditingId(null); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}><Save className="w-3.5 h-3.5 mr-1" /> Salvar Regra</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
            Nenhuma regra de preço especial definida.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-primary">{formatCurrency(item.preco_especial)}</span>
                  {!clienteId && <span className="text-xs truncate font-medium">· {item.clientes?.nome_razao_social}</span>}
                  {!produtoId && <span className="text-xs truncate font-medium">· {item.produtos?.nome}</span>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {item.vigencia_inicio && (
                    <span className="text-[10px] text-muted-foreground">
                      Vigência: {formatDate(item.vigencia_inicio)} {item.vigencia_fim ? `até ${formatDate(item.vigencia_fim)}` : "em diante"}
                    </span>
                  )}
                  {item.observacao && (
                    <span className="text-[10px] text-muted-foreground italic">"{item.observacao}"</span>
                  )}
                  {produtoId && item.produtos?.preco_venda && (
                    <span className="text-[10px] text-muted-foreground">
                      (Padrão: {formatCurrency(item.produtos.preco_venda)})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                  setEditingId(item.id);
                  setForm({
                    cliente_id: item.cliente_id,
                    produto_id: item.produto_id,
                    preco_especial: item.preco_especial,
                    vigencia_inicio: item.vigencia_inicio || "",
                    vigencia_fim: item.vigencia_fim || "",
                    observacao: item.observacao || "",
                  });
                }}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemove(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
