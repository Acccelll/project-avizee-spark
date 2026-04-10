import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, CartesianGrid, Bar } from 'recharts';

interface ComparativoItem {
  plataforma: string;
  seguidores_novos: number;
  alcance: number;
}

export function SocialMetricasTab({ historicoComparativo }: { historicoComparativo: ComparativoItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução de seguidores e engajamento</CardTitle>
        <CardDescription>Comparativo Instagram x LinkedIn no período selecionado.</CardDescription>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={historicoComparativo}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="plataforma" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="seguidores_novos" fill="hsl(var(--primary))" name="Seguidores novos" />
            <Bar dataKey="alcance" fill="hsl(var(--secondary))" name="Alcance" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
