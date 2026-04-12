import { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SLIDE_DEFINITIONS } from '@/lib/apresentacao/slideDefinitions';
import { buildDefaultConfig } from '@/lib/apresentacao/templateConfig';
import type {
  ApresentacaoTemplate,
  TemplateConfig,
  TemplateSlideConfig,
} from '@/types/apresentacao';
import { THEME } from '@/lib/apresentacao/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateFormValues {
  nome: string;
  codigo: string;
  versao: string;
  descricao: string;
  config_json: TemplateConfig;
}

interface ApresentacaoTemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Template to edit. Pass null to create a new one. */
  template: ApresentacaoTemplate | null;
  onSave: (values: TemplateFormValues) => Promise<void>;
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function initSlides(config: TemplateConfig | null | undefined): TemplateSlideConfig[] {
  const overrideMap = new Map<string, TemplateSlideConfig>();
  if (config?.slides) {
    config.slides.forEach((s) => overrideMap.set(s.codigo, s));
  }
  return SLIDE_DEFINITIONS.map((def, index) => {
    const override = overrideMap.get(def.codigo);
    return {
      codigo: def.codigo,
      ativo: override?.ativo ?? true,
      ordem: override?.ordem ?? index,
      tituloCustom: override?.tituloCustom ?? '',
      subtituloCustom: override?.subtituloCustom ?? '',
    };
  }).sort((a, b) => a.ordem - b.ordem);
}

// ---------------------------------------------------------------------------
// Colour input with preview
// ---------------------------------------------------------------------------

