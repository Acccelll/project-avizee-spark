import { useMemo, useState } from 'react';
import { Loader2, BarChart3, LineChart, PieChart, Table as TableIcon, LayoutGrid, TrendingUp, Layers, AlignLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ApresentacaoModoGeracao, ApresentacaoTemplate, SlideConfigItem } from '@/types/apresentacao';
import { APRESENTACAO_SLIDES_V2, SECAO_LABELS, SECAO_ORDEM, type SlideSecao } from '@/lib/apresentacao/slideDefinitions';

const CHART_ICON: Record<string, typeof BarChart3> = {
  coluna: BarChart3,
  linha: LineChart,
  barra_horizontal: AlignLeft,
  donut: PieChart,
  tabela: TableIcon,
  cards: LayoutGrid,
  texto: FileText,
  waterfall: TrendingUp,
  stacked: Layers,
};

const SECAO_ACCENT: Record<SlideSecao, string> = {
  capa: 'bg-slate-500',
  financeiro: 'bg-blue-600',
  pessoas: 'bg-amber-600',
  comercial: 'bg-emerald-600',
  operacoes: 'bg-purple-600',
  risco: 'bg-rose-600',
  marketing: 'bg-pink-600',
  encerramento: 'bg-slate-600',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ApresentacaoTemplate[];
  onGerar: (params: {
    templateId: string;
    competenciaInicial: string;
    competenciaFinal: string;
    modoGeracao: ApresentacaoModoGeracao;
    slideConfig: SlideConfigItem[];
    exigirRevisao: boolean;
  }) => Promise<void>;
  isGenerating: boolean;
}

export function ApresentacaoGeracaoDialog({ open, onOpenChange, templates, onGerar, isGenerating }: Props) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [competenciaInicial, setCompetenciaInicial] = useState(currentMonth);
  const [competenciaFinal, setCompetenciaFinal] = useState(currentMonth);
  const [modoGeracao, setModoGeracao] = useState<ApresentacaoModoGeracao>('dinamico');
  const [exigirRevisao, setExigirRevisao] = useState(true);
  const [enabledSlides, setEnabledSlides] = useState<Record<string, boolean>>({});

  const slideConfig = useMemo<SlideConfigItem[]>(() => APRESENTACAO_SLIDES_V2.map((s) => ({
    codigo: s.codigo,
    enabled: s.required || enabledSlides[s.codigo] === true,
    order: s.order,
  })), [enabledSlides]);

  const optionalBySection = useMemo(() => {
    const map = new Map<SlideSecao, typeof APRESENTACAO_SLIDES_V2>();
    APRESENTACAO_SLIDES_V2.filter((s) => s.optional).forEach((s) => {
      const arr = map.get(s.secao) ?? [];
      arr.push(s);
      map.set(s.secao, arr);
    });
    return SECAO_ORDEM.filter((sec) => map.has(sec)).map((sec) => ({ secao: sec, slides: map.get(sec)! }));
  }, []);

  const totalEnabled = slideConfig.filter((s) => s.enabled).length;

  const toggleSection = (secao: SlideSecao, value: boolean) => {
    const codes = optionalBySection.find((g) => g.secao === secao)?.slides.map((s) => s.codigo) ?? [];
    setEnabledSlides((prev) => {
      const next = { ...prev };
      codes.forEach((c) => { next[c] = value; });
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Gerar Apresentação Gerencial (V2)</DialogTitle>
          <DialogDescription>Configure período, modo e slides opcionais antes de gerar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome} ({t.versao})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><Label>Competência inicial</Label><Input type="month" value={competenciaInicial} onChange={(e) => setCompetenciaInicial(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Competência final</Label><Input type="month" value={competenciaFinal} onChange={(e) => setCompetenciaFinal(e.target.value)} /></div>
          </div>
          <div className="grid gap-1">
            <Label>Modo de geração</Label>
            <Select value={modoGeracao} onValueChange={(v) => setModoGeracao(v as ApresentacaoModoGeracao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="dinamico">dinâmico</SelectItem><SelectItem value="fechado">fechado</SelectItem></SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={exigirRevisao} onChange={(e) => setExigirRevisao(e.target.checked)} />
            Exigir revisão/aprovação antes da geração final
          </label>
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Slides opcionais por seção</p>
              <span className="text-xs text-muted-foreground">{totalEnabled} slides selecionados</span>
            </div>
            <div className="grid gap-3 max-h-72 overflow-auto pr-1">
              {optionalBySection.map(({ secao, slides }) => {
                const allOn = slides.every((s) => enabledSlides[s.codigo] === true);
                return (
                  <div key={secao} className="rounded border bg-muted/30 p-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SECAO_LABELS[secao]}</p>
                      <button
                        type="button"
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => toggleSection(secao, !allOn)}
                      >
                        {allOn ? 'Desmarcar todos' : 'Selecionar todos'}
                      </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-1">
                      {slides.map((s) => (
                        <label key={s.codigo} className="text-xs flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={enabledSlides[s.codigo] === true}
                            onChange={(e) => setEnabledSlides((prev) => ({ ...prev, [s.codigo]: e.target.checked }))}
                          />
                          {s.titulo}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>Cancelar</Button>
          <Button disabled={isGenerating || !templateId} onClick={() => onGerar({ templateId, competenciaInicial, competenciaFinal, modoGeracao, slideConfig, exigirRevisao })}>
            {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : 'Gerar apresentação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
