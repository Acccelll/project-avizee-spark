import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DadosGerais } from "./DadosGerais";
import { ItensNFe } from "./ItensNFe";
import { ImpostosNFe } from "./ImpostosNFe";
import { TransporteNFe } from "./TransporteNFe";
import { nfeSchema } from "./schema";
import type { NFeFormData } from "./schema";

export interface NFeFormProps {
  defaultValues?: Partial<NFeFormData>;
  onSubmit: (data: NFeFormData) => void;
  disabled?: boolean;
}

export function NFeForm({ defaultValues, onSubmit, disabled }: NFeFormProps) {
  const form = useForm<NFeFormData>({
    resolver: zodResolver(nfeSchema),
    defaultValues: {
      serie: "1",
      tipoOperacao: "saida",
      freteModalidade: "9",
      freteValor: 0,
      descontoValor: 0,
      outrasDespesas: 0,
      itens: [],
      ...defaultValues,
    },
  });

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <h3 className="text-base font-semibold">Dados Gerais</h3>
            <Separator className="my-2" />
            <DadosGerais disabled={disabled} />
          </div>

          <div>
            <h3 className="text-base font-semibold">Itens</h3>
            <Separator className="my-2" />
            <ItensNFe disabled={disabled} />
          </div>

          <div>
            <h3 className="text-base font-semibold">Transporte e Valores</h3>
            <Separator className="my-2" />
            <TransporteNFe disabled={disabled} />
          </div>

          <ImpostosNFe disabled={disabled} />

          {!disabled && (
            <div className="flex justify-end gap-2">
              <Button type="submit">Salvar NF-e</Button>
            </div>
          )}
        </form>
      </Form>
    </FormProvider>
  );
}
