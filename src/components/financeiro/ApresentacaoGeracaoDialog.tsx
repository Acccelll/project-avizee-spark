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
import { GripVertical } from 'lucide-react';

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
      toast.success('Rascunho da apresentação criado com sucesso!');
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

  const toggleSlide = (codigo: string, checked: boolean) => {
    if (checked) {
      setParams(p => ({ ...p, slidesSelecionados: [...p.slidesSelecionados, codigo] }));
    } else {
      setParams(p => ({ ...p, slidesSelecionados: p.slidesSelecionados.filter(s => s !== codigo) }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerar Nova Apresentação (Fase 2)</DialogTitle>
          <DialogDescription>
            Configure os parâmetros e selecione os slides para o deck gerencial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="template">Template Visual</Label>
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
              <Label htmlFor="modo">Modo de Dados</Label>
              <Select
                value={params.modoGeracao}
                onValueChange={(val: any) => setParams(p => ({ ...p, modoGeracao: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinamico">Dinâmico (Dados em Tempo Real)</SelectItem>
                  <SelectItem value="fechado">Fechado (Baseado em Snapshots)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Seleção e Ordem dos Slides</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setParams(p => ({ ...p, slidesSelecionados: SLIDE_DEFINITIONS.map(s => s.codigo) }))}
              >
                Selecionar Todos
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 border rounded-lg p-4 bg-muted/30">
              {SLIDE_DEFINITIONS.map((slide, index) => (
                <div key={slide.codigo} className="flex items-center justify-between p-2 bg-card border rounded-md shadow-sm">
                  <div className="flex items-center space-x-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Checkbox
                      id={slide.codigo}
                      checked={params.slidesSelecionados.includes(slide.codigo)}
                      onCheckedChange={(checked) => toggleSlide(slide.codigo, !!checked)}
                    />
                    <div className="flex flex-col">
                      <label htmlFor={slide.codigo} className="text-sm font-medium leading-none cursor-pointer">
                        {index + 1}. {slide.titulo}
                      </label>
                      {slide.optional && (
                        <span className="text-[10px] text-primary uppercase font-bold mt-1">Opcional / Fase 2</span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {slide.dataset}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Preparando...' : 'Criar Rascunho para Revisão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
