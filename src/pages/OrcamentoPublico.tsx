import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OrcamentoPublicoData {
  numero: string;
  data_orcamento: string;
  validade: string | null;
  valor_total: number;
  observacoes: string | null;
  status: string;
  prazo_entrega: string | null;
  prazo_pagamento: string | null;
  frete_tipo: string | null;
  cliente_snapshot: any;
  itens: Array<{
    descricao_snapshot: string;
    codigo_snapshot: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    valor_total: number;
    variacao: string | null;
  }>;
  empresa: {
    razao_social: string;
    nome_fantasia: string;
    cnpj: string | null;
    telefone: string | null;
    email: string | null;
    logradouro: string | null;
    cidade: string | null;
    uf: string | null;
  } | null;
}

export default function OrcamentoPublico() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData] = useState<OrcamentoPublicoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDone, setActionDone] = useState<'aprovado' | 'rejeitado' | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token inválido ou ausente.');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      const { data: orc, error: orcError } = await (supabase
        .from('orcamentos') as any)
        .select('id, numero, data_orcamento, validade, valor_total, observacoes, status, prazo_entrega, prazo_pagamento, frete_tipo, cliente_snapshot, public_token')
        .eq('public_token', token)
        .eq('ativo', true)
        .single();

      if (orcError || !orc) {
        setError('Orçamento não encontrado ou link expirado.');
        setLoading(false);
        return;
      }

      const { data: itens } = await supabase
        .from('orcamentos_itens')
        .select('descricao_snapshot, codigo_snapshot, quantidade, unidade, valor_unitario, valor_total, variacao')
        .eq('orcamento_id', orc.id);

      const { data: empresa } = await supabase
        .from('empresa_config')
        .select('razao_social, nome_fantasia, cnpj, telefone, email, logradouro, cidade, uf')
        .limit(1)
        .single();

      setData({
        numero: orc.numero,
        data_orcamento: orc.data_orcamento,
        validade: orc.validade,
        valor_total: Number(orc.valor_total || 0),
        observacoes: orc.observacoes,
        status: orc.status,
        prazo_entrega: (orc as any).prazo_entrega,
        prazo_pagamento: (orc as any).prazo_pagamento,
        frete_tipo: (orc as any).frete_tipo,
        cliente_snapshot: (orc as any).cliente_snapshot,
        itens: itens || [],
        empresa: empresa || null,
      });
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <XCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold text-foreground">{error || 'Erro desconhecido'}</h1>
        <p className="text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
      </div>
    );
  }

  const cliente = data.cliente_snapshot as any;
  const isExpired = data.validade && new Date(data.validade) < new Date();
  const handleAction = async (acao: 'aprovado' | 'rejeitado') => {
    if (!data || !token) return;
    setActionLoading(true);
    const { error } = await (supabase.from('orcamentos') as any)
      .update({ status: acao })
      .eq('public_token', token)
      .eq('ativo', true);
    if (error) {
      toast.error('Erro ao registrar sua resposta. Tente novamente.');
    } else {
      setActionDone(acao);
      setData((prev: any) => prev ? { ...prev, status: acao } : prev);
    }
    setActionLoading(false);
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              {data.empresa && (
                <div className="mb-3">
                  <h2 className="text-lg font-bold text-foreground">{data.empresa.nome_fantasia}</h2>
                  <p className="text-xs text-muted-foreground">{data.empresa.razao_social}</p>
                  {data.empresa.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {data.empresa.cnpj}</p>}
                  {data.empresa.telefone && <p className="text-xs text-muted-foreground">{data.empresa.telefone}</p>}
                </div>
              )}
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Cotação {data.numero}</h1>
              </div>
            </div>
            <div className="text-right text-sm space-y-1">
              <p><span className="text-muted-foreground">Data:</span> {formatDate(data.data_orcamento)}</p>
              {data.validade && (
                <p className={isExpired ? 'text-destructive font-semibold' : ''}>
                  <span className="text-muted-foreground">Validade:</span> {formatDate(data.validade)}
                  {isExpired && ' (Expirada)'}
                </p>
              )}
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                data.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                data.status === 'cancelado' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {data.status === 'aprovado' && <CheckCircle className="h-3 w-3" />}
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </div>
            </div>
          </div>

          {/* Client info */}
          {cliente && (
            <div className="mt-4 pt-4 border-t text-sm">
              <p className="font-semibold text-foreground">{cliente.nome_razao_social || 'Cliente'}</p>
              {cliente.cpf_cnpj && <p className="text-muted-foreground">CPF/CNPJ: {cliente.cpf_cnpj}</p>}
              {cliente.email && <p className="text-muted-foreground">{cliente.email}</p>}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-foreground">Itens da Cotação</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Qtd</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Unit.</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{item.descricao_snapshot || item.codigo_snapshot}</p>
                      {item.variacao && <p className="text-xs text-muted-foreground">{item.variacao}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{item.quantidade} {item.unidade}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(item.valor_unitario)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatCurrency(item.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total + conditions */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">TOTAL DA COTAÇÃO</span>
            <span className="text-2xl font-bold font-mono text-primary">{formatCurrency(data.valor_total)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {data.prazo_entrega && (
              <div><span className="text-muted-foreground">Prazo de Entrega:</span><br /><span className="font-medium">{data.prazo_entrega}</span></div>
            )}
            {data.prazo_pagamento && (
              <div><span className="text-muted-foreground">Prazo de Pagamento:</span><br /><span className="font-medium">{data.prazo_pagamento}</span></div>
            )}
            {data.frete_tipo && (
              <div><span className="text-muted-foreground">Frete:</span><br /><span className="font-medium">{data.frete_tipo}</span></div>
            )}
          </div>
          {data.observacoes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{data.observacoes}</p>
            </div>
          )}
        </div>

        {/* Action buttons — only when pending and not expired */}
        {!actionDone && !isExpired && !['aprovado', 'rejeitado', 'cancelado'].includes(data.status) && (
          <div className="bg-card rounded-xl border p-6 text-center">
            <p className="text-sm text-muted-foreground mb-5">
              Revise os itens acima e confirme sua resposta:
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white gap-2 min-w-[200px]"
                disabled={actionLoading}
                onClick={() => handleAction('aprovado')}
              >
                <CheckCircle className="h-5 w-5" />
                {actionLoading ? 'Aguarde...' : 'Aceitar esta cotação'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/5 gap-2 min-w-[200px]"
                disabled={actionLoading}
                onClick={() => handleAction('rejeitado')}
              >
                <XCircle className="h-5 w-5" />
                {actionLoading ? 'Aguarde...' : 'Solicitar revisão'}
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation message after action */}
        {actionDone && (
          <div className={`bg-card rounded-xl border-2 p-8 text-center ${
            actionDone === 'aprovado' ? 'border-green-300' : 'border-orange-300'
          }`}>
            {actionDone === 'aprovado' ? (
              <>
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-semibold text-green-700 mb-2">Cotação aceita com sucesso!</p>
                <p className="text-sm text-muted-foreground">
                  Nossa equipe entrará em contato em breve para confirmar os próximos passos.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-orange-700 mb-2">Solicitação de revisão registrada.</p>
                <p className="text-sm text-muted-foreground">
                  Nossa equipe analisará suas considerações e enviará uma nova versão em breve.
                </p>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Documento gerado eletronicamente pelo sistema ERP AviZee.</p>
          <p>Este orçamento é informativo e não tem valor fiscal.</p>
        </div>
      </div>
    </div>
  );
}
