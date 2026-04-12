import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Download,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Eye
} from 'lucide-react';
import { ApresentacaoGeracao } from '@/types/apresentacao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ApresentacaoComentariosEditor } from './ApresentacaoComentariosEditor';
import { ApresentacaoSlidesPreview } from './ApresentacaoSlidesPreview';

interface Props {
  geracoes: ApresentacaoGeracao[];
  onDownload: (path: string) => void;
  onProcess: (id: string) => void;
}

export const ApresentacaoHistoricoTable: React.FC<Props> = ({ geracoes, onDownload, onProcess }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluido':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>;
      case 'gerando':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Clock className="h-3 w-3 mr-1 animate-spin" /> Gerando</Badge>;
      case 'erro':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {geracoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma geração encontrada.
                </TableCell>
              </TableRow>
            ) : (
              geracoes.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>{format(new Date(g.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                  <TableCell>
                    {g.competencia_inicial?.slice(0, 7)} a {g.competencia_final?.slice(0, 7)}
                  </TableCell>
                  <TableCell>{g.apresentacao_templates?.nome}</TableCell>
                  <TableCell className="capitalize">{g.modo_geracao}</TableCell>
                  <TableCell>{getStatusBadge(g.status)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {g.status === 'pendente' && (
                      <Button size="sm" variant="outline" onClick={() => setEditingId(g.id)} title="Editar Comentários">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                    {g.status === 'pendente' && (
                      <Button size="sm" variant="default" onClick={() => onProcess(g.id)} title="Processar Geração">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {g.status === 'concluido' && (
                      <Button size="sm" variant="outline" onClick={() => setPreviewId(g.id)} title="Visualizar Slides">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {g.status === 'concluido' && g.arquivo_path && (
                      <Button size="sm" variant="outline" onClick={() => onDownload(g.arquivo_path!)} title="Baixar PPTX">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingId && (
        <ApresentacaoComentariosEditor
          geracaoId={editingId}
          open={!!editingId}
          onOpenChange={(open) => !open && setEditingId(null)}
        />
      )}

      {previewId && (
        <ApresentacaoSlidesPreview
          geracaoId={previewId}
          open={!!previewId}
          onOpenChange={(open) => !open && setPreviewId(null)}
        />
      )}
    </>
  );
};
