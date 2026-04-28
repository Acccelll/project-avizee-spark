# Faturamento estilo Emissor Sebrae — plano de construção

Adoto o Emissor Sebrae como referência de **escopo funcional, vocabulário e fluxo de telas**, mas implemento dentro do nosso ERP (React + Supabase + sefaz-proxy já existentes). Não vamos clonar a UI: vamos cobrir as mesmas capacidades, reaproveitando o que já temos (cadastros de produtos/clientes/fornecedores, RBAC, certificado A1 no Vault, builder XML 4.00, autorização SEFAZ).

## 1. Mapa de paridade Sebrae × ERP atual

```text
Capítulo Sebrae                 │ Estado no ERP        │ Ação
────────────────────────────────┼──────────────────────┼──────────────────────
Cadastro de Emitente            │ empresa_config OK    │ Endurecer validação + wizard
Configuração Fiscal (CRT, amb)  │ Parcial              │ Aba dedicada "Faturamento"
Certificado A1/A3               │ A1 via Vault OK      │ UI upload + validade + alerta
Cadastro de Produtos/NCM/CST    │ produtos OK          │ Aba Fiscal por produto + grade
Cadastro de Serviços (NFS-e)    │ Inexistente          │ Fora do MVP — fase 2
Cadastro de Clientes/Forn.      │ OK                   │ Adicionar IBGE município + IE
Transportadoras                 │ Inexistente          │ Nova entidade transportadoras
Matriz Fiscal (regras CST/CFOP) │ Inexistente          │ Tabela matriz_fiscal + RPC
Natureza de Operação            │ Campo livre          │ Tabela naturezas_operacao
Permissões (perfis fiscais)     │ user_permissions OK  │ Adicionar recursos fiscais
Emissão NF-e (saída/entrada)    │ Backend OK, UX fraca │ Wizard 5 passos + rascunho
Carta de Correção (CC-e)        │ Inexistente          │ Serviço + UI
Cancelamento NF-e               │ OK                   │ Manter
Inutilização de numeração       │ Serviço OK, sem UI   │ Drawer dedicado
NF-e devolução / complementar   │ Inexistente          │ Modelos pré-preenchidos
Manifestação destinatário (MDe) │ Inexistente          │ Fase 2
NFC-e / CT-e / NFS-e / MDF-e    │ Tela vazia/parcial   │ Fora do MVP
Consulta de documentos          │ Lista NF OK          │ Filtros avançados + ações
Importar XML emitido fora       │ OK                   │ Manter
Exportar XMLs em lote           │ Inexistente          │ Gerar ZIP do período
Status do serviço SEFAZ         │ Health parcial       │ Widget na tela Faturamento
Relatórios fiscais              │ Inexistente          │ Livro Saídas/Entradas + SPED
Rejeições com soluções          │ Toast genérico       │ Catálogo de cStat + ajuda
```

## 2. Arquitetura nova: módulo `/faturamento`

Rota dedicada (separada de `/fiscal`, que vira tela técnica de auditoria de NFs). Layout em 4 abas seguindo o Sebrae:

```text
/faturamento
├─ Painel        → KPIs (autorizadas hoje, rejeitadas, status SEFAZ, certificado)
├─ Emitir        → Wizard NF-e + atalhos (saída/devolução/complementar/remessa)
├─ Backlog       → OVs aprovadas aguardando faturamento + ação "Faturar"
└─ Documentos    → Lista NFs com filtros, ações em lote, exportar XML/DANFE
```

## 3. Wizard "Emitir NF-e" (5 passos, igual ao Sebrae)

