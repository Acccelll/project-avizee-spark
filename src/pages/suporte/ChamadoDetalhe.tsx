import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Paperclip, Send, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useChamado } from '@/hooks/suporte/useChamado';
import {
  SUPORTE_STATUS_LABELS,
  SUPORTE_TIPO_LABELS,
  SUPORTE_IMPACTO_LABELS,
  SUPORTE_PRIORIDADE_LABELS,
  type SuporteEvento,
} from '@/services/suporte/types';

/** Descrição legível para eventos de sistema (não-comentário) na timeline. */
function descreverEvento(evento: SuporteEvento): string {
  const dados = (evento.dados_novos ?? {}) as Record<string, unknown>;
  switch (evento.tipo) {
    case 'abertura':
      return 'Chamado aberto.';
    case 'status_alterado':
      return `Status alterado para "${dados.status ?? '—'}".`;
    case 'prioridade_alterada':
      return `Prioridade alterada para "${dados.prioridade ?? '—'}".`;
    case 'tipo_modulo_alterado':
      return 'Chamado reclassificado.';
    case 'responsavel_alterado':
      return 'Responsável atualizado.';
    case 'anexo_adicionado':
      return 'Anexo adicionado.';
    case 'vinculo_dev':
      return 'Vínculo de desenvolvimento adicionado.';
    case 'resolucao':
      return 'Chamado marcado como resolvido.';
    case 'reabertura':
      return 'Chamado reaberto.';
    case 'fechamento':
      return 'Chamado fechado.';
    case 'cancelamento':
      return 'Chamado cancelado.';
    case 'duplicidade':
      return 'Chamado marcado como duplicado de outro.';
    default:
      return evento.tipo;
  }
}

export default function ChamadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const {
    chamado, loadingChamado, eventos, anexos,
    comentar, anexar, confirmarResolucao,
  } = useChamado(id);
  const [mensagem, setMensagem] = useState('');

  if (loadingChamado) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (!chamado) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Chamado não encontrado.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/ajuda/meus-chamados"><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
    );
  }

  const handleEnviarComentario = async () => {
    if (!mensagem.trim()) return;
    await comentar.mutateAsync({ mensagem: mensagem.trim(), visibilidade: 'publico' });
    setMensagem('');
  };

  const handleAnexo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) anexar.mutate({ file });
    e.target.value = '';
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link to="/ajuda/meus-chamados"><ArrowLeft className="h-4 w-4" /> Meus chamados</Link>
      </Button>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{chamado.numero}</span>
            <Badge>{SUPORTE_STATUS_LABELS[chamado.status]}</Badge>
            <Badge variant="outline">{SUPORTE_TIPO_LABELS[chamado.tipo]}</Badge>
            {chamado.prioridade && (
              <Badge variant="outline">{SUPORTE_PRIORIDADE_LABELS[chamado.prioridade]}</Badge>
            )}
          </div>
          <CardTitle className="text-lg">{chamado.resumo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm whitespace-pre-wrap">{chamado.descricao}</p>
          <p className="text-xs text-muted-foreground">
            Impacto: {SUPORTE_IMPACTO_LABELS[chamado.impacto]}
          </p>
          {chamado.resumo_resolucao && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-1">Resumo da resolução</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{chamado.resumo_resolucao}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {chamado.status === 'resolvido' && chamado.solicitante_id === user?.id && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm font-medium">Este problema foi resolvido?</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => confirmarResolucao.mutate(false)}
                disabled={confirmarResolucao.isPending}
              >
                <RotateCcw className="h-4 w-4" /> Ainda tenho problema
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => confirmarResolucao.mutate(true)}
                disabled={confirmarResolucao.isPending}
              >
                <CheckCircle2 className="h-4 w-4" /> Sim, está resolvido
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {eventos.map((evento) => (
            <div key={evento.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(evento.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              {evento.tipo === 'comentario' ? (
                <p className="text-sm rounded-md bg-muted/40 p-2.5 whitespace-pre-wrap">
                  {evento.mensagem}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">{descreverEvento(evento)}</p>
              )}
            </div>
          ))}

          <Separator />

          {anexos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Anexos</p>
              <ul className="space-y-1">
                {anexos.map((anexo) => (
                  <li key={anexo.id} className="flex items-center gap-1.5 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    {anexo.nome_arquivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              placeholder="Escreva um comentário…"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <div>
                <input
                  id="chamado-anexo-input"
                  type="file"
                  className="hidden"
                  onChange={handleAnexo}
                  accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,.xml,.xls,.xlsx"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={anexar.isPending}
                  onClick={() => document.getElementById('chamado-anexo-input')?.click()}
                >
                  {anexar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  Anexar
                </Button>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!mensagem.trim() || comentar.isPending}
                onClick={handleEnviarComentario}
              >
                {comentar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Comentar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
