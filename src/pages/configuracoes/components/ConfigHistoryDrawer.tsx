import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, RotateCcw, Loader2 } from 'lucide-react';
import { ViewDrawerV2 } from '@/components/ViewDrawerV2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchAuditLogs } from '@/services/admin/audit.service';
import { formatDate } from '@/lib/format';

interface ConfigHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  chave: string;
  onRestore?: (valor: Record<string, unknown>) => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function ConfigHistoryDrawer({
  open,
  onClose,
  chave,
  onRestore,
}: ConfigHistoryDrawerProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['auditoria_logs', 'app_configuracoes', chave],
    queryFn: () =>
      fetchAuditLogs({
        tabela: 'app_configuracoes',
        pageSize: 50,
      }),
    enabled: open,
    select: (result) =>
      result.data.filter((log) => log.registro_id === chave),
  });

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      variant="view"
      title="Histórico de Alterações"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Configuração <strong className="font-mono text-foreground">{chave}</strong>
        </span>
      }
    >
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive py-4 text-center">
          Erro ao carregar histórico.
        </p>
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState
          icon={History}
          title="Sem histórico"
          description="Nenhuma alteração registrada para esta configuração."
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((log, index) => (
            <div key={log.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {formatDate(log.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.usuario_id
                      ? `Usuário: ${log.usuario_id.slice(0, 8)}...`
                      : 'Sistema'}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {log.acao}
                </Badge>
              </div>

              {log.dados_anteriores !== null && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Valor Anterior
                  </p>
                  <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                    {formatValue(log.dados_anteriores)}
                  </pre>
                </div>
              )}

              {log.dados_novos !== null && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Novo Valor
                  </p>
                  <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                    {formatValue(log.dados_novos)}
                  </pre>
                </div>
              )}

              {onRestore && log.dados_anteriores !== null && (
                <>
                  <Separator />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    aria-label={`Restaurar configuração do momento ${formatDate(log.created_at)}`}
                    onClick={() =>
                      onRestore(log.dados_anteriores as Record<string, unknown>)
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar este valor
                  </Button>
                </>
              )}

              {index < data.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      )}
    </ViewDrawerV2>
  );
}
