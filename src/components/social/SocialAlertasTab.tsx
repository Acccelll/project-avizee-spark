import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { SocialAlerta } from '@/types/social';

export function SocialAlertasTab({ alertas }: { alertas: SocialAlerta[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas operacionais</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <div key={alerta.id} className="rounded border p-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> {alerta.titulo}</p>
                <p className="text-xs text-muted-foreground">{alerta.descricao || 'Sem descrição'} · {formatDate(alerta.data_cadastro)}</p>
              </div>
              <Badge variant={alerta.severidade === 'critica' || alerta.severidade === 'alta' ? 'destructive' : 'secondary'}>{alerta.severidade}</Badge>
            </div>
          ))}
          {!alertas.length && <p className="text-sm text-muted-foreground">Nenhum alerta pendente.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
