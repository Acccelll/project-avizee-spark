import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Pendencia {
  id: string;
  tipo: 'receber' | 'pagar';
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
}

const QUERY_KEY = ['dashboard', 'pendencias'] as const;

async function fetchPendencias(): Promise<Pendencia[]> {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAhead = new Date();
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);
  const ahead = sevenDaysAhead.toISOString().slice(0, 10);
  // Include overdue items from up to 60 days ago so very stale items don't
  // pollute the list, while still showing all items due in the next 7 days.
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const pastBound = sixtyDaysAgo.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('id, tipo, descricao, valor, data_vencimento, status')
    .eq('ativo', true)
    .in('status', ['aberto', 'vencido'])
    .gte('data_vencimento', pastBound)
    .lte('data_vencimento', ahead)
    .order('data_vencimento', { ascending: true })
    .limit(20);

  if (error) throw error;

  return (data || []).map((r: { id: string; tipo: string; descricao: string | null; valor: number; data_vencimento: string; status: string | null }) => ({
    id: r.id,
    tipo: r.tipo as 'receber' | 'pagar',
    descricao: r.descricao || (r.tipo === 'receber' ? 'A receber' : 'A pagar'),
    valor: Number(r.valor || 0),
    data_vencimento: r.data_vencimento,
    status: r.status ?? 'aberto',
  }));
}

const INITIAL_VISIBLE = 5;

export function PendenciasList() {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const { data: pendencias = [], isLoading } = useQuery<Pendencia[], Error>({
    queryKey: QUERY_KEY,
    queryFn: fetchPendencias,
    staleTime: 2 * 60 * 1000,
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col h-full">
      <h3 className="mb-3 font-semibold text-foreground text-sm flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Vencimentos / Pendências
      </h3>

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
      ) : pendencias.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2.5">
          <div className="h-2 w-2 rounded-full bg-success shrink-0" />
          <p className="text-xs text-success font-medium">Sem pendências nos próximos 7 dias.</p>
        </div>
      ) : (
        <div className="space-y-1 flex-1">
          {(showAll ? pendencias : pendencias.slice(0, INITIAL_VISIBLE)).map((p) => {
            const vencido = p.data_vencimento < today;
            const isReceber = p.tipo === 'receber';
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded py-1.5 px-1 hover:bg-muted/20"
              >
                <div
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    vencido ? 'bg-destructive' : isReceber ? 'bg-success' : 'bg-warning',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{p.descricao}</p>
                  <p
                    className={cn(
                      'text-[11px] flex items-center gap-0.5',
                      vencido ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {vencido ? 'Vencido em ' : ''}{formatDate(p.data_vencimento)}
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  title="Abrir no módulo financeiro"
                  aria-label={`Abrir lançamento ${p.descricao} no financeiro`}
                  onClick={() => navigate(`/financeiro/${p.id}`)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          {pendencias.length > INITIAL_VISIBLE && (
            <button
              type="button"
              className="w-full mt-1 text-xs text-primary hover:underline py-1 text-center"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Mostrar menos' : `Mostrar todas (${pendencias.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
