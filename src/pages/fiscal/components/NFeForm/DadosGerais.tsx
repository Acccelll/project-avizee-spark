import { useFormContext } from "react-hook-form";
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

export function DadosGerais({ disabled }: DadosGeraisProps) {
  const { control } = useFormContext<NFeFormData>();

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
