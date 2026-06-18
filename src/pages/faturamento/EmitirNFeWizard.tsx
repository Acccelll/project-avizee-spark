import { useNavigate } from "react-router-dom";
import { FormProvider } from "react-hook-form";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { STEPS } from "./emitir-nfe/schema";
import { Stepper } from "./emitir-nfe/Stepper";
import { Step1Identificacao } from "./emitir-nfe/steps/Step1Identificacao";
import { Step2Destinatario } from "./emitir-nfe/steps/Step2Destinatario";
import { Step3Itens } from "./emitir-nfe/steps/Step3Itens";
import { Step4Transporte } from "./emitir-nfe/steps/Step4Transporte";
import { Step5Revisao } from "./emitir-nfe/steps/Step5Revisao";
import { useEmitirNFe } from "./emitir-nfe/useEmitirNFe";

/**
 * /faturamento/emitir — Wizard NF-e em 5 passos.
 *
 * Shell do wizard. Toda a lógica vive em:
 *   - `./emitir-nfe/useEmitirNFe.ts`   — orquestração (form/totais/nav/save);
 *   - `./emitir-nfe/steps/*`           — UI de cada passo;
 *   - `@/services/fiscal/emitirNfe/*`  — loaders + buildPayload + persistência.
 *
 * Salva como rascunho em `notas_fiscais` (status_sefaz='nao_enviada') e
 * redireciona para `/fiscal/:id` onde o usuário transmite via
 * `SefazAcoesPanel` já existente. Não duplica a lógica de XML/SEFAZ —
 * apenas guia a entrada de dados aplicando matriz fiscal e IBGE.
 *
 * Comportamento idêntico ao monólito anterior (Etapa 6.2 da refatoração).
 */
export default function EmitirNFeWizard() {
  const navigate = useNavigate();
  const { form, step, setStep, saving, totalNF, next, prev, salvarRascunho } = useEmitirNFe();

  return (
    <ModulePage
      title="Emitir NF-e"
      subtitle="Wizard guiado em 5 passos com aplicação automática da matriz fiscal"
      headerActions={
        <Button variant="outline" onClick={() => navigate("/faturamento")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      }
    >
      <FormProvider {...form}>
        <div className="space-y-4">
          <Stepper current={step} onStepClick={(n) => setStep(n)} />

          {step === 0 && <Step1Identificacao />}
          {step === 1 && <Step2Destinatario />}
          {step === 2 && <Step3Itens />}
          {step === 3 && <Step4Transporte />}
          {step === 4 && (
            <Step5Revisao totalNF={totalNF} onSalvarRascunho={salvarRascunho} saving={saving} />
          )}

          <div className="flex flex-col gap-2 pt-4 border-t sm:flex-row sm:items-center sm:justify-between">
            {totalNF > 0 && step >= 2 && (
              <span className="text-sm text-muted-foreground text-center sm:order-2 sm:text-left">
                {step === 4 ? "Total da NF-e: " : "Valor estimado: "}
                <strong className="tabular-nums text-foreground">
                  {formatCurrency(totalNF)}
                </strong>
              </span>
            )}
            <div className="flex gap-2 sm:order-1">
              <Button
                variant="outline"
                onClick={prev}
                disabled={step === 0}
                className="flex-1 sm:flex-none gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Anterior
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={next} className="flex-1 sm:flex-none gap-2">
                  Próximo <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <span className="flex-1 sm:hidden" />
              )}
            </div>
          </div>
        </div>
      </FormProvider>
    </ModulePage>
  );
}
