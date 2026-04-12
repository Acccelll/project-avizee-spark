import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import {
  atualizarComentario,
  downloadApresentacao,
  downloadBlob,
  gerarApresentacao,
  listarApresentacaoGeracoes,
  listarApresentacaoTemplates,
  listarComentarios,
} from '@/services/apresentacaoService';
import { ApresentacaoGeracaoDialog } from '@/components/apresentacao/ApresentacaoGeracaoDialog';
import { ApresentacaoSlidesPreview } from '@/components/apresentacao/ApresentacaoSlidesPreview';
import { ApresentacaoHistoricoTable } from '@/components/apresentacao/ApresentacaoHistoricoTable';
import { ApresentacaoComentariosEditor } from '@/components/apresentacao/ApresentacaoComentariosEditor';

export default function ApresentacaoGerencial() {
  const { can } = useCan();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGeracaoId, setSelectedGeracaoId] = useState<string | null>(null);

  const canVisualizar = can('apresentacao:visualizar');
  const canGerar = can('apresentacao:gerar');
  const canEditarComentarios = can('apresentacao:editar_comentarios');
  const canDownload = can('apresentacao:download');

  const { data: templates = [] } = useQuery({ queryKey: ['apresentacao-templates'], queryFn: listarApresentacaoTemplates, enabled: canVisualizar });
  const { data: geracoes = [], refetch, isLoading } = useQuery({ queryKey: ['apresentacao-geracoes'], queryFn: listarApresentacaoGeracoes, enabled: canVisualizar });
  const { data: comentarios = [] } = useQuery({ queryKey: ['apresentacao-comentarios', selectedGeracaoId], queryFn: () => listarComentarios(selectedGeracaoId!), enabled: !!selectedGeracaoId });

  const gerarMutation = useMutation({
    mutationFn: gerarApresentacao,
    onSuccess: ({ blob, geracaoId }) => {
      downloadBlob(blob, `apresentacao_gerencial_${geracaoId.slice(0, 8)}.pptx`);
      toast.success('Apresentação gerada com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
      setDialogOpen(false);
    },
    onError: (err) => toast.error(`Falha ao gerar apresentação: ${err instanceof Error ? err.message : String(err)}`),
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
            {canGerar && <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Gerar .pptx</Button>}
          </div>
        }
      >
        <div className="space-y-4">
          <ApresentacaoSlidesPreview />
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
            });
          }}
        />
      )}
    </AppLayout>
  );
}
