import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import type { NFeFormData } from "./schema";

interface ItensNFeProps {
  disabled?: boolean;
}

const ITEM_PADRAO = {
  produto_id: undefined,
  descricao: "",
  ncm: "",
  cfop: "",
  cst: "",
  unidade: "UN",
  quantidade: 1,
  valorUnitario: 0,
  valorTotal: 0,
  icmsAliquota: 0,
  icmsBase: 0,
  icmsValor: 0,
  ipiAliquota: 0,
  ipiValor: 0,
  pisAliquota: 0.65,
  pisValor: 0,
  cofinsAliquota: 3,
  cofinsValor: 0,
};

export function ItensNFe({ disabled }: ItensNFeProps) {
  const { control } = useFormContext<NFeFormData>();
  const { fields, append, remove } = useFieldArray({ control, name: "itens" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Itens da NF-e</h3>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(ITEM_PADRAO)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Item
          </Button>
        )}
      </div>

      {fields.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nenhum item adicionado. Clique em "Adicionar Item" para começar.
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="rounded-md border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Item {index + 1}</span>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <FormField
              control={control}
              name={`itens.${index}.descricao`}
              render={({ field: f }) => (
                <FormItem className="col-span-2">
                  <FormControl>
                    <Input {...f} disabled={disabled} placeholder="Descrição do produto" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`itens.${index}.ncm`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} disabled={disabled} placeholder="NCM (8 dígitos)" maxLength={8} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`itens.${index}.cfop`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} disabled={disabled} placeholder="CFOP" maxLength={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`itens.${index}.unidade`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} disabled={disabled} placeholder="UN" maxLength={6} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`itens.${index}.quantidade`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} type="number" disabled={disabled} placeholder="Qtd" min={0} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`itens.${index}.valorUnitario`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} type="number" disabled={disabled} placeholder="Vl. Unitário" step="0.01" min={0} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`itens.${index}.valorTotal`}
              render={({ field: f }) => (
                <FormItem>
                  <FormControl>
                    <Input {...f} type="number" disabled={disabled} placeholder="Vl. Total" step="0.01" min={0} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
