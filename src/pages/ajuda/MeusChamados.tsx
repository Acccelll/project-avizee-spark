import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, MessageSquareWarning } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useHelp } from "@/contexts/HelpContext";
import { useMeusChamados } from "./hooks/useSuporteQueries";
import type { SuporteChamado } from "@/services/suporte.service";
import { STATUS_BADGE_CLASS, STATUS_BADGE_VARIANT, STATUS_LABELS, TIPO_ICON_EMOJI, TIPO_LABELS } from "./suporteLabels";

/** Filtros rápidos da spec §19 — "sem excesso de filtros". */
type FiltroRapido = "todos" | "abertos" | "aguardando" | "resolvidos";

const FILTROS: { value: FiltroRapido; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "abertos", label: "Abertos" },
  { value: "aguardando", label: "Aguardando minha resposta" },
  { value: "resolvidos", label: "Resolvidos" },
];

function correspondeAoFiltro(chamado: SuporteChamado, filtro: FiltroRapido): boolean {
  switch (filtro) {
    case "abertos":
      return !["resolvido", "fechado", "cancelado"].includes(chamado.status);
    case "aguardando":
      return chamado.status === "aguardando_usuario";
    case "resolvidos":
      return chamado.status === "resolvido" || chamado.status === "fechado";
    default:
      return true;
  }
}

/**
 * "Meus chamados" — lista dos chamados abertos pelo usuário atual (ou onde
 * ele é o responsável), visível a qualquer usuário autenticado. A RLS de
 * `suporte_chamados` já garante que só aparecem os chamados próprios (admin
 * vê todos, mas a gestão administrativa completa é uma tela separada).
 */
export default function MeusChamados() {
  const { data: chamados, isLoading } = useMeusChamados();
  const { openReportDialog } = useHelp();
  const [filtro, setFiltro] = useState<FiltroRapido>("todos");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (chamados ?? []).filter((c) => {
      if (!correspondeAoFiltro(c, filtro)) return false;
      if (termo && !c.numero.toLowerCase().includes(termo) && !c.resumo.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [chamados, filtro, busca]);

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

      {!!chamados?.length && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={filtro === f.value ? "default" : "outline"}
                onClick={() => setFiltro(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Buscar por número ou texto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="sm:w-64"
          />
        </div>
      )}

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
      ) : filtrados.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum chamado para os filtros selecionados.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((chamado) => (
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
