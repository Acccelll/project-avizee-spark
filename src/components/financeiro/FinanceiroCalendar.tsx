import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getEffectiveStatus } from "@/services/financeiro.service";

interface Lancamento {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  saldo_restante?: number | null;
  data_vencimento: string;
  status: string;
  clientes?: { nome_razao_social: string } | null;
  fornecedores?: { nome_razao_social: string } | null;
}

interface Props {
  data: Lancamento[];
}

export function FinanceiroCalendar({ data }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Lancamento[]>();
    data.forEach((l) => {
      if (!l.data_vencimento) return;
      const key = l.data_vencimento.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return map;
  }, [data]);

  const selectedDateStr = selectedDate
    ? selectedDate.toISOString().slice(0, 10)
    : null;
  const selectedItems = selectedDateStr
    ? eventsByDate.get(selectedDateStr) || []
    : [];

  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const modifiers = useMemo(() => {
    const receber: Date[] = [];
    const pagar: Date[] = [];
    const vencido: Date[] = [];

    eventsByDate.forEach((items, dateStr) => {
      const d = new Date(dateStr + "T12:00:00");
      const hasVencido = items.some(
        (i) => getEffectiveStatus(i.status, i.data_vencimento, hoje) === "vencido"
      );
      if (hasVencido) {
        vencido.push(d);
      } else {
        const hasReceber = items.some((i) => i.tipo === "receber");
        const hasPagar = items.some((i) => i.tipo === "pagar");
        if (hasReceber) receber.push(d);
        if (hasPagar) pagar.push(d);
      }
    });

    return { receber, pagar, vencido };
  }, [eventsByDate, hoje]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <Card>
        <CardContent className="p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className={cn("p-3 pointer-events-auto")}
            modifiers={modifiers}
            modifiersClassNames={{
              receber: "bg-success/20 text-success font-bold rounded-full",
              pagar: "bg-destructive/20 text-destructive font-bold rounded-full",
              vencido:
                "bg-warning/30 text-warning font-bold rounded-full ring-2 ring-warning/40",
            }}
          />
          <div className="flex gap-4 mt-3 px-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success" /> Receber
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive" />{" "}
              Pagar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning" /> Vencido
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedDate
              ? `Vencimentos em ${selectedDate.toLocaleDateString("pt-BR")}`
              : "Selecione um dia"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {selectedDate
                ? "Nenhum vencimento nesta data."
                : "Clique em um dia no calendário para ver os títulos."}
            </p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {l.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.tipo === "receber"
                        ? l.clientes?.nome_razao_social
                        : l.fornecedores?.nome_razao_social || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Badge
                      variant="outline"
                      className={
                        l.tipo === "receber"
                          ? "border-success/40 text-success bg-success/5"
                          : "border-destructive/40 text-destructive bg-destructive/5"
                      }
                    >
                      {l.tipo === "receber" ? "Receber" : "Pagar"}
                    </Badge>
                    <span className="text-sm font-mono font-semibold whitespace-nowrap">
                      {formatCurrency(Number(l.valor))}
                    </span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 text-right">
                <span className="text-sm font-semibold">
                  Total:{" "}
                  {formatCurrency(
                    selectedItems.reduce(
                      (s, l) => s + Number(l.saldo_restante ?? l.valor ?? 0),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