```text
Passo 1 — Identificação
  • Tipo (saída/entrada), finalidade (normal/complementar/ajuste/devolução)
  • Natureza da operação (autocomplete da tabela naturezas_operacao)
  • Série, próximo número (auto via SEQUENCE), data emissão/saída

Passo 2 — Destinatário
  • Buscar cliente/fornecedor existente OU cadastrar inline
  • Validação: CPF/CNPJ + IE + UF + IBGE município (bloqueia avanço)
  • indIEDest calculado automaticamente

Passo 3 — Itens
  • Adicionar produto (autocomplete por código/descrição)
  • Aplica matriz fiscal: CFOP por UF emit×UF dest, CST/CSOSN por CRT,
    NCM, alíquotas ICMS/IPI/PIS/COFINS calculadas
  • Permite override por linha (com aviso "fora da matriz")
  • Totalizador em tempo real

Passo 4 — Transporte e pagamento
  • Modalidade do frete (0-9), transportadora (autocomplete),
    placa, volumes, peso bruto/líquido
  • Forma de pagamento (mapeada para tpag SEFAZ) + parcelas (duplicatas)
  • Informações complementares (texto livre + tags %DUPLICATAS%)

Passo 5 — Revisão e transmissão
  • Pré-validação local (preEmissao.validator + ncm + cfop)
  • Painel "o que será enviado" com totais e tributos
  • Botões: [Salvar rascunho] [Transmitir SEFAZ] [Transmitir e baixar DANFE]
```

Cada passo é um componente isolado; rascunho persiste em `notas_fiscais` com `status='rascunho'` (autosave 5s).

## 4. Novidades funcionais (estilo Sebrae)

### 4.1 Matriz Fiscal
Tabela `matriz_fiscal` (escopo: CRT × UF origem × UF destino × tipo operação) com CST/CSOSN, alíquota ICMS, redução BC, FCP, ST, PIS/COFINS, CFOP padrão. RPC `aplicar_matriz_fiscal(produto_id, dest_uf, finalidade)` retorna o item pronto. Tela de cadastro em "Faturamento → Configurações → Matriz Fiscal" com clonagem (botão "Copiar matriz" do Sebrae).

### 4.2 Natureza de Operação
Tabela `naturezas_operacao` (descrição, CFOP padrão dentro/fora UF, finalidade NF-e, movimenta estoque?, gera financeiro?). Vira preset 1-clique no Passo 1.

### 4.3 Carta de Correção (CC-e)
Serviço `cartaCorrecao.service.ts` (evento 110110), drawer no detalhe da NF: textarea (mínimo 15 chars, máximo 1000), histórico de CC-e (até 20 por NF). Persistência em `eventos_fiscais`.

### 4.4 NF-e Devolução / Complementar / Remessa
Botões "Nova devolução", "Nova complementar" no detalhe de uma NF autorizada. Pré-preenche referência (`refNFe`), CFOPs invertidos, finalidade adequada, itens copiados.

### 4.5 Inutilização de numeração
Drawer "Inutilizar números" em "Faturamento → Documentos": série + faixa numérica + justificativa. Exige que os números estejam não usados; persiste em `inutilizacoes` e bloqueia reuso.

### 4.6 Status SEFAZ ao vivo
Widget no Painel chamando `consultaStatusServico` (cStat 107) por UF. Detecta SEFAZ offline e oferece **modo contingência SVC-AN/SVC-RS** (alterando `tpEmis` para 9).

### 4.7 Catálogo de rejeições
Tabela seed `sefaz_rejeicoes_help` com cStat → título amigável + causa provável + ação sugerida (espelho do capítulo "Rejeições e Soluções" do manual). Modal de retorno SEFAZ consulta esta tabela e mostra "Como resolver".

### 4.8 Exportação em lote
Botão "Exportar XMLs do período" gera ZIP com todos `procNFe.xml` autorizados (storage `dbavizee/nfe/`) e DANFEs PDF — usado por contadores.

### 4.9 Permissões por perfil fiscal
Recursos novos em `user_permissions`: `faturamento.emitir`, `faturamento.cancelar`, `faturamento.cce`, `faturamento.inutilizar`, `faturamento.matriz_fiscal`. Perfis sugeridos: Vendedor (emitir), Financeiro (consultar), Contador (CC-e/inutilizar/exportar), Admin (tudo).

## 5. Fundação técnica obrigatória (sem isso nada autoriza)

Mantida do plano anterior, agora explicitada:

