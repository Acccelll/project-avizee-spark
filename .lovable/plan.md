

# Revisão técnica e funcional — Módulo Fiscal

## 1) Visão geral do módulo

O módulo Fiscal está concentrado em três páginas e um conjunto denso de componentes/services:

- **`/fiscal` (`src/pages/Fiscal.tsx`, 984 linhas)** — God component que orquestra grid, KPIs, filtros, modal de criação inline, modal de edição (`NotaFiscalEditModal`), drawer de visualização (`NotaFiscalDrawer`), import de XML, devolução (`DevolucaoDialog`), DANFE (`DanfeViewer`) e ações de ciclo de vida (confirmar, estornar, inativar rascunho).
- **`/fiscal/:id` (`src/pages/FiscalDetail.tsx`)** — shell que carrega a NF e reabre o `NotaFiscalDrawer` em modo deep-link.
- **`NotaFiscalView`** — visão rápida usada no sistema de drawers relacionais (`pushView`).

Camada de domínio:

- **`src/lib/fiscalStatus.ts`** — máquina visual com dois eixos (status interno × status SEFAZ), helpers `canConfirmFiscal`, `canEstornarFiscal`, `canDevolverFiscal`, `isFiscalReadOnly`, `isFiscalStructurallyLocked`.
- **`src/lib/fiscal.ts`** — fórmulas puras (totais, parcelas, CFOP devolução, status faturamento OV).
- **`src/lib/fiscalUtils.ts`** — helper para reconciliar `nota_fiscal_id` × `documento_fiscal_id`.
- **`src/utils/fiscal/calculoImpostos.ts`** — ICMS, ICMS-ST, DIFAL, PIS/COFINS (puro, não consumido pela página principal).

Serviços:

- **`src/services/fiscal.service.ts` (531 linhas)** — `confirmarNotaFiscal`, `estornarNotaFiscal`, `processarDevolucao`, `registrarEventoFiscal`, `cancelarNotaFiscal`, `cancelarNotaFiscalSefaz`, `inutilizarNotaFiscal`, `verificarDuplicidadeChave`, `updateOVFaturamento` (interno).
- **`src/services/fiscal/sefaz/*`** — `autorizarNFe`, `cancelarNFe`, `inutilizarNumeracao`, `consultarNFe`, `xmlBuilder`, `httpClient` (proxy para edge `sefaz-proxy`).
- **`src/services/fiscal/certificado.service.ts`** + **`CertificadoValidadeAlert`** — leitura/validação A1.
- **`src/services/fiscal/tributacao.service.ts`** — `sugerirTributacao`.
- **`src/services/fiscal/validadores/*`** — chave de acesso, NCM, CFOP, CEST, IE.

Hooks dedicados:

- **`useNotaFiscalLifecycle`** — `useConfirmarNotaFiscal`, `useEstornarNotaFiscal`, `useGerarDevolucaoNF` apoiados em RPCs transacionais (`confirmar_nota_fiscal`, `estornar_nota_fiscal`, `gerar_devolucao_nota_fiscal`).
- **`useSefazAutorizacao`** / **`useSefazConsulta`** — wrappers React Query.

Formulário canônico:

- **`src/pages/fiscal/components/NFeForm/`** — `index.tsx` + `DadosGerais`, `ItensNFe`, `ImpostosNFe`, `TransporteNFe` + `schema.ts` (Zod).
- **`SefazRetornoModal`** — visualização de retorno SEFAZ.

Documento de referência: `docs/fiscal-modelo-estrutural.md` define máquina canônica + RPCs assinadas.

## 2) Problemas encontrados

### A. Arquitetura paralela ignorada (dívida estrutural massiva)

