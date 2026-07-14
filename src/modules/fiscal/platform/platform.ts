import { DocumentoRegistry } from './registries/documentoRegistry';
import { PlatformLayoutRegistry } from './registries/layoutRegistry';
import { ServicoRegistry } from './registries/servicoRegistry';
import { ValidadorRegistry } from './registries/validadorRegistry';
import { BuilderRegistry } from './registries/builderRegistry';
import { EventoRegistry } from './registries/eventoRegistry';
import { IntegracaoRegistry } from './registries/integracaoRegistry';
import { WorkflowRegistry, WorkflowExecutor } from './registries/workflowRegistry';
import type { FiscalPlatformAPI, PluginDocumentoFiscal } from './types';

/**
 * Fiscal Platform — núcleo agnóstico de documento.
 * Concentra apenas registries, factories e o executor de workflows.
 * Nenhuma regra específica de NF-e (ou qualquer outro documento) reside aqui.
 */
export class FiscalPlatform implements FiscalPlatformAPI {
  documentos = new DocumentoRegistry();
  layouts = new PlatformLayoutRegistry();
  servicos = new ServicoRegistry();
  validadores = new ValidadorRegistry();
  builders = new BuilderRegistry();
  eventos = new EventoRegistry();
  integracoes = new IntegracaoRegistry();
  workflows = new WorkflowRegistry();
  executor = new WorkflowExecutor();

  async use(plugin: PluginDocumentoFiscal): Promise<void> {
    this.documentos.register(plugin);
    plugin.layouts?.forEach((l) => this.layouts.register(l));
    plugin.servicos?.forEach((s) => this.servicos.register(s));
    plugin.validadores?.forEach((v) => this.validadores.register(v));
    plugin.builders?.forEach((b) => this.builders.register(b));
    plugin.eventos?.forEach((e) => this.eventos.register(e));
    plugin.integracoes?.forEach((i) => this.integracoes.register(i));
    plugin.workflows?.forEach((w) => this.workflows.register(w));
    await plugin.onRegister?.(this);
  }

  /** Descoberta automática — recebe uma coleção (ex.: import.meta.glob resolvido em runtime). */
  async discover(plugins: Iterable<PluginDocumentoFiscal>) {
    for (const p of plugins) await this.use(p);
  }

  snapshot() {
    return {
      documentos: this.documentos.list().map((d) => ({
        codigo: d.codigo, nome: d.nome, versao: d.versao, capacidades: d.capacidades,
      })),
      layouts: this.layouts.all().length,
      servicos: this.servicos.list().length,
      validadores: this.validadores.list.length, // ver método específico se necessário
      builders: this.builders.list().length,
      eventos: this.eventos.list().length,
      integracoes: this.integracoes.list().length,
      workflows: this.workflows.list().length,
    };
  }
}

let _platform: FiscalPlatform | null = null;
export function getFiscalPlatform(): FiscalPlatform {
  if (!_platform) _platform = new FiscalPlatform();
  return _platform;
}
export function resetFiscalPlatform() { _platform = null; }
