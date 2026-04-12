import { Copy, Edit, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { LayoutDashboard } from 'lucide-react';
import type { ApresentacaoTemplate } from '@/types/apresentacao';

interface ApresentacaoTemplatesTableProps {
  templates: ApresentacaoTemplate[];
  isLoading: boolean;
  onEdit: (template: ApresentacaoTemplate) => void;
  onDuplicate: (template: ApresentacaoTemplate) => void;
  onToggleAtivo: (template: ApresentacaoTemplate) => void;
  togglingId: string | null;
}

export function ApresentacaoTemplatesTable({
  templates,
  isLoading,
  onEdit,
  onDuplicate,
  onToggleAtivo,
  togglingId,
}: ApresentacaoTemplatesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="Nenhum template cadastrado"
        description="Clique em 'Novo Template' para criar o primeiro template de apresentação."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Versão</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Slides ativos</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((t) => {
          const slidesAtivos = t.config_json?.slides
            ? t.config_json.slides.filter((s) => s.ativo).length
            : 12;
          const isToggling = togglingId === t.id;

          return (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                {t.nome}
                {t.descricao && (
                  <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                    {t.descricao}
                  </p>
                )}
              </TableCell>
              <TableCell className="font-mono text-sm">{t.codigo}</TableCell>
              <TableCell>{t.versao}</TableCell>
              <TableCell>
                <Badge variant={t.ativo ? 'default' : 'secondary'}>
                  {t.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {slidesAtivos} / 12
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(t)}
                    aria-label={`Editar template ${t.nome}`}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDuplicate(t)}
                    aria-label={`Duplicar template ${t.nome}`}
                    title="Duplicar"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleAtivo(t)}
                    disabled={isToggling}
                    aria-label={t.ativo ? `Desativar template ${t.nome}` : `Ativar template ${t.nome}`}
                    title={t.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {isToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : t.ativo ? (
                      <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
