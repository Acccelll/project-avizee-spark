import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  SUPORTE_IMPACTO_LABELS,
  SUPORTE_ABRANGENCIA_LABELS,
  SUPORTE_FREQUENCIA_LABELS,
  type SuporteAbrangencia,
  type SuporteFrequencia,
  type SuporteImpacto,
} from '@/services/suporte/types';

const IMPACTO_OPCOES = Object.entries(SUPORTE_IMPACTO_LABELS) as [SuporteImpacto, string][];
const ABRANGENCIA_OPCOES = Object.entries(SUPORTE_ABRANGENCIA_LABELS) as [SuporteAbrangencia, string][];
const FREQUENCIA_OPCOES = Object.entries(SUPORTE_FREQUENCIA_LABELS) as [SuporteFrequencia, string][];

export interface ChamadoFormValues {
  resumo: string;
  descricao: string;
  impacto: SuporteImpacto | '';
  abrangencia: SuporteAbrangencia | '';
  frequencia: SuporteFrequencia | '';
}

export const EMPTY_CHAMADO_FORM: ChamadoFormValues = {
  resumo: '',
  descricao: '',
  impacto: '',
  abrangencia: '',
  frequencia: '',
};

export function chamadoFormEstaCompleto(form: ChamadoFormValues): boolean {
  return (
    form.resumo.trim().length > 0 &&
    form.descricao.trim().length > 0 &&
    form.impacto !== '' &&
    form.abrangencia !== '' &&
    form.frequencia !== ''
  );
}

interface Props {
  idPrefix: string;
  form: ChamadoFormValues;
  onChange: (form: ChamadoFormValues) => void;
  resumoLabel?: string;
  resumoPlaceholder?: string;
  descricaoPlaceholder?: string;
}

/**
 * Campos comuns a qualquer chamado (seção 5 da especificação): resumo,
 * descrição, impacto, abrangência, frequência. Compartilhado entre
 * `ReportarProblemaDrawer` (tipo fixo `bug`) e `AbrirChamado` (tipo livre)
 * para manter os dois formulários consistentes.
 */
export function ChamadoFormFields({
  idPrefix,
  form,
  onChange,
  resumoLabel = 'O que aconteceu?',
  resumoPlaceholder = 'Ex.: Cliquei em "Salvar" e o pedido continuou com os dados anteriores.',
  descricaoPlaceholder = 'O que você estava tentando fazer, o que aconteceu e o que esperava que acontecesse.',
}: Props) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-resumo`}>{resumoLabel}</Label>
        <Input
          id={`${idPrefix}-resumo`}
          placeholder={resumoPlaceholder}
          value={form.resumo}
          onChange={(e) => onChange({ ...form, resumo: e.target.value })}
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-descricao`}>Descrição</Label>
        <Textarea
          id={`${idPrefix}-descricao`}
          placeholder={descricaoPlaceholder}
          value={form.descricao}
          onChange={(e) => onChange({ ...form, descricao: e.target.value })}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Impacto</Label>
        <RadioGroup
          value={form.impacto}
          onValueChange={(v) => onChange({ ...form, impacto: v as SuporteImpacto })}
        >
          {IMPACTO_OPCOES.map(([value, label]) => (
            <div key={value} className="flex items-start gap-2">
              <RadioGroupItem value={value} id={`${idPrefix}-impacto-${value}`} className="mt-0.5" />
              <Label htmlFor={`${idPrefix}-impacto-${value}`} className="font-normal leading-snug cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Abrangência</Label>
        <RadioGroup
          value={form.abrangencia}
          onValueChange={(v) => onChange({ ...form, abrangencia: v as SuporteAbrangencia })}
          className="grid-flow-col auto-cols-max gap-4"
        >
          {ABRANGENCIA_OPCOES.map(([value, label]) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`${idPrefix}-abrangencia-${value}`} />
              <Label htmlFor={`${idPrefix}-abrangencia-${value}`} className="font-normal cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Frequência</Label>
        <RadioGroup
          value={form.frequencia}
          onValueChange={(v) => onChange({ ...form, frequencia: v as SuporteFrequencia })}
        >
          {FREQUENCIA_OPCOES.map(([value, label]) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`${idPrefix}-frequencia-${value}`} />
              <Label htmlFor={`${idPrefix}-frequencia-${value}`} className="font-normal cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </>
  );
}
