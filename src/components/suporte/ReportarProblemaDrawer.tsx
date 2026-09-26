import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Camera, ChevronDown, X, Loader2 } from 'lucide-react';
import { useHelp } from '@/contexts/HelpContext';
import { useReportarProblema } from '@/hooks/suporte/useReportarProblema';
import { uploadAnexo } from '@/services/suporte/anexos.service';
import { capturarTelaVisivel } from '@/services/suporte/captura.service';
import { coletarDiagnosticoAutomatico } from '@/services/suporte/diagnostico.service';
import { ChamadoFormFields, EMPTY_CHAMADO_FORM, chamadoFormEstaCompleto } from './ChamadoFormFields';
import type { SuporteAbrangencia, SuporteFrequencia, SuporteImpacto } from '@/services/suporte/types';

const EMPTY_FORM = EMPTY_CHAMADO_FORM;

/**
 * Drawer global "Reportar problema" (seção 3–5 da especificação). Não é só
 * um formulário: coleta contexto técnico automaticamente e permite anexar
 * uma captura de tela explícita — nunca silenciosa (seção 8).
 */
export function ReportarProblemaDrawer() {
  const { reportarProblemaOpen, closeReportarProblema, openReportarProblema } = useHelp();
  const { enviar, isSubmitting } = useReportarProblema();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [screenshot, setScreenshot] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [showTecnico, setShowTecnico] = useState(false);

  const reset = useCallback(() => {
    setForm(EMPTY_FORM);
    setScreenshot((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setShowTecnico(false);
  }, []);

  const handleClose = useCallback(() => {
    closeReportarProblema();
    reset();
  }, [closeReportarProblema, reset]);

  const capturarTela = useCallback(async () => {
    setCapturing(true);
    // Fecha o próprio drawer momentaneamente para não aparecer na captura,
    // aguardando a animação de saída antes de capturar.
    closeReportarProblema();
    try {
      await new Promise((r) => setTimeout(r, 300));
      const blob = await capturarTelaVisivel();
      if (blob) {
        setScreenshot({ blob, previewUrl: URL.createObjectURL(blob) });
      }
    } finally {
      setCapturing(false);
      openReportarProblema();
    }
  }, [closeReportarProblema, openReportarProblema]);

  const descartarScreenshot = useCallback(() => {
    setScreenshot((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const podeEnviar = chamadoFormEstaCompleto(form);

  const handleSubmit = useCallback(async () => {
    if (!podeEnviar) return;
    const result = await enviar({
      resumo: form.resumo.trim(),
      descricao: form.descricao.trim(),
      impacto: form.impacto as SuporteImpacto,
      abrangencia: form.abrangencia as SuporteAbrangencia,
      frequencia: form.frequencia as SuporteFrequencia,
    });
    if (screenshot) {
      const file = new File([screenshot.blob], 'screenshot.png', { type: 'image/png' });
      try {
        await uploadAnexo({ chamadoId: result.id, file, isScreenshot: true });
      } catch {
        // Falha no anexo não invalida o chamado já criado — usuário pode
        // anexar depois na tela do chamado.
      }
    }
    handleClose();
    navigate(`/ajuda/meus-chamados/${result.id}`);
  }, [podeEnviar, enviar, form, screenshot, handleClose, navigate]);

  const diagnostico = coletarDiagnosticoAutomatico();

  return (
    <Sheet open={reportarProblemaOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Reportar problema</SheetTitle>
          <SheetDescription>
            Conte o que aconteceu com suas palavras — o ERP coleta o contexto técnico automaticamente.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <ChamadoFormFields idPrefix="rp" form={form} onChange={setForm} />

          <div className="space-y-2 border-t border-border pt-4">
            <Label>Captura de tela (opcional)</Label>
            {screenshot ? (
              <div className="relative rounded-md border border-border overflow-hidden">
                <img src={screenshot.previewUrl} alt="Prévia da captura de tela" className="w-full" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={descartarScreenshot}
                  aria-label="Descartar captura"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={capturarTela}
                disabled={capturing}
              >
                {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Capturar tela
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              A captura nunca é feita automaticamente — só quando você clicar no botão acima, e você pode
              descartá-la antes de enviar.
            </p>
          </div>

          <Collapsible open={showTecnico} onOpenChange={setShowTecnico} className="border-t border-border pt-4">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
                <ChevronDown className={`h-4 w-4 transition-transform ${showTecnico ? 'rotate-180' : ''}`} />
                Ver informações técnicas incluídas
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p><strong>Tela:</strong> {diagnostico.url_relativa}</p>
              <p><strong>Navegador:</strong> {diagnostico.navegador}</p>
              <p><strong>Sistema:</strong> {diagnostico.sistema_operacional}</p>
              <p><strong>Viewport:</strong> {diagnostico.viewport}</p>
              <p><strong>Idioma:</strong> {diagnostico.idioma}</p>
              <p><strong>Conectividade:</strong> {diagnostico.conectividade}</p>
              {screenshot && <p><strong>Screenshot:</strong> anexado</p>}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!podeEnviar || isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar chamado
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
