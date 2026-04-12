import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ApresentacaoTemplate, ApresentacaoModoGeracao } from '@/types/apresentacao';

interface ApresentacaoGeracaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ApresentacaoTemplate[];
  onGerar: (params: {
    templateId: string;
    competenciaInicial: string;
    competenciaFinal: string;
    modoGeracao: ApresentacaoModoGeracao;
  }) => Promise<void>;
  isGenerating: boolean;
}

export function ApresentacaoGeracaoDialog({
  open,
  onOpenChange,
  templates,
  onGerar,
  isGenerating,
}: ApresentacaoGeracaoDialogProps) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [competenciaInicial, setCompetenciaInicial] = useState(currentMonth);
  const [competenciaFinal, setCompetenciaFinal] = useState(currentMonth);
  const [modoGeracao, setModoGeracao] = useState<ApresentacaoModoGeracao>('dinamico');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');

  const handleGerar = async () => {
    await onGerar({ templateId, competenciaInicial, competenciaFinal, modoGeracao });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Apresentação Gerencial</DialogTitle>
          <DialogDescription>
            Configure os parâmetros para gerar a apresentação em PowerPoint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template */}
          <div className="space-y-1.5">
            <Label htmlFor="ap-template">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="ap-template" aria-label="Selecionar template">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} (v{t.versao})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Competência */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ap-comp-ini">Competência inicial</Label>
              <Input
                id="ap-comp-ini"
                type="month"
                value={competenciaInicial}
                onChange={(e) => setCompetenciaInicial(e.target.value)}
                aria-label="Competência inicial"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-comp-fim">Competência final</Label>
              <Input
                id="ap-comp-fim"
                type="month"
                value={competenciaFinal}
                onChange={(e) => setCompetenciaFinal(e.target.value)}
                aria-label="Competência final"
              />
            </div>
          </div>

          {/* Mode */}
          <div className="space-y-1.5">
            <Label htmlFor="ap-modo">Modo de geração</Label>
            <Select
              value={modoGeracao}
              onValueChange={(v) => setModoGeracao(v as ApresentacaoModoGeracao)}
            >
              <SelectTrigger id="ap-modo" aria-label="Modo de geração">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinamico">Dinâmico (dados atuais)</SelectItem>
                <SelectItem value="fechado">Fechado (snapshots consolidados)</SelectItem>
              </SelectContent>
            </Select>
            {modoGeracao === 'fechado' && (
              <p className="text-xs text-muted-foreground">
                O modo fechado exige fechamentos mensais consolidados para o período selecionado.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGerar}
            disabled={isGenerating || !templateId}
            aria-label="Gerar apresentação"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              'Gerar Apresentação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
