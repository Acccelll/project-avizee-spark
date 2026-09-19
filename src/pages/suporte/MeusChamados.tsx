import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Flag, ChevronRight } from 'lucide-react';
import { useMeusChamados } from '@/hooks/suporte/useMeusChamados';
import { useHelp } from '@/contexts/HelpContext';
import {
  SUPORTE_STATUS_LABELS,
  SUPORTE_TIPO_LABELS,
  SUPORTE_PRIORIDADE_LABELS,
} from '@/services/suporte/types';
import type { SuporteChamado, SuporteStatus } from '@/services/suporte/types';

type Filtro = 'todos' | 'abertos' | 'aguardando' | 'resolvidos';

/** Filtros rápidos da seção 17 da especificação. */
function filtrar(chamados: SuporteChamado[], filtro: Filtro): SuporteChamado[] {
  switch (filtro) {
    case 'abertos':
      return chamados.filter((c) => !['resolvido', 'fechado', 'cancelado'].includes(c.status));
    case 'aguardando':
      return chamados.filter((c) => c.status === 'aguardando_usuario');
    case 'resolvidos':
      return chamados.filter((c) => c.status === 'resolvido' || c.status === 'fechado');
    default:
      return chamados;
  }
}

const STATUS_BADGE_VARIANT: Record<SuporteStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  aberto: 'secondary',
  em_triagem: 'secondary',
  em_andamento: 'default',
  aguardando_usuario: 'destructive',
  resolvido: 'outline',
  fechado: 'outline',
  cancelado: 'outline',
};

/** "Meus chamados" — seção 17 da especificação de Ajuda/Suporte. */
export default function MeusChamados() {
  const { chamados, loading } = useMeusChamados();
  const { openReportarProblema } = useHelp();
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const filtrados = useMemo(() => filtrar(chamados, filtro), [chamados, filtro]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Meus chamados</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe os problemas, dúvidas e sugestões que você enviou.
          </p>
        </div>
        <Button onClick={openReportarProblema} className="gap-1.5">
          <Flag className="h-4 w-4" /> Reportar problema
        </Button>
      </header>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="abertos">Abertos</TabsTrigger>
          <TabsTrigger value="aguardando">Aguardando minha resposta</TabsTrigger>
          <TabsTrigger value="resolvidos">Resolvidos</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum chamado nesta categoria.</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((chamado) => (
            <Link key={chamado.id} to={`/ajuda/meus-chamados/${chamado.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="flex-row items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{chamado.numero}</span>
                      <Badge variant={STATUS_BADGE_VARIANT[chamado.status]}>
                        {SUPORTE_STATUS_LABELS[chamado.status]}
                      </Badge>
                      <Badge variant="outline">{SUPORTE_TIPO_LABELS[chamado.tipo]}</Badge>
                      {chamado.prioridade && (
                        <Badge variant="outline">{SUPORTE_PRIORIDADE_LABELS[chamado.prioridade]}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{chamado.resumo}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
