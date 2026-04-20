import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { usePublishDrawerSlots } from "@/contexts/RelationalDrawerSlotsContext";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Truck, FileText, Edit } from "lucide-react";
import { useDetailFetch } from "@/hooks/useDetailFetch";
import { DetailLoading, DetailError, DetailEmpty } from "@/components/ui/DetailStates";
import type { NotaFiscal } from "@/types/domain";
import { FiscalInternalStatusBadge, FiscalSefazStatusBadge } from "@/components/fiscal/FiscalStatusBadges";

interface NfViewItem {
  id: string;
  produto_id: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  produtos?: { id: string; nome: string; sku: string | null } | null;
}

interface NfDetail {
  nf: NotaFiscal;
  items: NfViewItem[];
}

interface Props {
  id: string;
}

export function NotaFiscalView({ id }: Props) {
  const { pushView, clearStack } = useRelationalNavigation();
  const navigate = useNavigate();

  // Fetch padronizado via useDetailFetch — corrige loading eterno (A2) e race (A1).
  const { data, loading, error } = useDetailFetch<NfDetail>(id, async (nfId, signal) => {
    const { data: nf, error: nfErr } = await supabase
      .from("notas_fiscais")
      .select("*, fornecedores(id, nome_razao_social), clientes(id, nome_razao_social), ordens_venda(id, numero)")
      .eq("id", nfId)
      .abortSignal(signal)
      .maybeSingle();
    if (nfErr) throw nfErr;
    if (!nf) return null;

    const { data: it, error: itErr } = await supabase
      .from("notas_fiscais_itens")
      .select("*, produtos(id, nome, sku)")
      .eq("nota_fiscal_id", nfId)
      .abortSignal(signal);
    if (itErr) throw itErr;

    return { nf: nf as NotaFiscal, items: (it as NfViewItem[]) || [] };
  });

  const selected = data?.nf ?? null;
  const items = data?.items ?? [];

  // Slots no header padronizado — `actions` agora inclui Editar (D3).
  usePublishDrawerSlots(`nota_fiscal:${id}`, selected ? {
    breadcrumb: `Nota Fiscal · NF ${selected.numero}`,
    summary: (
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm leading-tight truncate font-mono">NF {selected.numero}</h3>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(selected.data_emissao)}
            {selected.tipo === 'entrada'
              ? selected.fornecedores?.nome_razao_social && ` · ${selected.fornecedores.nome_razao_social}`
              : selected.clientes?.nome_razao_social && ` · ${selected.clientes.nome_razao_social}`}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <FiscalInternalStatusBadge status={selected.status} />
            <FiscalSefazStatusBadge status={selected.status_sefaz || "nao_enviada"} />
            <span className="inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
              {selected.tipo}
            </span>
            <span className="inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {formatCurrency(Number(selected.valor_total || 0))}
            </span>
          </div>
        </div>
      </div>
    ),
    actions: (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        aria-label="Abrir nota fiscal completa"
        onClick={() => { clearStack(); navigate(`/fiscal/${id}`); }}
      >
        <Edit className="h-3.5 w-3.5" /> Abrir Detalhes
      </Button>
    ),
  } : {});

  if (loading) return <DetailLoading />;
  if (error) return <DetailError message={error.message} />;
  if (!selected) return <DetailEmpty title="Nota fiscal não encontrada" icon={FileText} />;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="itens" className="w-full">
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Este painel lateral é uma visão rápida. Para operação completa (confirmação, estorno, devolução e trilha fiscal), use <strong>“Abrir Detalhes”</strong>.
        </div>
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
                {items.map((i, idx) => (
                  <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-2 py-2">
                      <button onClick={() => pushView("produto", i.produtos?.id)} className="text-left hover:underline block truncate max-w-[120px]">
                        {i.produtos?.nome || "—"}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs">{i.quantidade}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs font-medium">{formatCurrency(i.valor_total || (i.quantidade ?? 0) * (i.valor_unitario ?? 0))}</td>
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
              <RelationalLink onClick={() => pushView("ordem_venda", (selected.ordens_venda as { id?: string } | undefined)?.id)} className="font-mono">
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
