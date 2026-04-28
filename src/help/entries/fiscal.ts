import type { HelpEntry } from '../types';

export const fiscalHelp: HelpEntry = {
  route: '/fiscal',
  title: 'Fiscal — NF-e',
  summary: 'Emissão, consulta, cancelamento e contingência de notas fiscais eletrônicas (entrada e saída) com integração SEFAZ via certificado A1.',
  sections: [
    {
      heading: 'Estrutura da tela',
      body: 'A URL ?tipo=entrada/saida controla o tipo exibido — alternar muda título, KPIs e ações. Filtros avançados permitem refinar por modelo, status ERP, status SEFAZ e origem.',
    },
    {
      heading: 'Tipos de nota',
      body: 'Saída (venda, devolução de compra), Entrada (compra, devolução de venda) e Ajustes. Para entrada existe importação de XML — útil para registrar NF-e recebidas de fornecedores.',
    },
    {
      heading: 'Ciclo de vida',
      body: 'Rascunho → Em transmissão → Autorizada / Rejeitada / Denegada. Notas autorizadas podem ser canceladas em até 24h pela SEFAZ; depois disso, apenas Carta de Correção (CC-e) para campos permitidos pela legislação.',
    },
    {
      heading: 'Status SEFAZ',
      body: 'Badges coloridos seguem o contrato: verde (autorizada), vermelho (rejeitada/denegada), âmbar (em processamento), cinza (não enviada). Rejeições mostram o motivo SEFAZ no drawer.',
    },
    {
      heading: 'Certificado digital',
      body: 'Necessário um certificado A1 (.pfx) configurado em Administração → Fiscal. A senha fica em cofre seguro (Vault), nunca em texto puro no banco. O alerta de validade aparece no topo da tela 30 dias antes do vencimento.',
    },
    {
      heading: 'Contingência',
      body: 'Em caso de falha SEFAZ, o sistema oferece reenvio automático com backoff exponencial. Notas em "Em transmissão" há mais de 5 minutos disparam alerta para o operador.',
    },
    {
      heading: 'XMLs e DANFE',
      body: 'XMLs de envio e retorno ficam armazenados no bucket "dbavizee" e podem ser baixados a qualquer momento via ações da nota. DANFE é gerada sob demanda em PDF.',
    },
    {
      heading: 'Ações por linha',
      body: 'Visualizar (drawer com tributos), Baixar XML, Baixar DANFE, Enviar por e-mail, Carta de Correção (CC-e), Cancelar (motivo + 24h), Devolução (gera nota de retorno) — disponíveis conforme status.',
    },
    {
      heading: 'Importar XML (entrada)',
      body: 'Para notas de entrada (compras), use "Importar XML" no header. O sistema lê o XML, cadastra automaticamente o fornecedor (se novo) e propõe vínculo com pedido de compra existente.',
    },
  ],
  shortcuts: [
    { keys: 'Ctrl/Cmd + Shift + N', desc: 'Nova nota fiscal' },
    { keys: 'Ctrl/Cmd + 6', desc: 'Ir para Fiscal' },
  ],
  related: [
    { label: 'Pedidos', to: '/pedidos' },
    { label: 'Configuração fiscal', to: '/administracao' },
    { label: 'Logística', to: '/logistica' },
  ],
  tour: [
    {
      target: 'fiscal.filtros',
      title: 'Filtros e busca',
      body: 'Filtre por modelo, status ERP, status SEFAZ e origem. Busca cobre número, chave de acesso e nome do parceiro. Quando ?tipo está na URL, o filtro de tipo fica oculto.',
    },
    {
      target: 'fiscal.tabela',
      title: 'Lista de notas',
      body: 'O badge de status sinaliza o estágio na SEFAZ. Cores seguem o contrato global. Clique para abrir o drawer com tributos detalhados.',
    },
    {
      target: '',
      title: 'Ações por linha',
      body: 'A partir da linha: Baixar XML, Baixar DANFE, Enviar por e-mail, CC-e, Cancelar (24h), Devolução. Ações disponíveis variam pelo status SEFAZ.',
    },
    {
      target: 'fiscal.novoBtn',
      title: 'Emitir nova nota',
      body: 'Abre o formulário com itens, tributos calculados e validação SEFAZ. Para entrada, prefira "Importar XML" para evitar redigitação.',
    },
    {
      target: '',
      title: 'Carta de Correção (CC-e)',
      body: 'Após 24h de autorização, use CC-e para corrigir campos permitidos pela legislação (ex.: dados do destinatário não-essenciais). Não corrige valores ou itens.',
    },
    {
      target: '',
      title: 'Contingência e reenvio',
      body: 'Falhas de comunicação com a SEFAZ disparam reenvio automático com backoff. Após 5 min em "Em transmissão", a nota fica destacada para ação manual.',
    },
  ],
  version: 3,
};
