import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/useDebounce";
import { FORMA_PAGAMENTO, type WizardData } from "../schema";

interface TransportadoraRow {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string | null;
  uf: string | null;
}

function TransportadoraPicker() {
  const { setValue, watch } = useFormContext<WizardData>();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(busca, 300);

  const transportadoraNome = watch("transportadora_nome");

  const { data, isFetching } = useQuery({
    queryKey: ["transportadoras-busca", debounced],
    queryFn: async () => {
      let q = supabase
        .from("fornecedores")
        .select("id, nome_razao_social, cpf_cnpj, uf")
        .eq("ativo", true)
        .eq("transportadora", true)
        .order("nome_razao_social")
        .limit(20);
      if (debounced) {
        q = q.or(`nome_razao_social.ilike.%${debounced}%,cpf_cnpj.ilike.%${debounced}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as TransportadoraRow[];
    },
    enabled: open,
  });

  const selecionar = (t: TransportadoraRow) => {
    setValue("transportadora_id", t.id, { shouldDirty: true });
    setValue("transportadora_nome", t.nome_razao_social, { shouldDirty: true });
    setValue("transportadora_cnpj", t.cpf_cnpj ?? "", { shouldDirty: true });
    setOpen(false);
  };

  const limpar = () => {
    setValue("transportadora_id", null, { shouldDirty: true });
    setValue("transportadora_nome", "", { shouldDirty: true });
    setValue("transportadora_cnpj", "", { shouldDirty: true });
  };

  return (
    <div className="space-y-1 sm:col-span-2">
      <Label>Transportadora</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex-1 justify-between">
              {transportadoraNome || "Selecionar transportadora…"}
              <Truck className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Nome ou CNPJ…" value={busca} onValueChange={setBusca} />
              <CommandList>
                {isFetching && <p className="p-3 text-xs text-muted-foreground">Buscando…</p>}
                <CommandEmpty>
                  Nenhuma transportadora cadastrada. Marque o flag “transportadora” no fornecedor.
                </CommandEmpty>
                <CommandGroup>
                  {(data ?? []).map((t) => (
                    <CommandItem key={t.id} value={t.id} onSelect={() => selecionar(t)}>
                      <div className="flex flex-col">
                        <span className="font-medium">{t.nome_razao_social}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.cpf_cnpj ?? "—"} · {t.uf ?? "?"}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {transportadoraNome && (
          <Button variant="ghost" size="sm" onClick={limpar}>Limpar</Button>
        )}
      </div>
    </div>
  );
}

export function Step4Transporte() {
  const { register, watch, setValue } = useFormContext<WizardData>();
  const modal = watch("frete_modalidade");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transporte e pagamento</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Modalidade do frete</Label>
          <Select value={watch("frete_modalidade")} onValueChange={(v) => setValue("frete_modalidade", v as WizardData["frete_modalidade"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 — Por conta do emitente</SelectItem>
              <SelectItem value="1">1 — Por conta do destinatário</SelectItem>
              <SelectItem value="2">2 — Por conta de terceiros</SelectItem>
              <SelectItem value="3">3 — Transp. próprio do emitente</SelectItem>
              <SelectItem value="4">4 — Transp. próprio do destinatário</SelectItem>
              <SelectItem value="9">9 — Sem transporte</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Valor do frete</Label>
          <Input type="number" step="0.01" {...register("frete_valor")} />
        </div>
        {modal !== "9" && (
          <>
            <TransportadoraPicker />
            <div className="sm:col-span-2 -mt-2">
              <p className="text-xs text-muted-foreground">
                Transportadora não encontrada?{" "}
                <a
                  href="/logistica?tab=transportadoras"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-medium"
                >
                  Cadastrar nova transportadora →
                </a>
              </p>
            </div>
            <div className="space-y-1">
              <Label>Placa do veículo</Label>
              <Input
                {...register("veiculo_placa")}
                placeholder="ABC1D23"
                maxLength={8}
                style={{ textTransform: "uppercase" }}
              />
            </div>
            <div className="space-y-1">
              <Label>UF do veículo</Label>
              <Input
                {...register("veiculo_uf")}
                placeholder="SP"
                maxLength={2}
                style={{ textTransform: "uppercase" }}
              />
            </div>
          </>
        )}
        <div className="space-y-1">
          <Label>Outras despesas</Label>
          <Input type="number" step="0.01" {...register("outras_despesas")} />
        </div>
        <div className="space-y-1">
          <Label>Desconto</Label>
          <Input type="number" step="0.01" {...register("desconto_valor")} />
        </div>
        <div className="space-y-1">
          <Label>Forma de pagamento</Label>
          <Select value={watch("forma_pagamento")} onValueChange={(v) => setValue("forma_pagamento", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMA_PAGAMENTO.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Observações / Informações complementares</Label>
          <Textarea rows={3} {...register("observacoes")} placeholder="Texto livre que entra em infCpl…" />
        </div>
      </CardContent>
    </Card>
  );
}