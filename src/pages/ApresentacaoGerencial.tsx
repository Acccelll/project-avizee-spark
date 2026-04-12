import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, RefreshCcw, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApresentacaoGeracaoDialog } from '@/components/apresentacao/ApresentacaoGeracaoDialog';
import { ApresentacaoHistoricoTable } from '@/components/apresentacao/ApresentacaoHistoricoTable';
import { ApresentacaoComentariosEditor } from '@/components/apresentacao/ApresentacaoComentariosEditor';
import { ApresentacaoSlidesPreview } from '@/components/apresentacao/ApresentacaoSlidesPreview';
import { useCan } from '@/hooks/useCan';
import {
  listarApresentacaoTemplates,
  listarApresentacaoGeracoes,
  listarComentariosByGeracao,
  atualizarComentarioEditado,
  gerarApresentacao,
  downloadApresentacaoGeracao,
  downloadBlob,
} from '@/services/apresentacaoService';
import type { ApresentacaoGeracao, ApresentacaoModoGeracao } from '@/types/apresentacao';
import { getUserFriendlyError } from '@/utils/errorMessages';

export default function ApresentacaoGerencial() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedGeracaoId, setSelectedGeracaoId] = useState<string | null>(null);
  const { can } = useCan();

  const canVisualizar = can('apresentacao:visualizar');
  const canGerar = can('apresentacao:gerar');
  const canEditar = can('apresentacao:editar');
  const canDownload = can('apresentacao:baixar');

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['apresentacao-templates'],
    queryFn: listarApresentacaoTemplates,
    enabled: canVisualizar,
  });

  const {
    data: geracoes = [],
    isLoading: loadingGeracoes,
    refetch,
  } = useQuery({
    queryKey: ['apresentacao-geracoes'],
    queryFn: listarApresentacaoGeracoes,
    enabled: canVisualizar,
  });

  const { data: comentarios = [], isLoading: loadingComentarios } = useQuery({
    queryKey: ['apresentacao-comentarios', selectedGeracaoId],
    queryFn: () => listarComentariosByGeracao(selectedGeracaoId!),
    enabled: Boolean(selectedGeracaoId),
  });

  const gerarMutation = useMutation({
    mutationFn: async (params: {
      templateId: string;
      competenciaInicial: string;
      competenciaFinal: string;
      modoGeracao: ApresentacaoModoGeracao;
    }) => {
      const { blob, geracaoId } = await gerarApresentacao(
        {
          templateId: params.templateId,
          competenciaInicial: params.competenciaInicial,
          competenciaFinal: params.competenciaFinal,
          modoGeracao: params.modoGeracao,
        },
        undefined
      );
      const filename = `apresentacao_gerencial_${params.competenciaInicial}_${params.competenciaFinal}_${geracaoId.slice(0, 8)}.pptx`;
      downloadBlob(blob, filename);
      return geracaoId;
    },
    onSuccess: (geracaoId) => {
      toast.success('Apresentação gerada com sucesso! O download foi iniciado.');
      setDialogOpen(false);
      setSelectedGeracaoId(geracaoId);
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  const saveComentarioMutation = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      await atualizarComentarioEditado(id, texto);
    },
    onSuccess: () => {
      toast.success('Comentário salvo.');
      queryClient.invalidateQueries({ queryKey: ['apresentacao-comentarios', selectedGeracaoId] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  const handleDownload = async (geracao: ApresentacaoGeracao) => {
    setDownloadingId(geracao.id);
    try {
      const blob = await downloadApresentacaoGeracao(geracao);
      const filename = `apresentacao_gerencial_${geracao.id.slice(0, 8)}.pptx`;
      downloadBlob(blob, filename);
      toast.success('Download iniciado.');
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout>
      <ModulePage
        title="Apresentação Gerencial"
        description="Gere apresentações PowerPoint com dados do ERP para fechamentos mensais."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              aria-label="Atualizar histórico"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            {canGerar && (
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                disabled={loadingTemplates || templates.length === 0}
                aria-label="Nova apresentação gerencial"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Apresentação
              </Button>
            )}
          </div>
        }
      >
        <Tabs defaultValue="historico" className="space-y-4">
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="slides">
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Estrutura dos Slides
            </TabsTrigger>
            {selectedGeracaoId && (
              <TabsTrigger value="comentarios">
                Comentários da Geração
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="historico">
            <ApresentacaoHistoricoTable
              geracoes={geracoes}
              isLoading={loadingGeracoes}
              onDownload={handleDownload}
              downloadingId={downloadingId}
            />
            {geracoes.length > 0 && canDownload && (
              <div className="mt-3 flex flex-wrap gap-2">
                {geracoes
                  .filter((g) => g.status === 'concluido')
                  .slice(0, 5)
                  .map((g) => (
                    <Button
                      key={g.id}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedGeracaoId(g.id)}
                      aria-label={`Ver comentários da geração ${g.id.slice(0, 8)}`}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Ver comentários {g.competencia_inicial?.slice(0, 7)}
                    </Button>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="slides">
            <div className="mb-3">
              <p className="text-sm text-muted-foreground">
                Estrutura dos {12} slides incluídos na V1 da apresentação gerencial.
              </p>
            </div>
            <ApresentacaoSlidesPreview />
          </TabsContent>

          {selectedGeracaoId && (
            <TabsContent value="comentarios">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Edite os comentários executivos antes de gerar o arquivo final.
                  O arquivo usará o comentário editado quando disponível.
                </p>
                {canDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const g = geracoes.find((x) => x.id === selectedGeracaoId);
                      if (g) handleDownload(g);
                    }}
                    disabled={Boolean(downloadingId)}
                    aria-label="Baixar apresentação selecionada"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Baixar .pptx
                  </Button>
                )}
              </div>
              {loadingComentarios ? (
                <p className="text-sm text-muted-foreground">Carregando comentários…</p>
              ) : (
                <ApresentacaoComentariosEditor
                  comentarios={comentarios}
                  onSave={(id, texto) =>
                    saveComentarioMutation.mutateAsync({ id, texto })
                  }
                  isSaving={saveComentarioMutation.isPending}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </ModulePage>

      <ApresentacaoGeracaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templates={templates}
        onGerar={(params) => gerarMutation.mutateAsync(params)}
        isGenerating={gerarMutation.isPending}
      />
    </AppLayout>
  );
}