1. **`NFeForm` (RHF + Zod) existe mas não é usado.** A página `Fiscal.tsx` mantém um formulário inline de ~250 linhas com `useState` cru (`form`, `items`, `itemFiscalData`, `itemContaContabil`). Os subcomponentes `DadosGerais/ItensNFe/ImpostosNFe/TransporteNFe` foram construídos e são código morto na rota principal.
2. **`useNotaFiscalLifecycle` (RPCs canônicas) não tem nenhum consumidor.** Grep confirma zero importações de `useConfirmarNotaFiscal`/`useEstornarNotaFiscal`/`useGerarDevolucaoNF`. A página continua chamando `confirmarNotaFiscal`/`estornarNotaFiscal` do `fiscal.service.ts` antigo, que executa o pipeline manualmente em vez de chamar a RPC `confirmar_nota_fiscal` / `estornar_nota_fiscal` definidas no modelo estrutural.
3. **`useSefazAutorizacao`/`useSefazConsulta`/`SefazRetornoModal` não têm UI consumidora.** Toda a camada SEFAZ (autorizar, cancelar, inutilizar, consultar) está implementada e exposta via `services/fiscal/sefaz/index.ts`, mas não há botão "Transmitir SEFAZ", "Cancelar SEFAZ" ou "Inutilizar" em lugar nenhum da página `Fiscal.tsx`/`NotaFiscalDrawer`/`NotaFiscalEditModal`. A integração SEFAZ existe apenas como bibliotecas órfãs.
4. **Funções `cancelarNotaFiscalSefaz` e `inutilizarNotaFiscal` no `fiscal.service.ts` também não são chamadas em nenhuma UI.**

### B. Coexistência de dois caminhos divergentes para cancelamento

5. **`handleCancelarRascunho` (linha 365 de `Fiscal.tsx`)** faz `update({status:"cancelada"})` direto na tabela, ignorando a RPC canônica `cancelar_nota_fiscal` que já é exposta por `cancelarNotaFiscal()`. Isso fura a máquina de estados (sem `pg_advisory_xact_lock`, sem `app.nf_internal_op`, sem reversão coordenada).
6. **`handleInativar` faz `remove(nfId)` (DELETE físico via `useSupabaseCrud`)** enquanto `FiscalDetail.handleDelete` faz `update({ativo:false})` (soft delete). Mesma ação, dois comportamentos diferentes em rotas distintas.
7. **`confirmarNotaFiscal` no service NÃO chama RPC** — executa manualmente: update status → leitura/inserção em `estoque_movimentos` (N+1 com Promise.all) → inserts em `financeiro_lancamentos` → atualização de OV. Sem transação atômica. Em caso de falha parcial (ex.: financeiro falha após estoque criado), a NF fica com efeitos inconsistentes.

### C. Inconsistência `nota_fiscal_id` × `documento_fiscal_id`

8. **`NotaFiscalDrawer.tsx:134`** ainda usa `or("nota_fiscal_id.eq.${id},documento_fiscal_id.eq.${id}")` para buscar lançamentos.
9. **`fiscal.service.ts:288–292` (estorno)** filtra apenas por `nota_fiscal_id` com comentário explícito dizendo que `documento_fiscal_id` "não existe" — em contradição direta com (8). Resultado: lançamentos vinculados pela coluna nova (se existirem) **não são cancelados** no estorno.
10. **Existe `lib/fiscalUtils.ts` justamente para resolver isso**, mas nem o drawer nem o service o utilizam.

### D. Devolução

11. **`processarDevolucao` gera `numero: "DEV-${devolucaoNF.numero}"`** sem sequência atômica. Conflita com a regra arquitetural de numeração via PostgreSQL SEQUENCES (memo `tech/numeracao-atomica-documentos`).
12. **`processarDevolucao` faz dual-write** via insert direto em `estoque_movimentos` e ainda comenta que o trigger atualiza `estoque_atual` — mas o pré-cálculo `saldo_atual = saldoAnterior + qtd_devolver` é feito no client e enviado, podendo divergir do trigger sob concorrência.
13. **`processarDevolucao` ignora a RPC canônica `gerar_devolucao_nota_fiscal`** (já implementada e exposta em `useGerarDevolucaoNF`), que faria isso transacionalmente.
14. **CFOP da devolução é decidido por flip ad-hoc** (`cfop.replace(/^[0-9]/, ...)` somando/subtraindo 2) em vez de usar `calcularCfopDevolucao` de `lib/fiscal.ts`.
15. **Devolução só cobre "saída → entrada de devolução"**. Não há fluxo simétrico para devolução de NF de entrada (devolução a fornecedor).

### E. Confirmação e efeitos colaterais

16. **`confirmarNotaFiscal` força `status_sefaz: "nao_enviada"`** ao confirmar uma NF, mesmo que o usuário tenha importado uma NF com `status_sefaz='importada_externa'` ou já autorizada. Isso quebra o eixo SEFAZ.
17. **Não há trava por `tipo_operacao='devolucao'`**: confirmar uma devolução duplica os efeitos (estoque entra + financeiro `pagar` para fornecedor inexistente, já que devolução de saída tem só `cliente_id`).
18. **Idempotência só checa `status='confirmada'`**: se status estiver em `autorizada`/`importada` e o usuário clicar em confirmar, lança erro genérico, mas o botão não fica desabilitado (gating é só `canConfirmFiscal`, que cobre rascunho/pendente — ok no botão, mas o service faz a checagem em paralelo, duplicando responsabilidade).
19. **`handleSaveAndConfirm` salva e confirma em duas etapas não-transacionais.** Se confirmar falhar após o save, a NF fica salva com itens recriados (delete+insert) mas sem efeitos.

