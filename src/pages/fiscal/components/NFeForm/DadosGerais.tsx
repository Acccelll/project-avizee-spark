import { useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NFeFormData } from "./schema";

interface DadosGeraisProps {
  disabled?: boolean;
}

async function verificarNumeroDuplicado(numero: string, serie: string): Promise<boolean> {
  if (!numero || !serie) return false;
  const { data } = await supabase
    .from("notas_fiscais")
    .select("id")
    .eq("numero", numero)
    .eq("serie", serie)
    .eq("ativo", true)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export function DadosGerais({ disabled }: DadosGeraisProps) {
  const { control, setError, clearErrors } = useFormContext<NFeFormData>();
  const numero = useWatch({ control, name: "numero" });
  const serie = useWatch({ control, name: "serie" });

  useQuery({
    queryKey: ["nfe-duplicado", numero, serie],
    queryFn: async () => {
      const duplicado = await verificarNumeroDuplicado(numero ?? "", serie ?? "");
      if (duplicado) {
        setError("numero", { type: "manual", message: "Número já utilizado nesta série" });
      } else {
        clearErrors("numero");
      }
      return duplicado;
    },
    enabled: !!(numero && numero.length > 0 && serie),
    staleTime: 0,
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <FormField
        control={control}
        name="dataEmissao"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Data de Emissão</FormLabel>
            <FormControl>
              <Input type="date" {...field} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="serie"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Série</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} maxLength={3} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="numero"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Número</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} placeholder="Gerado automaticamente" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="naturezaOperacao"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Natureza da Operação</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} placeholder="Ex: Venda de mercadoria" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="cfop"
        render={({ field }) => (
          <FormItem>
            <FormLabel>CFOP</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} maxLength={4} placeholder="5102" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="tipoOperacao"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Operação</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="formaPagamento"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Forma de Pagamento</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} placeholder="Ex: À vista" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="observacoes"
        render={({ field }) => (
          <FormItem className="md:col-span-2 lg:col-span-3">
            <FormLabel>Observações</FormLabel>
            <FormControl>
              <Textarea {...field} disabled={disabled} rows={3} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
