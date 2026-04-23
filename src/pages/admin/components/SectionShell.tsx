/**
 * SectionShell — wrapper consistente das seções administrativas.
 * Renderiza header (título + descrição) e barra de salvar quando aplicável.
 *
 * Em mobile (<sm) a barra de salvar fica `fixed` no rodapé com
 * `safe-area-inset-bottom` para não ficar perdida no fim de formulários
 * longos (Empresa, Email, Integrações, etc.).
 */

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionShellProps {
  title: string;
  description: string;
  saveCta?: string;
  lastSavedAt?: string | null;
  isSaving?: boolean;
  onSave?: () => void;
  children: React.ReactNode;
}

export function SectionShell({
  title,
  description,
  saveCta,
  lastSavedAt,
  isSaving = false,
  onSave,
  children,
}: SectionShellProps) {
  const showSaveBar = !!onSave && !!saveCta;
  const lastSavedLabel = lastSavedAt
    ? `Última atualização: ${new Date(lastSavedAt).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })}`
    : "Ainda não há atualização registrada para esta seção.";
  return (
    <div className={cn("space-y-4", showSaveBar && "max-sm:pb-24")}>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
      {children}
      {showSaveBar && (
        <>
          {/* Desktop / tablet: barra inline */}
          <div className="hidden sm:flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{lastSavedLabel}</p>
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="gap-2"
              aria-label="Salvar alterações de configuração"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saveCta}
            </Button>
          </div>
          {/* Mobile: barra fixed bottom com safe-area */}
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_-4px_hsl(var(--background))]">
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="w-full gap-2 min-h-11"
              aria-label="Salvar alterações de configuração"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saveCta}
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground truncate">
              {lastSavedLabel}
            </p>
          </div>
        </>
      )}
    </div>
  );
}