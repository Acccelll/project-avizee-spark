import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { EdicaoSlide, Slide } from '@/lib/apresentacao/fechamento/tipos';

interface Props {
  /** Slide com o texto automático (antes das edições). */
  original: Slide;
  edicao: EdicaoSlide | undefined;
  disabled?: boolean;
  onChange: (e: EdicaoSlide | undefined) => void;
}

const linhas = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);

/** Título, comentários (um por linha) e itens do slide selecionado. */
export function EditorSlide({ original, edicao, disabled, onChange }: Props) {
  const lista = original.visual.tipo === 'lista' ? original.visual.itens : null;
  const [mensagem, setMensagem] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [itens, setItens] = useState('');

  useEffect(() => {
    setMensagem(edicao?.mensagem ?? original.mensagem);
    setComentarios((edicao?.comentarios ?? original.comentarios).join('\n'));
    setItens((edicao?.itens ?? lista ?? []).join('\n'));
    // Recarrega só ao trocar de slide ou ao chegar uma edição de fora (outro rascunho).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original.codigo, original.mensagem, edicao === undefined]);

  const emitir = (parcial: Partial<EdicaoSlide>) => {
    const prox: EdicaoSlide = { ...edicao, ...parcial };
    if (prox.mensagem === original.mensagem) delete prox.mensagem;
    if (prox.comentarios && prox.comentarios.join('\n') === original.comentarios.join('\n')) delete prox.comentarios;
    if (prox.itens && lista && prox.itens.join('\n') === lista.join('\n')) delete prox.itens;
    if (!prox.oculto) delete prox.oculto;
    onChange(Object.keys(prox).length ? prox : undefined);
  };

  const editado = !!edicao && (edicao.mensagem != null || edicao.comentarios != null || edicao.itens != null);
  const capa = original.visual.tipo === 'capa';

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{original.rotulo}</h3>
        {!capa && (
          <div className="flex items-center gap-2">
            <Label htmlFor="ocultar-slide" className="text-xs text-muted-foreground">Ocultar</Label>
            <Switch id="ocultar-slide" checked={!!edicao?.oculto} disabled={disabled} onCheckedChange={(v) => emitir({ oculto: v })} />
          </div>
        )}
      </div>
      {capa ? (
        <p className="mt-3 text-sm text-muted-foreground">A capa é montada com o período e a data-base.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="slide-titulo" className="text-xs">Título (a conclusão do slide)</Label>
            <Textarea
              id="slide-titulo"
              rows={2}
              value={mensagem}
              disabled={disabled}
              onChange={(e) => setMensagem(e.target.value)}
              onBlur={() => emitir({ mensagem: mensagem.trim() || original.mensagem })}
            />
          </div>
          {lista ? (
            <div className="space-y-1.5">
              <Label htmlFor="slide-itens" className="text-xs">Itens, um por linha (o texto até o primeiro ponto sai em negrito)</Label>
              <Textarea id="slide-itens" rows={7} value={itens} disabled={disabled} onChange={(e) => setItens(e.target.value)} onBlur={() => emitir({ itens: linhas(itens) })} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="slide-comentarios" className="text-xs">Comentários, um por linha (até três)</Label>
              <Textarea id="slide-comentarios" rows={6} value={comentarios} disabled={disabled} onChange={(e) => setComentarios(e.target.value)} onBlur={() => emitir({ comentarios: linhas(comentarios) })} />
            </div>
          )}
          {editado && !disabled && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setMensagem(original.mensagem);
                setComentarios(original.comentarios.join('\n'));
                setItens((lista ?? []).join('\n'));
                onChange(edicao?.oculto ? { oculto: true } : undefined);
              }}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Voltar ao texto automático
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
