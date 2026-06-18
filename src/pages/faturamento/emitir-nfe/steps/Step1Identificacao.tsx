import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { WizardData } from "../schema";

interface Natureza {
  codigo: string;
  descricao: string;
  cfop_dentro_uf: string | null;
  cfop_fora_uf: string | null;
  finalidade: string;
  tipo_operacao: string;
}

export function Step1Identificacao() {
  const { register, watch, setValue, formState } = useFormContext<WizardData>();
  const { data: naturezas } = useQuery({
    queryKey: ["naturezas-operacao", "ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("naturezas_operacao")
        .select("codigo, descricao, cfop_dentro_uf, cfop_fora_uf, finalidade, tipo_operacao")
        .eq("ativo", true)
        .order("descricao");
      if (error) throw error;
      return data as Natureza[];
    },
  });

  const codigoSel = watch("natureza_codigo");

  const handleNaturezaChange = (codigo: string) => {
    const n = naturezas?.find((x) => x.codigo === codigo);
    if (!n) return;
    setValue("natureza_codigo", codigo, { shouldDirty: true });
    setValue("natureza_descricao", n.descricao, { shouldDirty: true });
    setValue("finalidade", n.finalidade as WizardData["finalidade"], { shouldDirty: true });
    setValue("tipo_operacao", n.tipo_operacao as "saida" | "entrada", { shouldDirty: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identificação da NF-e</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Natureza da operação *</Label>
          <Select value={codigoSel || ""} onValueChange={handleNaturezaChange}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {(naturezas ?? []).map((n) => (
                <SelectItem key={n.codigo} value={n.codigo}>
                  {n.codigo} — {n.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formState.errors.natureza_codigo && (
            <p className="text-xs text-destructive">{formState.errors.natureza_codigo.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Tipo de operação</Label>
          <Select value={watch("tipo_operacao")} onValueChange={(v) => setValue("tipo_operacao", v as "saida" | "entrada")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Finalidade</Label>
          <Select value={watch("finalidade")} onValueChange={(v) => setValue("finalidade", v as WizardData["finalidade"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — NF-e Normal</SelectItem>
              <SelectItem value="2">2 — Complementar</SelectItem>
              <SelectItem value="3">3 — Ajuste</SelectItem>
              <SelectItem value="4">4 — Devolução</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Série</Label>
          <Input {...register("serie")} placeholder="1" />
          <p className="text-xs text-muted-foreground">
            Numeração será gerada automaticamente na transmissão.
          </p>
        </div>
        <div className="space-y-1">
          <Label>Data de emissão *</Label>
          <Input type="date" {...register("data_emissao")} />
        </div>
        <div className="space-y-1">
          <Label>Indicador de presença *</Label>
          <Select
            value={watch("indicador_presenca")}
            onValueChange={(v) => setValue("indicador_presenca", v as WizardData["indicador_presenca"], { shouldDirty: true })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 — Não se aplica</SelectItem>
              <SelectItem value="1">1 — Operação presencial</SelectItem>
              <SelectItem value="2">2 — Não presencial, internet</SelectItem>
              <SelectItem value="3">3 — Não presencial, teleatendimento</SelectItem>
              <SelectItem value="4">4 — NFC-e em entrega a domicílio</SelectItem>
              <SelectItem value="9">9 — Não presencial, outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Data de saída</Label>
          <Input type="date" {...register("data_saida")} />
          {formState.errors.data_saida && (
            <p className="text-xs text-destructive">{formState.errors.data_saida.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Hora de saída</Label>
          <Input type="time" step={1} {...register("hora_saida")} placeholder="HH:MM:SS" />
        </div>
        <div className="sm:col-span-2 rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Operação via intermediador (marketplace)</Label>
              <p className="text-xs text-muted-foreground">
                Ative para vendas via plataforma digital (NT 2020.006).
              </p>
            </div>
            <Switch
              checked={watch("via_intermediador") ?? false}
              onCheckedChange={(v) => setValue("via_intermediador", v, { shouldDirty: true })}
            />
          </div>
          {watch("via_intermediador") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">CNPJ do intermediador *</Label>
                <Input
                  {...register("intermediador_cnpj")}
                  placeholder="00000000000000"
                  maxLength={14}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Identificador do pedido na plataforma</Label>
                <Input {...register("intermediador_identificador")} placeholder="ex.: ML123456789" />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}