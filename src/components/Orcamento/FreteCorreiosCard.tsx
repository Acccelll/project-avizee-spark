import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Package, Truck, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppConfig } from '@/hooks/useAppConfig';
import { toast } from 'sonner';

interface FreteOption {
  servico: string;
  codigo: string;
  valor: number;
  prazo: number;
  erro?: string;
}

interface FreteCorreiosCardProps {
  cepDestino: string;
  pesoTotal: number;
  onSelect: (freteValor: number, freteTipo: string, prazoEntrega: string) => void;
}

export function FreteCorreiosCard({ cepDestino, pesoTotal, onSelect }: FreteCorreiosCardProps) {
  const { value: cepOrigem, loading: loadingConfig } = useAppConfig<string>('cep_empresa', '');
  const [loading, setLoading] = useState(false);
  const [opcoes, setOpcoes] = useState<FreteOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const cepDestinoClean = (cepDestino || '').replace(/\D/g, '');
  const cepOrigemClean = (cepOrigem || '').replace(/\D/g, '');
  const canQuote = cepDestinoClean.length === 8 && cepOrigemClean.length === 8 && pesoTotal > 0;

  const handleConsultar = async () => {
    if (!canQuote) {
      if (!cepOrigemClean || cepOrigemClean.length !== 8) {
        toast.error('Configure o CEP da empresa em Configurações → Empresa.');
        return;
      }
      if (!cepDestinoClean || cepDestinoClean.length !== 8) {
        toast.error('O cliente selecionado não possui CEP válido.');
        return;
      }
      if (pesoTotal <= 0) {
        toast.error('Adicione itens com peso para cotar o frete.');
        return;
      }
      return;
    }

    setLoading(true);
    setOpcoes([]);
    setSelected(null);

    try {
      // Derive Edge Function URL from VITE_SUPABASE_URL, avoiding dependency on VITE_SUPABASE_PROJECT_ID.
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string || '').replace(/\/$/, '');
      const url = `${supabaseUrl}/functions/v1/correios-api?action=cotacao_multi`;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cepOrigem: cepOrigemClean,
          cepDestino: cepDestinoClean,
          peso: pesoTotal,
          comprimento: 30,
          altura: 15,
          largura: 10,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Erro ${res.status}`);
      }

      const result: FreteOption[] = await res.json();
      const validas = result.filter(o => !o.erro && o.valor > 0);

      if (validas.length === 0) {
        toast.warning('Nenhuma opção de frete disponível para este destino.');
      }

      setOpcoes(validas);
    } catch (err: unknown) {
      console.error('[frete-correios]', err);
      toast.error('Erro ao consultar frete: ' + (err instanceof Error ? err.message : 'Tente novamente'));
    }
    setLoading(false);
  };

  const handleSelect = (opcao: FreteOption) => {
    setSelected(opcao.codigo);
    onSelect(opcao.valor, `CORREIOS (${opcao.servico})`, `${opcao.prazo} dias úteis`);
    toast.success(`Frete ${opcao.servico} selecionado!`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Cotação de Frete — Correios
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleConsultar}
            disabled={loading || loadingConfig}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
            {loading ? 'Consultando...' : 'Consultar Frete'}
          </Button>
        </div>
        {(!cepOrigemClean || cepOrigemClean.length !== 8) && !loadingConfig && (
          <p className="text-xs text-destructive mt-1">
            ⚠ CEP de origem não configurado. Vá em Configurações → Empresa.
          </p>
        )}
      </CardHeader>

      {opcoes.length > 0 && (
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {opcoes.map((opcao) => (
              <button
                key={opcao.codigo}
                onClick={() => handleSelect(opcao)}
                className={`relative flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
                  selected === opcao.codigo ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{opcao.servico}</p>
                  <p className="text-xs text-muted-foreground">{opcao.prazo} dias úteis</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">
                    {opcao.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  {selected === opcao.codigo && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
