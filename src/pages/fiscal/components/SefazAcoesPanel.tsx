import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Send, Search, Ban, FileDown, Loader2, ShieldAlert, FileText, RotateCcw, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSefazAcoes } from "@/pages/fiscal/hooks/useSefazAcoes";
import { SefazRetornoModal } from "@/pages/fiscal/components/SefazRetornoModal";
import { CartaCorrecaoDrawer } from "@/pages/fiscal/components/CartaCorrecaoDrawer";
import { gerarDanfePdf, type DanfeInput } from "@/services/fiscal/danfe.service";
import { enviarDanfePorEmail } from "@/services/fiscal/danfeEmail.service";
import { obterCertificadoConfigurado } from "@/services/fiscal/certificado.service";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { NotaFiscal } from "@/types/domain";
import type { NFeData } from "@/services/fiscal/sefaz";

interface SefazAcoesPanelProps {
  nf: NotaFiscal;
  /** Construtor opcional do payload NFeData (necessário para Transmitir). */
  buildNFeData?: (nf: NotaFiscal) => Promise<NFeData> | NFeData;
  /** Construtor opcional do payload da DANFE PDF. */
  buildDanfeData?: (nf: NotaFiscal) => Promise<DanfeInput> | DanfeInput;
}

/**
 * Painel compacto com as 4 ações SEFAZ + DANFE.
 * Usa o `useSefazAcoes` para orquestrar e o `SefazRetornoModal` para feedback.
 */
