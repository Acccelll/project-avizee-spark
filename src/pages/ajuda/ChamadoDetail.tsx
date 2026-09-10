import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { getAnexoSignedUrl, type SuporteEvento } from "@/services/suporte.service";
import { notifyError } from "@/utils/errorMessages";
import { useAnexosChamado, useChamado, useEventosChamado } from "./hooks/useSuporteQueries";
import { useComentarChamado, useConfirmarResolucao } from "./hooks/useSuporteMutations";
import {
  ABRANGENCIA_LABELS,
  FREQUENCIA_LABELS,
  IMPACTO_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  TIPO_ICON_EMOJI,
  TIPO_LABELS,
} from "./suporteLabels";

const EVENTO_LABELS: Record<SuporteEvento["tipo"], string> = {
  abertura: "Chamado aberto",
  comentario: "Comentário",
  status_alterado: "Status alterado",
  prioridade_alterada: "Prioridade alterada",
  tipo_modulo_alterado: "Classificação alterada",
  responsavel_alterado: "Responsável alterado",
  anexo_adicionado: "Anexo adicionado",
  vinculo_dev: "Vínculo de desenvolvimento",
  resolucao: "Marcado como resolvido",
  reabertura: "Reaberto",
  fechamento: "Fechado",
  cancelamento: "Cancelado",
  duplicidade: "Marcado como duplicado",
};

function AnexoItem({ nome, caminho }: { nome: string; caminho: string }) {
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    setCarregando(true);
    try {
      const url = await getAnexoSignedUrl(caminho);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      notifyError(err, "Não foi possível abrir o anexo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={abrir} disabled={carregando}>
      <Paperclip className="h-3.5 w-3.5" />
      <span className="max-w-[180px] truncate">{nome}</span>
    </Button>
  );
}

/**
 * Página do chamado — timeline pública (comentário e nota interna são a
 * mesma tabela, a RLS já filtra o que o usuário não pode ver), anexos e a
 * confirmação de resolução pelo solicitante (spec §27.3).
 */
export default function ChamadoDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole?.("admin") ?? false;

  const { data: chamado, isLoading: carregandoChamado } = useChamado(id);
  const { data: eventos, isLoading: carregandoEventos } = useEventosChamado(id);
  const { data: anexos } = useAnexosChamado(id);
  const comentar = useComentarChamado(id ?? "");
  const confirmarResolucao = useConfirmarResolucao(id ?? "");

  const [mensagem, setMensagem] = useState("");
  const [notaInterna, setNotaInterna] = useState(false);

  async function enviarComentario() {
    if (!mensagem.trim()) return;
    try {
      await comentar.mutateAsync({ mensagem: mensagem.trim(), visibilidade: notaInterna ? "interno" : "publico" });
      setMensagem("");
      setNotaInterna(false);
    } catch {
      // notifyError já disparado pelo hook
    }
  }

  const podeConfirmar =
    chamado?.status === "resolvido" && !!user?.id && (chamado.solicitante_id === user.id || isAdmin);

  if (carregandoChamado) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (!chamado) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link to="/ajuda/chamados"><ArrowLeft className="h-4 w-4" /> Meus chamados</Link>
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Chamado não encontrado ou você não tem acesso a ele.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
        <Link to="/ajuda/chamados"><ArrowLeft className="h-4 w-4" /> Meus chamados</Link>
      </Button>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{chamado.numero}</span>
            <Badge variant={STATUS_BADGE_VARIANT[chamado.status]} className={cn(STATUS_BADGE_CLASS[chamado.status])}>
              {STATUS_LABELS[chamado.status]}
            </Badge>
            <Badge variant="outline">{TIPO_ICON_EMOJI[chamado.tipo]} {TIPO_LABELS[chamado.tipo]}</Badge>
          </div>
          <h1 className="text-xl font-semibold leading-snug">{chamado.resumo}</h1>
          <p className="text-xs text-muted-foreground">
            Aberto em {formatDateTime(chamado.created_at)}
            {chamado.reportado_por_nome ? ` · relatado originalmente por ${chamado.reportado_por_nome}` : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{chamado.descricao}</p>

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <span>Impacto: {IMPACTO_LABELS[chamado.impacto]}</span>
            <span>Abrangência: {ABRANGENCIA_LABELS[chamado.abrangencia]}</span>
            <span>Frequência: {FREQUENCIA_LABELS[chamado.frequencia]}</span>
          </div>

          {chamado.registro_relacionado_tipo && (
            <p className="text-xs text-muted-foreground">
              Registro relacionado: <span className="font-mono">{chamado.registro_relacionado_tipo}</span>
              {chamado.registro_relacionado_id ? ` (${chamado.registro_relacionado_id})` : ""}
            </p>
          )}

          {chamado.status === "resolvido" && chamado.resumo_resolucao && (
            <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
              <p className="font-medium text-success">Como foi resolvido</p>
              <p className="mt-1 text-foreground/90">{chamado.resumo_resolucao}</p>
            </div>
          )}

          {anexos && anexos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {anexos.map((a) => (
                <AnexoItem key={a.id} nome={a.nome_arquivo} caminho={a.caminho_storage} />
              ))}
            </div>
          )}

          {podeConfirmar && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium mb-2">Este chamado foi resolvido. Podemos fechá-lo?</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => confirmarResolucao.mutate(true)}
                  disabled={confirmarResolucao.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" /> Sim, resolvido
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => confirmarResolucao.mutate(false)}
                  disabled={confirmarResolucao.isPending}
                >
                  <RotateCcw className="h-4 w-4" /> Ainda tenho o problema
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Histórico</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {carregandoEventos ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : (
            <ol className="space-y-4">
              {eventos?.map((evento) => (
                <li key={evento.id} className="flex gap-3">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    {evento.tipo === "comentario" ? (
                      <MessageSquare className="h-3.5 w-3.5" />
                    ) : evento.visibilidade === "interno" ? (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    ) : (
                      <UserCog className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{EVENTO_LABELS[evento.tipo]}</span>
                      {evento.visibilidade === "interno" && (
                        <Badge variant="secondary" className="text-[10px]">Nota interna</Badge>
                      )}
                      <span>{formatDateTime(evento.created_at)}</span>
                    </div>
                    {evento.mensagem && (
                      <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-sm">{evento.mensagem}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <Textarea
              placeholder="Adicionar um comentário…"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between gap-2">
              {isAdmin ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={notaInterna} onCheckedChange={(v) => setNotaInterna(v === true)} />
                  Nota interna (não visível ao solicitante)
                </label>
              ) : (
                <span />
              )}
              <Button
                size="sm"
                className="gap-1.5"
                onClick={enviarComentario}
                disabled={!mensagem.trim() || comentar.isPending}
              >
                <Send className="h-3.5 w-3.5" /> Enviar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
