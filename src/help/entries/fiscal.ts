import type { HelpEntry } from '../types';

export const fiscalHelp: HelpEntry = {
  route: '/fiscal',
  title: 'Fiscal — NF-e',
  summary: 'Emissão, consulta e cancelamento de notas fiscais eletrônicas (entrada e saída) com integração SEFAZ via certificado A1.',
  sections: [
    {
      heading: 'Tipos de nota',
      body: 'Saída (venda, devolução de compra), Entrada (compra, devolução de venda) e Ajustes. Use o seletor no topo para alternar.',
    },
    {
      heading: 'Ciclo de vida',
      body: 'Rascunho → Em transmissão → Autorizada / Rejeitada / Denegada. Notas autorizadas podem ser canceladas em até 24h pela SEFAZ; depois disso, apenas Carta de Correção (CC-e) para campos permitidos.',
    },
    {
      heading: 'Certificado digital',
      body: 'Necessário um certificado A1 (.pfx) configurado em Administração → Fiscal. A senha fica em cofre seguro (vault), nunca no banco em texto puro.',
    },
    {
      heading: 'Contingência',
      body: 'Em caso de falha SEFAZ, o sistema oferece reenvio automático com backoff. Notas em "Em transmissão" há mais de 5 minutos disparam alerta.',
    },
    {
      heading: 'XMLs',
      body: 'XMLs de envio e retorno ficam armazenados no bucket "dbavizee" e podem ser baixados a qualquer momento via ações da nota.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + Shift + N', desc: 'Nova nota fiscal' },
    { keys: 'Ctrl/Cmd + 6', desc: 'Ir para Fiscal' },
  ],
  related: [
    { label: 'Pedidos', to: '/pedidos' },
    { label: 'Configuração fiscal', to: '/administracao' },
  ],
  tour: [
    {
      target: 'fiscal.filtros',
      title: 'Filtros e busca',
      body: 'Filtre por tipo (entrada/saída), modelo, status ERP, status SEFAZ e origem. Use a busca para localizar por número, chave ou parceiro.',
    },
    {
      target: 'fiscal.tabela',
      title: 'Notas emitidas',
      body: 'O badge de status sinaliza o estágio na SEFAZ. Clique para ver XML, DANFE e ações.',
    },
  ],
  version: 2,
};