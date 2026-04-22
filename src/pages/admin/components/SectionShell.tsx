/**
 * SectionShell — wrapper consistente das seções administrativas.
 * Renderiza header (título + descrição) e barra de salvar quando aplicável.
 */

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
      {children}
      {showSaveBar && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {lastSavedAt
              ? `Última atualização: ${new Date(lastSavedAt).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}`
              : "Ainda não há atualização registrada para esta seção."}
          </p>
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
      )}
    </div>
  );
}