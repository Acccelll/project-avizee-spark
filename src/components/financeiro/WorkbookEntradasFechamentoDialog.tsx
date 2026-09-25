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
import {
  carregarEntradasManuais,
  carregarParametrosAno,
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

const numOuNull = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));

/**
 * Valores do Workbook de Fechamento que o ERP não calcula: seguidores das
 * redes no fim do mês e os parâmetros do ano (meta de faturamento e limite).
 */
export function WorkbookEntradasFechamentoDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [competencia, setCompetencia] = useState(mesAnterior());
  const ano = Number(competencia.slice(0, 4));
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [crescimento, setCrescimento] = useState('');
  const [limite, setLimite] = useState('');

  const entradas = useQuery({
    queryKey: ['workbook-entradas', competencia],
    queryFn: () => carregarEntradasManuais(competencia),
    enabled: open && /^\d{4}-\d{2}$/.test(competencia),
  });
  const parametros = useQuery({
    queryKey: ['workbook-parametros-ano', ano],
    queryFn: () => carregarParametrosAno(ano),
    enabled: open && Number.isFinite(ano),
  });

  useEffect(() => {
    setLinkedin(entradas.data?.seguidores_linkedin?.toString() ?? '');
    setInstagram(entradas.data?.seguidores_instagram?.toString() ?? '');
  }, [entradas.data]);
  useEffect(() => {
    setCrescimento(parametros.data ? String(Math.round(parametros.data.crescimento_meta * 10000) / 100) : '');
    setLimite(parametros.data ? String(parametros.data.limite_faturamento) : '');
  }, [parametros.data]);

  const salvar = useMutation({
    mutationFn: async () => {
      const li = numOuNull(linkedin);
      const ig = numOuNull(instagram);
      const cr = numOuNull(crescimento);
      const lim = numOuNull(limite);
      for (const v of [li, ig, cr, lim]) {
        if (v !== null && !Number.isFinite(v)) throw new Error('Informe apenas números.');
      }
      await salvarEntradaManual(competencia, 'seguidores_linkedin', li);
      await salvarEntradaManual(competencia, 'seguidores_instagram', ig);
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
      queryClient.invalidateQueries({ queryKey: ['workbook-parametros-ano'] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`),
  });

  const carregando = entradas.isFetching || parametros.isFetching;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvar.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Entradas do fechamento</DialogTitle>
          <DialogDescription>
            Valores do Workbook de Fechamento que não vêm do ERP. Os demais números (recebimentos, pagamentos,
            faturamento, estoque, aging, cartões e sócios) são calculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="entr-comp">Competência</Label>
            <Input id="entr-comp" type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="entr-li">Seguidores LinkedIn (fim do mês)</Label>
              <Input id="entr-li" inputMode="numeric" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} disabled={carregando} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entr-ig">Seguidores Instagram (fim do mês)</Label>
              <Input id="entr-ig" inputMode="numeric" value={instagram} onChange={(e) => setInstagram(e.target.value)} disabled={carregando} />
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">Parâmetros de {Number.isFinite(ano) ? ano : '—'}</p>
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
          </div>
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
