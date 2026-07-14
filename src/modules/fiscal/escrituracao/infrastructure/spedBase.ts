/**
 * Base arquitetural para SPED Fiscal / Contribuições.
 * Registros são plugáveis; esta etapa entrega apenas a infraestrutura.
 */

export interface SpedRegistroSpec {
  codigo: string; // ex: '0000', 'C100'
  bloco: string; // ex: '0', 'C', '9'
  campos: string[];
  versao: string;
}

export interface SpedLinha {
  registro: string;
  valores: (string | number | null | undefined)[];
}

export class SpedLayoutRegistry {
  private specs = new Map<string, SpedRegistroSpec>();

  registrar(spec: SpedRegistroSpec): void {
    this.specs.set(`${spec.versao}:${spec.codigo}`, spec);
  }

  obter(versao: string, codigo: string): SpedRegistroSpec | undefined {
    return this.specs.get(`${versao}:${codigo}`);
  }

  listarPorBloco(versao: string, bloco: string): SpedRegistroSpec[] {
    return [...this.specs.values()].filter((s) => s.versao === versao && s.bloco === bloco);
  }
}

export function serializarLinha(linha: SpedLinha): string {
  const valores = linha.valores.map((v) => (v === null || v === undefined ? '' : String(v)));
  return `|${linha.registro}|${valores.join('|')}|`;
}

export function validarLinha(spec: SpedRegistroSpec, linha: SpedLinha): string[] {
  const erros: string[] = [];
  if (linha.registro !== spec.codigo) erros.push(`Registro ${linha.registro} != esperado ${spec.codigo}`);
  if (linha.valores.length !== spec.campos.length) {
    erros.push(`Nº de campos ${linha.valores.length} != esperado ${spec.campos.length}`);
  }
  return erros;
}

export class SpedSerializer {
  constructor(private readonly registry: SpedLayoutRegistry, private readonly versao: string) {}

  serializarBloco(bloco: string, linhas: SpedLinha[]): string {
    return linhas
      .map((l) => {
        const spec = this.registry.obter(this.versao, l.registro);
        if (!spec) throw new Error(`Registro ${l.registro} não registrado no layout ${this.versao}`);
        const erros = validarLinha(spec, l);
        if (erros.length) throw new Error(`SPED ${l.registro}: ${erros.join('; ')}`);
        return serializarLinha(l);
      })
      .join('\n');
  }
}

/** Base para EFD-Reinf/eSocial: infraestrutura de fila/contrato sem eventos específicos. */
export interface EventoObrigacaoAcessoria {
  tipo: 'efd-reinf' | 'esocial';
  codigo: string;
  payload: Record<string, unknown>;
  criadoEm: string;
}

export interface IObrigacoesAcessoriasQueue {
  enfileirar(evento: EventoObrigacaoAcessoria): Promise<void>;
  drenar(limit?: number): Promise<EventoObrigacaoAcessoria[]>;
}

export class InMemoryObrigacoesQueue implements IObrigacoesAcessoriasQueue {
  private items: EventoObrigacaoAcessoria[] = [];
  async enfileirar(evento: EventoObrigacaoAcessoria): Promise<void> {
    this.items.push(evento);
  }
  async drenar(limit = 100): Promise<EventoObrigacaoAcessoria[]> {
    const out = this.items.slice(0, limit);
    this.items = this.items.slice(limit);
    return out;
  }
}
