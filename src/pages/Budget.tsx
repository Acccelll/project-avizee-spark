import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useCan } from '@/hooks/useCan';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/services/relatorios/lib/fetchAllPages';
import {
  listBudgetsMensais,
  createBudgetMensal,
  deleteBudgetMensal,
  type BudgetCategoria,
  type BudgetMensal,
} from '@/services/budget.service';

type BudgetRow = BudgetMensal;

const CATEGORIAS: { value: BudgetCategoria; label: string }[] = [
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'fopag', label: 'Folha (FOPAG)' },
  { value: 'imposto', label: 'Impostos' },
  { value: 'investimento', label: 'Investimentos' },
];

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Budget() {
  const qc = useQueryClient();
  const { can } = useCan();
  const canEdit = can('financeiro:editar');
  const isMobile = useIsMobile();

  const now = new Date();
  const [competencia, setCompetencia] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [categoria, setCategoria] = useState<BudgetCategoria>('receita');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['budgets-mensais'],
    queryFn: () => listBudgetsMensais(),
  });

  const [anoFiltro, setAnoFiltro] = useState(String(new Date().getFullYear()));

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(rows.map((r) => r.competencia.split('-')[0]));
    const current = String(new Date().getFullYear());
    anos.add(current);
    return Array.from(anos).sort().reverse();
  }, [rows]);

  const { data: realizados = [] } = useQuery({
    queryKey: ['budget-realizados', anoFiltro],
    queryFn: async () => {
      // Frente 4 — fetch-all com paginação: financeiro_lancamentos em um ano
      // ultrapassa facilmente o page-size 1000 do Supabase. Truncamento
      // silencioso causaria realizados incorretos no gráfico vs orçado.
      const data = await fetchAllPages<{ tipo: string; valor: number; data_vencimento: string }>(() =>
        supabase
          .from('financeiro_lancamentos')
          .select('tipo, valor, data_vencimento')
          .eq('ativo', true)
          .gte('data_vencimento', `${anoFiltro}-01-01`)
          .lte('data_vencimento', `${anoFiltro}-12-31`),
      );
      return data;
    },
    staleTime: 30_000,
  });

  const tipoMap: Record<BudgetCategoria, 'receber' | 'pagar'> = {
    receita: 'receber',
    despesa: 'pagar',
    fopag: 'pagar',
    imposto: 'pagar',
    investimento: 'pagar',
  };

  const getRealizado = (competenciaIso: string, cat: BudgetCategoria): number => {
    const ym = competenciaIso.slice(0, 7);
    const [year, month] = ym.split('-').map(Number);
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const tipo = tipoMap[cat];
    return realizados
      .filter((r) => r.data_vencimento >= from && r.data_vencimento <= to && r.tipo === tipo)
      .reduce((s, r) => s + Math.abs(Number(r.valor)), 0);
  };

  const filteredRows = useMemo(
    () => rows.filter((r) => r.competencia.startsWith(anoFiltro))
      .sort((a, b) => a.competencia.localeCompare(b.competencia)),
    [rows, anoFiltro],
  );

  const insertMutation = useMutation({
    mutationFn: async () => {
      const valorNum = Number(valor.replace(',', '.'));
      if (!Number.isFinite(valorNum) || valorNum <= 0) throw new Error('Informe um valor válido.');
      await createBudgetMensal({
        competencia: competencia + '-01',
        categoria,
        valor: valorNum,
        observacoes: observacoes || null,
      });
    },
    onSuccess: () => {
      toast.success('Budget adicionado.');
      setValor('');
      setObservacoes('');
      qc.invalidateQueries({ queryKey: ['budgets-mensais'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao salvar.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudgetMensal(id),
    onSuccess: () => {
      toast.success('Removido.');
      qc.invalidateQueries({ queryKey: ['budgets-mensais'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao remover.'),
  });

  const total = useMemo(() => filteredRows.reduce((acc, r) => acc + Number(r.valor || 0), 0), [filteredRows]);

  return (
    <ModulePage title="Budget Mensal" subtitle="Metas financeiras usadas no Workbook Gerencial (coluna Budget e Δ%)">
      {canEdit && (
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-4">
            <div className="space-y-1">
              <Label>Competência</Label>
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as BudgetCategoria)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label>Observações</Label>
              <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" className="h-11" />
            </div>
            <div className="flex items-end">
              <Button onClick={() => insertMutation.mutate()} disabled={insertMutation.isPending} className="w-full h-11">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ano</Label>
              <Select value={anoFiltro} onValueChange={setAnoFiltro}>
                <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((ano) => (
                    <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredRows.length} entr{filteredRows.length === 1 ? 'ada' : 'adas'} em {anoFiltro}
            </span>
          </div>
          {isMobile ? (
            <div className="space-y-2">
              {isLoading && (
                <p className="text-sm text-center text-muted-foreground py-4">Carregando...</p>
              )}
              {!isLoading && filteredRows.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-4">
                  Nenhum budget cadastrado em {anoFiltro}.
                </p>
              )}
              {filteredRows.map((r) => {
                const orcado = Number(r.valor || 0);
                const realizado = getRealizado(r.competencia, r.categoria);
                const pct = orcado > 0 ? Math.min((realizado / orcado) * 100, 100) : 0;
                const isOver = realizado > orcado;
                return (
                  <div key={r.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight">{r.competencia.slice(0, 7)}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {CATEGORIAS.find((c) => c.value === r.categoria)?.label ?? r.categoria}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Orçado</p>
                        <p className="font-semibold tabular-nums">{formatBrl(orcado)}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Realizado</span>
                        <span className={`tabular-nums font-medium ${isOver ? 'text-destructive' : ''}`}>
                          {formatBrl(realizado)} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full transition-all ${isOver ? 'bg-destructive' : pct >= 90 ? 'bg-warning' : 'bg-success'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {r.observacoes && (
                      <p className="text-xs text-muted-foreground">{r.observacoes}</p>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-11 text-destructive hover:text-destructive justify-center"
                        onClick={() => deleteMutation.mutate(r.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    )}
                  </div>
                );
              })}
              {filteredRows.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border-2 bg-muted/30 px-3 py-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatBrl(total)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="w-[200px]">Execução</TableHead>
                <TableHead>Observações</TableHead>
                {canEdit && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground">Nenhum budget cadastrado em {anoFiltro}.</TableCell></TableRow>
              )}
              {filteredRows.map((r) => {
                const orcado = Number(r.valor || 0);
                const realizado = getRealizado(r.competencia, r.categoria);
                const pct = orcado > 0 ? Math.min((realizado / orcado) * 100, 100) : 0;
                const isOver = realizado > orcado;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.competencia.slice(0, 7)}</TableCell>
                    <TableCell className="capitalize">{CATEGORIAS.find((c) => c.value === r.categoria)?.label ?? r.categoria}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBrl(orcado)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${isOver ? 'text-destructive font-semibold' : ''}`}>
                      {formatBrl(realizado)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="h-2 w-full bg-muted rounded overflow-hidden">
                          <div
                            className={`h-full transition-all ${isOver ? 'bg-destructive' : pct >= 90 ? 'bg-warning' : 'bg-success'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% executado</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.observacoes ?? '—'}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending} aria-label="Excluir lançamento de budget">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filteredRows.length > 0 && (
                <TableRow className="font-semibold border-t-2">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBrl(total)}</TableCell>
                  <TableCell colSpan={canEdit ? 4 : 3}></TableCell>
                </TableRow>
              )}
            </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </ModulePage>
  );
}