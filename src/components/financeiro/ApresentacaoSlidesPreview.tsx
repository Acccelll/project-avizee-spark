import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { buscarComentarios } from '@/services/apresentacaoService';
import { Loader2, Monitor } from 'lucide-react';

interface Props {
  geracaoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApresentacaoSlidesPreview: React.FC<Props> = ({ geracaoId, open, onOpenChange }) => {
  const { data: comentarios, isLoading } = useQuery({
    queryKey: ['apresentacao-comentarios', geracaoId],
    queryFn: () => buscarComentarios(geracaoId),
    enabled: open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Estrutura da Apresentação
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
              {comentarios?.map((c, idx) => (
                <div key={c.id} className="aspect-video bg-white border rounded shadow-sm overflow-hidden flex flex-col relative group">
                  <div className="absolute top-2 right-2 bg-primary/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                    Slide {idx + 1}
                  </div>
                  <div className="p-4 border-b bg-slate-50">
                    <h5 className="text-sm font-bold text-slate-700 truncate">{c.titulo}</h5>
                  </div>
                  <div className="flex-1 p-4 flex flex-col justify-center items-center text-center space-y-2">
                    <div className="w-16 h-1 w-full bg-slate-100 rounded" />
                    <div className="w-12 h-1 w-2/3 bg-slate-100 rounded" />
                    <div className="w-20 h-1 w-full bg-slate-100 rounded" />
                    <p className="text-[10px] text-slate-400 mt-4 px-4 line-clamp-3 italic">
                      {c.comentario_editado || c.comentario_automatico}
                    </p>
                  </div>
                  <div className="h-2 bg-primary" />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