### F. Importação XML

20. **Validação de duplicidade só pela chave de acesso**, não pela tupla `(modelo, série, número, tipo, emitente)` exigida pelo modelo estrutural (`unicidade`). Importar XML sem chave (NFS-e antiga) passa direto.
21. **Mapeamento de itens não preenche `cst`/`csosn`/`base_cálculo`** (apenas valores totais por imposto). Itens importados ficam fiscalmente incompletos e o usuário não tem onde editá-los na tela atual (só via modal de edição, que mostra ítens mas não expõe campos de CST/base — só conta contábil).
22. **`fornecedoresCrud.data.find(...)`** roda no client sobre o conjunto carregado pelo `useSupabaseCrud` (default 1000 linhas). Empresas com >1000 fornecedores podem não casar o emitente.

### G. Grid, filtros e UI

23. **`NotaFiscal` é declarada duas vezes** com schemas próximos: `Fiscal.tsx:46` e `NotaFiscalDrawer.tsx:39`. Já existe `NotaFiscal` em `@/types/domain` (usado por `NotaFiscalView`). Três fontes de verdade.
24. **KPIs filtram apenas por `status==="confirmada"`** mas não consideram `autorizada`/`importada`. Em projeto com NFs autorizadas, o card "Confirmadas" subnotifica.
25. **Coluna "Origem" usa `Badge variant="outline"` sem cor**, enquanto outras colunas (`status`, `status_sefaz`) têm badges semânticos coloridos. Inconsistência visual.
26. **Coluna "Modelo" oculta por padrão** em uma página chamada "Fiscal" que mistura NF-e/NFC-e/CT-e/NFS-e. Usuário não vê o modelo no scan da grid.
27. **Filtro `tipoFilters` aparece como MultiSelect mesmo quando há `tipoParam` na URL** — então `Notas de Entrada` ainda mostra um dropdown de tipo escondido (`!tipoParam` evita renderizar, ok), mas o chip de filtro ativo ainda é gerado no `useMemo` (linha 635), gerando lixo se tipoFilters foi setado antes.
28. **Devolução vista no grid**: a coluna "Tipo" mostra "Entrada" para uma NF de devolução de venda, sem nenhuma marcação inline. A coluna `operacao` que mostraria "Devolução" está oculta por padrão.

### H. Edit modal × Drawer × Detail page (consistência)

29. **Três caminhos para abrir/editar a mesma NF:**
    - Grid → `openView` → `NotaFiscalDrawer` (com `Editar`, `Confirmar`, `Estornar`, `Devolução`).
    - Grid → `openEdit` → `NotaFiscalEditModal` (com `Salvar`, `Salvar e confirmar`, `Cancelar rascunho`).
    - Detail page `/fiscal/:id` → reabre `NotaFiscalDrawer` com botões de Editar/Confirmar/Estornar que apenas chamam `reload()` ou navegam de volta — **não executam de fato confirmação/estorno na rota detail**.
30. **`FiscalDetail.handleDelete` checa `["pendente","rascunho"]` em string literal** em vez de `canConfirmFiscal`/`isFiscalStructurallyLocked`. Divergência com o gating do drawer.
31. **`NotaFiscalView` (visão rápida)** carrega seu próprio fetch e exibe abas (`Itens`, `Logística`, `Vínculos`) divergentes do drawer (`Resumo`, `Itens`, `Fiscal`, `Arquivos`, `Eventos`, `Vínculos`). Conjunto de tabs distintos para a mesma entidade.

### I. Reflexos cross-módulo

