import { useCallback, useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/ModulePage";
import { SummaryCard } from "@/components/SummaryCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Wand2, PlusCircle, TrendingUp, LineChart as LineIcon } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { carregarMetricasMatching } from "@/services/financeiro/matching/aprendizadoMetricas.service";
import { logger } from "@/lib/logger";

const isoInicioMes = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const isoHoje = () => new Date().toISOString().slice(0, 10);

function useEmpresaId() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("user_empresas")
        .select("empresa_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (alive) setEmpresaId(data?.empresa_id ?? null);
    })();
    return () => { alive = false; };
  }, []);
  return empresaId;
}

export default function MatchingAprendizado() {
  const empresaId = useEmpresaId();
  const [dataInicio, setDataInicio] = useState(isoInicioMes());
  const [dataFim, setDataFim] = useState(isoHoje());

  const queryFn = useCallback(async () => {
    if (!empresaId) return null;
    try {
      return await carregarMetricasMatching({ empresaId, dataInicio, dataFim });
    } catch (err) {
      logger.warn("[matching-aprendizado] falha ao carregar métricas:", err);
      throw err;
    }
  }, [empresaId, dataInicio, dataFim]);

  const { data, isLoading } = useQuery({
    queryKey: ["matching-metricas", empresaId, dataInicio, dataFim],
    queryFn,
    enabled: !!empresaId,
    staleTime: 60_000,
  });

  const resumo = data?.resumo;
  const serie = data?.serie ?? [];

  const acuraciaLabel = useMemo(() => {
    if (resumo?.acuracia == null) return "—";
    return `${(resumo.acuracia * 100).toFixed(1)}%`;
  }, [resumo?.acuracia]);
  const scoreLabel = useMemo(() => {
    if (resumo?.scoreMedio == null) return "—";
    return `${(resumo.scoreMedio * 100).toFixed(0)}%`;
  }, [resumo?.scoreMedio]);

  return (
    <ModulePage
      title="Aprendizado do Motor de Matching"
      subtitle="Métricas de sugestões aceitas, corrigidas e rejeitadas na conciliação bancária"
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="dt-inicio" className="text-xs">Início</Label>
          <Input id="dt-inicio" type="date" className="h-9 w-[160px]"
            value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="dt-fim" className="text-xs">Fim</Label>
          <Input id="dt-fim" type="date" className="h-9 w-[160px]"
            value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard title="Sugestões aceitas" value={resumo?.aceita ?? 0}
            subtitle={`${resumo?.total ?? 0} eventos no período`}
            variant="success" icon={CheckCircle2} />
          <SummaryCard title="Corrigidas manualmente" value={resumo?.corrigida ?? 0}
            subtitle="usuário trocou o alvo" variant="warning" icon={Wand2} />
          <SummaryCard title="Rejeitadas" value={resumo?.rejeitada ?? 0}
            subtitle="sugestão descartada" variant="danger" icon={XCircle} />
          <SummaryCard title="Criadas inline" value={resumo?.criada_inline ?? 0}
            subtitle="novo lançamento pelo extrato" variant="info" icon={PlusCircle} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SummaryCard title="Acurácia" value={acuraciaLabel}
          subtitle="aceitas / (aceitas + corrigidas + rejeitadas)"
          variant="info" icon={TrendingUp} />
        <SummaryCard title="Score médio das sugestões" value={scoreLabel}
          subtitle="confiança média oferecida pelo motor"
          variant="default" icon={LineIcon} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução diária</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {serie.length === 0 ? (
            <EmptyState variant="noResults" icon={LineIcon}
              title="Sem feedback no período"
              description="Aceite, corrija ou rejeite sugestões na conciliação para alimentar o motor." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="aceita" stackId="a" fill="hsl(var(--success))" name="Aceitas" />
                <Bar dataKey="corrigida" stackId="a" fill="hsl(var(--warning))" name="Corrigidas" />
                <Bar dataKey="rejeitada" stackId="a" fill="hsl(var(--destructive))" name="Rejeitadas" />
                <Bar dataKey="criada_inline" stackId="a" fill="hsl(var(--info))" name="Criadas inline" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </ModulePage>
  );
}