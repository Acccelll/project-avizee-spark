import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { montarTextoCopiavel, type Diagnostico } from "./diagnosticoTexto";

interface Campo {
  label: string;
  valor: string | number | null | undefined;
}

function Secao({ titulo, campos, defaultOpen }: { titulo: string; campos: Campo[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const preenchidos = campos.filter((c) => c.valor !== null && c.valor !== undefined && c.valor !== "");
  if (preenchidos.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md py-1.5 text-sm font-medium hover:text-primary">
        {titulo}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pb-2 pl-1 text-xs text-muted-foreground">
        {preenchidos.map((c) => (
          <p key={c.label}>
            <span className="text-foreground/80">{c.label}:</span> {String(c.valor)}
          </p>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface DiagnosticoPanelProps {
  chamadoNumero: string;
  diagnostico: Diagnostico | null | undefined;
  isLoading: boolean;
  totalAnexos: number;
}

/**
 * Diagnóstico técnico (spec §29): expansível, organizado por Ambiente,
 * Contexto, Erro e Evidências — nunca despeja JSON bruto por padrão.
 * "Copiar diagnóstico" monta um texto estruturado (não o JSON da linha),
 * pronto para colar num Issue do GitHub.
 */
export function DiagnosticoPanel({ chamadoNumero, diagnostico, isLoading, totalAnexos }: DiagnosticoPanelProps) {
  if (isLoading) return <Skeleton className="h-24 rounded-lg" />;
  if (!diagnostico) return null;

  async function copiarDiagnostico() {
    if (!diagnostico) return;
    try {
      await navigator.clipboard.writeText(montarTextoCopiavel(chamadoNumero, diagnostico));
      toast.success("Diagnóstico copiado.");
    } catch {
      toast.error("Não foi possível copiar o diagnóstico.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <h2 className="text-sm font-semibold">Diagnóstico técnico</h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={copiarDiagnostico}>
          <ClipboardCopy className="h-3.5 w-3.5" /> Copiar diagnóstico
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 divide-y divide-border">
        <Secao
          titulo="Ambiente"
          defaultOpen
          campos={[
            { label: "Navegador", valor: diagnostico.navegador },
            { label: "Sistema operacional", valor: diagnostico.sistema_operacional },
            { label: "Viewport", valor: diagnostico.viewport },
            { label: "Idioma", valor: diagnostico.idioma },
            { label: "Conectividade", valor: diagnostico.conectividade },
          ]}
        />
        <Secao
          titulo="Contexto"
          campos={[
            { label: "Rota", valor: diagnostico.url_relativa },
            { label: "Versão/build", valor: diagnostico.versao_build },
            { label: "Ambiente", valor: diagnostico.ambiente },
            {
              label: "Contexto da tela",
              valor:
                diagnostico.contexto_tela && Object.keys(diagnostico.contexto_tela).length > 0
                  ? Object.entries(diagnostico.contexto_tela)
                      .map(([k, v]) => `${k}=${String(v)}`)
                      .join(", ")
                  : undefined,
            },
          ]}
        />
        <Secao
          titulo="Erro"
          campos={[
            { label: "Mensagem", valor: diagnostico.erro_mensagem_amigavel },
            { label: "Código", valor: diagnostico.erro_codigo },
            { label: "Operação", valor: diagnostico.erro_operacao },
            { label: "Correlation ID", valor: diagnostico.erro_correlation_id },
            { label: "HTTP status", valor: diagnostico.erro_http_status },
            { label: "Stack trace", valor: diagnostico.erro_stack_trace },
          ]}
        />
        <Secao
          titulo="Evidências"
          campos={[{ label: "Anexos", valor: totalAnexos > 0 ? `${totalAnexos} arquivo(s) — ver acima` : undefined }]}
        />
      </CardContent>
    </Card>
  );
}