32. **Estoque**: `confirmarNotaFiscal` faz N+1 (uma SELECT em `produtos.estoque_atual` por item, dentro de `Promise.all`) só para preencher `saldo_anterior`. Sob concorrência, dois confirmes simultâneos podem ler o mesmo `saldo_anterior` e gerar movimentos com saldo errado (mesmo que o trigger ajuste depois, o histórico fica incoerente).
33. **Financeiro**: `cancelarNotaFiscal` (RPC) está descrita como "estorna efeitos automaticamente quando NF estava confirmada", mas `estornarNotaFiscal` no client também faz seu próprio rollback. Duas fontes de verdade para reverter o financeiro.
34. **Comercial (OV)**: `updateOVFaturamento` é melhor-esforço com `try/catch` engolido (`console.error` no catch). Falha na atualização da OV não interrompe a confirmação nem é mostrada ao usuário.
35. **Pedido de Compra**: `OriginContextBanner` aparece e abre `?pedido_compra_id=...&tipo=entrada`, mas a NF criada não persiste vínculo nenhum com o PC (só observação textual). Não há `pedido_compra_id` em `notas_fiscais`.

### J. Outros

36. **`registrarEventoFiscal` não usa transação** — se a inserção do evento falhar após a confirmação, perde-se a trilha sem reverter a confirmação.
37. **`estornarNotaFiscal`** seta `status_sefaz: "nao_enviada"` mesmo quando a NF estava `autorizada` na SEFAZ — isso é factualmente incorreto: estorno operacional não anula a autorização SEFAZ, só o cancelamento SEFAZ faz isso.
38. **`buildNfItemsPayload` injeta `descricao: fiscal.descricao ?? i.descricao`** mas perde casos de edição manual da descrição quando há `fiscal.descricao` armazenado de uma importação anterior.
39. **`NotaFiscalEditModal`** importa `Lock`, `Package`, `DollarSign` e nunca usa `Lock` em alguns ramos (apenas em alerta) — pequenas dívidas de import.

## 3) Problemas prioritários (ordem de risco)

| # | Problema | Risco |
|---|---|---|
| P1 | `confirmarNotaFiscal` / `estornarNotaFiscal` / `processarDevolucao` não usam as RPCs canônicas (problemas 2, 7, 13). Pipeline manual sem atomicidade. | Inconsistência permanente de estoque/financeiro em falha parcial. |
| P2 | `handleCancelarRascunho` faz UPDATE cru ignorando RPC `cancelar_nota_fiscal` (problema 5). | Fura a máquina de estados, sem reversão se NF tinha efeitos. |
| P3 | `handleInativar` (DELETE) × `FiscalDetail.handleDelete` (soft delete) (problema 6). | Mesma ação destrói permanente em uma rota e marca inativo em outra. |
| P4 | Drawer ainda referencia `documento_fiscal_id` em `or(...)` enquanto service diz que a coluna não existe (problemas 8, 9). | Estorno deixa lançamentos órfãos ou query falha silenciosamente. |
| P5 | Devolução com numeração `DEV-N` não-atômica e sem RPC (problemas 11, 13). | Duplicidade de número, divergência com `numero_atomico` documents. |
| P6 | Camada SEFAZ inteira sem UI (autorizar, consultar, cancelar SEFAZ, inutilizar) (problema 3). | Módulo não cumpre o ciclo de vida documentado. |
| P7 | `confirmarNotaFiscal` não bloqueia `tipo_operacao='devolucao'` e força `status_sefaz='nao_enviada'` (problemas 16, 17). | Confirmar devolução duplica financeiro/estoque; sobrescreve estado SEFAZ válido. |
| P8 | Tipo `NotaFiscal` declarado em 3 lugares divergentes (problema 23). | Drift de schema; PR que altera um esquece outros. |
| P9 | Validação de duplicidade XML só pela chave (problema 20). | Permite reimportação de NFS-e/CT-e. |

## 4) Melhorias de UI/UX

