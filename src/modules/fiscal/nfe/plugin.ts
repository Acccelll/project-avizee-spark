/**
 * Adapter/plugin da NF-e para a Fiscal Platform (Etapa 13).
 * Não altera o comportamento existente da NF-e (Etapas 6-7): apenas expõe
 * suas capacidades como plugin, permitindo descoberta e coexistência com
 * futuros documentos (NFC-e/CT-e/MDF-e/etc).
 */
import { definePlugin, defineLayout, defineEvento } from '../platform/sdk';
import type { PluginDocumentoFiscal } from '../platform/types';

export const NFePlugin: PluginDocumentoFiscal = definePlugin({
  codigo: 'nfe',
  nome: 'Nota Fiscal Eletrônica (modelo 55)',
  versao: '4.00',
  capacidades: [
    'emissao', 'autorizacao', 'cancelamento', 'consulta',
    'inutilizacao', 'cce', 'manifestacao', 'distdfe', 'sincronizacao',
  ],
  layouts: [
    defineLayout({ chave: 'nfe.autorizacao', versao: '4.00', documento: 'nfe' }),
    defineLayout({ chave: 'nfe.evento.cancelamento', versao: '1.00', documento: 'nfe' }),
    defineLayout({ chave: 'nfe.evento.cce',           versao: '1.00', documento: 'nfe' }),
    defineLayout({ chave: 'nfe.inutilizacao',         versao: '4.00', documento: 'nfe' }),
    defineLayout({ chave: 'nfe.distdfe',              versao: '1.01', documento: 'nfe' }),
  ],
  eventos: [
    defineEvento({ nome: 'fiscal.nfe.autorizada',       documento: 'nfe', categoria: 'fiscal' }),
    defineEvento({ nome: 'fiscal.nfe.rejeitada',        documento: 'nfe', categoria: 'fiscal' }),
    defineEvento({ nome: 'fiscal.nfe.cancelamento.homologado', documento: 'nfe', categoria: 'fiscal' }),
    defineEvento({ nome: 'fiscal.nfe.cce.homologada',   documento: 'nfe', categoria: 'fiscal' }),
    defineEvento({ nome: 'fiscal.nfe.distdfe.consultado', documento: 'nfe', categoria: 'integracao' }),
  ],
});
