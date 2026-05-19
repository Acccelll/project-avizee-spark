import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { calcularFaturasParcelas } from "@/lib/cartaoFatura";

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
  /**
   * Quando informado, os vencimentos são derivados das faturas do cartão
   * (dia_fechamento / dia_vencimento) a partir de `dataEmissao`, e os campos
   * de 1º vencimento / intervalo / vencimento por linha ficam read-only.
   */
  cartao?: { dia_fechamento: number; dia_vencimento: number } | null;
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

export function gerarPlanoParcelasCartao(
  total: number,
  qtd: number,
  dataEmissao: string,
  diaFechamento: number,
  diaVencimento: number,
): ParcelaPlano[] {
  if (qtd <= 0 || !dataEmissao) return [];
  const previews = calcularFaturasParcelas(dataEmissao, diaFechamento, diaVencimento, qtd);
  const valorBase = Math.floor((total / qtd) * 100) / 100;
  const resto = +(total - valorBase * qtd).toFixed(2);
  return previews.map((p, i) => ({
    numero: i + 1,
    vencimento: p.dataVencimento.toISOString().split("T")[0],
    valor: i === qtd - 1 ? +(valorBase + resto).toFixed(2) : valorBase,
  }));
}

export function ParcelasFiscalEditor({
  total, qtdParcelas, dataEmissao, primeiroVencimento, intervaloDias,
  parcelas, onPrimeiroVencimentoChange, onIntervaloChange, onParcelasChange,
  cartao,
}: Props) {
  const isCartao = !!cartao;

  // Auto-regenera se mudar total/qtd/primeiro/intervalo e ainda não houver edição manual
  useEffect(() => {
    if (isCartao) return;
    if (!primeiroVencimento && dataEmissao) {
      onPrimeiroVencimentoChange(addDays(dataEmissao, 30));
    }
  }, [dataEmissao, primeiroVencimento, onPrimeiroVencimentoChange, isCartao]);

  useEffect(() => {
    if (isCartao && cartao && qtdParcelas > 0 && dataEmissao) {
      const novas = gerarPlanoParcelasCartao(total, qtdParcelas, dataEmissao, cartao.dia_fechamento, cartao.dia_vencimento);
      onParcelasChange(novas);
      const primeira = novas[0]?.vencimento;
      if (primeira && primeira !== primeiroVencimento) onPrimeiroVencimentoChange(primeira);
      return;
    }
    if (qtdParcelas > 0 && primeiroVencimento) {
      onParcelasChange(gerarPlanoParcelas(total, qtdParcelas, primeiroVencimento, intervaloDias));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, qtdParcelas, primeiroVencimento, intervaloDias, isCartao, dataEmissao, cartao?.dia_fechamento, cartao?.dia_vencimento]);

  const soma = parcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const diff = +(total - soma).toFixed(2);

  const updateParcela = (idx: number, patch: Partial<ParcelaPlano>) => {
    const next = parcelas.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onParcelasChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
      {isCartao && cartao && (
        <p className="text-[11px] text-muted-foreground">
          Vencimentos seguem a fatura do cartão · fecha dia {cartao.dia_fechamento} · vence dia {cartao.dia_vencimento}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">1º Vencimento</Label>
          <Input type="date" value={primeiroVencimento} onChange={(e) => onPrimeiroVencimentoChange(e.target.value)} className="h-9" disabled={isCartao} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Intervalo entre parcelas (dias)</Label>
          <Input type="number" min={1} max={365} value={intervaloDias} onChange={(e) => onIntervaloChange(Number(e.target.value))} className="h-9" disabled={isCartao} />
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
              <Input type="date" value={p.vencimento} onChange={(e) => updateParcela(idx, { vencimento: e.target.value })} className="h-8" disabled={isCartao} title={isCartao ? "Vencimento determinado pela fatura do cartão" : undefined} />
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