import type { BuscaGlobalItem } from '../types';

const REGEX_CHAVE_NFE = /^\d{44}$/;
const REGEX_CNPJ = /^\d{14}$/;
const REGEX_CPF = /^\d{11}$/;
const REGEX_NSU = /^\d{15}$/;
const REGEX_PROTOCOLO = /^\d{15}$/;

/**
 * Detector de tipo por padrão do termo. Indexação real é resolvida por adapters do ERP;
 * este serviço só classifica e sugere destinos.
 */
export class BuscaGlobalFiscalService {
  classificar(termo: string): BuscaGlobalItem['tipo'] {
    const t = termo.replace(/\D/g, '');
    if (REGEX_CHAVE_NFE.test(t)) return 'chave';
    if (REGEX_CNPJ.test(t)) return 'cnpj';
    if (REGEX_CPF.test(t)) return 'cpf';
    if (REGEX_PROTOCOLO.test(t) || REGEX_NSU.test(t)) return 'protocolo';
    return 'numero';
  }

  sugerirHref(item: BuscaGlobalItem): string | undefined {
    switch (item.tipo) {
      case 'chave': return `/fiscal?chave=${item.valor}`;
      case 'cnpj': return `/fornecedores?q=${item.valor}`;
      case 'cpf': return `/clientes?q=${item.valor}`;
      case 'protocolo': return `/fiscal?protocolo=${item.valor}`;
      case 'nsu': return `/fiscal/distdfe-historico?nsu=${item.valor}`;
      case 'numero': return `/fiscal?numero=${item.valor}`;
      default: return undefined;
    }
  }
}
