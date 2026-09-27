import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";
import { StatusStepper } from "./StatusStepper";

interface Props {
  register: UseFormRegister<OrcamentoFormValues>;
  control: Control<OrcamentoFormValues>;
  fieldErrors: FieldErrors<OrcamentoFormValues>;
  numero: string;
  status: string;
  id?: string;
  isLocked: boolean;
  statusOptions: { value: string; label: string }[];
}

/** Card de identificação do orçamento — número, data, status e validade. */
export function IdentificacaoCard({
  register, control, numero, status, id, isLocked, statusOptions,
}: Props) {
  return (
    <div className="bg-card rounded-xl border shadow-soft p-5">
      <h3 className="font-semibold text-foreground mb-4">Identificação do Orçamento</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="orcamento-numero">Nº Orçamento</Label>
          {/* O número é gerado pelo banco ao salvar; aqui só é exibido. */}
          <Input
            id="orcamento-numero"
            {...register('numero')}
            readOnly
            tabIndex={-1}
            placeholder="Gerado ao salvar"
            className="font-mono bg-muted/40"
          />
          {!id && (
            <p className="text-[11px] text-muted-foreground">
              {numero ? "Previsto · o número definitivo é gerado ao salvar." : "Gerado ao salvar."}
            </p>
          )}
        </div>
        <div className="space-y-1.5"><Label className="text-xs">Data de Emissão</Label><Input type="date" {...register('dataOrcamento')} /></div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isLocked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <StatusStepper status={status} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Validade</Label>
          <Input type="date" {...register('validade')} />
          <p className="text-[11px] text-muted-foreground">Data limite para o cliente aceitar.</p>
        </div>
      </div>
    </div>
  );
}
