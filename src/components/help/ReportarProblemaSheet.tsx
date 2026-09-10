import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Camera, ChevronDown, Paperclip, X } from "lucide-react";
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
import { resolveHelpEntry } from "@/help/registry";
import { notifyError } from "@/utils/errorMessages";
import type {
  SuporteAbrangencia,
  SuporteFrequencia,
  SuporteImpacto,
} from "@/services/suporte.service";
import { ABRANGENCIA_LABELS, FREQUENCIA_LABELS, IMPACTO_LABELS } from "@/pages/ajuda/suporteLabels";
import { useCriarChamadoSuporte, type AnexoParaEnvio } from "@/pages/ajuda/hooks/useSuporteMutations";

const MAX_ANEXOS = 5;
const MAX_TAMANHO_MB = 10;
// Tipos previstos na spec (§14.1): PNG, JPG/JPEG, WEBP, PDF, XML, TXT, CSV, XLS/XLSX.
const ACCEPT_ANEXOS = "image/png,image/jpeg,image/webp,.pdf,.xml,.txt,.csv,.xls,.xlsx";

interface FormState {
  resumo: string;
  descricao: string;
  impacto: SuporteImpacto | "";
  abrangencia: SuporteAbrangencia | "";
  frequencia: SuporteFrequencia | "";
}

const FORM_INICIAL: FormState = {
  resumo: "",
  descricao: "",
  impacto: "",
  abrangencia: "",
  frequencia: "",
};

interface CapturaPreview {
  blob: Blob;
  url: string;
}

