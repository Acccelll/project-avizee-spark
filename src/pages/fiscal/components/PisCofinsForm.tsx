import type { Control } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { NFeFormData } from "./NFeForm/schema";

export interface PisCofinsFormProps {
  control: Control<NFeFormData>;
  itemIndex: number;
  disabled?: boolean;
}

export function PisCofinsForm({ control, itemIndex, disabled }: PisCofinsFormProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <FormField
        control={control}
        name={`itens.${itemIndex}.pisAliquota`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Alíquota PIS (%)</FormLabel>
            <FormControl>
              <Input {...field} type="number" step="0.01" min={0} max={100} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`itens.${itemIndex}.pisValor`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Valor PIS (R$)</FormLabel>
            <FormControl>
              <Input {...field} type="number" step="0.01" min={0} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`itens.${itemIndex}.cofinsAliquota`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Alíquota COFINS (%)</FormLabel>
            <FormControl>
              <Input {...field} type="number" step="0.01" min={0} max={100} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`itens.${itemIndex}.cofinsValor`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Valor COFINS (R$)</FormLabel>
            <FormControl>
              <Input {...field} type="number" step="0.01" min={0} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
