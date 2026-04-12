import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { WorkbookGeracaoDialog } from '@/components/financeiro/WorkbookGeracaoDialog';
import { WorkbookHistoricoTable } from '@/components/financeiro/WorkbookHistoricoTable';
import { useCan } from '@/hooks/useCan';
import {
  listarTemplates,
  listarGeracoes,
  gerarWorkbook,
  downloadGeracao,
  downloadBlob,
} from '@/services/workbookService';
import type { WorkbookGeracao, WorkbookModoGeracao } from '@/types/workbook';

export default function WorkbookGerencial() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { can } = useCan();

  const canGerar = can('workbook:exportar');
  const canDownload = can('workbook:visualizar');

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['workbook-templates'],
    queryFn: listarTemplates,
  });

  const { data: geracoes = [], isLoading: loadingGeracoes, refetch } = useQuery({
    queryKey: ['workbook-geracoes'],
    queryFn: listarGeracoes,
  });

  const gerarMutation = useMutation({
    mutationFn: async (params: {
      templateId: string;
      competenciaInicial: string;
      competenciaFinal: string;
      modoGeracao: WorkbookModoGeracao;
    }) => {
      const { blob, geracaoId } = await gerarWorkbook(
        {
          templateId: params.templateId,
          competenciaInicial: params.competenciaInicial + '-01',
          competenciaFinal: params.competenciaFinal + '-01',
          modoGeracao: params.modoGeracao,
          abasSelecionadas: [],
        },
        undefined
      );
      const filename = `workbook_gerencial_${params.competenciaInicial}_${params.competenciaFinal}_${geracaoId.slice(0, 8)}.xlsx`;
      downloadBlob(blob, filename);
      return geracaoId;
    },
    onSuccess: () => {
      toast.success('Workbook gerado com sucesso! O download foi iniciado.');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['workbook-geracoes'] });
    },
    onError: (err) => {
      toast.error(`Erro ao gerar workbook: ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  const handleDownload = async (geracao: WorkbookGeracao) => {
    try {
      const blob = await downloadGeracao(geracao);
      const filename = `workbook_gerencial_${geracao.id.slice(0, 8)}.xlsx`;
      downloadBlob(blob, filename);
      toast.success('Download iniciado.');
    } catch (err) {
      toast.error(`Erro ao baixar: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <AppLayout>
      <ModulePage
        title="Workbook Gerencial"
        headerActions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCcw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            {canGerar && (
              <Button size="sm" onClick={() => setDialogOpen(true)} disabled={loadingTemplates || templates.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                Gerar Workbook
              </Button>
            )}
          </div>
        }
      >
        {templates.length === 0 && !loadingTemplates && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
            Nenhum template de workbook disponível. Contacte o administrador.
          </div>
        )}
        <WorkbookHistoricoTable
          geracoes={geracoes}
          isLoading={loadingGeracoes}
          onDownload={handleDownload}
          canDownload={canDownload}
        />
      </ModulePage>

      {canGerar && (
        <WorkbookGeracaoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          templates={templates}
          onGerar={async (p) => { await gerarMutation.mutateAsync(p); }}
          isGenerating={gerarMutation.isPending}
        />
      )}
    </AppLayout>
  );
}
