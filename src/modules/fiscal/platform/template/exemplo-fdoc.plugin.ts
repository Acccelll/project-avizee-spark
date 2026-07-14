/**
 * Exemplo (não-produtivo) de plugin para um "F-Doc" fictício.
 * Usado no template e nos testes de extensibilidade — jamais utilizar em produção.
 */
import { definePlugin, defineLayout, defineServico, defineValidador, defineBuilder, defineWorkflow, ok, fail } from '../sdk';
import type { PluginDocumentoFiscal } from '../types';

export const FDocPlugin: PluginDocumentoFiscal = definePlugin({
  codigo: 'fdoc',
  nome: 'Documento Fictício de Teste',
  versao: '1.0.0',
  capacidades: ['emissao', 'autorizacao', 'cancelamento', 'consulta'],
  layouts: [
    defineLayout({ chave: 'fdoc.autorizacao', versao: '1.0', documento: 'fdoc' }),
  ],
  builders: [
    defineBuilder<{ id: string; total: number }, string>({
      id: 'fdoc.xml',
      documento: 'fdoc',
      formato: 'xml',
      build: (i) => `<fdoc><id>${i.id}</id><total>${i.total.toFixed(2)}</total></fdoc>`,
    }),
  ],
  validadores: [
    defineValidador<{ id?: string; total?: number }>({
      id: 'fdoc.basico',
      documento: 'fdoc',
      run: (i) => {
        const erros: Array<{ codigo: string; mensagem: string; campo?: string }> = [];
        if (!i.id) erros.push({ codigo: 'FD001', mensagem: 'id obrigatório', campo: 'id' });
        if (i.total === undefined || i.total < 0) erros.push({ codigo: 'FD002', mensagem: 'total inválido', campo: 'total' });
        return erros.length === 0 ? ok() : { ok: false, erros };
      },
    }),
  ],
  servicos: [
    defineServico({
      nome: 'authorize', versao: '1.0', documento: 'fdoc',
      capacidades: ['autorizacao'], contrato: 'IAuthorize',
      handler: async () => ({ protocolo: 'FDOC-000001', status: 100 }),
    }),
  ],
  workflows: [
    defineWorkflow({
      id: 'fdoc.emissao', documento: 'fdoc', capacidade: 'emissao',
      passos: [
        { id: 'validar', execute: async (ctx) => { ctx.data.validado = true; } },
        { id: 'construir', execute: async (ctx) => { ctx.data.xml = '<fdoc/>'; } },
        { id: 'autorizar', execute: async (ctx) => { ctx.data.protocolo = 'FDOC-1'; } },
      ],
    }),
  ],
  eventos: [
    { nome: 'fiscal.fdoc.autorizada', documento: 'fdoc', categoria: 'fiscal' },
  ],
});
