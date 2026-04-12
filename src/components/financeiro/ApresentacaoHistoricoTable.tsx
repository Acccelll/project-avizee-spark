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
  Eye,
  FileText,
  UserCheck
} from 'lucide-react';
import { ApresentacaoGeracao } from '@/types/apresentacao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ApresentacaoComentariosEditor } from './ApresentacaoComentariosEditor';
import { ApresentacaoSlidesPreview } from './ApresentacaoSlidesPreview';
import { ApresentacaoAprovacaoBar } from './ApresentacaoAprovacaoBar';

interface Props {
  geracoes: ApresentacaoGeracao[];
  onDownload: (path: string) => void;
  onProcess: (id: string) => void;
}

export const ApresentacaoHistoricoTable: React.FC<Props> = ({ geracoes, onDownload, onProcess }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);

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

  const getEditorialBadge = (status?: string) => {
    switch (status) {
      case 'gerado':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Publicado</Badge>;
      case 'aprovado':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Aprovado</Badge>;
      case 'revisao':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Em Revisão</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200">Rascunho</Badge>;
    }
  };

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px]">Data Criação</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Dados</TableHead>
              <TableHead>Fase Editorial</TableHead>
              <TableHead>Status Geração</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {geracoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 opacity-20" />
                    <p>Nenhuma apresentação gerencial encontrada.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              geracoes.map((g) => (
                <TableRow key={g.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">
                    {format(new Date(g.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {g.competencia_inicial?.slice(0, 7)} ➜ {g.competencia_final?.slice(0, 7)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{g.apresentacao_templates?.nome}</span>
                      <span className="text-[10px] text-muted-foreground">Versão {g.apresentacao_templates?.versao}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">
                    <span className={g.modo_geracao === 'fechado' ? 'text-blue-600 font-semibold' : ''}>
                      {g.modo_geracao}
                    </span>
                  </TableCell>
                  <TableCell>{getEditorialBadge(g.status_editorial)}</TableCell>
                  <TableCell>{getStatusBadge(g.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {g.status === 'pendente' && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(g.id)} title="Revisar Conteúdo">
                            <MessageSquare className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setApprovalId(g.id)} title="Aprovar/Avançar">
                            <UserCheck className="h-4 w-4 text-green-600" />
                          </Button>
                          {g.status_editorial === 'aprovado' && (
                            <Button size="icon" variant="ghost" className="bg-primary/10" onClick={() => onProcess(g.id)} title="Gerar PPTX Final">
                              <Play className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                        </>
                      )}

                      {g.status === 'concluido' && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setPreviewId(g.id)} title="Visualizar Estrutura">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {g.arquivo_path && (
                            <Button size="icon" variant="ghost" onClick={() => onDownload(g.arquivo_path!)} title="Baixar Arquivo">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
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

      {approvalId && (
        <ApresentacaoAprovacaoBar
          geracao={geracoes.find(g => g.id === approvalId)!}
          open={!!approvalId}
          onOpenChange={(open) => !open && setApprovalId(null)}
        />
      )}
    </>
  );
};