- **Numeração atômica**: SEQUENCE `nfe_numero_seq_<serie>` + RPC `proximo_numero_nfe(serie)`.
- **Chave de acesso 44d**: RPC `gerar_chave_acesso_nfe(nf_id)` (UF+AAMM+CNPJ+modelo+série+número+tpEmis+cNF+DV mod11).
- **IBGE município** em `clientes` e `fornecedores` (lookup ViaCEP/IBGE no cadastro).
- **Endurecer `buildNFeDataFromDb`**: NCM válido obrigatório, CFOP derivado, CST/CSOSN conforme CRT, tpag mapeado, sem defaults perigosos.
- **Pós-autorização**: salvar `procNFe.xml` em `dbavizee/nfe/<ano>/<mes>/<chave>.xml`, gerar DANFE PDF, popular `caminho_xml`/`caminho_pdf`, opcional envio email via fila pgmq.
- **Triggers de integração**: NF autorizada → `estoque_movimentos` (saída) + `financeiro_lancamentos` (a receber por parcela).
- **Constraint unicidade**: `(empresa_id, modelo, serie, numero)` única em `notas_fiscais`.

## 6. Roadmap em 6 ondas

```text
Onda 0 — Fundação SEFAZ (bloqueante)  ✅ entregue
  Numeração + chave + IBGE + uniqueness + rigor do payload + persistência XML/DANFE

Onda 1 — Estrutura do módulo /faturamento  ✅ entregue
  Rota, layout 4 abas, KPIs do Painel, widget status SEFAZ

Onda 2 — Cadastros fiscais
  Naturezas de Operação, Matriz Fiscal, Transportadoras, aba Fiscal em produtos,
  IBGE município em clientes/fornecedores, UI upload certificado A1 + alerta validade

Onda 3 — Wizard Emitir NF-e (5 passos)
  Rascunho/autosave, presets de natureza, validação SEFAZ-grade,
  modal de retorno com catálogo de rejeições

Onda 4 — Backlog "Faturar OV"
  Tela com OVs aprovadas, RPC faturar_ordem_venda, faturamento parcial,
  triggers estoque/financeiro

Onda 5 — Eventos pós-emissão e operação
  CC-e (serviço + UI), Inutilização (drawer), NF Devolução/Complementar/Remessa,
  Exportar XMLs em lote, Importar XML emitido fora (já existe — integrar),
  Permissões fiscais granulares
```

## 7. Fora do MVP (fase 2)

NFC-e (precisa CSC + impressora), CT-e (5 modais), NFS-e (350+ municípios diferentes), MDF-e, Manifestação do Destinatário, certificado A3 (precisa middleware no SO do cliente). Mantemos as telas atuais como placeholder até decidirmos investir.

## 8. Pré-requisitos do cliente (operacionais)

1. Certificado A1 (.pfx) + senha
2. CRT, IE ativa, série e numeração inicial definidos
3. NCM/CFOP padrão revisados nos produtos cadastrados
4. Homologação SEFAZ antes de virar para produção

## Como prefere prosseguir?

Sugiro a sequência **Onda 0 → Onda 1 → Onda 3** (fundação + casca + wizard de emissão) para ter algo emitindo NF-e real em homologação o quanto antes; cadastros (Onda 2) e backlog OV (Onda 4) entram em paralelo conforme prioridade. Posso começar pela Onda 0 ou prefere validar antes a estrutura visual da Onda 1 (rota, abas, KPIs)?

---

## Status de implementação

- ✅ **Onda 0** — Fundação: SEQUENCE de numeração, RPC `gerar_chave_acesso_nfe`, IBGE em clientes/fornecedores
- ✅ **Onda 1** — Estrutura: rota `/faturamento` com 4 abas (Painel/Emitir/Backlog/Documentos) e KPIs reais
- ✅ **Onda 2** — Cadastros auxiliares:
  - Tabelas `naturezas_operacao`, `matriz_fiscal`, `ibge_municipios`
  - RPCs `aplicar_matriz_fiscal(produto, uf_destino)` e `buscar_municipio_ibge(nome, uf)`
  - UI `/faturamento/cadastros` com Naturezas (CRUD + 7 seeds) e Matriz Fiscal (CRUD)
  - Hook `useMunicipioIbge` com fallback automático para a API do IBGE
