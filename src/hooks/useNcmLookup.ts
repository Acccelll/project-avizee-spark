import { useState } from 'react';
import { toast } from 'sonner';

interface NcmResult {
  codigo: string;
  descricao: string;
}

export function useNcmLookup() {
  const [loading, setLoading] = useState(false);

  const buscarNcm = async (ncm: string): Promise<NcmResult | null> => {
    const clean = ncm.replace(/\D/g, '');
    if (clean.length < 4) return null;
    setLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/ncm/v1/${clean}`);
      if (!res.ok) {
        if (res.status === 404) toast.error('NCM não encontrado na tabela TIPI.');
        else toast.error('Erro ao consultar NCM. Tente novamente.');
        return null;
      }
      const data = await res.json();
      const descricao = (data.descricao || '').substring(0, 80);
      toast.success(`NCM ${data.codigo}: ${descricao}${data.descricao?.length > 80 ? '...' : ''}`);
      return { codigo: data.codigo, descricao: data.descricao };
    } catch {
      toast.error('Erro de conexão ao consultar NCM.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { buscarNcm, loading };
}
