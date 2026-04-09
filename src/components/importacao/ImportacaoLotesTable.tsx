import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ImportacaoStatusBadge } from "./ImportacaoStatusBadge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Trash2, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface ImportacaoLote {
  id: string;
  tipo_importacao: string;
  status: string;
  arquivo_nome: string;
  total_lidos: number;
  total_validos: number;
  total_erros: number;
  total_importados: number;
  criado_em: string;
}

interface ImportacaoLotesTableProps {
  lotes: ImportacaoLote[];
  isLoading?: boolean;
  onView?: (id: string) => void;
  onImport?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ImportacaoLotesTable({ lotes, isLoading, onView, onImport, onDelete }: ImportacaoLotesTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground bg-card">
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
        Carregando lotes...
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center text-muted-foreground bg-card">
        Nenhum lote de importação encontrado.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[180px]">Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Arquivo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Lidos</TableHead>
            <TableHead className="text-center text-emerald-600">Válidos</TableHead>
            <TableHead className="text-center text-rose-600">Erros</TableHead>
            <TableHead className="text-center text-blue-600">Importados</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lotes.map((lote) => (
            <TableRow key={lote.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-medium whitespace-nowrap">
                {format(new Date(lote.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell className="capitalize">{lote.tipo_importacao.replace('_', ' ')}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={lote.arquivo_nome}>
                {lote.arquivo_nome}
              </TableCell>
              <TableCell className={cn((lote.status === 'concluido' || lote.status === 'cancelado') && "opacity-50")}>
                <ImportacaoStatusBadge status={lote.status} />
              </TableCell>
              <TableCell className="text-center font-semibold">{lote.total_lidos}</TableCell>
              <TableCell className="text-center font-semibold text-emerald-600">{lote.total_validos}</TableCell>
              <TableCell className="text-center font-semibold text-rose-600">{lote.total_erros}</TableCell>
              <TableCell className="text-center font-semibold text-blue-600">{lote.total_importados}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onView?.(lote.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Visualizar
                    </DropdownMenuItem>
                    {(lote.status === 'validado' || lote.status === 'parcial') && (
                      <DropdownMenuItem onClick={() => onImport?.(lote.id)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Finalizar Importação
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-rose-600" onClick={() => onDelete?.(lote.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir Lote
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
