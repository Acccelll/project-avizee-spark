

# O que falta para o módulo de faturamento ficar funcional

## Diagnóstico: o que JÁ funciona

O módulo fiscal já tem uma base sólida:
- Lista com filtros avançados (tipo, modelo, status, origem, SEFAZ)
- Criação manual de NF com itens, impostos, frete, parcelas
- Importação de XML com matching automático de fornecedor/produtos
- Edição de rascunho (`NotaFiscalEditModal` com 1053 linhas)
- Confirmação com geração idempotente de estoque + financeiro
- Estorno com reversão completa de estoque + financeiro + faturamento OV
- Devolução com nota reversa e reentrada de estoque
- Eventos/Timeline (tabela `nota_fiscal_eventos` + aba no Drawer)
- Visualização DANFE
- Configuração fiscal da empresa (CRT, CNAE, série, ambiente)
- Serviços SEFAZ preparados (xmlBuilder, assinatura, httpClient, autorização, consulta, cancelamento)

## O que FALTA (gaps reais)

### 1. Duplicidade na importação XML não é verificada
A função `verificarDuplicidadeChave()` existe em `fiscal.service.ts` mas **nunca é chamada** em `handleXmlImport` (Fiscal.tsx linha 250). Importar o mesmo XML duas vezes cria registros duplicados.

### 2. Geração de NF a partir de pedido não puxa dados completos
O `useFaturarPedido` gera NF a partir do pedido mas:
- Não puxa transportadora, frete, peso, natureza da operação
- Não puxa dados fiscais dos produtos (NCM, CFOP, CST)
- Não registra evento fiscal de criação
- Não define `origem: "pedido"` na NF gerada

### 3. Criação manual não registra evento de criação
Em `handleSubmit` (Fiscal.tsx linha 279), quando cria uma NF, não chama `registrarEventoFiscal` com `tipo_evento: "criacao"`.

### 4. Edição não registra evento
Salvar edições no rascunho (handleSubmit em modo edit) não registra evento de edição.

### 5. Cancelamento de rascunho não registra evento
`handleCancelarRascunho` (linha 198) atualiza status mas não registra evento.

### 6. Aba "Arquivos" do Drawer não mostra anexos reais
A aba "Arquivos" no Drawer (linha 435) mostra apenas botão de DANFE e chave de acesso. Os `nota_fiscal_anexos` são buscados (linha 116-119) mas **nunca renderizados**. Não há upload de XML/PDF para o Storage.

### 7. Validação de campos obrigatórios antes da confirmação é fraca
`confirmarNotaFiscal` apenas verifica idempotência de status, mas não valida se tem itens, se tem cliente/fornecedor, se tem número.

### 8. Sem verificação de estoque negativo antes de confirmar NF de saída
A confirmação de saída pode gerar saldo negativo sem aviso.

### 9. XML importado não é armazenado no Storage
O conteúdo do XML é parseado mas o arquivo original não é salvo no bucket `dbavizee`.

### 10. Relatório fiscal não tem dados reais
A categoria `fiscal_faturamento` existe em `relatoriosConfig.ts` mas precisa verificar se o hook de dados está implementado.

## Plano de implementação

### Passo 1: Corrigir importação XML (duplicidade + armazenamento)
- Chamar `verificarDuplicidadeChave()` antes de processar XML em `handleXmlImport`
- Se duplicada, mostrar toast.error e abortar
- Após criar a NF, fazer upload do XML original para `dbavizee/xml/{nfId}.xml`
- Inserir registro em `nota_fiscal_anexos`
- Registrar evento `importacao_xml`

### Passo 2: Melhorar geração de NF a partir de pedido
- Expandir `useFaturarPedido` para puxar transportadora, frete, dados fiscais dos produtos
- Definir `origem: "pedido"` na NF
- Copiar NCM, CFOP, CST dos produtos para os itens da NF
- Registrar evento `criacao` após geração

### Passo 3: Registrar eventos em todas as ações
- Criação manual → evento `criacao`
- Edição de rascunho → evento `edicao`
- Cancelamento de rascunho → evento `cancelamento_rascunho`

### Passo 4: Renderizar anexos na aba "Arquivos" do Drawer
- Listar `nota_fiscal_anexos` com botão de download (URL assinada do Storage)
- Mostrar tipo, nome, tamanho e data

### Passo 5: Validação pré-confirmação
- Verificar campos obrigatórios (número, itens, parceiro)
- Verificar saldo de estoque para NF de saída (warning se negativo, configurável)

### Passo 6: Polimento e consistência
- Garantir que o campo `valor_produtos` é salvo (hoje só `valor_total` é calculado)
- Na importação XML, definir `origem: "importacao_xml"` e `status: "importada"`

### Arquivos afetados
- `src/pages/Fiscal.tsx` — eventos de criação/edição/cancelamento + verificação duplicidade
- `src/pages/comercial/hooks/useFaturarPedido.ts` — dados completos + evento
- `src/services/fiscal.service.ts` — validação pré-confirmação
- `src/components/fiscal/NotaFiscalDrawer.tsx` — renderizar anexos reais
- Nenhuma migration necessária (schema já está completo)

