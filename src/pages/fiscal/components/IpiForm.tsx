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

export interface IpiFormProps {
  control: Control<NFeFormData>;
  itemIndex: number;
  disabled?: boolean;
}

export function IpiForm({ control, itemIndex, disabled }: IpiFormProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
      <FormField
        control={control}
        name={`itens.${itemIndex}.ipiAliquota`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Alíquota IPI (%)</FormLabel>
            <FormControl>
              <Input {...field} type="number" step="0.01" min={0} max={100} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`itens.${itemIndex}.ipiValor`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Valor IPI (R$)</FormLabel>
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
