import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { WORKBOOK_SHEET_GROUPS } from '@/lib/workbook/templateMap';
import type { WorkbookTemplate, WorkbookModoGeracao } from '@/types/workbook';

interface WorkbookParametrosCardProps {
  competenciaInicial: string;
  competenciaFinal: string;
  modoGeracao: WorkbookModoGeracao;
  templateId: string;
  templates: WorkbookTemplate[];
  abasSelecionadas: string[];
  onCompetenciaInicialChange: (v: string) => void;
  onCompetenciaFinalChange: (v: string) => void;
  onModoGeracaoChange: (v: WorkbookModoGeracao) => void;
  onTemplateChange: (v: string) => void;
  onAbasChange: (ids: string[]) => void;
}

export function WorkbookParametrosCard({
  competenciaInicial,
  competenciaFinal,
  modoGeracao,
  templateId,
  templates,
  abasSelecionadas,
  onCompetenciaInicialChange,
  onCompetenciaFinalChange,
  onModoGeracaoChange,
  onTemplateChange,
  onAbasChange,
}: WorkbookParametrosCardProps) {
  const toggle = (id: string, checked: boolean) => {
    const set = new Set(abasSelecionadas);
    if (checked) set.add(id); else set.delete(id);
    onAbasChange(Array.from(set));
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parâmetros de Geração</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>
        <div className="space-y-2">
          <Label>Conteúdo do Workbook</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WORKBOOK_SHEET_GROUPS.map((g) => {
              const checked = abasSelecionadas.includes(g.id);
              return (
                <label key={g.id} className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={checked} onCheckedChange={(v) => toggle(g.id, v === true)} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium leading-none">{g.label}</div>
                    <div className="text-xs text-muted-foreground">{g.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