- **U1.** Mostrar coluna "Modelo" e "Operação" por padrão (são informações chave para identificar a NF). Remover visibilidade default da coluna "Origem" (raramente útil) ou transformá-la em chip colorido alinhado a `status`.
- **U2.** Adicionar marcador inline no nome do parceiro ou no número quando `tipo_operacao='devolucao'` ("↺ DEV"), em vez de depender de coluna oculta.
- **U3.** Substituir o card "Confirmadas" por um KPI que some `confirmada + autorizada + importada` (status com efeito ativo).
- **U4.** Unificar a entrada de edição: do drawer, o botão "Editar" deve abrir o `NotaFiscalEditModal` na mesma rota; em `/fiscal/:id`, "Editar" hoje navega de volta para `/fiscal` (perda de contexto).
- **U5.** Padronizar tabs entre `NotaFiscalView` (visão rápida) e `NotaFiscalDrawer` (drawer operacional) — pelo menos garantir que `Itens`, `Vínculos`, `Eventos` apareçam em ambos.
- **U6.** Adicionar empty state acionável no drawer aba "Eventos" quando não há eventos ("Nenhum evento registrado — eventos são gerados ao confirmar/estornar/cancelar a NF").
- **U7.** Na importação XML, se itens vierem sem `cst`/`csosn`, sinalizar em badge inline na grid de itens do edit modal e oferecer "Sugerir tributação" (`sugerirTributacao` já existe).
- **U8.** Adicionar ação "Transmitir para SEFAZ" no drawer/modal quando `status='confirmada'` e `status_sefaz='nao_enviada'`, conectando `useSefazAutorizacao`.
- **U9.** Botão "Consultar status SEFAZ" quando `status_sefaz='em_processamento'`, conectando `useSefazConsulta`.
- **U10.** Botão "Cancelar na SEFAZ" e "Inutilizar numeração" no drawer, gateado por `status_sefaz`.
- **U11.** Mostrar `CertificadoValidadeAlert` no topo da página `Fiscal` (hoje só está disponível como componente mas não é renderizado).
- **U12.** No `OriginContextBanner` de PC, mostrar também o vínculo persistido (criar coluna ou tabela de vínculo, hoje só observação textual).

## 5) Melhorias estruturais

- **E1. Migrar `Fiscal.tsx` para usar `NFeForm` + Zod.** Eliminar o formulário inline de criação. Reutilizar `DadosGerais/ItensNFe/ImpostosNFe/TransporteNFe`. Reduz `Fiscal.tsx` em ~300 linhas e centraliza validação.
- **E2. Substituir `confirmarNotaFiscal`/`estornarNotaFiscal`/`processarDevolucao` por `useNotaFiscalLifecycle`.** Toda mutação passa pelas RPCs `confirmar_nota_fiscal`, `estornar_nota_fiscal`, `gerar_devolucao_nota_fiscal` documentadas em `docs/fiscal-modelo-estrutural.md`. Manter o service apenas como facade fina de re-export.
- **E3. Substituir `handleCancelarRascunho` e `handleInativar` por `cancelarNotaFiscal(nfId, motivo)`** (já existe via RPC). Unificar comportamento entre página e detail page.
- **E4. Centralizar `NotaFiscal` em `@/types/domain`** e remover as duplicatas em `Fiscal.tsx` e `NotaFiscalDrawer.tsx`.
- **E5. Resolver `nota_fiscal_id` × `documento_fiscal_id`**: padronizar em `nota_fiscal_id` (escolha do service) e remover o `or(...)` do drawer; ou padronizar em `documento_fiscal_id` e migrar dados. Em qualquer caso, usar `getEffectiveFiscalId` em todos os consumers e remover a divergência.
- **E6. Adicionar painel SEFAZ no drawer** consumindo `useSefazAutorizacao`/`useSefazConsulta` + `cancelarNFe`/`inutilizarNumeracao`. Implementar `SefazRetornoModal` no fluxo. Bloquear botões por `status_sefaz` real.
- **E7. Validação de duplicidade XML** ampliada: tupla `(modelo, serie, numero, tipo, emit_cnpj)` quando `chave_acesso` ausente.
- **E8. Vincular Pedido de Compra → NF de entrada** persistindo o ID (nova coluna `pedido_compra_id` em `notas_fiscais` ou tabela de junção), substituindo a observação textual.
- **E9. Quebrar `Fiscal.tsx` (984 LoC)** em: `pages/Fiscal/index.tsx` (orquestrador), `hooks/useFiscalGrid.ts` (filtros/KPIs), `components/FiscalCreateForm.tsx` (criação), `components/FiscalXmlImportButton.tsx`. Tirar lógica de XML/devolução/danfe do componente página.
- **E10. Eventos transacionais**: mover `registrarEventoFiscal` para dentro das RPCs (ou para um trigger sobre `notas_fiscais`), garantindo que evento e mudança de status são atômicos.
- **E11. Bloquear confirmação para `tipo_operacao='devolucao'`** em `canConfirmFiscal` (já que devolução nasce confirmada).
- **E12. Não sobrescrever `status_sefaz` em `confirmarNotaFiscal`/`estornarNotaFiscal`** — preservar o eixo SEFAZ; apenas `cancelarNotaFiscalSefaz` muda esse campo.
- **E13. CFOP de devolução**: usar `calcularCfopDevolucao` em vez do flip regex em `processarDevolucao`.
- **E14. Suporte a devolução de NF de entrada** (devolução a fornecedor) — fluxo simétrico ao atual.

