import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";
import { existeOrcamentoComNumero } from "@/services/orcamentos.service";
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
  register, control, fieldErrors, numero, status, id, isLocked, statusOptions,
}: Props) {
  return (
    <div className="bg-card rounded-xl border shadow-soft p-5">
      <h3 className="font-semibold text-foreground mb-4">Identificação do Orçamento</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Nº Orçamento</Label>
          <div className="relative">
            <Input
              {...register('numero')}
              onBlur={async (e) => {
                const val = e.target.value?.trim();
                if (!val) return;
                const existe = await existeOrcamentoComNumero(val, id || null).catch(() => false);
                if (existe) {
                  toast.error('Este número de orçamento já está em uso. Escolha outro.');
                }
              }}
              className={`font-mono pr-8 ${fieldErrors.numero ? "border-destructive" : numero ? "border-success" : ""}`}
            />
            {numero && !fieldErrors.numero && <CheckCircle2 className="h-4 w-4 text-success absolute right-2 top-1/2 -translate-y-1/2" />}
            {fieldErrors.numero && <AlertTriangle className="h-4 w-4 text-destructive absolute right-2 top-1/2 -translate-y-1/2" />}
          </div>
          {fieldErrors.numero && <p className="text-[11px] text-destructive">{fieldErrors.numero.message}</p>}
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
