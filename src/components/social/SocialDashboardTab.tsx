import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatNumber } from '@/lib/format';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SocialPost } from '@/types/social';
import { EmptyState } from '@/components/ui/empty-state';
import { Plug, TrendingUp, Activity, BarChart2 } from 'lucide-react';
import { SummaryCard } from '@/components/SummaryCard';

interface Props {
  historicoComparativo: Array<{ plataforma: string; seguidores_novos: number; taxa_engajamento_media: number }>;
  melhoresPosts: SocialPost[];
  pioresPosts: SocialPost[];
  growthPercent: number;
  postingFrequency: number;
  contentDistribution: Array<{ tipo: string; total: number }>;
  trendLabel: 'alta' | 'estavel' | 'queda';
}

export function SocialDashboardTab({
  historicoComparativo,
  melhoresPosts,
  pioresPosts,
  growthPercent,
  postingFrequency,
  contentDistribution,
  trendLabel,
}: Props) {
  // Sem contas conectadas / sem dados no período → CTA dedicado em vez de zeros.
  if (!historicoComparativo.length) {
    return (
      <Card>
        <CardContent className="py-2">
          <EmptyState
            variant="firstUse"
            icon={Plug}
            title="Conecte uma conta para ver métricas"
            description="Sem contas conectadas, o dashboard fica vazio. Vá para a aba Contas conectadas e conecte um perfil do Instagram ou LinkedIn."
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <SummaryCard
          title="Crescimento no período"
          value={`${growthPercent.toFixed(2)}%`}
          subtitle="vs período anterior equivalente"
          icon={TrendingUp}
          variant={growthPercent >= 0 ? 'success' : 'danger'}
          density="compact"
        />
        <SummaryCard
          title="Frequência de postagem"
          value={`${postingFrequency.toFixed(2)} / dia`}
          subtitle="média no filtro ativo"
          icon={Activity}
          density="compact"
        />
        <SummaryCard
          title="Tendência"
          value={trendLabel}
          subtitle="comparativo de engajamento"
          icon={BarChart2}
          variant={trendLabel === 'alta' ? 'success' : trendLabel === 'queda' ? 'danger' : 'default'}
          density="compact"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Crescimento de seguidores por rede</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicoComparativo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plataforma" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="seguidores_novos" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {contentDistribution.map((item) => (
                <div key={item.tipo} className="flex items-center justify-between text-sm border rounded p-2">
                  <span className="capitalize">{item.tipo}</span>
                  <Badge variant="outline">{item.total}</Badge>
                </div>
              ))}
              {!contentDistribution.length && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Top posts (engajamento)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {melhoresPosts.slice(0, 3).map((post, i) => (
                <div key={post.id ?? i} className="rounded border p-3">
                  <p className="font-medium text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                    {post.titulo_legenda || 'Sem título'}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(post.data_publicacao)} · {post.tipo_post}</p>
                  <p className="text-xs mt-2">Engajamento: <strong>{formatNumber(post.engajamento_total || 0)}</strong></p>
                </div>
              ))}
              {melhoresPosts.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem postagens no período.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pior post</CardTitle></CardHeader>
          <CardContent>
            {pioresPosts[0] ? (
              <div className="rounded border p-3">
                <p className="font-medium text-sm">{pioresPosts[0].titulo_legenda || 'Sem título'}</p>
                <p className="text-xs text-muted-foreground">{formatDate(pioresPosts[0].data_publicacao)} · {pioresPosts[0].tipo_post}</p>
                <p className="text-xs mt-2">Engajamento: <strong>{formatNumber(pioresPosts[0].engajamento_total || 0)}</strong></p>
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem postagens no período.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
