import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  FilePlus2,
  History,
  Download,
  Loader2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  listarGeracoes,
  listarTemplates,
  downloadApresentacao,
  processarGeracao
} from '@/services/apresentacaoService';
import { ApresentacaoGeracaoDialog } from '@/components/financeiro/ApresentacaoGeracaoDialog';
import { ApresentacaoHistoricoTable } from '@/components/financeiro/ApresentacaoHistoricoTable';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';

const ApresentacaoGerencial: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ['apresentacao-templates'],
    queryFn: listarTemplates,
  });

  const { data: geracoes, isLoading: isLoadingGeracoes } = useQuery({
    queryKey: ['apresentacao-geracoes'],
    queryFn: listarGeracoes,
    refetchInterval: (query) => {
      const anyProcessing = query.state.data?.some(g => g.status === 'gerando' || g.status === 'pendente');
      return anyProcessing ? 5000 : false;
    }
  });

  const downloadMutation = useMutation({
    mutationFn: async (path: string) => {
      const blob = await downloadApresentacao(path);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apresentacao_${path.split('/').pop()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError: (error) => {
      toast.error('Erro ao baixar arquivo: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  });

  const processMutation = useMutation({
    mutationFn: processarGeracao,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
      toast.success('Geração iniciada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao processar: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  });

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Apresentação Gerencial</h1>
            <p className="text-muted-foreground">
              Geração de decks de PowerPoint para fechamento mensal e análise executiva.
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <FilePlus2 className="h-4 w-4" />
            Nova Apresentação
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates Ativos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gerações no Mês</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {geracoes?.filter(g => {
                  const date = new Date(g.created_at);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm text-green-600 font-medium">Conectado ao Banco Real</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Gerações
            </CardTitle>
            <CardDescription>
              Visualize e baixe apresentações geradas anteriormente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingGeracoes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ApresentacaoHistoricoTable
                geracoes={geracoes || []}
                onDownload={(path) => downloadMutation.mutate(path)}
                onProcess={(id) => processMutation.mutate(id)}
              />
            )}
          </CardContent>
        </Card>

        <ApresentacaoGeracaoDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          templates={templates || []}
        />
      </div>
    </AppLayout>
  );
};

export default ApresentacaoGerencial;