- ✅ **Onda 3** — Wizard 5 passos: /faturamento/emitir com Stepper, autocomplete de cliente/produto, RPC aplicar_matriz_fiscal, resolução automática de IBGE, salvamento como rascunho e redirecionamento para SefazAcoesPanel
- ✅ **Onda 4** — Backlog OV→NF: aba `/faturamento?tab=backlog` lista ordens de venda com `status_faturamento ∈ {pendente, parcial}` e ação "Faturar" abre o wizard com `?ovId=…` (cliente, itens com saldo restante, frete e observações pré-preenchidos; vínculo `notas_fiscais.ordem_venda_id` persistido e OV marcada como `faturado`)
- ✅ **Onda 5** — Eventos pós-emissão:
  - Tabelas `eventos_fiscais` (CC-e/timeline com sequência+XML) e `inutilizacoes_numeracao` (faixa+justificativa+protocolo)
  - Coluna `notas_fiscais.nf_referenciada_chave` para devoluções/complementares
  - Service `cartaCorrecao.service.ts` (evento 110110) + builder `construirXMLCartaCorrecao`
  - `CartaCorrecaoDrawer` (texto 15–1000 chars, sequência 1–20, histórico) integrado ao `SefazAcoesPanel`
  - `InutilizacaoDrawer` (série/ano/faixa/justificativa) acessível pelo Painel e Documentos do Faturamento
  - Botão "Nova Devolução" no `SefazAcoesPanel` redireciona para `/faturamento/emitir?refNFeId=…&finalidade=4`; wizard pré-preenche cliente, itens (CFOP invertido 5xxx→1xxx / 6xxx→2xxx) e referência de chave
- ✅ **Onda 6** — Status SEFAZ por UF (cStat 107) + alternância de Contingência SVC: widget `StatusSefazUFWidget` consulta SEFAZ via sefaz-proxy, `ContingenciaSvcDrawer` grava `empresa_config.modo_emissao_nfe` com motivo (≥15 chars) validado por trigger
- ✅ **Onda 7** — DANFE PDF + envio por e-mail:
  - DANFE com **CODE-128C** (jsbarcode) na chave de acesso
  - Bucket privado `danfe-pdfs` (RLS: upload/leitura authenticated, delete admin)
  - Template transacional `nfe-autorizada` (registry + edge function redeploy)
  - Serviço `enviarDanfePorEmail` (PDF → Storage → signed URL 7d → fila pgmq)
  - Botão "Enviar por e-mail" no `SefazAcoesPanel` com pré-preenchimento do e-mail do cliente
- ✅ **Onda 8** — Manifestação do Destinatário (NF-e de entrada por chave):
  - Tabela `nfe_distribuicao` (chave única 44 dígitos, CNPJ/série/número extraídos da chave, `status_manifestacao ∈ {sem_manifestacao,ciencia,confirmada,desconhecida,nao_realizada}`)
  - Coluna `eventos_fiscais.nfe_distribuicao_id` + relax do `nota_fiscal_id NOT NULL` com `chk_eventos_fiscais_destino`
  - Builder `construirXMLManifestacao` (eventos 210200/210210/210220/210240, cOrgao 91 AN)
  - Service `manifestacao.service.ts` com URL do Ambiente Nacional (prod/hom) + helpers `statusManifestacaoFromEvento` / `tipoEventoFiscalFromManifestacao`
  - `ManifestacaoDestinatarioDrawer`: captura por chave, lista NF-e com badge de status e ações de Ciência / Confirmar / Desconhecer / Não realizada (esta com diálogo de justificativa 15–255 chars)
  - Atalhos no Painel e em Documentos do `/faturamento`
