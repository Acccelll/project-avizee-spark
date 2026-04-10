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
import type { NFeFormData } from "./schema";

interface TransporteNFeProps {
  disabled?: boolean;
}

export function TransporteNFe({ disabled }: TransporteNFeProps) {
  const { control } = useFormContext<NFeFormData>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <FormField
        control={control}
        name="freteModalidade"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Modalidade do Frete</FormLabel>
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
                <SelectItem value="0">0 – Por conta do emitente (CIF)</SelectItem>
                <SelectItem value="1">1 – Por conta do destinatário (FOB)</SelectItem>
                <SelectItem value="2">2 – Por conta de terceiros</SelectItem>
                <SelectItem value="3">3 – Próprio por conta do remetente</SelectItem>
                <SelectItem value="4">4 – Próprio por conta do destinatário</SelectItem>
                <SelectItem value="9">9 – Sem ocorrência de transporte</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="freteValor"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Valor do Frete (R$)</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                step="0.01"
                min={0}
                disabled={disabled}
                placeholder="0,00"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="descontoValor"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Desconto (R$)</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                step="0.01"
                min={0}
                disabled={disabled}
                placeholder="0,00"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
