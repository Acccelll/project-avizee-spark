import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import type { ConciliacaoRegraAuto } from "@/types/domain";

interface RegraForm {
  id?: string;
  nome: string;
  score_minimo: string;
  tolerancia_valor: string;
  tolerancia_dias: string;
  ativo: boolean;
}

const regraPadrao: RegraForm = {
  nome: "Regra padrão",
  score_minimo: "95",
  tolerancia_valor: "0",
  tolerancia_dias: "3",
  ativo: true,
};

function toForm(regra: ConciliacaoRegraAuto | null | undefined): RegraForm {
  if (!regra) return regraPadrao;
  return {
    id: regra.id,
    nome: regra.nome,
    score_minimo: String(regra.score_minimo),
    tolerancia_valor: String(regra.tolerancia_valor),
    tolerancia_dias: String(regra.tolerancia_dias),
    ativo: regra.ativo,
  };
}

export default function ConciliacaoRegrasAutoPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RegraForm>(regraPadrao);

  const empresaQuery = useQuery({
    queryKey: ["empresa", "atual"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_empresa_id");
      if (error) throw error;
      if (!data) throw new Error("Empresa não identificada.");
      return data;
    },
  });

  const regrasQuery = useQuery({
    queryKey: ["conciliacao", "regras-auto", empresaQuery.data],
    enabled: Boolean(empresaQuery.data),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conciliacao_regras_auto")
        .select("*")
        .eq("empresa_id", empresaQuery.data as string)
        .order("ativo", { ascending: false })
        .order("score_minimo", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ConciliacaoRegraAuto[];
    },
  });

  const regraAtiva = useMemo(
    () => regrasQuery.data?.find((regra) => regra.ativo) ?? regrasQuery.data?.[0] ?? null,
    [regrasQuery.data],
  );

  useEffect(() => {
    setForm(toForm(regraAtiva));
  }, [regraAtiva]);

  const salvar = useMutation({
    mutationFn: async () => {
      const empresaId = empresaQuery.data;
      if (!empresaId) throw new Error("Empresa não identificada.");

      const payload = {
        empresa_id: empresaId,
        nome: form.nome.trim() || "Regra padrão",
        score_minimo: Number(form.score_minimo),
        tolerancia_valor: Number(form.tolerancia_valor),
        tolerancia_dias: Number(form.tolerancia_dias),
        ativo: form.ativo,
      };

      if (form.id) {
        const { error } = await supabase
          .from("conciliacao_regras_auto")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("conciliacao_regras_auto").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra de autoaprovação salva.");
      void queryClient.invalidateQueries({ queryKey: ["conciliacao", "regras-auto"] });
    },
    onError: (err) => {
      logger.error("conciliacao.regras_auto.salvar", { err });
      toast.error("Falha ao salvar regra");
    },
  });

  const updateForm = (key: keyof RegraForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <ModulePage
      title="Regras de autoaprovação"
      subtitle="Parâmetros para aprovação automática de sugestões 1:1 da conciliação bancária"
      headerActions={
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || empresaQuery.isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regra ativa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(event) => updateForm("nome", event.target.value)}
              placeholder="Regra padrão"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="score-minimo">Score mínimo</Label>
            <Input
              id="score-minimo"
              type="number"
              min="0"
              max="100"
              step="1"
              value={form.score_minimo}
              onChange={(event) => updateForm("score_minimo", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tolerancia-dias">Tolerância em dias</Label>
            <Input
              id="tolerancia-dias"
              type="number"
              min="0"
              max="30"
              step="1"
              value={form.tolerancia_dias}
              onChange={(event) => updateForm("tolerancia_dias", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tolerancia-valor">Tolerância de valor</Label>
            <Input
              id="tolerancia-valor"
              type="number"
              min="0"
              step="0.01"
              value={form.tolerancia_valor}
              onChange={(event) => updateForm("tolerancia_valor", event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="ativo">Ativa</Label>
            <Switch
              id="ativo"
              checked={form.ativo}
              onCheckedChange={(checked) => updateForm("ativo", checked)}
            />
          </div>
        </CardContent>
      </Card>
    </ModulePage>
  );
}