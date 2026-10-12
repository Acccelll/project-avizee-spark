import { lazy, Suspense, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
// D-02: dialog carregado sob demanda (ExcelJS é puxado só quando o usuário gera).
const WorkbookGeracaoDialog = lazy(() =>
  import('@/components/financeiro/WorkbookGeracaoDialog').then((m) => ({
    default: m.WorkbookGeracaoDialog,
  })),
);
import { WorkbookHistoricoTable } from '@/components/financeiro/WorkbookHistoricoTable';
import { useCan } from '@/hooks/useCan';
import {
  listarTemplates,
  listarGeracoes,
  gerarWorkbook,
  downloadGeracao,
  downloadBlob,
  WORKBOOK_FECHAMENTO_CODIGO,
} from '@/services/workbook';
import type { WorkbookGeracao, WorkbookModoGeracao } from '@/types/workbook';

/**
 * Workbook gerencial, modelo antigo (DRE, vendas por vendedor, funil...).
 * O Workbook de Fechamento é gerado na página Fechamento do mês.
 */
export default function WorkbookGerencial() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { can } = useCan();

  const canGerar = can('workbook:exportar');
  const canDownload = can('workbook:visualizar');

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['workbook-templates', 'modelo-antigo'],
    queryFn: async () => (await listarTemplates()).filter((t) => t.codigo !== WORKBOOK_FECHAMENTO_CODIGO),
  });

  const { data: geracoes = [], isLoading: loadingGeracoes, refetch } = useQuery({
    queryKey: ['workbook-geracoes'],
    queryFn: listarGeracoes,
  });

  const gerarMutation = useMutation({
    mutationFn: async (params: {
      templateId: string;
      templateCodigo?: string;
      competenciaInicial: string;
      competenciaFinal: string;
      modoGeracao: WorkbookModoGeracao;
      abasSelecionadas: string[];
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { blob, geracaoId } = await gerarWorkbook(
        {
          templateId: params.templateId,
          templateCodigo: params.templateCodigo,
          competenciaInicial: params.competenciaInicial + '-01',
          competenciaFinal: params.competenciaFinal + '-01',
          modoGeracao: params.modoGeracao,
          abasSelecionadas: params.abasSelecionadas,
        },
        undefined,
        { signal: controller.signal },
      );
      const filename = `workbook_gerencial_${params.competenciaInicial}_${params.competenciaFinal}_${geracaoId.slice(0, 8)}.xlsx`;
      downloadBlob(blob, filename);
      return geracaoId;
    },
    onSuccess: () => {
      toast.success('Workbook gerado com sucesso! O download foi iniciado.');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['workbook-geracoes'] });
      abortRef.current = null;
    },
    onError: (err) => {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) {
        toast.info('Geração cancelada.');
      } else {
        toast.error(`Erro ao gerar workbook: ${err instanceof Error ? err.message : String(err)}`);
      }
      abortRef.current = null;
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
    <><ModulePage
        title="Workbook gerencial (modelo antigo)"
        subtitle="O Workbook de Fechamento fica em Fechamento do mês."
        headerActions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm" className="h-11 sm:h-9">
              <Link to="/relatorios/fechamento">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Fechamento do mês
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-11 sm:h-9"
            >
              <RefreshCcw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            {canGerar && (
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                disabled={loadingTemplates || templates.length === 0}
                className="h-11 sm:h-9"
              >
                <Plus className="h-4 w-4 mr-1" />
                Gerar Workbook
              </Button>
            )}
          </div>
        }
      >
        {templates.length === 0 && !loadingTemplates && (
          <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
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

      {canGerar && dialogOpen && (
        <Suspense fallback={null}>
          <WorkbookGeracaoDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            templates={templates}
            onGerar={async (p) => { await gerarMutation.mutateAsync(p); }}
            isGenerating={gerarMutation.isPending}
            onCancel={() => abortRef.current?.abort()}
          />
        </Suspense>
      )}
    </>
  );
}
