import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, RefreshCcw, Layers, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApresentacaoGeracaoDialog } from '@/components/apresentacao/ApresentacaoGeracaoDialog';
import { ApresentacaoHistoricoTable } from '@/components/apresentacao/ApresentacaoHistoricoTable';
import { ApresentacaoComentariosEditor } from '@/components/apresentacao/ApresentacaoComentariosEditor';
import { ApresentacaoSlidesPreview } from '@/components/apresentacao/ApresentacaoSlidesPreview';
import { ApresentacaoAprovacaoBar } from '@/components/apresentacao/ApresentacaoAprovacaoBar';
import { ApresentacaoTemplatesTable } from '@/components/apresentacao/ApresentacaoTemplatesTable';
import {
  ApresentacaoTemplateFormDialog,
  type TemplateFormValues,
} from '@/components/apresentacao/ApresentacaoTemplateFormDialog';
import { useCan } from '@/hooks/useCan';
import { supabase } from '@/integrations/supabase/client';
import {
  listarApresentacaoTemplates,
  listarTodosApresentacaoTemplates,
  listarApresentacaoGeracoes,
  listarComentariosByGeracao,
  atualizarComentarioEditado,
  gerarApresentacao,
  downloadApresentacaoGeracao,
  downloadBlob,
  criarTemplate,
  atualizarTemplate,
  duplicarTemplate,
  aprovarGeracao,
  rejeitarGeracao,
} from '@/services/apresentacaoService';
import { SLIDE_DEFINITIONS } from '@/lib/apresentacao/slideDefinitions';
import type {
  ApresentacaoGeracao,
  ApresentacaoModoGeracao,
  ApresentacaoTemplate,
} from '@/types/apresentacao';
import { getUserFriendlyError } from '@/utils/errorMessages';

