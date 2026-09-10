import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, MessageSquareWarning } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useHelp } from "@/contexts/HelpContext";
import { useMeusChamados } from "./hooks/useSuporteQueries";
import { STATUS_BADGE_CLASS, STATUS_BADGE_VARIANT, STATUS_LABELS, TIPO_ICON_EMOJI, TIPO_LABELS } from "./suporteLabels";

/**
 * "Meus chamados" — lista dos chamados abertos pelo usuário atual (ou onde
 * ele é o responsável), visível a qualquer usuário autenticado. A RLS de
 * `suporte_chamados` já garante que só aparecem os chamados próprios (admin
 * vê todos, mas a gestão administrativa completa é uma tela separada).
 */
export default function MeusChamados() {
  const { data: chamados, isLoading } = useMeusChamados();
  const { openReportDialog } = useHelp();

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Meus chamados</h1>
          <p className="text-sm text-muted-foreground">
            Bugs, dúvidas, sugestões e problemas operacionais que você reportou.
          </p>
        </div>
        <Button className="gap-1.5 max-sm:w-full max-sm:h-11" onClick={() => openReportDialog()}>
          <MessageSquareWarning className="h-4 w-4" /> Reportar problema
        </Button>
      </header>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : !chamados?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <LifeBuoy className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Você ainda não abriu nenhum chamado. Se encontrar um problema em qualquer tela, use o botão
              "Reportar problema" no menu de ajuda (?) ou aqui em cima.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {chamados.map((chamado) => (
            <Link key={chamado.id} to={`/ajuda/chamados/${chamado.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="space-y-1.5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{chamado.numero}</span>
                    <Badge
                      variant={STATUS_BADGE_VARIANT[chamado.status]}
                      className={cn(STATUS_BADGE_CLASS[chamado.status])}
                    >
                      {STATUS_LABELS[chamado.status]}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium leading-snug line-clamp-2">
                    <span aria-hidden>{TIPO_ICON_EMOJI[chamado.tipo]}</span> {chamado.resumo}
                  </p>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2 pt-0 text-xs text-muted-foreground">
                  <span>{TIPO_LABELS[chamado.tipo]}</span>
                  <span>{formatDateTime(chamado.created_at)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
