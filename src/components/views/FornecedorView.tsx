import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Truck, Mail, MapPin, ShoppingBag, CreditCard, Package, FileText, Edit, Trash2, Building2, Clock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Props {
  id: string;
}

export function FornecedorView({ id }: Props) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [compras, setCompras] = useState<any[]>([]);
  const [financeiro, setFinanceiro] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { pushView, clearStack } = useRelationalNavigation();

  useEffect(() => {
    if (!supabase) {
      setFetchError("Serviço de banco de dados não disponível.");
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const { data: f, error: fError } = await supabase.from("fornecedores").select("*").eq("id", id).maybeSingle();
        if (fError) {
          console.error("[FornecedorView] erro ao buscar fornecedor:", fError);
          setFetchError(`Erro ao carregar fornecedor: ${fError.message}`);
          setLoading(false);
          return;
        }
        if (!f) {
          setLoading(false);
          return;
        }
        setSelected(f);

        const [cRes, fRes, pRes] = await Promise.all([
          supabase
          .from("pedidos_compra")
          .select("id, numero, data_pedido, valor_total, status")
          .eq("fornecedor_id", f.id)
          .order("data_pedido", { ascending: false })
          .limit(10),
          supabase
          .from("financeiro_lancamentos")
          .select("*")
          .eq("fornecedor_id", f.id)
          .order("data_vencimento", { ascending: false })
          .limit(10),
          supabase
          .from("produtos_fornecedores")
          .select("*, produtos(id, nome, sku)")
          .eq("fornecedor_id", f.id)
        ]);

        setCompras(cRes.data || []);
        setFinanceiro(fRes.data || []);
        setProdutos(pRes.data || []);
      } catch (error) {
        console.error("[FornecedorView] erro inesperado:", error);
        setFetchError(`Erro inesperado: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando dados do fornecedor...</div>;
  if (fetchError) return <div className="p-8 text-center text-destructive space-y-1"><p className="font-semibold">Erro ao carregar dados</p><p className="text-xs text-muted-foreground">{fetchError}</p></div>;
  if (!selected) return <div className="p-8 text-center text-destructive">Fornecedor não encontrado</div>;

  const ultCompra = compras.length > 0 ? compras[0].data_pedido : null;
  const volumeTotal = compras.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
  const vencidos = financeiro.filter(f => f.status === 'vencido');
  const totalAberto = financeiro.filter(f => f.status === 'aberto' || f.status === 'vencido').reduce((acc, curr) => acc + (curr.saldo_restante || curr.valor), 0);
  const totalVencido = vencidos.reduce((acc, curr) => acc + (curr.saldo_restante || curr.valor), 0);

  const produtosComPrazo = produtos.filter(p => p.lead_time_dias !== null && p.lead_time_dias !== undefined);
  const prazoMedio = produtosComPrazo.length > 0
    ? Math.round(produtosComPrazo.reduce((acc, p) => acc + (p.lead_time_dias || 0), 0) / produtosComPrazo.length)
    : selected.prazo_padrao || null;

  const deleteDescription = (() => {
    const parts: string[] = [];
    if (compras.length > 0) parts.push(`${compras.length} pedido(s) de compra`);
    if (financeiro.length > 0) parts.push(`${financeiro.length} lançamento(s) financeiro(s)`);
    if (produtos.length > 0) parts.push(`${produtos.length} produto(s) vinculado(s)`);
    const cnpj = selected?.cpf_cnpj ? ` (${selected.cpf_cnpj})` : "";
    if (parts.length > 0) {
      return `Tem certeza que deseja excluir "${selected?.nome_razao_social || ""}"${cnpj}? Este fornecedor possui ${parts.join(", ")}. Considere inativá-lo em vez de excluir.`;
    }
    return `Tem certeza que deseja excluir "${selected?.nome_razao_social || ""}"${cnpj}? Esta ação não pode ser desfeita.`;
  })();

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-1 border-b pb-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { clearStack(); navigate('/fornecedores', { state: { editId: id } }); }}>
              <Edit className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Editar</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Excluir</TooltipContent>
        </Tooltip>
      </div>

      {/* Header identity card */}
      <div className="flex items-start gap-4 bg-muted/30 p-4 rounded-lg">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
          <Truck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="font-semibold text-lg truncate leading-tight">{selected.nome_razao_social}</h3>
          {selected.nome_fantasia && (
            <p className="text-sm text-muted-foreground truncate">{selected.nome_fantasia}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            {selected.cpf_cnpj && (
              <p className="text-xs text-muted-foreground font-mono">{selected.cpf_cnpj}</p>
            )}
            {(selected.cidade || selected.uf) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />{[selected.cidade, selected.uf].filter(Boolean).join("/")}
              </p>
            )}
          </div>
        </div>
        <div className="ml-auto shrink-0">
          <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Prazo Médio</p>
          <p className="font-mono font-bold text-xs">{prazoMedio ? `${prazoMedio} dias` : "—"}</p>
        </div>
        <div className={`rounded-lg border bg-card p-3 text-center space-y-1 ${totalAberto > 0 ? 'border-destructive/40' : ''}`}>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Saldo Aberto</p>
          <p className={`font-mono font-bold text-xs ${totalAberto > 0 ? 'text-destructive' : ''}`}>{formatCurrency(totalAberto)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Vol. Compras</p>
          <p className="font-mono font-bold text-xs">{formatCurrency(volumeTotal)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Ult. Compra</p>
          <p className="font-mono font-bold text-xs">{ultCompra ? formatDate(ultCompra) : "—"}</p>
        </div>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="geral" className="text-[10px] px-1">Geral</TabsTrigger>
          <TabsTrigger value="compras" className="text-[10px] px-1">Compras</TabsTrigger>
          <TabsTrigger value="financeiro" className="text-[10px] px-1">Financ.</TabsTrigger>
          <TabsTrigger value="produtos" className="text-[10px] px-1">Produtos</TabsTrigger>
          <TabsTrigger value="relacionamento" className="text-[10px] px-1">Relac.</TabsTrigger>
        </TabsList>

        {/* TAB: GERAL */}
        <TabsContent value="geral" className="space-y-4 mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><Building2 className="h-3 w-3" /> Dados Fiscais</h4>
                <p><span className="text-muted-foreground">CNPJ/CPF:</span> {selected.cpf_cnpj || "—"}</p>
                {selected.inscricao_estadual && <p><span className="text-muted-foreground">Insc. Estadual:</span> {selected.inscricao_estadual}</p>}
                <p><span className="text-muted-foreground">Tipo:</span> {selected.tipo_pessoa === "J" ? "Pessoa Jurídica" : "Pessoa Física"}</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><Mail className="h-3 w-3" /> Contato</h4>
                <p><span className="text-muted-foreground">Email:</span> {selected.email || "—"}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {selected.telefone || "—"}</p>
                {selected.celular && <p><span className="text-muted-foreground">Celular:</span> {selected.celular}</p>}
                {selected.contato && <p><span className="text-muted-foreground">Responsável:</span> {selected.contato}</p>}
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><CreditCard className="h-3 w-3" /> Condições</h4>
                <p><span className="text-muted-foreground">Prazo Padrão:</span> {selected.prazo_padrao ? `${selected.prazo_padrao} dias` : "—"}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><MapPin className="h-3 w-3" /> Endereço</h4>
                <p className="leading-snug text-sm">
                  {[selected.logradouro, selected.numero].filter(Boolean).join(", ")}
                  {selected.complemento && <span>{[selected.logradouro, selected.numero].filter(Boolean).length > 0 ? ", " : ""}{selected.complemento}</span>}
                  {(selected.bairro || selected.cidade || selected.uf) && (
                    <><br />{[selected.bairro, [selected.cidade, selected.uf].filter(Boolean).join("/")].filter(Boolean).join(" — ")}</>
                  )}
                  {selected.cep && <><br />CEP: {selected.cep}</>}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB: COMPRAS */}
        <TabsContent value="compras" className="space-y-3 mt-3">
          {compras.length > 0 && (
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/20 p-3 border">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pedidos</p>
                <p className="font-bold text-sm">{compras.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
                <p className="font-bold text-sm font-mono">{formatCurrency(volumeTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ult. Compra</p>
                <p className="font-bold text-sm">{ultCompra ? formatDate(ultCompra) : "—"}</p>
              </div>
            </div>
          )}
          <h4 className="font-semibold text-sm flex items-center gap-2 px-1 text-muted-foreground uppercase text-[10px]"><ShoppingBag className="h-3.5 w-3.5" /> Últimos Pedidos de Compra</h4>
          {compras.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 border rounded-xl border-dashed">Nenhum pedido de compra encontrado</p>
          ) : (
            <div className="space-y-2">
              {compras.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded border bg-card hover:bg-muted/30 transition-colors text-sm">
                  <div>
                    <RelationalLink onClick={() => pushView("pedido_compra", c.id)} className="font-mono">PC {c.numero}</RelationalLink>
                    <p className="text-[10px] text-muted-foreground">{formatDate(c.data_pedido)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(c.valor_total)}</p>
                    <StatusBadge status={c.status} className="h-3.5 text-[9px]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB: FINANCEIRO */}
        <TabsContent value="financeiro" className="space-y-3 mt-3">
          <div className="rounded-lg border p-3 space-y-3 bg-muted/10">
            <h4 className="font-semibold flex items-center gap-2 text-muted-foreground uppercase text-[10px]"><CreditCard className="h-3 w-3" /> Situação Financeira</h4>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Saldo Aberto</p>
                <p className={`font-bold font-mono ${totalAberto > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatCurrency(totalAberto)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Vencidos</p>
                <p className={`font-bold font-mono ${vencidos.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatCurrency(totalVencido)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prazo Padrão</p>
                <p className="font-bold">{selected.prazo_padrao ? `${selected.prazo_padrao}d` : "—"}</p>
              </div>
            </div>
          </div>
          <h4 className="font-semibold flex items-center gap-2 px-1 text-muted-foreground uppercase text-[10px]"><FileText className="h-3.5 w-3.5" /> Lançamentos Recentes</h4>
          {financeiro.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 border rounded-xl border-dashed">Nenhum lançamento financeiro</p>
          ) : (
            <div className="space-y-2">
              {financeiro.map((f) => (
                <div key={f.id} className={`flex items-center justify-between p-2.5 rounded border bg-card text-xs ${f.status === 'vencido' ? 'border-destructive/30' : ''}`}>
                  <div>
                    <p className="font-medium truncate max-w-[180px]">{f.descricao}</p>
                    <p className="text-[10px] text-muted-foreground">Vencimento: {formatDate(f.data_vencimento)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${f.status === 'pago' ? 'text-success' : f.status === 'vencido' ? 'text-destructive' : ''}`}>
                      {formatCurrency(f.saldo_restante || f.valor)}
                    </p>
                    <StatusBadge status={f.status} className="h-3.5 text-[9px]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB: PRODUTOS */}
        <TabsContent value="produtos" className="space-y-3 mt-3">
          <h4 className="font-semibold text-sm flex items-center gap-2 px-1 text-muted-foreground uppercase text-[10px]"><Package className="h-3.5 w-3.5" /> Produtos Fornecidos</h4>
          {produtos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 border rounded-xl border-dashed">Nenhum produto vinculado</p>
          ) : (
            <div className="space-y-2">
              {produtos.map((p) => (
                <div key={p.id} className={`flex items-center justify-between p-2.5 rounded border bg-card text-xs ${p.eh_principal ? 'border-primary/30 bg-primary/5' : ''}`}>
                  <div>
                    <button onClick={() => pushView("produto", p.produtos?.id)} className="font-medium hover:underline text-left">
                      {p.produtos?.nome}
                    </button>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.produtos?.sku}</p>
                    {p.referencia_fornecedor && <p className="text-[9px] text-primary mt-0.5">Ref: {p.referencia_fornecedor}</p>}
                    {p.descricao_fornecedor && <p className="text-[9px] text-muted-foreground mt-0.5 italic">{p.descricao_fornecedor}{p.unidade_fornecedor ? ` · ${p.unidade_fornecedor}` : ""}</p>}
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="font-bold">{formatCurrency(p.preco_compra || 0)}</p>
                    {p.lead_time_dias !== null && p.lead_time_dias !== undefined && <p className="text-[9px] text-muted-foreground">{p.lead_time_dias} dias</p>}
                    {p.eh_principal && <span className="inline-block bg-primary/10 text-primary px-1 rounded-[2px] font-bold">Principal</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB: RELACIONAMENTO */}
        <TabsContent value="relacionamento" className="space-y-4 mt-3">
          {selected.observacoes ? (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><FileText className="h-3 w-3" /> Observações</h4>
              <p className="text-xs text-muted-foreground italic leading-relaxed bg-muted/20 rounded-lg p-3">{selected.observacoes}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4 border rounded-xl border-dashed">Sem observações registradas</p>
          )}
          {(selected.contato || selected.email || selected.telefone || selected.celular) && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><MessageSquare className="h-3 w-3" /> Contato Principal</h4>
              <div className="rounded-lg border bg-card p-3 space-y-1.5 text-xs">
                {selected.contato && <p><span className="text-muted-foreground">Responsável:</span> {selected.contato}</p>}
                {selected.email && <p><span className="text-muted-foreground">Email:</span> {selected.email}</p>}
                {selected.telefone && <p><span className="text-muted-foreground">Telefone:</span> {selected.telefone}</p>}
                {selected.celular && <p><span className="text-muted-foreground">Celular:</span> {selected.celular}</p>}
              </div>
            </div>
          )}
          {selected.prazo_padrao && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><Clock className="h-3 w-3" /> Condições Negociadas</h4>
              <div className="rounded-lg border bg-card p-3 space-y-1.5 text-xs">
                <p><span className="text-muted-foreground">Prazo Padrão:</span> {selected.prazo_padrao} dias</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          try {
            const { error } = await supabase.from("fornecedores").delete().eq("id", id);
            if (error) throw error;
            toast.success("Fornecedor excluído com sucesso.");
            clearStack();
          } catch (err) {
            console.error("[FornecedorView] erro ao excluir:", err);
            toast.error("Erro ao excluir fornecedor.");
          } finally {
            setDeleteConfirmOpen(false);
          }
        }}
        title="Excluir fornecedor"
        description={deleteDescription}
      />
    </div>
  );
}
