import { Save, Eye, FileText, Copy, Wand2, RefreshCw, MoreHorizontal, LayoutTemplate, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrcamentoTemplate } from "@/pages/comercial/hooks/useOrcamentoTemplates";
import type { TemplateScope } from "./TemplateSaveDialog";

interface Props {
  saving: boolean;
  isEdit: boolean;
  isLocked: boolean;
  templates: OrcamentoTemplate[];
  onSave: () => void;
  onPreview: () => void;
  onGeneratePdf: () => void;
  onDuplicate: () => void;
  onCriarRevisao: () => void;
  onApplyTemplate: (tpl: OrcamentoTemplate) => void;
  onOpenTemplateDialog: (escopo: TemplateScope) => void;
}

/** Barra de ações do OrcamentoForm — botões mobile (Salvar + menu) e desktop (Salvar/Preview/PDF/Templates). */
export function ActionsToolbar({
  saving, isEdit, isLocked, templates,
  onSave, onPreview, onGeneratePdf, onDuplicate, onCriarRevisao,
  onApplyTemplate, onOpenTemplateDialog,
}: Props) {
  return (
    <>
      {/* Mobile: Salvar + menu "Mais" */}
      <div className="flex items-center gap-2 md:hidden">
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1" aria-label="Mais ações">
              <MoreHorizontal className="w-4 h-4" />
              <span>Mais</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Visualização</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onPreview}>
              <Eye className="w-4 h-4 mr-2" />Visualizar proposta
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onGeneratePdf}>
              <FileText className="w-4 h-4 mr-2" />Gerar PDF
            </DropdownMenuItem>
            {templates.length > 0 && <DropdownMenuSeparator />}
            {templates.length > 0 && <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Templates</DropdownMenuLabel>}
            {templates.slice(0, 5).map((tpl) => (
              <DropdownMenuItem key={tpl.id} onSelect={() => onApplyTemplate(tpl)}>
                <LayoutTemplate className="w-4 h-4 mr-2" />
                <span className="truncate">{tpl.nome}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Edição</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onOpenTemplateDialog('usuario')}>
              <Wand2 className="w-4 h-4 mr-2" />Salvar como meu template
            </DropdownMenuItem>
            {isEdit && (
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy className="w-4 h-4 mr-2" />Duplicar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop */}
      <div className="hidden items-center gap-2 md:flex md:flex-wrap">
        {isLocked ? (
          <Button onClick={onCriarRevisao} className="gap-2" title="Criar nova revisão deste orçamento">
            <RefreshCw className="w-4 h-4" />
            Criar revisão
          </Button>
        ) : (
          <Button onClick={onSave} disabled={saving} className="gap-2" title={isEdit ? "Salvar alterações neste orçamento" : "Salvar novo orçamento"}>
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        )}
        <Button variant="outline" onClick={onPreview} className="gap-2"><Eye className="w-4 h-4" />Visualizar</Button>
        <Button variant="secondary" onClick={onGeneratePdf} className="gap-2"><FileText className="w-4 h-4" />Gerar PDF</Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1.5">
              <LayoutTemplate className="w-4 h-4" />Templates<ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Aplicar template</DropdownMenuLabel>
            {templates.length === 0 && (
              <DropdownMenuItem disabled>Nenhum template salvo</DropdownMenuItem>
            )}
            {templates.map((tpl) => (
              <DropdownMenuItem key={tpl.id} onClick={() => onApplyTemplate(tpl)}>
                <span className="truncate">{tpl.nome}</span>
                <span className="ml-auto text-[10px] uppercase text-muted-foreground">{tpl.escopo}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onOpenTemplateDialog('usuario')}>
              <Wand2 className="w-4 h-4 mr-2" />Salvar como meu…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpenTemplateDialog('equipe')}>
              <Wand2 className="w-4 h-4 mr-2" />Compartilhar com equipe…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {isEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais ações"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}
