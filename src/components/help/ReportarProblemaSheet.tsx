import { useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useHelp } from "@/contexts/HelpContext";
import { coletarDiagnostico } from "@/lib/suporte/diagnostico";
import type {
  SuporteAbrangencia,
  SuporteFrequencia,
  SuporteImpacto,
  SuporteTipo,
} from "@/services/suporte.service";
import { ABRANGENCIA_LABELS, FREQUENCIA_LABELS, IMPACTO_LABELS, TIPO_LABELS } from "@/pages/ajuda/suporteLabels";
import { useCriarChamadoSuporte } from "@/pages/ajuda/hooks/useSuporteMutations";

const MAX_ANEXOS = 5;
const MAX_TAMANHO_MB = 10;

interface FormState {
  tipo: SuporteTipo;
  resumo: string;
  descricao: string;
  impacto: SuporteImpacto | "";
  abrangencia: SuporteAbrangencia | "";
  frequencia: SuporteFrequencia | "";
}

const FORM_INICIAL: FormState = {
  tipo: "bug",
  resumo: "",
  descricao: "",
  impacto: "",
  abrangencia: "",
  frequencia: "",
};

/**
 * Drawer "Reportar problema" — acessível a qualquer usuário autenticado a
 * partir do HelpDrawer e do HelpMenu (spec §5-7). Coleta o relato do usuário
 * mais contexto técnico automático (nunca captura de tela automática — só
 * anexo manual) e mostra, de forma transparente, o que será enviado antes
 * do envio (spec §13).
 */
export function ReportarProblemaSheet() {
  const { reportOpen, reportContext, closeReportDialog } = useHelp();
  const { pathname } = useLocation();
  const criarChamado = useCriarChamadoSuporte();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [anexos, setAnexos] = useState<File[]>([]);

  // Recalculado a cada abertura — coletarDiagnostico() lê window.location.pathname
  // no momento da chamada, então já reflete a tela de onde o usuário reportou.
  const diagnostico = useMemo(() => (reportOpen ? coletarDiagnostico() : null), [reportOpen]);

  function resetar() {
    setForm(FORM_INICIAL);
    setAnexos([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      closeReportDialog();
      resetar();
    }
  }

  function handleAnexarArquivos(files: FileList | null) {
    if (!files?.length) return;
    const novos = Array.from(files);
    if (anexos.length + novos.length > MAX_ANEXOS) {
      toast.error(`Máximo de ${MAX_ANEXOS} anexos por chamado.`);
      return;
    }
    const grandeDemais = novos.find((f) => f.size > MAX_TAMANHO_MB * 1024 * 1024);
    if (grandeDemais) {
      toast.error(`"${grandeDemais.name}" excede ${MAX_TAMANHO_MB}MB.`);
      return;
    }
    setAnexos((prev) => [...prev, ...novos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removerAnexo(index: number) {
    setAnexos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.resumo.trim() || !form.descricao.trim() || !form.impacto || !form.abrangencia || !form.frequencia) {
      toast.error("Preencha todos os campos antes de enviar.");
      return;
    }
    await criarChamado.mutateAsync({
      tipo: form.tipo,
      resumo: form.resumo.trim(),
      descricao: form.descricao.trim(),
      impacto: form.impacto,
      abrangencia: form.abrangencia,
      frequencia: form.frequencia,
      rota: pathname,
      registroRelacionadoTipo: reportContext?.registroRelacionadoTipo,
      registroRelacionadoId: reportContext?.registroRelacionadoId,
      diagnostico: diagnostico ?? undefined,
      anexos,
    });
    closeReportDialog();
    resetar();
  }

  return (
    <Sheet open={reportOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle>Reportar problema</SheetTitle>
          <SheetDescription>
            Conte o que aconteceu com suas palavras. Quanto mais detalhe, mais rápido conseguimos ajudar.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as SuporteTipo }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TIPO_LABELS) as [SuporteTipo, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suporte-resumo">Resumo</Label>
            <Input
              id="suporte-resumo"
              placeholder="Em uma frase: o que aconteceu?"
              value={form.resumo}
              onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suporte-descricao">Descrição</Label>
            <Textarea
              id="suporte-descricao"
              placeholder="O que você esperava que acontecesse? O que aconteceu de fato? Em que tela/passo você estava?"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={5}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Impacto</Label>
            <RadioGroup
              value={form.impacto}
              onValueChange={(v) => setForm((f) => ({ ...f, impacto: v as SuporteImpacto }))}
              className="space-y-1.5"
            >
              {(Object.entries(IMPACTO_LABELS) as [SuporteImpacto, string][]).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value={value} />
                  {label}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quem é afetado?</Label>
              <Select
                value={form.abrangencia}
                onValueChange={(v) => setForm((f) => ({ ...f, abrangencia: v as SuporteAbrangencia }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ABRANGENCIA_LABELS) as [SuporteAbrangencia, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Com que frequência?</Label>
              <Select
                value={form.frequencia}
                onValueChange={(v) => setForm((f) => ({ ...f, frequencia: v as SuporteFrequencia }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(FREQUENCIA_LABELS) as [SuporteFrequencia, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Anexos (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.log,.csv"
              className="hidden"
              onChange={(e) => handleAnexarArquivos(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={anexos.length >= MAX_ANEXOS}
            >
              <Paperclip className="h-4 w-4" /> Anexar arquivo ou captura de tela
            </Button>
            <p className="text-xs text-muted-foreground">
              Até {MAX_ANEXOS} arquivos, {MAX_TAMANHO_MB}MB cada. A captura de tela é manual — tire o print e
              anexe aqui, nada é capturado automaticamente.
            </p>
            {anexos.length > 0 && (
              <ul className="space-y-1.5">
                {anexos.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                    <span className="truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      aria-label={`Remover ${file.name}`}
                      onClick={() => removerAnexo(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {diagnostico && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
                  <ChevronDown className="h-3.5 w-3.5" /> O que enviaremos junto com o chamado
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <dl className="mt-2 space-y-1 rounded-md border border-border bg-muted/40 p-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Tela</dt>
                    <dd className="text-right font-mono">{diagnostico.url_relativa}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Navegador</dt>
                    <dd className="text-right truncate max-w-[70%]">{diagnostico.navegador}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Tela do dispositivo</dt>
                    <dd className="text-right">{diagnostico.viewport}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Conectividade</dt>
                    <dd className="text-right">{diagnostico.conectividade}</dd>
                  </div>
                </dl>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Nunca enviamos senhas, tokens ou dados bancários — só informações técnicas do seu navegador.
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          <SheetFooter className="gap-2 sm:gap-0">
            <Button type="submit" className="w-full" disabled={criarChamado.isPending}>
              {criarChamado.isPending ? "Enviando…" : "Enviar chamado"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
