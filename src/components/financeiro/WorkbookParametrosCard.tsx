import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WorkbookTemplate, WorkbookModoGeracao } from '@/types/workbook';

interface WorkbookParametrosCardProps {
  competenciaInicial: string;
  competenciaFinal: string;
  modoGeracao: WorkbookModoGeracao;
  templateId: string;
  templates: WorkbookTemplate[];
  onCompetenciaInicialChange: (v: string) => void;
  onCompetenciaFinalChange: (v: string) => void;
  onModoGeracaoChange: (v: WorkbookModoGeracao) => void;
  onTemplateChange: (v: string) => void;
}

export function WorkbookParametrosCard({
  competenciaInicial,
  competenciaFinal,
  modoGeracao,
  templateId,
  templates,
  onCompetenciaInicialChange,
  onCompetenciaFinalChange,
  onModoGeracaoChange,
  onTemplateChange,
}: WorkbookParametrosCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parâmetros de Geração</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label htmlFor="comp-ini">Competência Inicial</Label>
          <Input
            id="comp-ini"
            type="month"
            value={competenciaInicial}
            onChange={(e) => onCompetenciaInicialChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="comp-fim">Competência Final</Label>
          <Input
            id="comp-fim"
            type="month"
            value={competenciaFinal}
            onChange={(e) => onCompetenciaFinalChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Modo de Geração</Label>
          <Select value={modoGeracao} onValueChange={(v) => onModoGeracaoChange(v as WorkbookModoGeracao)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dinamico">Dinâmico</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={onTemplateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o template" />
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
      </CardContent>
    </Card>
  );
}
