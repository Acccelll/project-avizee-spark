import type { FechamentoDados } from '@/lib/workbook/fechamento/types';

/** Mensal todo mês; trimestral em mar, jun e set; anual em dez. */
export type VersaoApresentacao = 'mensal' | 'trimestral' | 'anual';

/** Detalhe de um mês, vindo de `apresentacao_fechamento_dados`. */
export interface DetalheMes {
  /** Faturamento por grupo de cliente (CNPJ raiz), em ordem decrescente. */
  clientes: Array<{ k: string; v: number; nf: number }>;
  /** Faturamento por UF do cliente. */
  uf: Record<string, number>;
  /** Pagamentos do mês por categoria (mesma base da despesa de caixa). */
  despesas: Record<string, number>;
  /** Até 10 maiores fornecedores pagos no mês. */
  fornecedores: Array<{ nome: string; v: number }>;
}

export interface PendenciasFechamento {
  /** Linhas do extrato do mês ainda pendentes nas contas ativas. */
  extrato_pendentes: number;
  /** Data do último extrato importado até o fim do mês. */
  extrato_ultima_data: string | null;
  /** Notas de saída do mês. */
  notas_saida_mes: number;
}

/** Retorno da RPC `apresentacao_fechamento_dados(p_competencia)`. */
export interface ApresentacaoFechamentoDados {
  competencia: string;
  workbook: FechamentoDados;
  /** Chave = AAAA-MM, de jan/(ano-1) até a competência. */
  detalhe: Record<string, DetalheMes>;
  /** Nome de exibição de cada grupo de cliente. */
  grupos: Record<string, string>;
  /** Mês (AAAA-MM) da primeira nota de cada grupo. */
  primeira_compra: Record<string, string>;
  pendencias: PendenciasFechamento;
}

// ---------------------------------------------------------------------------
// Modelo do deck: independente de PowerPoint ou de tela. O gerador .pptx e a
// prévia da página desenham o mesmo modelo.
// ---------------------------------------------------------------------------

/** Papel da cor no deck; cada renderizador traduz para a paleta da marca. */
export type CorPapel = 'atual' | 'anterior' | 'despesa' | 'bom' | 'ruim' | 'neutro';

export interface Kpi {
  rotulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}

export interface SerieBarras {
  nome: string;
  valores: Array<number | null>;
  cor: CorPapel;
}

export interface PassoPonte {
  rotulo: string;
  valor: number;
  tipo: 'base' | 'entrada' | 'saida';
}

export interface FaixaAging {
  rotulo: string;
  valor: number;
  /** 0 = até 30 dias, 1 = 31–90 dias, 2 = mais de 90 dias, 3 = vencido. */
  nivel: 0 | 1 | 2 | 3;
}

export type Visual =
  | { tipo: 'capa'; eyebrow: string; titulo: string; subtitulo: string; rodape: string }
  | { tipo: 'kpis'; itens: Kpi[] }
  | {
      tipo: 'barras';
      categorias: string[];
      series: SerieBarras[];
      /** Índice da categoria em destaque (o mês ou trimestre atual). */
      destaque?: number;
      /** Barras empilhadas (estoque, resultado positivo/negativo). */
      empilhado?: boolean;
      /** Faixa do limite anual da ME sob o gráfico. */
      limite?: { usado: number; limite: number; rotulo: string };
      /** Linha de referência horizontal (ex.: limite da ME). */
      referencia?: { valor: number; rotulo: string };
    }
  | {
      tipo: 'linhas';
      categorias: string[];
      series: SerieBarras[];
      referencia?: { valor: number; rotulo: string };
      /** Ponto em destaque: série e índice. */
      marca?: { serie: number; indice: number; rotulo: string };
      area?: boolean;
    }
  | { tipo: 'ranking'; itens: Array<{ rotulo: string; valor: number; detalhe: string }>; cor: CorPapel; destaques: number }
  | { tipo: 'ponte'; passos: PassoPonte[]; serie?: { categorias: string[]; valores: number[] } }
  | { tipo: 'aging'; receber: FaixaAging[]; pagar: FaixaAging[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][]; total?: string[]; nota?: string }
  | { tipo: 'mapa'; valores: Record<string, number>; anterior?: { rotulo: string; valores: Record<string, number> }; rotulo: string }
  | { tipo: 'redes'; categorias: string[]; series: Array<{ nome: string; valores: Array<number | null>; cor: CorPapel }> }
  | { tipo: 'lista'; itens: string[] };

export interface Slide {
  /** Identificador estável do slide dentro da versão (para comentários e ocultar). */
  codigo: string;
  /** Rótulo curto do topo do slide. */
  rotulo: string;
  /** Título-conclusão. */
  mensagem: string;
  visual: Visual;
  /** Até três comentários com fatos. */
  comentarios: string[];
  /** Fonte para pessoas, no rodapé. */
  fonte: string;
}

export interface Alerta {
  codigo: string;
  severidade: 'alta' | 'media';
  /** Frase curta para o slide de pontos de atenção (com negrito no início). */
  titulo: string;
  texto: string;
}

export interface Deck {
  versao: VersaoApresentacao;
  competencia: string;
  /** "Setembro de 2026", "3º trimestre de 2026", "2026". */
  periodo: string;
  /** "Fechamento setembro/2026" — vai no rodapé de todos os slides. */
  rodape: string;
  slides: Slide[];
  alertas: Alerta[];
}

/** Edições feitas na página antes de baixar. */
export interface EdicaoSlide {
  mensagem?: string;
  comentarios?: string[];
  /** Itens de slides em lista (pontos de atenção, metas, destaques). */
  itens?: string[];
  oculto?: boolean;
}

export type EdicoesDeck = Record<string, EdicaoSlide>;
