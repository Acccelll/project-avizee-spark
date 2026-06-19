import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeftRight,
  CheckCircle,
  Edit as EditIcon,
  Eye,
  FileDown,
  FileText,
  MoreVertical,
  XCircle as XCircleIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { canConfirmFiscal, canEstornarFiscal } from "@/lib/fiscalStatus";
import type { NotaFiscal as NotaFiscalDomain } from "@/types/domain";

type NotaFiscal = NotaFiscalDomain;

export interface FiscalMobileRowActionsDeps {
  canEstornarNF: boolean;
  onConfirmar: (n: NotaFiscal) => void;
  onDanfe: (n: NotaFiscal) => void;
  onView: (n: NotaFiscal) => void;
  onEditNavigate: (n: NotaFiscal) => void;
  onDevolucao: (n: NotaFiscal) => void;
  onEstornar: (n: NotaFiscal) => void;
  onBaixarXml: (n: NotaFiscal) => void;
}

/**
 * Renderers de ações mobile do `DataTable` do módulo Fiscal — extraídos
 * de `Fiscal.tsx` (linhas 1522–1630). Cada função devolve o ReactNode que
 * o DataTable injeta em `mobilePrimaryAction` / `mobileInlineActions`.
 *
 * Mantido como factory (não componente) para preservar o contrato funcional
 * esperado pelo DataTable sem mudança de comportamento.
 */
export function buildFiscalMobileRowActions(deps: FiscalMobileRowActionsDeps) {
  const renderPrimary = (n: NotaFiscal): ReactNode => {
    const status = n.status ?? "";
    if (canConfirmFiscal(status)) {
      return (
        <Button
          size="sm"
          className="w-full min-h-11 gap-2"
          onClick={() => deps.onConfirmar(n)}
          aria-label={`Concluir lançamento da NF ${n.numero}`}
        >
          <CheckCircle className="h-4 w-4" /> Concluir lançamento
        </Button>
      );
    }
    if (["confirmada", "autorizada", "importada"].includes(status)) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="w-full min-h-11 gap-2"
          onClick={() => deps.onDanfe(n)}
          aria-label={`Visualizar DANFE da NF ${n.numero}`}
        >
          <FileText className="h-4 w-4" /> DANFE
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full min-h-11 gap-2"
        onClick={() => deps.onView(n)}
        aria-label={`Ver detalhes da NF ${n.numero}`}
      >
        <Eye className="h-4 w-4" /> Ver detalhes
      </Button>
    );
  };

  const renderInline = (n: NotaFiscal): ReactNode => {
    const status = n.status ?? "";
    const editable = ["pendente", "rascunho"].includes(status);
    const canDevolucao =
      n.tipo === "saida" &&
      (n.tipo_operacao || "normal") === "normal" &&
      ["confirmada", "autorizada", "importada"].includes(status);
    return (
      <>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-11 min-w-11 px-3"
          onClick={(e) => {
            e.stopPropagation();
            deps.onView(n);
          }}
          aria-label={`Ver detalhes da NF ${n.numero}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
        {editable && (
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 min-h-11"
            onClick={() => deps.onEditNavigate(n)}
            aria-label={`Editar NF ${n.numero}`}
          >
            <EditIcon className="h-4 w-4 mr-1.5" /> Editar
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 min-h-11"
              aria-label="Mais ações"
            >
              <MoreVertical className="h-4 w-4 mr-1.5" /> Mais
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => deps.onView(n)}>
              <Eye className="h-4 w-4 mr-2" /> Ver detalhes
            </DropdownMenuItem>
            {["confirmada", "autorizada", "importada"].includes(status) && (
              <DropdownMenuItem onClick={() => deps.onDanfe(n)}>
                <FileText className="h-4 w-4 mr-2" /> DANFE
              </DropdownMenuItem>
            )}
            {(n as { caminho_xml?: string | null }).caminho_xml && (
              <DropdownMenuItem onClick={() => deps.onBaixarXml(n)}>
                <FileDown className="h-4 w-4 mr-2" /> Baixar XML
              </DropdownMenuItem>
            )}
            {canDevolucao && (
              <DropdownMenuItem onClick={() => deps.onDevolucao(n)}>
                <ArrowLeftRight className="h-4 w-4 mr-2" /> Devolução
              </DropdownMenuItem>
            )}
            {canEstornarFiscal(n.status) && deps.canEstornarNF && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => deps.onEstornar(n)}
                >
                  <XCircleIcon className="h-4 w-4 mr-2" /> Estornar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  };

  return { renderPrimary, renderInline };
}