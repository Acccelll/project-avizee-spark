import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { LayoutDashboard } from 'lucide-react';
import type { ApresentacaoGeracao } from '@/types/apresentacao';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  gerando: { label: 'Gerando…', variant: 'outline' },
  concluido: { label: 'Concluído', variant: 'default' },
  erro: { label: 'Erro', variant: 'destructive' },
};

interface ApresentacaoHistoricoTableProps {
  geracoes: ApresentacaoGeracao[];
  isLoading: boolean;
  onDownload: (geracao: ApresentacaoGeracao) => Promise<void>;
  downloadingId: string | null;
}

export function ApresentacaoHistoricoTable({
  geracoes,
  isLoading,
  onDownload,
  downloadingId,
}: ApresentacaoHistoricoTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (geracoes.length === 0) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="Nenhuma apresentação gerada"
        description="Clique em 'Nova Apresentação' para gerar seu primeiro relatório em PowerPoint."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Template</TableHead>
          <TableHead>Período</TableHead>
          <TableHead>Modo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Gerado em</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {geracoes.map((g) => {
          const statusInfo = STATUS_LABELS[g.status] ?? STATUS_LABELS.pendente;
          const isDownloading = downloadingId === g.id;
          const canDownload = g.status === 'concluido' && Boolean(g.arquivo_path);
          const templateNome = g.apresentacao_templates?.nome ?? 'Template desconhecido';
          const periodoLabel =
            g.competencia_inicial && g.competencia_final
              ? `${g.competencia_inicial.slice(0, 7)} → ${g.competencia_final.slice(0, 7)}`
              : '—';
          const geradoEm = g.gerado_em
            ? new Date(g.gerado_em).toLocaleString('pt-BR')
            : '—';

          return (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{templateNome}</TableCell>
              <TableCell>{periodoLabel}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {g.modo_geracao === 'fechado' ? 'Fechado' : 'Dinâmico'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{geradoEm}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canDownload || isDownloading}
                  onClick={() => onDownload(g)}
                  aria-label="Baixar apresentação"
                  title={canDownload ? 'Baixar .pptx' : 'Arquivo não disponível'}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
