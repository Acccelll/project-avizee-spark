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

  const now = new Date();
  const [competencia, setCompetencia] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [categoria, setCategoria] = useState<BudgetCategoria>('receita');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['budgets-mensais'],
    queryFn: () => listBudgetsMensais(),
  });

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

  const total = useMemo(() => rows.reduce((acc, r) => acc + Number(r.valor || 0), 0), [rows]);

  return (
    <ModulePage title="Budget Mensal" subtitle="Metas financeiras usadas no Workbook Gerencial (coluna Budget e Δ%)">
      {canEdit && (
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-4">
            <div className="space-y-1">
              <Label>Competência</Label>
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as BudgetCategoria)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label>Observações</Label>
              <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="flex items-end">
              <Button onClick={() => insertMutation.mutate()} disabled={insertMutation.isPending} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Observações</TableHead>
                {canEdit && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum budget cadastrado.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.competencia.slice(0, 7)}</TableCell>
                  <TableCell className="capitalize">{CATEGORIAS.find((c) => c.value === r.categoria)?.label ?? r.categoria}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBrl(Number(r.valor))}</TableCell>
                  <TableCell className="text-muted-foreground">{r.observacoes ?? '—'}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending} aria-label="Excluir lançamento de budget">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow className="font-semibold border-t-2">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBrl(total)}</TableCell>
                  <TableCell colSpan={canEdit ? 2 : 1}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ModulePage>
  );
}