- ✅ **Onda 9** — Importação de XML de NF-e (entrada):
  - `nfe_distribuicao` recebe colunas enriquecidas: `uf_emitente`, `ie_emitente`, `valor_icms`, `valor_ipi`, `natureza_operacao`, `xml_importado`
  - Tabela `nfe_distribuicao_itens` (numero_item, código, descrição, NCM, CFOP, unidade, qtd, valor_unitario, valor_total) com UNIQUE (nfe_distribuicao_id, numero_item) e `chk_` constraints
  - Service `nfeXmlParser.service.ts` (DOMParser nativo, tolerante a namespace) extraindo chave/emitente/totais/itens/protocolo de procNFe ou NFe
  - `ManifestacaoDestinatarioDrawer` ganhou: botão "Importar XML autorizado" (upsert por chave + reescrita atômica de itens), badge "XML" + total formatado por linha, botão "Ver itens" abrindo `ItensDialog` (lazy fetch, tabela com NCM/CFOP/qtd/valores)
- ✅ **Onda 10** — Processamento de NF-e de entrada (estoque + financeiro):
  - `nfe_distribuicao` ganha: `fornecedor_id`, `processado`, `data_processamento`, `financeiro_lancamento_id`
  - `nfe_distribuicao_itens` ganha `produto_id` (vínculo com cadastro)
  - RPC `processar_nfe_distribuicao(p_nfe_id, p_fornecedor_id, p_data_vencimento, p_descricao)` SECURITY DEFINER + search_path=public — atomicamente: gera 1 título consolidado em `financeiro_lancamentos` (origem_tipo='nfe_entrada', origem_id=NF-e, fornecedor + valor + vencimento), insere movimentações em `estoque_movimentos` (tipo=entrada, documento_tipo='nfe_entrada') para cada item com produto mapeado, marca a NF como processada
  - Pré-condições no RPC: status `confirmada` + `xml_importado` + ainda não processada + fornecedor obrigatório
  - UI no `ManifestacaoDestinatarioDrawer`: badge "Processada", botão "Processar entrada" (visível só quando confirmada+importada+não processada) abrindo `ProcessarEntradaDialog` com seleção de fornecedor (sugerido pelo CNPJ emitente), data de vencimento padrão D+30 e mapeamento item→produto inline (Select), retorno mostra contagem `itens_processados / itens_total / itens_sem_produto`
- ✅ **Onda 11** — Visibilidade de NF-e de entrada no Financeiro:
  - `useFinanceiroFiltros`: novo valor `nfe_entrada` em `origemOpts` e label "NF-e de Entrada" em `origemLabelMap` (alias adicional `fiscal_nota`)
  - `getOrigemLabel` (src/lib/financeiro.ts) reconhece `origem_tipo='nfe_entrada'` → "NF-e de Entrada"
  - `FinanceiroDrawer` (aba Origem): novo `RelationalLink` "Ver NF-e de entrada original" quando `origem_tipo='nfe_entrada'` + `origem_id` definido, navegando para `/faturamento?tab=manifestacao&nfe=<id>`
  - `ManifestacaoDestinatarioDrawer` aceita `highlightNfeId` (opcional): rola até o `<li>` da NF correspondente e aplica anel `border-primary ring-2 ring-primary/30 bg-primary/5`
  - `Faturamento.tsx`: efeito de deep-link consome `?tab=manifestacao&nfe=<id>` → abre o drawer com destaque, limpa os params para evitar reabertura
- ✅ **Onda 12** — Relatório "NF-e de Entrada":
  - Novo `TipoRelatorio: 'nfe_entrada'` em `src/services/relatorios/lib/shared.ts`
  - Loader `loadNfeEntrada(filtros)` em `src/services/relatorios/loaders/compras.ts`: lê `nfe_distribuicao` (com join em `fornecedores`), aplica `withDateRange('data_emissao')` + filtro `fornecedorIds`, monta linhas com fornecedor (fallback para `nome_emitente` ou `cnpj_emitente`), totais (valor/ICMS/IPI), KPIs (`qtdNfe`, `totalEntradas`, `totalIcms`, `totalIpi`, `processadas`) e chartData agregado por mês (`YYYY-MM`)
  - `nfeEntradaConfig` em `src/config/relatoriosConfig.ts` (categoria `fiscal_faturamento`, ícone Receipt): colunas Emissão/Nº/Série/Fornecedor/CNPJ/Valor/ICMS/IPI/Status/Processada com `footerTotal` em valores; filtros de fornecedor e status (`sem_manifestacao|ciencia|confirmada|desconhecida|nao_realizada`); drill-down para `/fornecedores` e `/faturamento`
  - `reportRuntimeSemantics.nfe_entrada` (statusField='status', dateSortField='emissao', valueSortField='valor')
  - Dispatcher `carregarRelatorio` roteia `case 'nfe_entrada'`
