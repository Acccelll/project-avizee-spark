import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Plus, RefreshCcw } from 'lucide-react';
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
  downloadBlob,
} from '@/services/workbookService';
import type { WorkbookGeracao, WorkbookModoGeracao } from '@/types/workbook';

export default function WorkbookGerencial() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { can } = useCan();

  const canGerar = can('relatorios:exportar');
  const canDownload = can('relatorios:exportar');

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
          aborarSelecionadas: [],
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
    if (!geracao.parametros_json) {
      toast.error('Parâmetros da geração não encontrados.');
      return;
    }
    try {
      const params = geracao.parametros_json as {
        templateId?: string;
        competenciaInicial?: string;
        competenciaFinal?: string;
        modoGeracao?: WorkbookModoGeracao;
      };
      const { blob } = await gerarWorkbook(
        {
          templateId: params.templateId ?? '',
          competenciaInicial: params.competenciaInicial ?? '',
          competenciaFinal: params.competenciaFinal ?? '',
          modoGeracao: params.modoGeracao ?? 'dinamico',
          aborarSelecionadas: [],
        },
        undefined
      );
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
        icon={<FileSpreadsheet className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCcw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            {canGerar && (
              <Button size="sm" onClick={() => setDialogOpen(true)} disabled={loadingTemplates}>
                <Plus className="h-4 w-4 mr-1" />
                Gerar Workbook
              </Button>
            )}
          </div>
        }
      >
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
          onGerar={gerarMutation.mutateAsync}
          isGenerating={gerarMutation.isPending}
        />
      )}
    </AppLayout>
  );
}
