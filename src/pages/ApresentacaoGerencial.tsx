import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import {
  aprovarEGerarFinal,
  atualizarComentario,
  atualizarStatusEditorial,
  downloadApresentacao,
  downloadBlob,
  gerarApresentacao,
  incluirTemplateApresentacao,
  listarApresentacaoGeracoes,
  listarApresentacaoTemplates,
  listarComentarios,
} from '@/services/apresentacaoService';
import { ApresentacaoGeracaoDialog } from '@/components/apresentacao/ApresentacaoGeracaoDialog';
import { ApresentacaoSlidesPreview } from '@/components/apresentacao/ApresentacaoSlidesPreview';
import { ApresentacaoHistoricoTable } from '@/components/apresentacao/ApresentacaoHistoricoTable';
import { ApresentacaoComentariosEditor } from '@/components/apresentacao/ApresentacaoComentariosEditor';
import { ApresentacaoTemplateManager } from '@/components/apresentacao/ApresentacaoTemplateManager';
import { ApresentacaoAprovacaoBar } from '@/components/apresentacao/ApresentacaoAprovacaoBar';
import type { ApresentacaoGeracao, SlideCodigo } from '@/types/apresentacao';

export default function ApresentacaoGerencial() {
  const { can } = useCan();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGeracaoId, setSelectedGeracaoId] = useState<string | null>(null);

  const canVisualizar = can('apresentacao:visualizar');
  const canGerar = can('apresentacao:gerar');
  const canEditarComentarios = can('apresentacao:editar_comentarios');
  const canDownload = can('apresentacao:download');
  const canIncluirTemplate = can('apresentacao:gerenciar_templates') || can('apresentacao:criar');
  const canAprovar = can('apresentacao:aprovar');

  const { data: templates = [] } = useQuery({ queryKey: ['apresentacao-templates'], queryFn: listarApresentacaoTemplates, enabled: canVisualizar });
  const { data: geracoes = [], refetch, isLoading } = useQuery({ queryKey: ['apresentacao-geracoes'], queryFn: listarApresentacaoGeracoes, enabled: canVisualizar });
  const { data: comentarios = [] } = useQuery({ queryKey: ['apresentacao-comentarios', selectedGeracaoId], queryFn: () => listarComentarios(selectedGeracaoId!), enabled: !!selectedGeracaoId });

  const selectedGeracao = useMemo<ApresentacaoGeracao | null>(() => geracoes.find((g) => g.id === selectedGeracaoId) ?? null, [geracoes, selectedGeracaoId]);
  const selectedSlides = useMemo<SlideCodigo[]>(() => (selectedGeracao?.slides_json as { ativos?: SlideCodigo[] })?.ativos ?? [], [selectedGeracao]);

  const gerarMutation = useMutation({
    mutationFn: gerarApresentacao,
    onSuccess: ({ blob, geracaoId, aguardandoAprovacao }) => {
      if (blob) downloadBlob(blob, `apresentacao_gerencial_${geracaoId.slice(0, 8)}.pptx`);
      toast.success(aguardandoAprovacao ? 'Rascunho criado. Envie para aprovação para gerar versão final.' : 'Apresentação gerada com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
      setSelectedGeracaoId(geracaoId);
      setDialogOpen(false);
    },
    onError: (err) => toast.error(`Falha ao gerar apresentação: ${err instanceof Error ? err.message : String(err)}`),
  });

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGeracaoId) throw new Error('Selecione uma geração.');
      return aprovarEGerarFinal(selectedGeracaoId);
    },
    onSuccess: (blob) => {
      if (selectedGeracaoId) downloadBlob(blob, `apresentacao_gerencial_final_${selectedGeracaoId.slice(0, 8)}.pptx`);
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
      toast.success('Versão final aprovada e gerada.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const templateMutation = useMutation({
    mutationFn: incluirTemplateApresentacao,
    onSuccess: () => {
      toast.success('Template incluído com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates'] });
    },
    onError: (err) => toast.error(`Falha ao incluir template: ${err instanceof Error ? err.message : String(err)}`),
  });

  if (!canVisualizar) {
    return <AppLayout><ModulePage title="Apresentação Gerencial">Sem permissão para visualizar.</ModulePage></AppLayout>;
  }

  return (
    <AppLayout>
      <ModulePage
        title="Apresentação Gerencial"
        headerActions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCcw className="h-4 w-4 mr-1" />Atualizar</Button>
            {canGerar && <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo rascunho</Button>}
          </div>
        }
      >
        <div className="space-y-4">
          <ApresentacaoAprovacaoBar
            geracao={selectedGeracao}
            canAprovar={canAprovar}
            onEnviarRevisao={async () => {
              if (!selectedGeracaoId) return;
              await atualizarStatusEditorial(selectedGeracaoId, 'revisao');
              queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
            }}
            onAprovarGerar={async () => { await aprovarMutation.mutateAsync(); }}
          />

          {canIncluirTemplate && (
            <ApresentacaoTemplateManager
              templates={templates}
              isSaving={templateMutation.isPending}
              onCreate={async (draft, file) => {
                await templateMutation.mutateAsync({
                  nome: draft.nome,
                  codigo: draft.codigo,
                  versao: draft.versao,
                  descricao: draft.descricao,
                  arquivo: file,
                });
              }}
            />
          )}

          <ApresentacaoSlidesPreview
            activeSlides={selectedSlides.length ? selectedSlides : undefined}
            dataAvailability={Object.fromEntries(comentarios.map((c) => [c.slide_codigo, !c.comentario_automatico?.includes('indisponíveis')])) as Record<string, boolean>}
          />

          {canEditarComentarios && !!selectedGeracaoId && (
            <ApresentacaoComentariosEditor comentarios={comentarios} onChange={(id, value) => atualizarComentario(id, value).catch(() => toast.error('Falha ao salvar comentário.'))} />
          )}

          <ApresentacaoHistoricoTable
            geracoes={geracoes}
            isLoading={isLoading}
            canDownload={canDownload}
            onDownload={async (g) => {
              setSelectedGeracaoId(g.id);
              const blob = await downloadApresentacao(g);
              downloadBlob(blob, `apresentacao_gerencial_${g.id.slice(0, 8)}.pptx`);
            }}
          />
        </div>
      </ModulePage>

      {canGerar && (
        <ApresentacaoGeracaoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          templates={templates}
          isGenerating={gerarMutation.isPending}
          onGerar={async (p) => {
            await gerarMutation.mutateAsync({
              templateId: p.templateId,
              competenciaInicial: p.competenciaInicial,
              competenciaFinal: p.competenciaFinal,
              modoGeracao: p.modoGeracao,
              slideConfig: p.slideConfig,
              exigirRevisao: p.exigirRevisao,
            });
          }}
        />
      )}
    </AppLayout>
  );
}