- ✅ **Onda 13** — DistDF-e (download automático de NF-e via SEFAZ AN, mTLS):
  - Tabela `nfe_distdfe_sync` (cnpj+ambiente, ultimo_nsu, max_nsu, ultima_sync_at, cStat/xMotivo, qtd_docs) com `chk_distdfe_ambiente`, `chk_distdfe_cnpj_len` e UNIQUE(cnpj,ambiente); RLS: select autenticados, insert/update admin+financeiro, delete admin
  - Coluna `nfe_distribuicao.nsu` para correlacionar NF-e com NSU de origem
  - Edge function `sefaz-distdfe` (action `consultar-nsu`): lê PFX do storage `dbavizee/certificados/empresa.pfx` + senha `CERTIFICADO_PFX_SENHA`, converte para PEM via node-forge, cria `Deno.createHttpClient({cert,key})` para mTLS, monta `<distDFeInt>` (cUFAutor=91, distNSU/ultNSU 15 dígitos), envia SOAP 1.2 ao Ambiente Nacional (prod/hom), parseia `<retDistDFeInt>` e descomprime cada `<docZip>` (gzip+base64) via fflate, extrai chave/CNPJ/valor/data/numero/serie de cada documento
  - Service `distdfe.service.ts` (`sincronizarDistDFe(ambiente)`): lê último NSU de `nfe_distdfe_sync`, invoca a edge function, faz `upsert` em `nfe_distribuicao` por `chave_acesso` (idempotente, apenas docs com chave 44 dígitos), atualiza `nfe_distdfe_sync` (cnpj+ambiente) com novo NSU/contagem
  - UI `ManifestacaoDestinatarioDrawer`: botão primário "Sincronizar SEFAZ (DistDF-e)" no topo do drawer com toast de resultado (`X nova(s), Y existente(s), NSU u/m`), invalida `nfe-distribuicao`
  - Reaproveitamento total do A1 + senha já cadastrados na Onda 0 (sem novos secrets)
- ✅ **Onda 14** — Cron diário DistDF-e (sincronização automática):
  - Edge function `process-distdfe-cron` (verify_jwt=false, chamada apenas pelo pg_cron com anon key): lista todos CNPJs em `nfe_distdfe_sync` para o ambiente (default 2/homologação), invoca internamente `sefaz-distdfe` (action consultar-nsu) por CNPJ, faz upsert idempotente em `nfe_distribuicao` por `chave_acesso`, atualiza `ultimo_nsu`/`max_nsu`/`ultima_sync_at` e registra resumo agregado em `auditoria_logs` (acao='distdfe_cron_run', dados_novos com totais e detalhes por CNPJ)
  - Fallback: se `nfe_distdfe_sync` estiver vazio, faz uma sondagem inicial (`ultNSU='0'`, cnpj='auto') — a edge function descobre o CNPJ a partir do A1
  - Agendamento via `pg_cron` (job `process-distdfe-cron-daily`): cron `0 6 * * *` (06:00 UTC ≈ 03:00 BRT) → `net.http_post` para `/functions/v1/process-distdfe-cron`
  - Re-execuções manuais possíveis via `supabase.functions.invoke('process-distdfe-cron', { body: { ambiente: '1' | '2' } })` por admins