async function getCurrentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export default function ApresentacaoGerencial() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedGeracaoId, setSelectedGeracaoId] = useState<string | null>(null);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApresentacaoTemplate | null>(null);
  const [togglingTemplateId, setTogglingTemplateId] = useState<string | null>(null);
  const { can } = useCan();

  const canVisualizar = can('apresentacao:visualizar');
  const canGerar = can('apresentacao:gerar');
  const canEditar = can('apresentacao:editar');
  const canDownload = can('apresentacao:baixar');
  const canAprovar = can('apresentacao:aprovar');

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['apresentacao-templates'],
    queryFn: listarApresentacaoTemplates,
    enabled: canVisualizar,
  });

  const { data: allTemplates = [], isLoading: loadingAllTemplates } = useQuery({
    queryKey: ['apresentacao-templates-all'],
    queryFn: listarTodosApresentacaoTemplates,
    enabled: canEditar,
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

  const selectedGeracao = geracoes.find((g) => g.id === selectedGeracaoId) ?? null;

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
        await getCurrentUserId()
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

  const aprovarMutation = useMutation({
    mutationFn: async (geracaoId: string) => {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Usuário não autenticado.');
      await aprovarGeracao(geracaoId, userId);
    },
    onSuccess: () => {
      toast.success('Apresentação aprovada.');
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: async (geracaoId: string) => {
      await rejeitarGeracao(geracaoId);
    },
    onSuccess: () => {
      toast.success('Apresentação reaberta para revisão.');
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (values: TemplateFormValues) => {
      if (editingTemplate) {
        await atualizarTemplate(editingTemplate.id, {
          nome: values.nome,
          versao: values.versao,
          descricao: values.descricao || null,
          config_json: values.config_json,
        });
      } else {
        await criarTemplate({
          nome: values.nome,
          codigo: values.codigo,
          versao: values.versao,
          descricao: values.descricao || null,
          config_json: values.config_json,
        });
      }
    },
    onSuccess: () => {
      toast.success(editingTemplate ? 'Template atualizado.' : 'Template criado.');
      setTemplateFormOpen(false);
      setEditingTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates'] });
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates-all'] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (source: ApresentacaoTemplate) => {
      const novoCodigo = `${source.codigo}_copia_${Date.now().toString(36)}`;
      await duplicarTemplate(source.id, novoCodigo);
    },
    onSuccess: () => {
      toast.success('Template duplicado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates'] });
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates-all'] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  const handleToggleAtivo = async (template: ApresentacaoTemplate) => {
    setTogglingTemplateId(template.id);
    try {
      await atualizarTemplate(template.id, { ativo: !template.ativo });
      toast.success(`Template ${template.ativo ? 'desativado' : 'ativado'}.`);
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates'] });
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates-all'] });
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setTogglingTemplateId(null);
    }
  };

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

  const totalSlidesDefinidos = SLIDE_DEFINITIONS.filter((s) => !s.optional).length;

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
            {canEditar && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateFormOpen(true);
                }}
                aria-label="Novo template de apresentação"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Novo Template
              </Button>
            )}
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
            {canEditar && (
              <TabsTrigger value="templates">
                <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                Templates
              </TabsTrigger>
            )}
            {selectedGeracaoId && (
              <TabsTrigger value="comentarios">
                Revisão da Geração
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="historico">
            <ApresentacaoHistoricoTable
              geracoes={geracoes}
              isLoading={loadingGeracoes}
              onDownload={handleDownload}
              downloadingId={downloadingId}
              onSelectGeracao={(g) => setSelectedGeracaoId(g.id)}
              selectedGeracaoId={selectedGeracaoId}
            />
          </TabsContent>

          <TabsContent value="slides">
            <div className="mb-3">
              <p className="text-sm text-muted-foreground">
                Estrutura dos slides da apresentação gerencial (V1: obrigatórios + opcionais;
                V2: slides avançados, ativáveis por template).
                Total de {totalSlidesDefinidos} slides padrão + {SLIDE_DEFINITIONS.filter((s) => s.optional).length} opcionais.
              </p>
            </div>
            <ApresentacaoSlidesPreview />
          </TabsContent>

          {canEditar && (
            <TabsContent value="templates">
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                  Gerencie os templates de apresentação. Cada template define paleta de cores,
                  fontes e quais slides são incluídos na geração.
                </p>
              </div>
              <ApresentacaoTemplatesTable
                templates={allTemplates}
                isLoading={loadingAllTemplates}
                onEdit={(t) => {
                  setEditingTemplate(t);
                  setTemplateFormOpen(true);
                }}
                onDuplicate={(t) => duplicateTemplateMutation.mutate(t)}
                onToggleAtivo={handleToggleAtivo}
                togglingId={togglingTemplateId}
              />
            </TabsContent>
          )}

          {selectedGeracaoId && (
            <TabsContent value="comentarios">
              {/* V2 Approval Bar */}
              {selectedGeracao && (
                <div className="mb-4">
                  <ApresentacaoAprovacaoBar
                    statusEditorial={selectedGeracao.status_editorial ?? 'rascunho'}
                    aprovadoPor={selectedGeracao.aprovado_por}
                    aprovadoEm={selectedGeracao.aprovado_em}
                    totalSlides={selectedGeracao.total_slides}
                    canAprovar={canAprovar}
                    isLoading={aprovarMutation.isPending || rejeitarMutation.isPending}
                    onAprovar={() => aprovarMutation.mutate(selectedGeracaoId)}
                    onRejeitar={() => rejeitarMutation.mutate(selectedGeracaoId)}
                  />
                </div>
              )}

              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Revise e edite os comentários executivos. Os comentários editados têm
                  prioridade sobre os automáticos no arquivo final.
                </p>
                {canDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const g = geracoes.find((x) => x.id === selectedGeracaoId);
                      if (g) void handleDownload(g);
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

      {canEditar && (
        <ApresentacaoTemplateFormDialog
          open={templateFormOpen}
          onOpenChange={(open) => {
            setTemplateFormOpen(open);
            if (!open) setEditingTemplate(null);
          }}
          template={editingTemplate}
          onSave={(values) => saveTemplateMutation.mutateAsync(values)}
          isSaving={saveTemplateMutation.isPending}
        />
      )}
    </AppLayout>
  );
}


export default function ApresentacaoGerencial() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedGeracaoId, setSelectedGeracaoId] = useState<string | null>(null);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApresentacaoTemplate | null>(null);
  const [togglingTemplateId, setTogglingTemplateId] = useState<string | null>(null);
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

  const { data: allTemplates = [], isLoading: loadingAllTemplates } = useQuery({
    queryKey: ['apresentacao-templates-all'],
    queryFn: listarTodosApresentacaoTemplates,
    enabled: canEditar,
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

  const saveTemplateMutation = useMutation({
    mutationFn: async (values: TemplateFormValues) => {
      if (editingTemplate) {
        await atualizarTemplate(editingTemplate.id, {
          nome: values.nome,
          versao: values.versao,
          descricao: values.descricao || null,
          config_json: values.config_json,
        });
      } else {
        await criarTemplate({
          nome: values.nome,
          codigo: values.codigo,
          versao: values.versao,
          descricao: values.descricao || null,
          config_json: values.config_json,
        });
      }
    },
    onSuccess: () => {
      toast.success(editingTemplate ? 'Template atualizado.' : 'Template criado.');
      setTemplateFormOpen(false);
      setEditingTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates'] });
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates-all'] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (source: ApresentacaoTemplate) => {
      const novoCodigo = `${source.codigo}_copia_${Date.now().toString(36)}`;
      await duplicarTemplate(source.id, novoCodigo);
    },
    onSuccess: () => {
      toast.success('Template duplicado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates'] });
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates-all'] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  const handleToggleAtivo = async (template: ApresentacaoTemplate) => {
    setTogglingTemplateId(template.id);
    try {
      await atualizarTemplate(template.id, { ativo: !template.ativo });
      toast.success(`Template ${template.ativo ? 'desativado' : 'ativado'}.`);
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates'] });
      queryClient.invalidateQueries({ queryKey: ['apresentacao-templates-all'] });
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setTogglingTemplateId(null);
    }
  };

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
            {canEditar && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateFormOpen(true);
                }}
                aria-label="Novo template de apresentação"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Novo Template
              </Button>
            )}
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
            {canEditar && (
              <TabsTrigger value="templates">
                <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                Templates
              </TabsTrigger>
            )}
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

          {canEditar && (
            <TabsContent value="templates">
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                  Gerencie os templates de apresentação. Cada template define paleta de cores,
                  fontes e quais slides são incluídos na geração.
                </p>
              </div>
              <ApresentacaoTemplatesTable
                templates={allTemplates}
                isLoading={loadingAllTemplates}
                onEdit={(t) => {
                  setEditingTemplate(t);
                  setTemplateFormOpen(true);
                }}
                onDuplicate={(t) => duplicateTemplateMutation.mutate(t)}
                onToggleAtivo={handleToggleAtivo}
                togglingId={togglingTemplateId}
              />
            </TabsContent>
          )}

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

      {canEditar && (
        <ApresentacaoTemplateFormDialog
          open={templateFormOpen}
          onOpenChange={(open) => {
            setTemplateFormOpen(open);
            if (!open) setEditingTemplate(null);
          }}
          template={editingTemplate}
          onSave={(values) => saveTemplateMutation.mutateAsync(values)}
          isSaving={saveTemplateMutation.isPending}
        />
      )}
    </AppLayout>
  );
}
