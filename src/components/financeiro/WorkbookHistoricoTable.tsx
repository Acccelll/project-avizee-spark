import { Download, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/DataTable';
import type { WorkbookGeracao } from '@/types/workbook';

const STATUS_ICON: Record<string, React.ReactNode> = {
  concluido: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  erro: <XCircle className="h-4 w-4 text-red-600" />,
  gerando: <Loader2 className="h-4 w-4 animate-spin text-blue-600" />,
  pendente: <Clock className="h-4 w-4 text-yellow-600" />,
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  concluido: 'default',
  erro: 'destructive',
  gerando: 'secondary',
  pendente: 'outline',
};

interface WorkbookHistoricoTableProps {
  geracoes: WorkbookGeracao[];
  isLoading: boolean;
  onDownload: (geracao: WorkbookGeracao) => void;
  canDownload: boolean;
}

export function WorkbookHistoricoTable({
  geracoes,
  isLoading,
  onDownload,
  canDownload,
}: WorkbookHistoricoTableProps) {
  const columns = [
    {
      key: 'gerado_em',
      label: 'Gerado em',
      render: (r: WorkbookGeracao) =>
        new Date(r.gerado_em).toLocaleString('pt-BR'),
    },
    {
      key: 'template',
      label: 'Template',
      render: (r: WorkbookGeracao) =>
        r.workbook_templates?.nome ?? '—',
    },
    {
      key: 'periodo',
      label: 'Período',
      render: (r: WorkbookGeracao) =>
        r.competencia_inicial && r.competencia_final
          ? `${r.competencia_inicial} → ${r.competencia_final}`
          : '—',
    },
    {
      key: 'modo_geracao',
      label: 'Modo',
      render: (r: WorkbookGeracao) => (
        <Badge variant="outline">{r.modo_geracao ?? '—'}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: WorkbookGeracao) => (
        <div className="flex items-center gap-1.5">
          {STATUS_ICON[r.status]}
          <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: WorkbookGeracao) =>
        r.status === 'concluido' && canDownload ? (
          <Button size="sm" variant="outline" onClick={() => onDownload(r)}>
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={geracoes}
      loading={isLoading}
      emptyTitle="Nenhuma geração encontrada."
    />
  );
}
