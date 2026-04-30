import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";

export interface ParcelaPlano {
  numero: number;
  vencimento: string; // YYYY-MM-DD
  valor: number;
}

interface Props {
  total: number;
  qtdParcelas: number;
  dataEmissao: string; // YYYY-MM-DD
  primeiroVencimento: string;
  intervaloDias: number;
  parcelas: ParcelaPlano[];
  onPrimeiroVencimentoChange: (v: string) => void;
  onIntervaloChange: (v: number) => void;
  onParcelasChange: (p: ParcelaPlano[]) => void;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function gerarPlanoParcelas(
  total: number,
  qtd: number,
  primeiroVenc: string,
  intervalo: number,
): ParcelaPlano[] {
  if (qtd <= 0 || !primeiroVenc) return [];
  const valorBase = Math.floor((total / qtd) * 100) / 100;
  const resto = +(total - valorBase * qtd).toFixed(2);
  return Array.from({ length: qtd }, (_, i) => ({
    numero: i + 1,
    vencimento: i === 0 ? primeiroVenc : addDays(primeiroVenc, intervalo * i),
    valor: i === qtd - 1 ? +(valorBase + resto).toFixed(2) : valorBase,
  }));
}

export function ParcelasFiscalEditor({
  total, qtdParcelas, dataEmissao, primeiroVencimento, intervaloDias,
  parcelas, onPrimeiroVencimentoChange, onIntervaloChange, onParcelasChange,
}: Props) {
  // Auto-regenera se mudar total/qtd/primeiro/intervalo e ainda não houver edição manual
  useEffect(() => {
    if (!primeiroVencimento && dataEmissao) {
      onPrimeiroVencimentoChange(addDays(dataEmissao, 30));
    }
  }, [dataEmissao, primeiroVencimento, onPrimeiroVencimentoChange]);

  useEffect(() => {
    if (qtdParcelas > 0 && primeiroVencimento) {
      onParcelasChange(gerarPlanoParcelas(total, qtdParcelas, primeiroVencimento, intervaloDias));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, qtdParcelas, primeiroVencimento, intervaloDias]);

  const soma = parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const diff = +(total - soma).toFixed(2);

  const updateParcela = (idx: number, patch: Partial<ParcelaPlano>) => {
    const next = parcelas.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onParcelasChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">1º Vencimento</Label>
          <Input type="date" value={primeiroVencimento} onChange={(e) => onPrimeiroVencimentoChange(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Intervalo entre parcelas (dias)</Label>
          <Input type="number" min={1} max={365} value={intervaloDias} onChange={(e) => onIntervaloChange(Number(e.target.value))} className="h-9" />
        </div>
      </div>

      {qtdParcelas > 1 && parcelas.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[40px_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
            <span>Nº</span><span>Vencimento</span><span>Valor</span>
          </div>
          {parcelas.map((p, idx) => (
            <div key={idx} className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center">
              <span className="text-sm font-mono">{p.numero}</span>
              <Input type="date" value={p.vencimento} onChange={(e) => updateParcela(idx, { vencimento: e.target.value })} className="h-8" />
              <Input type="number" step="0.01" value={p.valor} onChange={(e) => updateParcela(idx, { valor: Number(e.target.value) })} className="h-8" />
            </div>
          ))}
          <div className={`flex justify-between text-xs pt-1 border-t ${Math.abs(diff) > 0.01 ? "text-destructive" : "text-muted-foreground"}`}>
            <span>Soma das parcelas:</span>
            <span className="font-mono font-semibold">{formatCurrency(soma)} {Math.abs(diff) > 0.01 && `(diferença: ${formatCurrency(diff)})`}</span>
          </div>
        </div>
      )}
    </div>
  );
}