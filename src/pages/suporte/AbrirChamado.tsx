import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ChevronDown, Loader2, Send } from 'lucide-react';
import { useAbrirChamado } from '@/hooks/suporte/useAbrirChamado';
import { coletarDiagnosticoAutomatico } from '@/services/suporte/diagnostico.service';
import {
  ChamadoFormFields,
  EMPTY_CHAMADO_FORM,
  chamadoFormEstaCompleto,
} from '@/components/suporte/ChamadoFormFields';
import {
  SUPORTE_TIPO_LABELS,
  type SuporteAbrangencia,
  type SuporteFrequencia,
  type SuporteImpacto,
  type SuporteTipo,
} from '@/services/suporte/types';

const TIPO_OPCOES = Object.entries(SUPORTE_TIPO_LABELS) as [SuporteTipo, string][];

/**
 * "Abrir chamado" (Parte I, item 2) — caminho genérico para qualquer tipo de
 * chamado (Bug, Problema operacional, Dúvida, Sugestão de melhoria),
 * distinto do botão "Reportar problema" (que nasce sempre como Bug).
 */
export default function AbrirChamado() {
  const navigate = useNavigate();
  const { enviar, isSubmitting } = useAbrirChamado();

  const [tipo, setTipo] = useState<SuporteTipo | ''>('');
  const [form, setForm] = useState(EMPTY_CHAMADO_FORM);
  const [showTecnico, setShowTecnico] = useState(false);

  const podeEnviar = tipo !== '' && chamadoFormEstaCompleto(form);

  const handleSubmit = async () => {
    if (!podeEnviar) return;
    const result = await enviar({
      tipo: tipo as SuporteTipo,
      resumo: form.resumo.trim(),
      descricao: form.descricao.trim(),
      impacto: form.impacto as SuporteImpacto,
      abrangencia: form.abrangencia as SuporteAbrangencia,
      frequencia: form.frequencia as SuporteFrequencia,
    });
    navigate(`/ajuda/meus-chamados/${result.id}`);
  };

  const diagnostico = coletarDiagnosticoAutomatico();

  return (
    <div className="space-y-5 max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link to="/ajuda/meus-chamados"><ArrowLeft className="h-4 w-4" /> Meus chamados</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Abrir chamado</CardTitle>
          <p className="text-sm text-muted-foreground">
            Reporte um bug, tire uma dúvida ou envie uma sugestão de melhoria — escolha o tipo abaixo.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="ac-tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as SuporteTipo)}>
              <SelectTrigger id="ac-tipo">
                <SelectValue placeholder="O que você quer fazer?" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPCOES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ChamadoFormFields
            idPrefix="ac"
            form={form}
            onChange={setForm}
            resumoLabel="Resumo"
            resumoPlaceholder='Ex.: "Como faço para emitir uma NF-e de devolução?" ou "Seria útil ter atalho de teclado para salvar."'
            descricaoPlaceholder="Descreva com suas palavras — quanto mais contexto, mais fácil é entender e responder."
          />

          <Collapsible open={showTecnico} onOpenChange={setShowTecnico} className="border-t border-border pt-4">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
                <ChevronDown className={`h-4 w-4 transition-transform ${showTecnico ? 'rotate-180' : ''}`} />
                Ver informações técnicas incluídas
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p><strong>Tela:</strong> {diagnostico.url_relativa}</p>
              <p><strong>Navegador:</strong> {diagnostico.navegador}</p>
              <p><strong>Sistema:</strong> {diagnostico.sistema_operacional}</p>
              <p><strong>Viewport:</strong> {diagnostico.viewport}</p>
              <p><strong>Idioma:</strong> {diagnostico.idioma}</p>
              <p><strong>Conectividade:</strong> {diagnostico.conectividade}</p>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" asChild disabled={isSubmitting}>
              <Link to="/ajuda/meus-chamados">Cancelar</Link>
            </Button>
            <Button onClick={handleSubmit} disabled={!podeEnviar || isSubmitting} className="gap-1.5">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar chamado
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
