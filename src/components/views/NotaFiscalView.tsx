import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { Truck, FileText, User, ShoppingCart } from "lucide-react";

interface Props {
  id: string;
}

export function NotaFiscalView({ id }: Props) {
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const { pushView } = useRelationalNavigation();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: nf } = await supabase
        .from("notas_fiscais")
        .select("*, fornecedores(id, nome_razao_social), clientes(id, nome_razao_social), ordens_venda(id, numero)")
        .eq("id", id)
        .single();

      if (!nf) return;
      setSelected(nf);

      const { data: it } = await supabase
        .from("notas_fiscais_itens")
        .select("*, produtos(id, nome, sku)")
        .eq("nota_fiscal_id", nf.id);

      setItems(it || []);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando nota fiscal...</div>;
  if (!selected) return <div className="p-8 text-center text-destructive">Nota fiscal não encontrada</div>;

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 rounded-lg p-4 text-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg font-mono text-primary">NF {selected.numero}</h3>
            <p className="text-xs text-muted-foreground">{formatDate(selected.data_emissao)}</p>
          </div>
          <StatusBadge status={selected.status} />
        </div>
        <div className="space-y-1 border-t pt-3">
           <div className="flex justify-between">
             <span className="text-muted-foreground">{selected.tipo === 'entrada' ? 'Fornecedor' : 'Cliente'}:</span>
             {selected.tipo === 'entrada' ? (
                <RelationalLink onClick={() => pushView("fornecedor", selected.fornecedores?.id)}>
                  {selected.fornecedores?.nome_razao_social || "—"}
                </RelationalLink>
             ) : (
                <RelationalLink onClick={() => pushView("cliente", selected.clientes?.id)}>
                  {selected.clientes?.nome_razao_social || "—"}
                </RelationalLink>
             )}
           </div>
           <div className="flex justify-between font-bold mt-2">
             <span>Total:</span>
             <span className="font-mono text-primary">{formatCurrency(selected.valor_total || 0)}</span>
           </div>
        </div>
      </div>

      <Tabs defaultValue="itens" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="logistica">Logística</TabsTrigger>
          <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="space-y-3 mt-3">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-muted-foreground">Produto</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Qtd</th>
                  <th className="px-2 py-2 text-right text-[10px] font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i: any, idx: number) => (
                  <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-2 py-2">
                      <button onClick={() => pushView("produto", i.produtos?.id)} className="text-left hover:underline block truncate max-w-[120px]">
                        {i.produtos?.nome || "—"}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs">{i.quantidade}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs font-medium">{formatCurrency(i.valor_total || i.quantidade * i.valor_unitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="logistica" className="mt-3">
          <h4 className="text-xs font-semibold flex items-center gap-2 px-1 text-muted-foreground uppercase mb-3">
            <Truck className="w-3.5 h-3.5" /> Rastreamento Logístico
          </h4>
          <LogisticaRastreioSection notaFiscalId={selected.id} />
        </TabsContent>

        <TabsContent value="vinculos" className="space-y-4 mt-3 text-sm">
          {selected.ordens_venda && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pedido</p>
              <RelationalLink onClick={() => pushView("ordem_venda", selected.ordens_venda?.id)} className="font-mono">
                {selected.ordens_venda?.numero}
              </RelationalLink>
            </div>
          )}
          {selected.chave_acesso && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Chave de Acesso</p>
              <p className="font-mono text-[10px] break-all bg-accent/20 p-2 rounded">{selected.chave_acesso}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