- ✅ **Onda 15** — Histórico DistDF-e (`/fiscal/distdfe-historico`):
  - Página nova `src/pages/fiscal/DistDFeHistorico.tsx` (lazy + `PermissionRoute resource="faturamento_fiscal"`): lê `auditoria_logs` filtrado por `acao='distdfe_cron_run'` (limit 50, ordem desc) — registros gravados pela edge function da Onda 14
  - KPIs: total de execuções (50), NF-e novas (10), erros (10); card destacado da última execução com ambiente, totais e timestamp formatado pt-BR
  - Lista accordion-style de execuções: clique expande detalhes por CNPJ (status OK/Falha, novos/duplicados, cStat/xMotivo/erro)
  - Botões: "Atualizar" (recarrega), "Executar agora (Hom.)" e "Produção" (dispara `sincronizarDistDFe(ambiente)` — útil para testes manuais sem aguardar o cron)
  - Link "Ver histórico de execuções →" no `ManifestacaoDestinatarioDrawer` (próximo ao botão de sincronização) para acesso direto
- ✅ **Onda 16** — Notificação proativa de NF-e de entrada novas:
  - `nfe_distribuicao` adicionada à publication `supabase_realtime` (REPLICA IDENTITY FULL) — qualquer INSERT do cron `process-distdfe-cron` chega ao client em tempo real
  - Canal singleton `alertsChannel` agora escuta também `public.nfe_distribuicao` (broadcast → invalida `sidebar-alerts`)
  - `SidebarAlertsRaw` ganha `nfeEntradaSemManifestacao`: COUNT(*) em `nfe_distribuicao WHERE status_manifestacao='sem_manifestacao'`
  - `useSidebarBadges`: badge da seção `fiscal` agora soma NF-e rejeitadas (saída) + NF-e de entrada sem manifestação; tone vira `warning` quando só há entradas pendentes (preserva `danger` para rejeições). Item-badge separado em `/faturamento` com tone `warning`
  - Hook `useNfeEntradaToast` (montado no `AppLayout`): observa `nfeEntradaSemManifestacao` via `useSidebarAlerts`, persiste último valor em `sessionStorage`, dispara `toast.info` com action "Ver" → `/faturamento?tab=manifestacao` quando o contador aumenta. Ignora primeira leitura (snapshot inicial não é "novo")
- ✅ **Onda 17** — Auto-Ciência DistDF-e (manifestação automática 210210):
  - Flag `app_configuracoes.distdfe_auto_ciencia` (boolean, default false) lida via `useAppConfig`
  - Service `src/services/fiscal/autoCiencia.service.ts`:
    - `aplicarCienciaEmLote(notas)`: carrega CNPJ destinatário e ambiente de `empresa_config`, recheca status atual de cada NF (idempotência), invoca `enviarManifestacao(210210)` (reusa serviço existente já testado, com XMLDSig + sefaz-proxy), persiste `eventos_fiscais` (motivo_retorno='auto-ciencia') e atualiza `nfe_distribuicao.status_manifestacao='ciencia'`. Retorna `{total, sucesso, falhas, detalhes[]}`
    - `buscarNfeSemManifestacao(limite)`: lista NF-e elegíveis ordenadas por created_at
  - Hook `useAutoCienciaDistDFe` (montado no `AppLayout`): quando flag ligada, observa `nfeEntradaSemManifestacao`; ao aumentar (sinal do cron), dispara `aplicarCienciaEmLote` em background com toast loading→success/error. Ref `running` previne reentrada (1 execução por vez); ignora primeira leitura
  - UI em `/fiscal/distdfe-historico` — novo card "Auto-Ciência da Operação" com:
    - Switch ligando/desligando a flag (persiste via `useAppConfig` → `app_configuracoes`)
    - Botão "Aplicar ciência em lote agora" (manual) que executa o lote sem precisar esperar o cron, útil para limpar backlog
  - Decisão arquitetural: manifestação roda no client (não no edge function) porque o serviço `enviarManifestacao` já assina XMLDSig localmente e usa o `sefaz-proxy` mTLS — reaproveitamento total, sem duplicar lógica de assinatura no edge
