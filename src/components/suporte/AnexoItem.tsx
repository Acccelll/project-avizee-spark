import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, ExternalLink, Loader2, ImageOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAnexoUrl } from '@/services/suporte/anexos.service';
import type { SuporteAnexo } from '@/services/suporte/types';

/** A URL assinada vale 10 min; renova antes de expirar. */
const SIGNED_URL_STALE_MS = 8 * 60 * 1000;

function isImagem(anexo: SuporteAnexo): boolean {
  return (anexo.tipo_arquivo ?? '').startsWith('image/');
}

/**
 * Item de anexo de chamado. O bucket `suporte` é privado, então o arquivo é
 * acessado por URL assinada. Imagens mostram miniatura e ampliam em modal;
 * demais tipos abrem em nova aba.
 */
export function AnexoItem({ anexo }: { anexo: SuporteAnexo }) {
  const [aberto, setAberto] = useState(false);
  const imagem = isImagem(anexo);

  const url = useQuery({
    queryKey: ['suporte_anexo_url', anexo.caminho_storage],
    queryFn: () => getAnexoUrl(anexo.caminho_storage),
    staleTime: SIGNED_URL_STALE_MS,
    refetchInterval: SIGNED_URL_STALE_MS,
  });

  if (imagem) {
    return (
      <li className="space-y-1">
        <button
          type="button"
          className="block overflow-hidden rounded-md border bg-muted/30 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => url.data && setAberto(true)}
          disabled={!url.data}
          aria-label={`Ampliar ${anexo.nome_arquivo}`}
        >
          {url.isLoading ? (
            <div className="flex h-28 w-40 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : url.isError || !url.data ? (
            <div className="flex h-28 w-40 flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
              <ImageOff className="h-4 w-4" /> Não foi possível carregar
            </div>
          ) : (
            <img
              src={url.data}
              alt={anexo.nome_arquivo}
              className="h-28 w-auto max-w-[16rem] object-contain"
              loading="lazy"
            />
          )}
        </button>
        <span className="block text-xs text-muted-foreground">{anexo.nome_arquivo}</span>

        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle className="truncate pr-6 text-sm">{anexo.nome_arquivo}</DialogTitle>
            </DialogHeader>
            {url.data && (
              <div className="space-y-2">
                <img
                  src={url.data}
                  alt={anexo.nome_arquivo}
                  className="mx-auto max-h-[75vh] w-auto object-contain"
                />
                <a
                  href={url.data}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
                </a>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1.5 text-sm">
      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
      {url.data ? (
        <a
          href={url.data}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {anexo.nome_arquivo}
        </a>
      ) : (
        <span>{anexo.nome_arquivo}</span>
      )}
      {url.isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </li>
  );
}
