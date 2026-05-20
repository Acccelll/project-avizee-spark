import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Check } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { SocialAlerta } from '@/types/social';

const severityOrder: Record<string, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

interface SocialAlertasTabProps {
  alertas: SocialAlerta[];
  onResolve?: (alertaId: string) => Promise<void> | void;
}

export function SocialAlertasTab({ alertas, onResolve }: SocialAlertasTabProps) {
  const sorted = useMemo(
    () =>
      [...alertas].sort(
        (a, b) => (severityOrder[a.severidade] ?? 99) - (severityOrder[b.severidade] ?? 99),
      ),
    [alertas],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas operacionais</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map((alerta) => (
            <div key={alerta.id} className="rounded border p-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> {alerta.titulo}</p>
                <p className="text-xs text-muted-foreground">{alerta.descricao || 'Sem descrição'} · {formatDate(alerta.data_cadastro)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={alerta.severidade === 'critica' || alerta.severidade === 'alta' ? 'destructive' : 'secondary'}>{alerta.severidade}</Badge>
                {onResolve && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 max-sm:h-11 max-sm:w-11"
                    onClick={() => onResolve(alerta.id)}
                    title="Marcar como resolvido"
                    aria-label="Marcar como resolvido"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!sorted.length && <p className="text-sm text-muted-foreground">Nenhum alerta pendente.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