export function SefazAcoesPanel({ nf, buildNFeData, buildDanfeData }: SefazAcoesPanelProps) {
  const acoes = useSefazAcoes();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cceOpen, setCceOpen] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [gerandoDanfe, setGerandoDanfe] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");
  const [mensagemEmail, setMensagemEmail] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const { data: certificado, isLoading: carregandoCert } = useQuery({
    queryKey: ["certificado-digital"],
    queryFn: obterCertificadoConfigurado,
    staleTime: 60 * 60 * 1000,
  });
  const certificadoAusente = !carregandoCert && !certificado;

  const podeTransmitir = !["autorizada", "cancelada_sefaz", "denegada"].includes(
    nf.status_sefaz ?? "nao_enviada",
  ) && !certificadoAusente;
  const podeConsultar = !!nf.chave_acesso;
  const podeCancelar = nf.status_sefaz === "autorizada";
  const podeDanfe = !!nf.chave_acesso;
  const podeEnviarEmail =
    nf.status_sefaz === "autorizada" && !!nf.chave_acesso && !!buildDanfeData;
  const podeCce = nf.status_sefaz === "autorizada" && !!nf.chave_acesso;
  const podeDevolucao = nf.status_sefaz === "autorizada";

  const handleTransmitir = async () => {
    if (!buildNFeData) {
      toast.error("Construtor de NFeData não fornecido para esta tela.");
      return;
    }
    const dados = await buildNFeData(nf);
    await acoes.transmitir(nf, dados);
  };

  const handleDanfe = async () => {
    if (!buildDanfeData) {
      toast.error("Construtor de dados DANFE não fornecido para esta tela.");
      return;
    }
    setGerandoDanfe(true);
    try {
      const dados = await buildDanfeData(nf);
      gerarDanfePdf(dados, true);
      toast.success("DANFE gerada com sucesso.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar DANFE.");
    } finally {
      setGerandoDanfe(false);
    }
  };

  /**
   * Pré-popula o e-mail do cliente (se cadastrado) e abre o diálogo de envio.
   */
  const handleAbrirEmail = async () => {
    setMensagemEmail("");
    setEmailDestino("");
    if (nf.cliente_id) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("email")
        .eq("id", nf.cliente_id)
        .maybeSingle();
      if (cli?.email) setEmailDestino(String(cli.email));
    }
    setEmailOpen(true);
  };

  const handleEnviarEmail = async () => {
    if (!buildDanfeData) return;
    if (!emailDestino.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setEnviandoEmail(true);
    try {
      const dados = await buildDanfeData(nf);
      const r = await enviarDanfePorEmail({
        nfId: nf.id,
        destinatarioEmail: emailDestino.trim(),
        destinatarioNome: dados.destinatario?.nome ?? null,
        danfe: dados,
        mensagem: mensagemEmail.trim() || null,
      });
      if (r.ok) {
        toast.success(`DANFE enviada para ${emailDestino.trim()}.`);
        setEmailOpen(false);
      } else {
        toast.error(r.erro ?? "Falha ao enviar DANFE por e-mail.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar DANFE.");
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <div className="space-y-3">
      {certificadoAusente && (
        <Alert variant="destructive" className="border-warning/40 bg-warning/10 text-warning-foreground [&>svg]:text-warning">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Certificado digital não configurado</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Configure o certificado digital antes de emitir NF-e.</span>
            <Button asChild size="sm" variant="outline">
              <Link to="/administracao">Ir para Administração &gt; Fiscal</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="default"
        className="gap-1.5"
        disabled={!podeTransmitir || acoes.pending}
        onClick={handleTransmitir}
      >
        {acoes.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Transmitir SEFAZ
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!podeConsultar || acoes.pending}
        onClick={() => acoes.consultar(nf)}
      >
        <Search className="h-3.5 w-3.5" /> Consultar
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-destructive border-destructive/30 hover:text-destructive"
        disabled={!podeCancelar || acoes.pending}
        onClick={() => setCancelOpen(true)}
      >
        <Ban className="h-3.5 w-3.5" /> Cancelar SEFAZ
      </Button>

      <Button
        size="sm"
        variant="secondary"
        className="gap-1.5"
        disabled={!podeDanfe || gerandoDanfe}
        onClick={handleDanfe}
      >
        {gerandoDanfe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        DANFE PDF
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!podeEnviarEmail || enviandoEmail}
        onClick={handleAbrirEmail}
      >
        {enviandoEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
        Enviar por e-mail
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!podeCce}
        onClick={() => setCceOpen(true)}
      >
        <FileText className="h-3.5 w-3.5" /> Carta de Correção
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!podeDevolucao}
        onClick={() => navigate(`/faturamento/emitir?refNFeId=${nf.id}&finalidade=4`)}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Nova Devolução
      </Button>

      <SefazRetornoModal
        aberto={acoes.modalAberto}
        onFechar={acoes.fecharModal}
        protocolo={acoes.ultimoRetorno?.protocolo}
        status={acoes.ultimoRetorno?.status}
        motivo={acoes.ultimoRetorno?.motivo}
        xmlRetorno={acoes.ultimoRetorno?.xmlRetorno}
        erros={acoes.ultimoRetorno?.erros}
      />

      <CartaCorrecaoDrawer nf={nf} open={cceOpen} onOpenChange={setCceOpen} />

      {/* Diálogo de envio do DANFE por e-mail (Onda 7) */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar DANFE por e-mail</DialogTitle>
            <DialogDescription>
              O DANFE será gerado em PDF, salvo em armazenamento privado e o
              link enviado ao destinatário (válido por 7 dias).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="danfe-email">E-mail do destinatário</Label>
              <Input
                id="danfe-email"
                type="email"
                value={emailDestino}
                onChange={(e) => setEmailDestino(e.target.value)}
                placeholder="financeiro@destinatario.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="danfe-mensagem">Mensagem (opcional)</Label>
              <Textarea
                id="danfe-mensagem"
                value={mensagemEmail}
                onChange={(e) => setMensagemEmail(e.target.value)}
                placeholder="Segue o DANFE da NF-e referente ao pedido…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={enviandoEmail}>
              Cancelar
            </Button>
            <Button onClick={handleEnviarEmail} disabled={enviandoEmail || !emailDestino.includes("@")}>
              {enviandoEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Enviar DANFE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar NF-e na SEFAZ</DialogTitle>
            <DialogDescription>
              O cancelamento exige justificativa de no mínimo 15 caracteres e é
              irreversível. A NF mantém histórico contábil por exigência fiscal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="justificativa-cancelamento">Justificativa</Label>
            <Textarea
              id="justificativa-cancelamento"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo do cancelamento (mín. 15 caracteres)"
              minLength={15}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {justificativa.length}/15 caracteres mínimos
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={justificativa.trim().length < 15 || acoes.pending}
              onClick={async () => {
                const r = await acoes.cancelar(nf, justificativa.trim());
                if (r?.sucesso) {
                  setCancelOpen(false);
                  setJustificativa("");
                }
              }}
            >
              {acoes.pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}