/** Captura um frame único da tela via getDisplayMedia — encerra o compartilhamento assim que captura. */
async function capturarFrameDaTela(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a captura.");
    ctx.drawImage(video, 0, 0);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Não foi possível gerar a imagem da captura.");
    return blob;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

/**
 * Drawer "Reportar problema" — acessível a qualquer usuário autenticado a
 * partir do HelpDrawer e do HelpMenu (spec §5-7). Coleta o relato do usuário
 * mais contexto técnico automático e mostra, de forma transparente, o que
 * será enviado antes do envio (spec §13). O tipo nasce sempre como "bug"
 * (spec §4: não perguntar algo que já é conhecido pelo contexto) — o
 * administrador reclassifica na triagem se for o caso.
 */
export function ReportarProblemaSheet() {
  const { reportOpen, reportContext, closeReportDialog } = useHelp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const criarChamado = useCriarChamadoSuporte();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [anexos, setAnexos] = useState<AnexoParaEnvio[]>([]);
  const [capturaPreview, setCapturaPreview] = useState<CapturaPreview | null>(null);
  const [capturando, setCapturando] = useState(false);

  const telaAtual = useMemo(() => (reportOpen ? resolveHelpEntry(pathname)?.title : null), [reportOpen, pathname]);

  // Recalculado a cada abertura — coletarDiagnostico() lê window.location.pathname
  // no momento da chamada, então já reflete a tela de onde o usuário reportou.
  const diagnostico = useMemo(() => (reportOpen ? coletarDiagnostico() : null), [reportOpen]);

  function resetar() {
    setForm(FORM_INICIAL);
    setAnexos([]);
    descartarCaptura();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Libera a URL do blob de preview ao desmontar, mesmo se o usuário fechar sem decidir.
  useEffect(() => () => {
    if (capturaPreview) URL.revokeObjectURL(capturaPreview.url);
  }, [capturaPreview]);

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
    setAnexos((prev) => [...prev, ...novos.map((file) => ({ file }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removerAnexo(index: number) {
    setAnexos((prev) => prev.filter((_, i) => i !== index));
  }

  async function iniciarCapturaTela() {
    if (anexos.length >= MAX_ANEXOS) {
      toast.error(`Máximo de ${MAX_ANEXOS} anexos por chamado.`);
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error("Captura de tela não é suportada neste navegador. Anexe um arquivo com o print manualmente.");
      return;
    }
    setCapturando(true);
    try {
      const blob = await capturarFrameDaTela();
      setCapturaPreview({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      const nome = (err as DOMException)?.name;
      if (nome === "NotAllowedError" || nome === "AbortError") {
        // Usuário cancelou o seletor de tela/janela — silencioso, não é erro.
      } else {
        notifyError(err, "Não foi possível capturar a tela.");
      }
    } finally {
      setCapturando(false);
    }
  }

  function usarCaptura() {
    if (!capturaPreview) return;
    const file = new File([capturaPreview.blob], `captura-${Date.now()}.png`, { type: "image/png" });
    setAnexos((prev) => [...prev, { file, isScreenshot: true }]);
    descartarCaptura();
  }

  function descartarCaptura() {
    setCapturaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.resumo.trim() || !form.descricao.trim() || !form.impacto || !form.abrangencia || !form.frequencia) {
      toast.error("Preencha todos os campos antes de enviar.");
      return;
    }
    const chamado = await criarChamado.mutateAsync({
      tipo: "bug",
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
    // spec §16: depois de criar, levar o usuário direto para a página do chamado.
    navigate(`/ajuda/chamados/${chamado.id}`);
  }

  return (
    <Sheet open={reportOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle>Reportar problema</SheetTitle>
          <SheetDescription>
            {telaAtual ? (
              <>Você está reportando um problema em: <span className="font-medium text-foreground">{telaAtual}</span></>
            ) : (
              "Conte o que aconteceu com suas palavras. Quanto mais detalhe, mais rápido conseguimos ajudar."
            )}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="suporte-resumo">Resumo do problema</Label>
            <Input
              id="suporte-resumo"
              placeholder="Ex.: Cliquei em 'Salvar' e o pedido continuou com os dados anteriores."
              value={form.resumo}
              onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
              maxLength={160}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suporte-descricao">Conte com mais detalhes</Label>
            <Textarea
              id="suporte-descricao"
              placeholder="O que você estava tentando fazer? O que aconteceu? O que você esperava que acontecesse?"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={5}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Qual o impacto?</Label>
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
              <Label>Quem parece estar sendo afetado?</Label>
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
              <Label>Isso aconteceu:</Label>
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
            <Label>Evidências (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_ANEXOS}
              className="hidden"
              onChange={(e) => handleAnexarArquivos(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={anexos.length >= MAX_ANEXOS}
              >
                <Paperclip className="h-4 w-4" /> Adicionar imagem ou arquivo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={iniciarCapturaTela}
                disabled={anexos.length >= MAX_ANEXOS || capturando}
              >
                <Camera className="h-4 w-4" /> {capturando ? "Capturando…" : "Capturar tela"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Até {MAX_ANEXOS} arquivos, {MAX_TAMANHO_MB}MB cada. A captura de tela é sempre manual e mostra uma
              prévia antes de anexar — nada é enviado automaticamente.
            </p>

            {capturaPreview && (
              <div className="space-y-2 rounded-md border border-border p-2.5">
                <img src={capturaPreview.url} alt="Prévia da captura de tela" className="max-h-48 w-full rounded object-contain" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={usarCaptura}>Usar esta imagem</Button>
                  <Button type="button" size="sm" variant="outline" onClick={descartarCaptura}>Descartar</Button>
                </div>
              </div>
            )}

            {anexos.length > 0 && (
              <ul className="space-y-1.5">
                {anexos.map((anexo, i) => (
                  <li key={`${anexo.file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                    <span className="truncate">
                      {anexo.file.name}
                      {anexo.isScreenshot && <span className="ml-1.5 text-xs text-muted-foreground">(captura de tela)</span>}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      aria-label={`Remover ${anexo.file.name}`}
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
                  <ChevronDown className="h-3.5 w-3.5" /> Informações técnicas coletadas
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
                  {reportContext?.registroRelacionadoTipo && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Registro relacionado</dt>
                      <dd className="text-right font-mono">{reportContext.registroRelacionadoTipo}</dd>
                    </div>
                  )}
                  {capturaPreview && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Screenshot selecionado</dt>
                      <dd className="text-right">Sim</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Nunca enviamos senhas, tokens ou dados bancários — só informações técnicas do seu navegador.
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          <SheetFooter className="gap-2 sm:gap-0">
            <Button type="submit" className="w-full" disabled={criarChamado.isPending}>
              {criarChamado.isPending ? "Enviando…" : "Enviar problema"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