## 6) Roadmap de execução

### Fase 1 — Correções críticas de integridade (bloqueia incidentes)
1. Substituir `handleCancelarRascunho`/`handleInativar`/`FiscalDetail.handleDelete` por `cancelarNotaFiscal(nfId, motivo)` (RPC). [P2, P3]
2. Remover `or("...documento_fiscal_id...")` do drawer (linha 134) e adotar `getEffectiveFiscalId` consistentemente. Alinhar service e drawer. [P4]
3. `confirmarNotaFiscal` e `estornarNotaFiscal`: parar de sobrescrever `status_sefaz`. Bloquear confirmação quando `tipo_operacao='devolucao'`. [P7]

### Fase 2 — Migração para RPCs canônicas
4. Adotar `useConfirmarNotaFiscal`/`useEstornarNotaFiscal`/`useGerarDevolucaoNF` em `Fiscal.tsx` e `FiscalDetail.tsx`. [P1, P5]
5. Reduzir `services/fiscal.service.ts` a uma facade fina (mantém `registrarEventoFiscal`, `verificarDuplicidadeChave`, `cancelarNotaFiscalSefaz`, `inutilizarNotaFiscal` como wrappers de RPC). Marcar `confirmarNotaFiscal/estornarNotaFiscal/processarDevolucao` como deprecated.

### Fase 3 — Tipagem e desacoplamento
6. Centralizar `NotaFiscal` em `@/types/domain`; remover duplicatas em `Fiscal.tsx` e `NotaFiscalDrawer.tsx`. [P8]
7. Quebrar `Fiscal.tsx` em página + hooks + subcomponentes (`useFiscalGrid`, `FiscalCreateForm`, `FiscalXmlImport`).

### Fase 4 — Adoção do `NFeForm` (RHF + Zod)
8. Substituir o formulário inline de criação por `NFeForm` (já existe). Inicialmente manter o `NotaFiscalEditModal` legado para edição (status confirmado/autorizado), e migrar criação primeiro.
9. Em seguida, migrar edição "rejeitada/rascunho" para `NFeForm` também; remover `NotaFiscalEditModal` quando paridade estiver completa.

### Fase 5 — Integração SEFAZ na UI
10. Adicionar `CertificadoValidadeAlert` no topo da página `Fiscal`. [U11]
11. Adicionar ações no drawer: "Transmitir SEFAZ" (`useSefazAutorizacao`), "Consultar status" (`useSefazConsulta`), "Cancelar SEFAZ" (`cancelarNotaFiscalSefaz`), "Inutilizar" (`inutilizarNotaFiscal`). Gating por `status_sefaz`. [P6, U8/U9/U10]
12. Plugar `SefazRetornoModal` no callback `onSucesso`/`onErro`.

### Fase 6 — Devolução robusta
13. Migrar `processarDevolucao` para `useGerarDevolucaoNF` (RPC). [P5]
14. Implementar fluxo simétrico de devolução para NF de entrada (devolução a fornecedor). [E14]
15. Usar `calcularCfopDevolucao` em vez do regex flip. [E13]

### Fase 7 — Importação XML
16. Validação de duplicidade por tupla `(modelo, serie, numero, tipo, emit_cnpj)` quando chave ausente. [P9, E7]
17. Carregar emitente por query targeted (`.eq("cpf_cnpj", ...)`) em vez de `find` no client. [problema 22]
18. Mapear `cst/csosn/base*` do XML para `notas_fiscais_itens`; oferecer `sugerirTributacao` para itens incompletos. [U7]

### Fase 8 — UX & vínculos
19. Tornar coluna "Modelo" e "Operação" visíveis por padrão; chip inline para devolução. [U1, U2]
20. KPI "Confirmadas" passa a contemplar `confirmada + autorizada + importada`. [U3]
21. Unificar tabs entre `NotaFiscalView` e `NotaFiscalDrawer`. [U5]
22. Persistir vínculo `pedido_compra_id` em `notas_fiscais` (migração + UI). [E8, U12]

### Fase 9 — Limpeza
23. Remover `confirmarNotaFiscal`/`estornarNotaFiscal`/`processarDevolucao` do service (após Fase 2 estável).
24. Remover `NotaFiscalEditModal` (após Fase 4 completa).
25. Remover `lib/fiscalUtils.ts` quando o schema for unificado em uma única coluna.

