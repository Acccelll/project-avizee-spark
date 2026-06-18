import { CheckCircle2, FileText, Lock } from "lucide-react";
import type { UseFormRegister } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { MobileSection } from "./MobileSection";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";

interface ObservacoesSectionProps {
  register: UseFormRegister<OrcamentoFormValues>;
  isLocked: boolean;
}

/** Bloco de observações (públicas + internas) do formulário de orçamento. */
export function ObservacoesSection({ register, isLocked }: ObservacoesSectionProps) {
  return (
    <MobileSection title="Observações" icon={FileText} defaultOpen={false}>
      <div className="bg-card rounded-xl border shadow-soft p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-foreground mb-3">Observações do Orçamento</h3>
          <Textarea
            {...register("observacoes")}
            disabled={isLocked}
            placeholder="Texto livre para observações comerciais, instruções, validade, condições extras, etc."
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-success shrink-0" aria-hidden />
            Este texto <strong>aparecerá</strong> no PDF e no link enviado ao cliente.
          </p>
        </div>
        <div className="border-t pt-4">
          <h3 className="font-semibold text-foreground mb-1">Observações Internas</h3>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
            Uso exclusivo da equipe — <strong>não aparece</strong> para o cliente, no PDF nem no link público.
          </p>
          <Textarea
            {...register("observacoesInternas")}
            disabled={isLocked}
            placeholder="Notas internas: margem, estratégia de negociação, alertas para a equipe, etc."
            className="min-h-[80px] border-dashed"
          />
        </div>
      </div>
    </MobileSection>
  );
}