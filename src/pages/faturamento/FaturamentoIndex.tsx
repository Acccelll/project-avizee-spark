import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Send,
  PackageCheck,
  FolderCog,
  FileSearch,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCan } from "@/hooks/useCan";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hub do módulo Faturamento.
 *
 * Substitui o antigo placeholder "Em breve" por 4 atalhos canônicos cobertos
 * por permissão `faturamento_fiscal:*`. Cards desabilitados (sem permissão)
 * permanecem visíveis para preservar a estrutura de navegação.
 */
interface HubCard {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  action: "visualizar" | "criar" | "editar";
  cta: string;
}

const CARDS: HubCard[] = [
  {
    title: "Emitir NF-e",
    description:
      "Wizard de emissão de NF-e a partir de pedidos aprovados ou notas avulsas, com pré-validação e transmissão SEFAZ.",
    icon: Send,
    path: "/faturamento/emitir",
    action: "criar",
    cta: "Iniciar emissão",
  },
  {
    title: "Backlog de faturamento",
    description:
      "Pedidos aprovados elegíveis para gerar NF-e — fila ordenada por SLA com atalho direto para o wizard.",
    icon: PackageCheck,
    path: "/faturamento/backlog",
    action: "visualizar",
    cta: "Abrir backlog",
  },
  {
    title: "Cadastros fiscais",
    description:
      "Configuração de empresa emitente, certificado A1, ambiente SEFAZ e DistDF-e.",
    icon: FolderCog,
    path: "/faturamento/cadastros",
    action: "editar",
    cta: "Configurar",
  },
  {
    title: "Consulta de documentos",
    description:
      "Busca de NF-e por chave, número, cliente ou status SEFAZ — com replicação de XML/DANFE.",
    icon: FileSearch,
    path: "/faturamento/documentos",
    action: "visualizar",
    cta: "Consultar",
  },
];

export default function FaturamentoIndex() {
  const navigate = useNavigate();
  const { can } = useCan();

  // Count do backlog para badge visual no card correspondente.
  const { data: backlogCount } = useQuery({
    queryKey: ["faturamento-backlog-count-hub"],
    queryFn: async () => {
      const { count } = await supabase
        .from("ordens_venda")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .in("status_faturamento", ["pendente", "parcial"])
        .in("status", ["aprovado", "em_separacao", "separado", "em_producao"]);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Faturamento</h1>
        <p className="text-sm text-muted-foreground">
          Centralize emissão, backlog e consulta de notas fiscais eletrônicas.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2" data-help-id="faturamento.cards">
        {CARDS.map((card) => {
          const allowed = can(`faturamento_fiscal:${card.action}` as never);
          const Icon = card.icon;
          const showBacklogBadge =
            card.path === "/faturamento/backlog" &&
            typeof backlogCount === "number" &&
            backlogCount > 0;
          const buttonEl = (
            <Button
              variant="secondary"
              className="w-full justify-between"
              disabled={!allowed}
              onClick={() => navigate(card.path)}
            >
              {allowed ? card.cta : "Sem permissão"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          );
          return (
            <Card key={card.path} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base flex-1">{card.title}</CardTitle>
                  {showBacklogBadge && (
                    <Badge variant="destructive">{backlogCount}</Badge>
                  )}
                </div>
                <CardDescription className="pt-2">{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                {allowed ? (
                  buttonEl
                ) : (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block w-full">{buttonEl}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Permissão necessária:{" "}
                        <code>faturamento_fiscal:{card.action}</code>.
                        Solicite ao administrador do sistema.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
