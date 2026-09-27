import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/format';
import {
  carregarEntradasManuais,
  carregarParametrosAno,
  carregarPreviaFechamento,
  salvarEntradaManual,
  salvarParametrosAno,
} from '@/services/workbook';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function mesAnterior(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Aceita "50000", "50000.5", "50.000,50" e "-1.234,00"; vazio = sem valor. */
function numOuNull(s: string): number | null {
  let t = s.trim().replace(/^R\$\s*/, '').replace(/\s/g, '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
}

const paraCampo = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));

/**
 * Valores do Workbook de Fechamento que o ERP não calcula: seguidores das
 * redes, caixa final do extrato e valor bloqueado no fim do mês, e os
 * parâmetros do ano. Mostra ao lado o que o sistema calcula (caixa e
 * retiradas dos sócios) para conferência.
 */
export function WorkbookEntradasFechamentoDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [competencia, setCompetencia] = useState(mesAnterior());
  const competenciaValida = /^\d{4}-\d{2}$/.test(competencia);
  const ano = Number(competencia.slice(0, 4));
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [caixaFinal, setCaixaFinal] = useState('');
  const [bloqueado, setBloqueado] = useState('');
  const [crescimento, setCrescimento] = useState('');
  const [limite, setLimite] = useState('');

  const entradas = useQuery({
    queryKey: ['workbook-entradas', competencia],
    queryFn: () => carregarEntradasManuais(competencia),
    enabled: open && competenciaValida,
  });
  const previa = useQuery({
    queryKey: ['workbook-previa-fechamento', competencia],
    queryFn: () => carregarPreviaFechamento(competencia),
    enabled: open && competenciaValida,
  });
  const parametros = useQuery({
    queryKey: ['workbook-parametros-ano', ano],
    queryFn: () => carregarParametrosAno(ano),
    enabled: open && Number.isFinite(ano),
  });

  useEffect(() => {
    setLinkedin(entradas.data?.seguidores_linkedin?.toString() ?? '');
    setInstagram(entradas.data?.seguidores_instagram?.toString() ?? '');
    setCaixaFinal(paraCampo(entradas.data?.caixa_final));
    setBloqueado(paraCampo(entradas.data?.bloqueado));
  }, [entradas.data]);
  useEffect(() => {
    setCrescimento(parametros.data ? String(Math.round(parametros.data.crescimento_meta * 10000) / 100) : '');
    setLimite(parametros.data ? String(parametros.data.limite_faturamento) : '');
  }, [parametros.data]);

  const caixaInformado = numOuNull(caixaFinal);
  const ajuste =
    caixaInformado !== null && Number.isFinite(caixaInformado) && previa.data
      ? Math.round((caixaInformado - previa.data.caixaCalculado) * 100) / 100
      : null;

  const salvar = useMutation({
    mutationFn: async () => {
      const li = numOuNull(linkedin);
      const ig = numOuNull(instagram);
      const cx = numOuNull(caixaFinal);
      const bl = numOuNull(bloqueado);
      const cr = numOuNull(crescimento);
      const lim = numOuNull(limite);
      for (const v of [li, ig, cx, bl, cr, lim]) {
        if (v !== null && !Number.isFinite(v)) throw new Error('Informe apenas números.');
      }
      await salvarEntradaManual(competencia, 'seguidores_linkedin', li);
      await salvarEntradaManual(competencia, 'seguidores_instagram', ig);
      await salvarEntradaManual(competencia, 'caixa_final', cx);
      await salvarEntradaManual(competencia, 'bloqueado', bl);
      if (cr !== null || lim !== null) {
        await salvarParametrosAno({
          ano,
          crescimento_meta: (cr ?? 0) / 100,
          limite_faturamento: lim ?? 360000,
        });
      }
    },
    onSuccess: () => {
      toast.success('Entradas do fechamento salvas.');
      queryClient.invalidateQueries({ queryKey: ['workbook-entradas'] });
      queryClient.invalidateQueries({ queryKey: ['workbook-previa-fechamento'] });
      queryClient.invalidateQueries({ queryKey: ['workbook-parametros-ano'] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`),
  });

  const carregando = entradas.isFetching || parametros.isFetching;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvar.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entradas do fechamento</DialogTitle>
          <DialogDescription>
            Valores do Workbook de Fechamento que não vêm do ERP. Recebimentos, pagamentos, faturamento, estoque,
            aging e retiradas dos sócios são calculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1 sm:max-w-xs">
            <Label htmlFor="entr-comp">Competência</Label>
            <Input id="entr-comp" type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>

          <section className="rounded-md border p-3 space-y-3">
            <h3 className="text-sm font-medium">Redes sociais (fim do mês)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="entr-li">Seguidores LinkedIn</Label>
                <Input id="entr-li" inputMode="numeric" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} disabled={carregando} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="entr-ig">Seguidores Instagram</Label>
                <Input id="entr-ig" inputMode="numeric" value={instagram} onChange={(e) => setInstagram(e.target.value)} disabled={carregando} />
              </div>
            </div>
          </section>

          <section className="rounded-md border p-3 space-y-3">
            <h3 className="text-sm font-medium">Caixa (fim do mês)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="entr-caixa">Caixa final — saldo do extrato (R$)</Label>
                <Input
                  id="entr-caixa"
                  inputMode="decimal"
                  placeholder="Opcional"
                  value={caixaFinal}
                  onChange={(e) => setCaixaFinal(e.target.value)}
                  disabled={carregando}
                />
                <p className="text-xs text-muted-foreground">
                  {previa.isFetching ? (
                    'Calculando o caixa do sistema...'
                  ) : previa.data ? (
                    <>
                      Calculado pelo sistema: {formatCurrency(previa.data.caixaCalculado)}
                      {ajuste !== null && ajuste !== 0 && <> · ajuste de {formatCurrency(ajuste)}</>}
                    </>
                  ) : previa.isError ? (
                    'Não foi possível calcular o caixa do sistema.'
                  ) : null}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="entr-bloq">Bloqueado (R$)</Label>
                <Input id="entr-bloq" inputMode="decimal" value={bloqueado} onChange={(e) => setBloqueado(e.target.value)} disabled={carregando} />
                <p className="text-xs text-muted-foreground">Sem valor informado, o mês fica com zero.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A diferença entre o caixa informado e o calculado entra como ajuste no mês; os meses seguintes partem do
              caixa informado. Receitas e despesas não mudam.
            </p>
          </section>

          <section className="rounded-md border p-3 space-y-2">
            <h3 className="text-sm font-medium">Sócios / FOPAG</h3>
            {previa.isFetching ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : previa.data && previa.data.socios.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="font-normal py-1">Sócio</th>
                    <th className="font-normal py-1 text-right">Retirada do mês</th>
                    <th className="font-normal py-1 text-right">Saldo no ano</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.data.socios.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-1">{s.nome}</td>
                      <td className="py-1 text-right tabular-nums">{formatCurrency(s.retirada)}</td>
                      <td className="py-1 text-right tabular-nums">{formatCurrency(s.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum sócio ativo.</p>
            )}
            <p className="text-xs text-muted-foreground">
              As retiradas vêm do cadastro de retiradas em Sócios (pró-labore aprovado ou pago na competência).
            </p>
          </section>

          <section className="rounded-md border p-3 space-y-3">
            <h3 className="text-sm font-medium">Parâmetros de {Number.isFinite(ano) ? ano : '—'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="entr-cresc">Meta de faturamento (% sobre o ano anterior)</Label>
                <Input id="entr-cresc" inputMode="decimal" value={crescimento} onChange={(e) => setCrescimento(e.target.value)} disabled={carregando} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="entr-lim">Limite de faturamento anual (R$)</Label>
                <Input id="entr-lim" inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} disabled={carregando} />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Fechar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || carregando}>
            {salvar.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
