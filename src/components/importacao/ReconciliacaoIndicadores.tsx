import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { Users, Warehouse, FileText, DollarSign, ShoppingCart } from "lucide-react";
import { ImportacaoLote } from "./ImportacaoLotesTable";

interface ReconciliacaoIndicadoresProps {
  lotes: ImportacaoLote[];
}

export function ReconciliacaoIndicadores({ lotes }: ReconciliacaoIndicadoresProps) {
  const stats = lotes.reduce((acc, lote) => {
    const type = lote.tipo;
    if (!acc[type]) acc[type] = { count: 0, imported: 0, errors: 0, pending: 0 };
    acc[type].count++;
    acc[type].imported += lote.registros_sucesso || 0;
    acc[type].errors += lote.registros_erro || 0;
    if (lote.status === 'validado' || lote.status === 'parcial') acc[type].pending++;
    return acc;
  }, {} as Record<string, { count: number; imported: number; errors: number; pending: number }>);

  const cards = [
    { title: "Cadastros-base", type: ["produtos", "clientes", "fornecedores"], icon: Users, color: "text-info", bg: "bg-info/10" },
    { title: "Estoque", type: ["estoque_inicial"], icon: Warehouse, color: "text-warning", bg: "bg-warning/10" },
    { title: "Faturamento", type: ["faturamento"], icon: FileText, color: "text-secondary", bg: "bg-secondary/10" },
    { title: "Financeiro", type: ["financeiro_aberto"], icon: DollarSign, color: "text-success", bg: "bg-success/10" },
    { title: "Compras XML", type: ["compras_xml"], icon: ShoppingCart, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, i) => {
        const typeStats = card.type.reduce((acc, t) => {
          const s = stats[t] || { imported: 0, errors: 0, pending: 0 };
          return { imported: acc.imported + s.imported, errors: acc.errors + s.errors, pending: acc.pending + s.pending };
        }, { imported: 0, errors: 0, pending: 0 });

        return (
          <Card key={i} className="hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium">{card.title}</CardTitle>
              <div className={`p-1.5 rounded-md ${card.bg}`}>
                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-xl font-bold">{formatNumber(typeStats.imported)}</div>
              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                {typeStats.errors > 0 ? (
                  <p className="text-destructive font-medium">{formatNumber(typeStats.errors)} inconsistências</p>
                ) : (
                  <p>Sem inconsistências</p>
                )}
                {typeStats.pending > 0 && (
                  <p className="text-warning font-medium">{typeStats.pending} pendente(s) de conferência</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
