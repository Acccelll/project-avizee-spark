import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ApresentacaoModoGeracao, ApresentacaoTemplate } from '@/types/apresentacao';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ApresentacaoTemplate[];
  onGerar: (params: { templateId: string; competenciaInicial: string; competenciaFinal: string; modoGeracao: ApresentacaoModoGeracao }) => Promise<void>;
  isGenerating: boolean;
}

export function ApresentacaoGeracaoDialog({ open, onOpenChange, templates, onGerar, isGenerating }: Props) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [competenciaInicial, setCompetenciaInicial] = useState(currentMonth);
  const [competenciaFinal, setCompetenciaFinal] = useState(currentMonth);
  const [modoGeracao, setModoGeracao] = useState<ApresentacaoModoGeracao>('dinamico');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar Apresentação Gerencial</DialogTitle>
          <DialogDescription>Selecione período, template e modo (dinâmico ou fechado).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome} ({t.versao})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Competência inicial</Label>
            <Input type="month" value={competenciaInicial} onChange={(e) => setCompetenciaInicial(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Competência final</Label>
            <Input type="month" value={competenciaFinal} onChange={(e) => setCompetenciaFinal(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Modo de geração</Label>
            <Select value={modoGeracao} onValueChange={(v) => setModoGeracao(v as ApresentacaoModoGeracao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinamico">dinâmico</SelectItem>
                <SelectItem value="fechado">fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>Cancelar</Button>
          <Button disabled={isGenerating || !templateId} onClick={() => onGerar({ templateId, competenciaInicial, competenciaFinal, modoGeracao })}>
            {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : 'Gerar .pptx'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