function ColorField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  const isValid = /^[0-9A-Fa-f]{6}$/.test(value);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded border border-input flex-shrink-0"
          style={{ backgroundColor: isValid ? `#${value}` : 'transparent' }}
          aria-hidden="true"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace('#', ''))}
          maxLength={6}
          placeholder="1F3864"
          className={!isValid && value.length > 0 ? 'border-destructive' : ''}
          aria-label={label}
        />
      </div>
      {!isValid && value.length > 0 && (
        <p className="text-xs text-destructive">Informe 6 dígitos hexadecimais (sem #).</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function ApresentacaoTemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSave,
  isSaving,
}: ApresentacaoTemplateFormDialogProps) {
  const isEditing = Boolean(template);
  const defaultCfg = buildDefaultConfig();

  // Basic fields
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [versao, setVersao] = useState('v1');
  const [descricao, setDescricao] = useState('');
  const [codigoManuallyEdited, setCodigoManuallyEdited] = useState(false);

  // Theme overrides
  const [primaryColor, setPrimaryColor] = useState(THEME.colors.primary);
  const [secondaryColor, setSecondaryColor] = useState(THEME.colors.secondary);
  const [accentColor, setAccentColor] = useState(THEME.colors.accent);
  const [fontTitle, setFontTitle] = useState(THEME.fonts.title);
  const [fontBody, setFontBody] = useState(THEME.fonts.body);

  // Slides
  const [slides, setSlides] = useState<TemplateSlideConfig[]>(() => initSlides(null));

  // Populate from template on open
  useEffect(() => {
    if (!open) return;
    if (template) {
      setNome(template.nome);
      setCodigo(template.codigo);
      setVersao(template.versao);
      setDescricao(template.descricao ?? '');
      setCodigoManuallyEdited(true);
      const tc = template.config_json;
      setPrimaryColor(tc?.theme?.primaryColor ?? THEME.colors.primary);
      setSecondaryColor(tc?.theme?.secondaryColor ?? THEME.colors.secondary);
      setAccentColor(tc?.theme?.accentColor ?? THEME.colors.accent);
      setFontTitle(tc?.theme?.fontTitle ?? THEME.fonts.title);
      setFontBody(tc?.theme?.fontBody ?? THEME.fonts.body);
      setSlides(initSlides(tc));
    } else {
      setNome('');
      setCodigo('');
      setVersao('v1');
      setDescricao('');
      setCodigoManuallyEdited(false);
      setPrimaryColor(THEME.colors.primary);
      setSecondaryColor(THEME.colors.secondary);
      setAccentColor(THEME.colors.accent);
      setFontTitle(THEME.fonts.title);
      setFontBody(THEME.fonts.body);
      setSlides(initSlides(defaultCfg));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template]);

  // Auto-generate codigo from nome
  useEffect(() => {
    if (!codigoManuallyEdited && nome) {
      setCodigo(slugify(nome));
    }
  }, [nome, codigoManuallyEdited]);

  function handleSlideToggle(codigo: string, ativo: boolean) {
    setSlides((prev) => prev.map((s) => (s.codigo === codigo ? { ...s, ativo } : s)));
  }

  function handleSlideTituloCustom(codigo: string, value: string) {
    setSlides((prev) => prev.map((s) => (s.codigo === codigo ? { ...s, tituloCustom: value } : s)));
  }

  function handleSlideSubtituloCustom(codigo: string, value: string) {
    setSlides((prev) =>
      prev.map((s) => (s.codigo === codigo ? { ...s, subtituloCustom: value } : s))
    );
  }

  function handleSlideOrdemUp(index: number) {
    if (index === 0) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((s, i) => ({ ...s, ordem: i }));
    });
  }

  function handleSlideOrdemDown(index: number) {
    setSlides((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((s, i) => ({ ...s, ordem: i }));
    });
  }

  async function handleSave() {
    const config: TemplateConfig = {
      version: '1.0',
      theme: {
        primaryColor,
        secondaryColor,
        accentColor,
        fontTitle: fontTitle.trim() || undefined,
        fontBody: fontBody.trim() || undefined,
      },
      slides: slides.map((s) => ({
        codigo: s.codigo,
        ativo: s.ativo,
        ordem: s.ordem,
        tituloCustom: s.tituloCustom?.trim() || undefined,
        subtituloCustom: s.subtituloCustom?.trim() || undefined,
      })),
    };
    await onSave({ nome, codigo, versao, descricao, config_json: config });
  }

  const canSave = nome.trim().length > 0 && codigo.trim().length > 0 && versao.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          <DialogDescription>
            Configure o template de apresentação. Os campos de cor devem ser hexadecimais de 6 dígitos sem #.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-6 py-2">
            {/* Basic info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Identificação
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="tpl-nome">Nome *</Label>
                  <Input
                    id="tpl-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Fechamento Mensal"
                    aria-label="Nome do template"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-codigo">Código *</Label>
                  <Input
                    id="tpl-codigo"
                    value={codigo}
                    onChange={(e) => {
                      setCodigo(e.target.value);
                      setCodigoManuallyEdited(true);
                    }}
                    placeholder="fechamento_mensal"
                    aria-label="Código do template"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-versao">Versão *</Label>
                  <Input
                    id="tpl-versao"
                    value={versao}
                    onChange={(e) => setVersao(e.target.value)}
                    placeholder="v1"
                    aria-label="Versão do template"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="tpl-descricao">Descrição</Label>
                  <Textarea
                    id="tpl-descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Descrição opcional do template..."
                    rows={2}
                    aria-label="Descrição do template"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Theme */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Paleta de Cores
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <ColorField
                  id="tpl-color-primary"
                  label="Cor primária"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                />
                <ColorField
                  id="tpl-color-secondary"
                  label="Cor secundária"
                  value={secondaryColor}
                  onChange={setSecondaryColor}
                />
                <ColorField
                  id="tpl-color-accent"
                  label="Cor de destaque"
                  value={accentColor}
                  onChange={setAccentColor}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-font-title">Fonte do título</Label>
                  <Input
                    id="tpl-font-title"
                    value={fontTitle}
                    onChange={(e) => setFontTitle(e.target.value)}
                    placeholder="Calibri"
                    aria-label="Fonte do título"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-font-body">Fonte do corpo</Label>
                  <Input
                    id="tpl-font-body"
                    value={fontBody}
                    onChange={(e) => setFontBody(e.target.value)}
                    placeholder="Calibri"
                    aria-label="Fonte do corpo"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Slides */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Slides ({slides.filter((s) => s.ativo).length} / {slides.length} ativos)
              </h3>
              <p className="text-xs text-muted-foreground">
                Use as setas para reordenar. Desative slides que não devem aparecer na apresentação.
                Deixe os campos de título em branco para usar os padrões.
              </p>
              <div className="space-y-2">
                {slides.map((slide, index) => {
                  const def = SLIDE_DEFINITIONS.find((d) => d.codigo === slide.codigo);
                  return (
                    <div
                      key={slide.codigo}
                      className={`border rounded-md p-3 space-y-2 transition-opacity ${
                        slide.ativo ? '' : 'opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Order buttons */}
                        <div className="flex flex-col gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleSlideOrdemUp(index)}
                            disabled={index === 0}
                            aria-label={`Mover slide ${slide.codigo} para cima`}
                          >
                            ▲
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleSlideOrdemDown(index)}
                            disabled={index === slides.length - 1}
                            aria-label={`Mover slide ${slide.codigo} para baixo`}
                          >
                            ▼
                          </Button>
                        </div>

                        {/* Toggle */}
                        <Switch
                          checked={slide.ativo}
                          onCheckedChange={(v) => handleSlideToggle(slide.codigo, v)}
                          aria-label={`Ativar/desativar slide ${slide.codigo}`}
                        />

                        {/* Slide info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {def?.titulo ?? slide.codigo}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {def?.subtitulo}
                          </p>
                        </div>

                        {/* Order badge */}
                        <span className="text-xs text-muted-foreground w-6 text-right">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Custom title/subtitle */}
                      {slide.ativo && (
                        <div className="grid grid-cols-2 gap-2 pl-10">
                          <div className="space-y-1">
                            <Label className="text-xs" htmlFor={`tpl-slide-titulo-${slide.codigo}`}>
                              Título custom
                            </Label>
                            <Input
                              id={`tpl-slide-titulo-${slide.codigo}`}
                              value={slide.tituloCustom ?? ''}
                              onChange={(e) => handleSlideTituloCustom(slide.codigo, e.target.value)}
                              placeholder={def?.titulo ?? ''}
                              className="h-7 text-xs"
                              aria-label={`Título customizado do slide ${slide.codigo}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs" htmlFor={`tpl-slide-subtitulo-${slide.codigo}`}>
                              Subtítulo custom
                            </Label>
                            <Input
                              id={`tpl-slide-subtitulo-${slide.codigo}`}
                              value={slide.subtituloCustom ?? ''}
                              onChange={(e) => handleSlideSubtituloCustom(slide.codigo, e.target.value)}
                              placeholder={def?.subtitulo ?? ''}
                              className="h-7 text-xs"
                              aria-label={`Subtítulo customizado do slide ${slide.codigo}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            aria-label={isEditing ? 'Salvar alterações do template' : 'Criar template'}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : isEditing ? (
              'Salvar Alterações'
            ) : (
              'Criar Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
