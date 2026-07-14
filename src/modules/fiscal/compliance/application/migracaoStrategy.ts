/**
 * Estratégia de migração e rollback para layouts, regras, parâmetros e schema.
 * Cada passo declara `apply` e `rollback` para permitir reversão segura.
 */
export interface PassoMigracao {
  id: string;
  descricao: string;
  apply: () => Promise<void>;
  rollback: () => Promise<void>;
}

export interface ResultadoMigracao {
  aplicados: string[];
  revertidos: string[];
  erro?: string;
}

export class MigracaoRunner {
  async executar(passos: PassoMigracao[]): Promise<ResultadoMigracao> {
    const aplicados: string[] = [];
    try {
      for (const p of passos) {
        await p.apply();
        aplicados.push(p.id);
      }
      return { aplicados, revertidos: [] };
    } catch (e) {
      const revertidos: string[] = [];
      for (const id of [...aplicados].reverse()) {
        const p = passos.find((x) => x.id === id)!;
        try { await p.rollback(); revertidos.push(id); } catch { /* segue */ }
      }
      return { aplicados, revertidos, erro: e instanceof Error ? e.message : String(e) };
    }
  }
}
