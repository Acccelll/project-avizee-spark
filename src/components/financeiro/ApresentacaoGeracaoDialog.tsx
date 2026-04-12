import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { iniciarGeracao } from '@/services/apresentacaoService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ApresentacaoParametros, ApresentacaoTemplate } from '@/types/apresentacao';
import { SLIDE_DEFINITIONS } from '@/lib/apresentacao/slideDefinitions';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ApresentacaoTemplate[];
}

export const ApresentacaoGeracaoDialog: React.FC<Props> = ({ open, onOpenChange, templates }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useState<ApresentacaoParametros>({
    templateId: '',
    competenciaInicial: new Date().toISOString().slice(0, 7),
    competenciaFinal: new Date().toISOString().slice(0, 7),
    modoGeracao: 'dinamico',
    slidesSelecionados: SLIDE_DEFINITIONS.map(s => s.codigo)
  });

  const mutation = useMutation({
    mutationFn: (p: ApresentacaoParametros) => iniciarGeracao(p, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacao-geracoes'] });
      toast.success('Geração solicitada com sucesso!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao iniciar geração: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.templateId) {
      toast.error('Selecione um template');
      return;
    }
    mutation.mutate(params);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar Nova Apresentação</DialogTitle>
          <DialogDescription>
            Configure os parâmetros para a geração do deck gerencial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select
                value={params.templateId}
                onValueChange={(val) => setParams(p => ({ ...p, templateId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome} (v{t.versao})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modo">Modo de Geração</Label>
              <Select
                value={params.modoGeracao}
                onValueChange={(val: any) => setParams(p => ({ ...p, modoGeracao: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinamico">Dinâmico (Dados Atuais)</SelectItem>
                  <SelectItem value="fechado">Fechado (Snapshots)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="compIni">Competência Inicial</Label>
              <Input
                type="month"
                value={params.competenciaInicial}
                onChange={(e) => setParams(p => ({ ...p, competenciaInicial: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compFim">Competência Final</Label>
              <Input
                type="month"
                value={params.competenciaFinal}
                onChange={(e) => setParams(p => ({ ...p, competenciaFinal: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Slides a Incluir</Label>
            <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-40 overflow-y-auto">
              {SLIDE_DEFINITIONS.map(slide => (
                <div key={slide.codigo} className="flex items-center space-x-2">
                  <Checkbox
                    id={slide.codigo}
                    checked={params.slidesSelecionados.includes(slide.codigo)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setParams(p => ({ ...p, slidesSelecionados: [...p.slidesSelecionados, slide.codigo] }));
                      } else {
                        setParams(p => ({ ...p, slidesSelecionados: p.slidesSelecionados.filter(s => s !== slide.codigo) }));
                      }
                    }}
                  />
                  <label htmlFor={slide.codigo} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {slide.titulo}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Iniciando...' : 'Gerar Apresentação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
