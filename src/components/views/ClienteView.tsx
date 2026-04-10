import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { PrecosEspeciaisTab } from "@/components/precos/PrecosEspeciaisTab";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Edit, Trash2, User, Mail, Phone, MapPin, FileText, CreditCard, MessageSquare, Truck, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  id: string;
}

type ClienteWithGroup = Tables<"clientes"> & {
  grupos_economicos: { nome: string } | null;
};

export function ClienteView({ id }: Props) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ClienteWithGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [vendas, setVendas] = useState<any[]>([]);
  const [financeiro, setFinanceiro] = useState<any[]>([]);
  const [comunicacao, setComunicacao] = useState<any[]>([]);
  const [transportadoras, setTransportadoras] = useState<any[]>([]);
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
        const { data: c, error: cError } = await supabase.from("clientes").select("*, grupos_economicos!clientes_grupo_economico_id_fkey(nome)").eq("id", id).maybeSingle();
        if (cError) {
          console.error("[ClienteView] erro ao buscar cliente:", cError);
          setFetchError(`Erro ao carregar cliente: ${cError.message}`);
          setSelected(null);
          return;
        }
        if (!c) {
          setSelected(null);
          return;
        }
        setSelected(c);

        const [vRes, fRes, commRes, transRes] = await Promise.all([
          supabase
          .from("ordens_venda")
          .select("id, numero, data_emissao, valor_total, status")
          .eq("cliente_id", c.id)
          .order("data_emissao", { ascending: false })
          .limit(10),
          supabase
          .from("financeiro_lancamentos")
          .select("*")
          .eq("cliente_id", c.id)
          .order("data_vencimento", { ascending: false })
          .limit(10),
          supabase
          .from("cliente_registros_comunicacao")
          .select("*")
          .eq("cliente_id", c.id)
          .order("data_hora", { ascending: false }),
          supabase
          .from("cliente_transportadoras")
          .select("*, transportadoras(nome_razao_social)")
          .eq("cliente_id", c.id)
        ]);

        setVendas(vRes.data || []);
        setFinanceiro(fRes.data || []);
        setComunicacao(commRes.data || []);
        setTransportadoras(transRes.data || []);
      } catch (error) {
        console.error("[ClienteView] erro inesperado:", error);
        setFetchError(`Erro inesperado: ${error instanceof Error ? error.message : String(error)}`);
        setSelected(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando dados do cliente...</div>;
  if (fetchError) return <div className="p-8 text-center text-destructive space-y-1"><p className="font-semibold">Erro ao carregar dados</p><p className="text-xs text-muted-foreground">{fetchError}</p></div>;
  if (!selected) return <div className="p-8 text-center text-destructive">Cliente não encontrado</div>;

  const totalAberto = financeiro.filter(f => f.status === 'aberto' || f.status === 'vencido').reduce((acc, curr) => acc + (curr.saldo_restante || curr.valor), 0);
  const ultCompra = vendas.length > 0 ? vendas[0].data_emissao : null;
  const pmv = vendas.length > 0 ? vendas.reduce((acc, curr) => acc + (curr.valor_total || 0), 0) / Math.max(vendas.length, 1) : 0;

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-1 border-b pb-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { clearStack(); navigate('/clientes', { state: { editId: id } }); }}>
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
      <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-lg truncate">{selected.nome_razao_social}</h3>
          <p className="text-xs text-muted-foreground font-mono">{selected.cpf_cnpj}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Saldo Devedor</p>
          <p className="font-mono font-bold text-xs text-destructive">{formatCurrency(totalAberto)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">PMV (Médio)</p>
          <p className="font-mono font-bold text-xs">{formatCurrency(pmv)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Lmt. Crédito</p>
          <p className="font-mono font-bold text-xs text-emerald-600">{formatCurrency(selected.limite_credito || 0)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Ult. Compra</p>
          <p className="font-mono font-bold text-xs">{ultCompra ? formatDate(ultCompra) : "—"}</p>
        </div>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="w-full grid grid-cols-6">
          <TabsTrigger value="geral" className="text-[10px] px-1">Geral</TabsTrigger>
          <TabsTrigger value="vendas" className="text-[10px] px-1">Vendas</TabsTrigger>
          <TabsTrigger value="financeiro" className="text-[10px] px-1">Financ.</TabsTrigger>
          <TabsTrigger value="contatos" className="text-[10px] px-1">Contatos</TabsTrigger>
          <TabsTrigger value="logistica" className="text-[10px] px-1">Logist.</TabsTrigger>
          <TabsTrigger value="precos" className="text-[10px] px-1">Preços</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4 mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><Mail className="h-3 w-3" /> Contato</h4>
                <p><span className="text-muted-foreground">Email:</span> {selected.email || "—"}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {selected.telefone || "—"}</p>
                <p><span className="text-muted-foreground">Celular:</span> {selected.celular || "—"}</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><BarChart3 className="h-3 w-3" /> Corporativo</h4>
                <p><span className="text-muted-foreground">Grupo Econômico:</span> {selected.grupos_economicos?.nome || "—"}</p>
                <p><span className="text-muted-foreground">Relação:</span> <span className="capitalize">{selected.tipo_relacao_grupo || "independente"}</span></p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><MapPin className="h-3 w-3" /> Endereço</h4>
                <p className="leading-tight">
                  {selected.logradouro}, {selected.numero}<br />
                  {selected.bairro} — {selected.cidade}/{selected.uf}<br />
                  CEP: {selected.cep}
                  {selected.caixa_postal && <><br />Cx. Postal: {selected.caixa_postal}</>}
                </p>
              </div>
              {selected.observacoes && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 border-b pb-1 text-muted-foreground uppercase text-[10px]"><FileText className="h-3 w-3" /> Observações</h4>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">{selected.observacoes}</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vendas" className="space-y-3 mt-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Últimos Pedidos</h4>
          {vendas.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido encontrado</p>
          ) : (
            <div className="space-y-2">
              {vendas.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-2 rounded border bg-card hover:bg-muted/30 transition-colors text-sm">
                  <div>
                    <RelationalLink onClick={() => pushView("ordem_venda", v.id)} className="font-mono">{v.numero}</RelationalLink>
                    <p className="text-[10px] text-muted-foreground">{formatDate(v.data_emissao)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(v.valor_total)}</p>
                    <StatusBadge status={v.status} className="h-4 text-[10px]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-4 mt-3">
           <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
             <h4 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Condições Padrão</h4>
             <div className="grid grid-cols-3 gap-4 text-sm">
               <div>
                 <p className="text-[10px] text-muted-foreground uppercase font-semibold">Forma de Pagto</p>
                 <p className="font-medium">{selected.forma_pagamento_padrao || "Não definida"}</p>
               </div>
               <div>
                 <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prazo (dias)</p>
                 <p className="font-medium">{selected.prazo_padrao || "—"}</p>
               </div>
               <div>
                 <p className="text-[10px] text-muted-foreground uppercase font-semibold">Prazo Pref.</p>
                 <p className="font-medium">{selected.prazo_preferencial || "—"}</p>
               </div>
             </div>
           </div>

           <div className="space-y-3">
             <h4 className="font-semibold text-sm flex items-center gap-2 px-1 text-muted-foreground uppercase text-[10px]">Lançamentos Recentes</h4>
             {financeiro.length === 0 ? (
               <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">Nenhum lançamento financeiro</p>
             ) : (
               <div className="space-y-2">
                 {financeiro.map((f) => (
                   <div key={f.id} className="flex items-center justify-between p-2.5 rounded border bg-card text-xs">
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
           </div>
        </TabsContent>

        <TabsContent value="contatos" className="space-y-3 mt-3">
           <div className="flex items-center justify-between px-1">
             <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground uppercase text-[10px]"><MessageSquare className="h-3.5 w-3.5" /> Histórico de Contatos</h4>
           </div>
           {comunicacao.length === 0 ? (
             <p className="text-xs text-muted-foreground text-center py-8 border rounded-xl border-dashed">Nenhum registro de contato</p>
           ) : (
             <div className="space-y-4">
               {comunicacao.map((c) => (
                 <div key={c.id} className="relative pl-4 border-l-2 border-primary/20 space-y-1 py-1">
                   <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-primary" />
                   <div className="flex justify-between items-start">
                     <p className="text-xs font-bold">{c.assunto || "Sem assunto"}</p>
                     <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">{formatDate(c.data_hora)}</span>
                   </div>
                   <p className="text-xs text-muted-foreground leading-relaxed">{c.descricao}</p>
                   <p className="text-[9px] text-primary/70 uppercase font-semibold">{c.canal || "Geral"}</p>
                 </div>
               ))}
             </div>
           )}
        </TabsContent>

        <TabsContent value="logistica" className="space-y-3 mt-3">
           <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground uppercase text-[10px]"><Truck className="h-3.5 w-3.5" /> Transportadoras de Preferência</h4>
           {transportadoras.length === 0 ? (
             <p className="text-xs text-muted-foreground text-center py-8 border rounded-xl border-dashed">Nenhuma transportadora vinculada</p>
           ) : (
             <div className="space-y-3">
               {transportadoras.map((t) => (
                 <div key={t.id} className="p-3 rounded-lg border bg-card space-y-2">
                   <div className="flex justify-between items-start">
                     <p className="text-sm font-semibold">{t.transportadoras?.nome_razao_social}</p>
                     {t.prioridade && <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded-full font-bold">Prioridade {t.prioridade}</span>}
                   </div>
                   <div className="grid grid-cols-2 gap-2 text-[10px]">
                     <div>
                       <p className="text-muted-foreground uppercase font-bold">Modalidade</p>
                       <p>{t.modalidade || "—"}</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground uppercase font-bold">Prazo Médio</p>
                       <p>{t.prazo_medio || "—"}</p>
                     </div>
                   </div>
                   {t.observacoes && <p className="text-[10px] text-muted-foreground italic border-t pt-1">"{t.observacoes}"</p>}
                 </div>
               ))}
             </div>
           )}
        </TabsContent>

        <TabsContent value="precos" className="mt-3">
          <PrecosEspeciaisTab clienteId={selected.id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          try {
            const { error } = await supabase.from("clientes").delete().eq("id", id);
            if (error) throw error;
            toast.success("Cliente excluído com sucesso.");
            clearStack();
          } catch (err) {
            console.error("[ClienteView] erro ao excluir:", err);
            toast.error("Erro ao excluir cliente.");
          } finally {
            setDeleteConfirmOpen(false);
          }
        }}
        title="Excluir cliente"
        description={`Tem certeza que deseja excluir "${selected?.nome_razao_social || ""}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
