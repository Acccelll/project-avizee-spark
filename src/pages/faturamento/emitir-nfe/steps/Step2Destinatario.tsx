import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/useDebounce";
import { useMunicipioIbge } from "@/hooks/useMunicipioIbge";
import type { WizardData } from "../schema";

interface ClienteRow {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string | null;
  uf: string | null;
  cidade: string | null;
  codigo_ibge_municipio: string | null;
  inscricao_estadual: string | null;
  ativo: boolean;
}

export function Step2Destinatario() {
  const { setValue, watch, formState } = useFormContext<WizardData>();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [resolvendoIbge, setResolvendoIbge] = useState(false);
  const debouncedBusca = useDebounce(busca, 300);
  const { buscar: buscarIbge } = useMunicipioIbge();

  const clienteId = watch("cliente_id");
  const clienteNome = watch("cliente_nome");
  const clienteIbge = watch("cliente_municipio_ibge");

  const { data: clientes, isFetching } = useQuery({
    queryKey: ["clientes-busca-wizard", debouncedBusca],
    queryFn: async () => {
      let q = supabase
        .from("clientes")
        .select("id, nome_razao_social, cpf_cnpj, uf, cidade, codigo_ibge_municipio, inscricao_estadual, ativo")
        .eq("ativo", true)
        .order("nome_razao_social")
        .limit(20);
      if (debouncedBusca) {
        q = q.or(`nome_razao_social.ilike.%${debouncedBusca}%,cpf_cnpj.ilike.%${debouncedBusca}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as ClienteRow[];
    },
    enabled: open,
  });

  const selecionar = async (c: ClienteRow) => {
    setValue("cliente_id", c.id, { shouldDirty: true });
    setValue("cliente_nome", c.nome_razao_social, { shouldDirty: true });
    setValue("cliente_uf", (c.uf ?? "").toUpperCase(), { shouldDirty: true });
    setValue("cliente_municipio_ibge", c.codigo_ibge_municipio ?? "", { shouldDirty: true });
    setOpen(false);

    if (!c.codigo_ibge_municipio && c.cidade && c.uf) {
      setResolvendoIbge(true);
      try {
        const m = await buscarIbge(c.cidade, c.uf);
        if (m) {
          setValue("cliente_municipio_ibge", m.codigo_ibge, { shouldDirty: true });
          await supabase
            .from("clientes")
            .update({ codigo_ibge_municipio: m.codigo_ibge, municipio_nome: m.nome })
            .eq("id", c.id);
          toast.success(`Código IBGE ${m.codigo_ibge} (${m.nome}) preenchido automaticamente`);
        } else {
          toast.warning("Não foi possível resolver o código IBGE — preencha manualmente.");
        }
      } finally {
        setResolvendoIbge(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Destinatário</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Cliente *</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {clienteNome || "Selecionar cliente…"}
                <User className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Buscar por nome ou CNPJ…" value={busca} onValueChange={setBusca} />
                <CommandList>
                  {isFetching && <p className="p-3 text-xs text-muted-foreground">Buscando…</p>}
                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    {(clientes ?? []).map((c) => (
                      <CommandItem key={c.id} value={c.id} onSelect={() => selecionar(c)}>
                        <div className="flex flex-col">
                          <span className="font-medium">{c.nome_razao_social}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.cpf_cnpj ?? "—"} · {c.cidade ?? "?"}/{c.uf ?? "?"}
                            {!c.codigo_ibge_municipio && " · ⚠ sem IBGE"}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {formState.errors.cliente_id && (
            <p className="text-xs text-destructive">{formState.errors.cliente_id.message}</p>
          )}
        </div>

        {clienteId && (
          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">UF destino</p>
              <p className="font-mono">{watch("cliente_uf") || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Código IBGE</p>
              <p className="font-mono">
                {resolvendoIbge ? "Resolvendo…" : clienteIbge || (
                  <span className="text-destructive">— pendente</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              {clienteIbge && clienteIbge.length >= 7 ? (
                <Badge variant="default">Pronto para emissão</Badge>
              ) : (
                <Badge variant="destructive">Bloqueado</Badge>
              )}
            </div>
          </div>
        )}

        {formState.errors.cliente_municipio_ibge && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Código IBGE obrigatório</AlertTitle>
            <AlertDescription>
              Atualize o cadastro do cliente com o código IBGE do município
              ({" "}
              <a className="underline" href="/clientes" target="_blank" rel="noreferrer">
                abrir cadastro
              </a>
              ).
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}