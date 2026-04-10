import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, Archive, FileText, Edit, Trash2, ShoppingCart, Layers, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { PrecosEspeciaisTab } from "@/components/precos/PrecosEspeciaisTab";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";

interface Props {
  id: string;
}

export function ProdutoView({ id }: Props) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Tables<"produtos"> | null>(null);
  const [grupoNome, setGrupoNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [composicao, setComposicao] = useState<any[]>([]);
  const [movimentos, setMovimentos] = useState<any[]>([]);
  const [fornecedoresProd, setFornecedoresProd] = useState<any[]>([]);
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
        const { data: p, error: pError } = await supabase.from("produtos").select("*").eq("id", id).maybeSingle();
        if (pError) {
          console.error("[ProdutoView] erro ao buscar produto:", pError);
          setFetchError(`Erro ao carregar produto: ${pError.message}`);
          setLoading(false);
          return;
        }
        if (!p) {
          setLoading(false);
          return;
        }
        setSelected(p);

        const [nfRes, compRes, movRes, fornRes, grupoRes] = await Promise.all([
          supabase.from("notas_fiscais_itens").
            select("quantidade, valor_unitario, notas_fiscais(id, numero, tipo, data_emissao, fornecedores(id, nome_razao_social))").
            eq("produto_id", p.id).limit(20),
          p.eh_composto ? supabase.from("produto_composicoes").
            select("quantidade, ordem, produtos:produto_filho_id(id, nome, sku, preco_custo)").
            eq("produto_pai_id", p.id).order("ordem") : Promise.resolve({ data: [] }),
          supabase.from("estoque_movimentos").
            select("tipo, quantidade, motivo, created_at, saldo_anterior, saldo_atual").
            eq("produto_id", p.id).order("created_at", { ascending: false }).limit(20),
          supabase.from("produtos_fornecedores").
            select("preco_compra, lead_time_dias, referencia_fornecedor, eh_principal, unidade_fornecedor, fornecedores:fornecedor_id(id, nome_razao_social)").
            eq("produto_id", p.id),
          p.grupo_id
            ? supabase.from("grupos_produto").select("nome").eq("id", p.grupo_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        setHistorico(nfRes.data || []);
        setComposicao((compRes.data || []).map((c: any) => ({
          id: c.produtos?.id,
          nome: c.produtos?.nome, sku: c.produtos?.sku, preco_custo: c.produtos?.preco_custo,
          quantidade: c.quantidade, ordem: c.ordem,
        })));
        setMovimentos(movRes.data || []);
        setFornecedoresProd(fornRes.data || []);
        setGrupoNome((grupoRes.data as any)?.nome || null);
      } catch (error) {
        console.error("[ProdutoView] erro inesperado:", error);
        setFetchError(`Erro inesperado: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando dados do produto...</div>;
  if (fetchError) return <div className="p-8 text-center text-destructive space-y-1"><p className="font-semibold">Erro ao carregar dados</p><p className="text-xs text-muted-foreground">{fetchError}</p></div>;
  if (!selected) return <div className="p-8 text-center text-destructive">Produto não encontrado</div>;

  const selectedMargem = (selected.preco_custo || 0) > 0 ? (selected.preco_venda / (selected.preco_custo || 1) - 1) * 100 : 0;
  const lucroBruto = selected.preco_venda - (selected.preco_custo || 0);
  const custoCompostoView = composicao.reduce((s, c) => s + c.quantidade * (c.preco_custo || 0), 0);
  const estoqueValor = (selected.estoque_atual || 0) * (selected.preco_custo || 0);
  const estoqueBaixo = Number(selected.estoque_atual) <= Number(selected.estoque_minimo) && Number(selected.estoque_minimo) > 0;
  const fiscalCompleto = !!(selected.ncm && selected.cst && selected.cfop_padrao);
  const fornecedorPrincipal = fornecedoresProd.find((f: any) => f.eh_principal);
  const ultimaEntrada = movimentos.find((m: any) => m.tipo === 'entrada');
  const ultimaSaida = movimentos.find((m: any) => m.tipo === 'saida');

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-1 border-b pb-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { clearStack(); navigate('/produtos', { state: { editId: id } }); }}>
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

      {/* Product identity header */}
      <div className="flex items-start gap-4 bg-muted/30 p-4 rounded-lg">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Package className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-lg leading-tight truncate">{selected.nome}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {selected.sku && <p className="text-xs text-muted-foreground font-mono">SKU: {selected.sku}</p>}
            {selected.codigo_interno && <p className="text-xs text-muted-foreground font-mono">Cód: {selected.codigo_interno}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusBadge status={selected.ativo ? "ativo" : "inativo"} />
            <StatusBadge status={selected.eh_composto ? "composto" : "simples"} />
            {grupoNome && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground font-medium">
                <Layers className="h-2.5 w-2.5" />
                {grupoNome}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-card p-4 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Venda</p>
          <p className="font-mono font-bold text-sm text-foreground">{formatCurrency(selected.preco_venda)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Custo</p>
          <p className="font-mono font-bold text-sm text-foreground">{formatCurrency(selected.preco_custo || 0)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Lucro Bruto</p>
          <p className="font-mono font-bold text-sm text-primary">{formatCurrency(lucroBruto)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Margem</p>
          <p className={`font-mono font-bold text-sm ${selectedMargem > 0 ? "text-emerald-600 dark:text-emerald-400" : selectedMargem < 0 ? "text-destructive" : "text-foreground"}`}>{(selected.preco_custo || 0) > 0 ? `${selectedMargem.toFixed(1)}%` : "—"}</p>
        </div>
        <div className={`rounded-lg border p-4 text-center space-y-1 ${estoqueBaixo ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Estoque</p>
          <p className={`font-mono font-bold text-sm ${estoqueBaixo ? "text-destructive" : "text-foreground"}`}>{selected.estoque_atual ?? 0} {selected.unidade_medida}</p>
          {estoqueBaixo && <p className="text-[9px] text-destructive font-medium leading-none">Abaixo do mín.</p>}
        </div>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="w-full grid grid-cols-7">
          <TabsTrigger value="geral" className="text-[9px] px-0.5">Geral</TabsTrigger>
          <TabsTrigger value="compras" className="text-[9px] px-0.5">Compras</TabsTrigger>
          <TabsTrigger value="preco" className="text-[9px] px-0.5">Preço</TabsTrigger>
          <TabsTrigger value="estoque" className="text-[9px] px-0.5">Estoque</TabsTrigger>
          <TabsTrigger value="fiscal" className="text-[9px] px-0.5">Fiscal</TabsTrigger>
          <TabsTrigger value="precos" className="text-[9px] px-0.5">Espec.</TabsTrigger>
          <TabsTrigger value="historico" className="text-[9px] px-0.5">Histórico</TabsTrigger>
        </TabsList>

        {/* Tab: Geral */}
        <TabsContent value="geral" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SKU</span>
              <p className="font-mono text-sm">{selected.sku || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Código</span>
              <p className="font-mono text-sm">{selected.codigo_interno || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Unidade</span>
              <p className="text-sm">{selected.unidade_medida}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Peso</span>
              <p className="font-mono text-sm">{selected.peso ? `${selected.peso} kg` : "—"}</p>
            </div>
            {grupoNome && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Grupo</span>
                <p className="text-sm">{grupoNome}</p>
              </div>
            )}
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</span>
              <p className="text-sm">{selected.eh_composto ? "Composto" : "Simples"}</p>
            </div>
          </div>
          {selected.descricao && (
            <div className="pt-1 border-t">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Descrição</span>
              <p className="text-sm mt-0.5 text-foreground/80">{selected.descricao}</p>
            </div>
          )}
          {selected.eh_composto && composicao.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Package className="w-3.5 h-3.5" /> Composição
              </h4>
              <div className="space-y-1">
                {composicao.map((c, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1.5 border-b last:border-b-0">
                    <button onClick={() => pushView("produto", c.id)} className="text-left text-primary font-medium hover:underline flex items-center gap-1">
                      {c.nome} <span className="text-muted-foreground font-mono text-[10px]">({c.sku})</span>
                    </button>
                    <div className="text-right text-xs">
                      <span className="font-mono">× {c.quantidade}</span>
                      {c.preco_custo != null && <p className="text-muted-foreground">{formatCurrency(c.preco_custo * c.quantidade)}</p>}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2">
                  <span>Custo Composto</span>
                  <span className="font-mono text-primary">{formatCurrency(custoCompostoView)}</span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Compras / Fornecedores */}
        <TabsContent value="compras" className="space-y-3 mt-3">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5" /> Fornecedores Vinculados
          </h4>
          {fornecedoresProd.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded-lg">
              Nenhum fornecedor vinculado a este produto
            </p>
          ) : (
            <div className="space-y-2">
              {fornecedoresProd.map((f: any, idx: number) => (
                <div key={idx} className={`rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors ${f.eh_principal ? "border-primary/30" : ""}`}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <RelationalLink onClick={() => pushView("fornecedor", f.fornecedores?.id)} className="font-medium text-sm">
                      {f.fornecedores?.nome_razao_social || "—"}
                    </RelationalLink>
                    {f.eh_principal && (
                      <span className="inline-flex items-center text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">Principal</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {f.referencia_fornecedor && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Ref. Fornecedor</p>
                        <p className="font-mono text-xs">{f.referencia_fornecedor}</p>
                      </div>
                    )}
                    {f.unidade_fornecedor && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Unidade</p>
                        <p className="text-xs">{f.unidade_fornecedor}</p>
                      </div>
                    )}
                    {f.lead_time_dias != null && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Lead Time</p>
                        <p className="text-xs font-mono">{f.lead_time_dias}d</p>
                      </div>
                    )}
                    {f.preco_compra != null && (
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Preço Compra</p>
                        <p className="text-xs font-mono font-semibold">{formatCurrency(f.preco_compra)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {historico.filter((h: any) => h.notas_fiscais?.tipo === 'entrada' || h.notas_fiscais?.tipo === 'compra').length > 0 && (
            <div className="border-t pt-3">
              <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Últimas Compras
              </h4>
              <div className="space-y-1.5">
                {historico
                  .filter((h: any) => h.notas_fiscais?.tipo === 'entrada' || h.notas_fiscais?.tipo === 'compra')
                  .slice(0, 10)
                  .map((h: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs py-1.5 border-b last:border-b-0">
                      <div>
                        <RelationalLink onClick={() => pushView("nota_fiscal", h.notas_fiscais?.id)} mono className="text-xs">{h.notas_fiscais?.numero}</RelationalLink>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">{h.notas_fiscais?.fornecedores?.nome_razao_social || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono">{formatCurrency(h.valor_unitario)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(h.notas_fiscais?.data_emissao)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Preço */}
        <TabsContent value="preco" className="space-y-3 mt-3">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Custo</span>
                <p className="font-mono font-semibold text-lg">{formatCurrency(selected.preco_custo || 0)}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Margem</span>
                <p className={`font-mono font-semibold text-lg ${selectedMargem > 0 ? "text-emerald-600 dark:text-emerald-400" : selectedMargem < 0 ? "text-destructive" : ""}`}>
                  {(selected.preco_custo || 0) > 0 ? `${selectedMargem.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Venda</span>
                <p className="font-mono font-semibold text-lg text-primary">{formatCurrency(selected.preco_venda)}</p>
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">Lucro Bruto</span>
                <span className={`font-mono font-semibold text-sm ${lucroBruto > 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(lucroBruto)}</span>
              </div>
              {fornecedorPrincipal?.preco_compra != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs">Últ. Custo (Fornec. Principal)</span>
                  <span className="font-mono text-xs">{formatCurrency(fornecedorPrincipal.preco_compra)}</span>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Estoque */}
        <TabsContent value="estoque" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg border p-3 text-center ${estoqueBaixo ? "border-destructive/40 bg-destructive/5" : ""}`}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estoque Atual</p>
              <p className={`text-2xl font-bold font-mono ${estoqueBaixo ? "text-destructive" : ""}`}>{selected.estoque_atual ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{selected.unidade_medida}</p>
              {estoqueBaixo && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  <p className="text-[9px] text-destructive font-semibold">Abaixo do mínimo</p>
                </div>
              )}
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estoque Mínimo</p>
              <p className="text-2xl font-bold font-mono">{selected.estoque_minimo ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{selected.unidade_medida}</p>
            </div>
          </div>
          {estoqueValor > 0 && (
            <div className="rounded-lg border bg-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Valor em Estoque</span>
              </div>
              <span className="font-mono font-semibold text-sm">{formatCurrency(estoqueValor)}</span>
            </div>
          )}
          {(ultimaEntrada || ultimaSaida) && (
            <div className="grid grid-cols-2 gap-3">
              {ultimaEntrada && (
                <div className="rounded-lg border p-3 space-y-0.5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Última Entrada</p>
                  <p className="font-mono font-semibold text-sm text-emerald-600 dark:text-emerald-400">+{ultimaEntrada.quantidade}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(ultimaEntrada.created_at)}</p>
                  {ultimaEntrada.motivo && <p className="text-[9px] text-muted-foreground truncate">{ultimaEntrada.motivo}</p>}
                </div>
              )}
              {ultimaSaida && (
                <div className="rounded-lg border p-3 space-y-0.5">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Última Saída</p>
                  <p className="font-mono font-semibold text-sm text-destructive">-{ultimaSaida.quantidade}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(ultimaSaida.created_at)}</p>
                  {ultimaSaida.motivo && <p className="text-[9px] text-muted-foreground truncate">{ultimaSaida.motivo}</p>}
                </div>
              )}
            </div>
          )}
          {movimentos.length > 0 && (
            <div>
              <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Archive className="w-3.5 h-3.5" /> Últimas Movimentações
              </h4>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {movimentos.map((m: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-b-0 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${m.tipo === 'entrada' ? 'bg-success/10 text-success' : m.tipo === 'saida' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                        {m.tipo === 'entrada' ? '↑' : m.tipo === 'saida' ? '↓' : '↔'} {m.quantidade}
                      </span>
                      <span className="text-muted-foreground text-[10px]">{m.motivo || m.tipo}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground">{formatDate(m.created_at)}</span>
                      {m.saldo_atual != null && <p className="text-[9px] text-muted-foreground">Saldo: {m.saldo_atual}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Fiscal */}
        <TabsContent value="fiscal" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Dados Fiscais</h4>
            {fiscalCompleto ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-success/10 border border-success/20 px-2 py-0.5 rounded-full font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> Cadastro Completo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle className="h-2.5 w-2.5" /> Cadastro Incompleto
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">NCM</p>
              <p className="font-mono text-sm font-medium">{selected.ncm || <span className="text-muted-foreground text-xs italic">Não informado</span>}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">CST</p>
              <p className="font-mono text-sm font-medium">{selected.cst || <span className="text-muted-foreground text-xs italic">Não informado</span>}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">CFOP Padrão</p>
              <p className="font-mono text-sm font-medium">{selected.cfop_padrao || <span className="text-muted-foreground text-xs italic">Não informado</span>}</p>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Preços Especiais */}
        <TabsContent value="precos" className="space-y-3 mt-3">
          <PrecosEspeciaisTab produtoId={selected.id} />
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="historico" className="space-y-3 mt-3">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Histórico de Notas Fiscais
          </h4>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">Nenhum histórico de notas</p>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {historico.map((h: any, idx: number) => (
                <div key={idx} className="text-sm py-1.5 border-b last:border-b-0">
                  <div className="flex justify-between items-center">
                    <RelationalLink onClick={() => pushView("nota_fiscal", h.notas_fiscais?.id)} mono className="text-xs">{h.notas_fiscais?.numero}</RelationalLink>
                    <span className="text-[10px] text-muted-foreground">{formatDate(h.notas_fiscais?.data_emissao)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="truncate max-w-[150px] text-muted-foreground">{h.notas_fiscais?.fornecedores?.nome_razao_social || "—"}</span>
                    <span className="font-mono">Qtd: {h.quantidade} × {formatCurrency(h.valor_unitario)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          try {
            const { error } = await supabase.from("produtos").delete().eq("id", id);
            if (error) throw error;
            toast.success("Produto excluído com sucesso.");
            clearStack();
          } catch (err) {
            console.error("[ProdutoView] erro ao excluir:", err);
            toast.error("Erro ao excluir produto.");
          } finally {
            setDeleteConfirmOpen(false);
          }
        }}
        title="Excluir produto"
        description={[
          `Tem certeza que deseja excluir "${selected?.nome || ""}"${selected?.sku ? ` (SKU: ${selected.sku})` : ""}?`,
          "Esta ação não pode ser desfeita.",
          fornecedoresProd.length > 0 ? `Este produto possui ${fornecedoresProd.length} fornecedor(es) vinculado(s).` : "",
          composicao.length > 0 ? "Este produto possui itens de composição." : "",
          historico.length > 0 ? "Este produto possui histórico de notas fiscais." : "",
        ].filter(Boolean).join(" ")}
      />
    </div>
  );
}
