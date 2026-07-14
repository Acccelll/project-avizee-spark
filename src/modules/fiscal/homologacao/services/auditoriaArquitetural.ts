/**
 * Regras leves de auditoria arquitetural para o módulo fiscal.
 * Não é um linter completo — valida invariantes estruturais críticos.
 */

export interface DependenciaModulo {
  origem: string; // ex: 'nfe/domain'
  destino: string; // ex: 'infrastructure/soap'
}

export interface ViolacaoArquitetural {
  regra: string;
  origem: string;
  destino: string;
  mensagem: string;
}

/**
 * `domain` nunca pode depender de `infrastructure` (Clean Architecture).
 * `application` só pode depender de `domain` e de contratos (não de infra concreta).
 */
export class AuditoriaArquitetural {
  analisar(deps: DependenciaModulo[]): ViolacaoArquitetural[] {
    const violacoes: ViolacaoArquitetural[] = [];
    for (const d of deps) {
      if (d.origem.includes('/domain') && d.destino.includes('/infrastructure')) {
        violacoes.push({
          regra: 'domain-nao-depende-de-infra',
          origem: d.origem,
          destino: d.destino,
          mensagem: 'Camada domain não pode importar infrastructure',
        });
      }
      if (
        d.origem.includes('/application') &&
        d.destino.includes('/infrastructure') &&
        !d.destino.includes('/contracts')
      ) {
        violacoes.push({
          regra: 'application-depende-de-contratos',
          origem: d.origem,
          destino: d.destino,
          mensagem: 'Camada application só pode depender de infra via portas/contratos',
        });
      }
    }
    return violacoes;
  }
}
