import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, AlertTriangle, Clock, ChevronRight, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Pendencia {
  id: string;
  tipo: 'receber' | 'pagar';
  descricao: string;
  pessoa: string;
  valor: number;
  data_vencimento: string;
  status: string;
  plano_contas: string;
}

/** Mostra vencidos reais sem limite retroativo, mais os próximos sete dias. */
function localIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function fetchPendencias(): Promise<Pendencia[]> {
  const today = new Date();
  const todayIso = localIso(today);
  const until = new Date(today);
  until.setDate(until.getDate() + 7);
  const cols = 'id, tipo, descricao, valor, saldo_restante, data_vencimento, status, clientes(nome_razao_social), fornecedores(nome_razao_social), contas_contabeis(codigo, descricao)';
  const base = () => supabase.from('financeiro_lancamentos').select(cols)
    .eq('ativo', true).in('status', ['aberto', 'parcial', 'vencido']).gt('saldo_restante', 0);

  const [overdue, upcoming] = await Promise.all([
    base().lt('data_vencimento', todayIso).order('data_vencimento', { ascending: false }).limit(10),
    base().gte('data_vencimento', todayIso).lte('data_vencimento', localIso(until))
      .order('data_vencimento', { ascending: true }).limit(10),
  ]);
  if (overdue.error || upcoming.error) {
    throw new Error(overdue.error?.message || upcoming.error?.message || 'Erro ao consultar pendências');
  }

  type PendingRow = {
    id: string; tipo: string; descricao: string | null; valor: number;
    saldo_restante: number | null; data_vencimento: string; status: string | null;
    clientes?: { nome_razao_social: string | null } | null;
    fornecedores?: { nome_razao_social: string | null } | null;
    contas_contabeis?: { codigo: string | null; descricao: string | null } | null;
  };
  return ([...(overdue.data || []), ...(upcoming.data || [])] as PendingRow[]).map((r) => {
    const isReceber = r.tipo === 'receber';
    const pessoa = (isReceber ? r.clientes?.nome_razao_social : r.fornecedores?.nome_razao_social)
      || (isReceber ? 'Cliente não informado' : 'Fornecedor não informado');
    const conta = r.contas_contabeis;
    return {
      id: r.id,
      tipo: r.tipo as 'receber' | 'pagar',
      descricao: r.descricao || (isReceber ? 'A receber' : 'A pagar'),
      pessoa,
      valor: Number(r.saldo_restante ?? r.valor ?? 0),
      data_vencimento: r.data_vencimento,
      status: r.status ?? 'aberto',
      plano_contas: conta?.descricao || conta?.codigo || 'Sem plano de contas',
    };
  });
}

const INITIAL_VISIBLE = 5;

export function PendenciasList() {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const { data: pendencias = [], isLoading, isError } = useQuery<Pendencia[], Error>({
    queryKey: ['dashboard', 'pendencias', 'operacional'] as const,
    queryFn: fetchPendencias,
    staleTime: 2 * 60 * 1000,
  });

  const todayDate = new Date();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Vencimentos / Pendências
        </h3>
        <span className="text-[11px] text-muted-foreground">Vencidos + próximos 7 dias</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-7 w-7" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p role="alert" className="text-xs text-destructive">Não foi possível consultar pendências. Atualize para tentar novamente.</p>
      ) : pendencias.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2.5">
          <div className="h-2 w-2 rounded-full bg-success shrink-0" />
          <p className="text-xs text-success font-medium">Sem vencidos nem vencimentos nos próximos 7 dias.</p>
        </div>
      ) : (
        <div className="space-y-1 flex-1">
          {(showAll ? pendencias : pendencias.slice(0, INITIAL_VISIBLE)).map((p) => {
            const vencido = p.data_vencimento < today;
            const isReceber = p.tipo === 'receber';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/financeiro/${p.id}`)}
                aria-label={`Abrir lançamento ${p.descricao} no financeiro`}
                className="w-full text-left flex items-stretch gap-2 rounded py-2 px-1 min-h-[56px] md:min-h-[44px] hover:bg-muted/20 active:bg-muted/40 transition-colors"
              >
                <div
                  className={cn(
                    'mt-1.5 h-2 w-2 rounded-full shrink-0',
                    vencido ? 'bg-destructive' : isReceber ? 'bg-success' : 'bg-warning',
                  )}
                />
                {/* md+: layout single-row (compatibilidade desktop) */}
                <div className="hidden md:flex flex-1 items-center gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{p.pessoa}</p>
                    <p
                      className={cn(
                        'text-[11px] flex items-center gap-0.5',
                        vencido ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {vencido ? 'Vencido em ' : ''}{formatDate(p.data_vencimento)}
                      <span className="mx-1">·</span>
                      <span className="truncate" title={p.plano_contas}>{p.plano_contas}</span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-bold mono shrink-0',
                      isReceber ? 'text-success' : 'text-warning',
                    )}
                  >
                    {formatCurrency(p.valor)}
                  </span>
                  <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
                {/* mobile: layout 2 andares */}
                <div className="flex md:hidden flex-1 min-w-0 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <p className="text-sm font-medium truncate">{p.pessoa}</p>
                    <span
                      className={cn(
                        'text-sm font-bold mono shrink-0',
                        isReceber ? 'text-success' : 'text-warning',
                      )}
                    >
                      {formatCurrency(p.valor)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'text-[11px] flex items-center gap-1 min-w-0',
                      vencido ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    <span className="shrink-0">
                      {vencido ? 'Vencido em ' : ''}{formatDate(p.data_vencimento)}
                    </span>
                    <span className="opacity-60">·</span>
                    <span className="truncate" title={p.plano_contas}>{p.plano_contas}</span>
                  </p>
                </div>
                <ChevronRight className="md:hidden h-4 w-4 text-muted-foreground shrink-0 self-center" />
              </button>
            );
          })}
          {pendencias.length > INITIAL_VISIBLE && (
            <button
              type="button"
              className="w-full mt-1 text-xs text-primary hover:underline py-1 text-center"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Mostrar menos' : `Mostrar itens carregados (${pendencias.length})`}
            </button>
          )}
          {pendencias.length >= 10 && (
            <button
              type="button"
              onClick={() => navigate('/financeiro')}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              Consultar lista completa no Financeiro
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
