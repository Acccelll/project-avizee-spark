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

export interface IcmsFormProps {
  control: Control<NFeFormData>;
  itemIndex: number;
  disabled?: boolean;
}

export function IcmsForm({ control, itemIndex, disabled }: IcmsFormProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <FormField
        control={control}
        name={`itens.${itemIndex}.cst`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>CST ICMS</FormLabel>
            <FormControl>
              <Input {...field} disabled={disabled} placeholder="00" maxLength={3} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`itens.${itemIndex}.icmsBase`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Base ICMS (R$)</FormLabel>
            <FormControl>
              <Input {...field} type="number" step="0.01" min={0} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`itens.${itemIndex}.icmsAliquota`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Alíquota ICMS (%)</FormLabel>
            <FormControl>
              <Input {...field} type="number" step="0.01" min={0} max={100} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`itens.${itemIndex}.icmsValor`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Valor ICMS (R$)</FormLabel>
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
