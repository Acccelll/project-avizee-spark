## Diagnóstico

A NF exibida (Emitente **CND 27 COMERCIO DE UTILIDADES LTDA**, CNPJ `10.413.463/0007-24`, número 69850) tem como destinatário **C S DOS S RODRIGUES EIRELI** (CNPJ `16.615.493/0001-04`). Nenhum dos dois CNPJs é o da empresa configurada em Administração — `empresa_config.cnpj` está como `53.078.538/0001-85` (AviZee Equipamentos LTDA). Portanto a NF realmente não é destinada ao certificado A1 dessa empresa.

Como ela entrou no Portal:

- A linha em `nfe_distribuicao` tem `nsu = '0'` e `tipo_documento = 'procNFe'`, padrão usado por `consultarNFePorChave` (botão **Buscar por chave** do toolbar fiscal).
- Esse fluxo consulta a SEFAZ via `sefaz-distdfe` (`action: consultar-chave`) e, em fallback, o `consultadanfe-proxy` (serviço público que devolve XML de qualquer chave válida, sem checar o CNPJ do certificado).
- Ao receber o XML, o código em `src/services/fiscal/sefaz/distdfe.service.ts` faz `upsert` em `nfe_distribuicao` **sem validar** se o `<dest><CNPJ>` corresponde ao CNPJ do certificado/empresa. Por isso a NF apareceu na listagem como "Sem manifestação".

O DistDFe oficial (sincronização periódica) já é filtrado pela SEFAZ pelo CNPJ do certificado, então o problema ocorre apenas no caminho de busca por chave (e em XMLs importados manualmente, que seguem regra parecida).

## Plano de correção

### 1. Validar destinatário no momento da busca por chave

Em `src/services/fiscal/sefaz/distdfe.service.ts`:

- Estender `extrairCamposBasicosDoXml` para também devolver `cnpjDestinatario` e `nomeDestinatario` (parse de `<dest><CNPJ>` / `<dest><CPF>` / `<dest><xNome>`).
- Em `consultarNFePorChave`, após obter o XML da SEFAZ:
  1. Ler `empresa_config.cnpj` (cache simples em memória do módulo).
  2. Comparar com o CNPJ do destinatário extraído do XML (somente dígitos).
  3. Se forem diferentes, **abortar o upsert** e retornar `sucesso: false` com mensagem:
     > "Esta NF-e não é destinada ao CNPJ configurado no certificado A1 (`<cnpj_empresa>`). Destinatário do XML: `<nome>` — `<cnpj_destinatario>`. Verifique o certificado em Administração ou solicite a chave correta."
- Aplicar a mesma validação na função interna `cachearXmlPorChave`, usada por outros pontos do serviço.

### 2. Bloquear importação manual com destinatário divergente

Em `src/pages/fiscal/hooks/useNFeXmlImport.ts` (entrada via **Importar XML**), adicionar verificação equivalente quando o XML for de NF-e **de entrada** (`tpNF=0` na visão da empresa) ou quando o destinatário não bater com `empresa_config.cnpj` — exibir toast de erro e não inserir em `nfe_distribuicao`.

### 3. Adicionar coluna persistente para futuras consultas

Migração nova: adicionar `cnpj_destinatario` e `nome_destinatario` em `nfe_distribuicao` (nullable, sem default), preencher nos dois pontos de upsert acima e criar índice `idx_nfe_dist_destinatario`. Isso permite filtragem server-side e auditoria sem precisar abrir o XML.

### 4. Filtro server-side no Portal

Em `src/pages/fiscal/PortalFiscal.tsx`, no carregamento da lista (`from('nfe_distribuicao')…`), adicionar:

```ts
.or(`cnpj_destinatario.is.null,cnpj_destinatario.eq.${cnpjEmpresa}`)
```

Assim, registros antigos sem `cnpj_destinatario` continuam visíveis (legado), mas qualquer novo upsert divergente fica fora da listagem. Adicionalmente, exibir no cabeçalho do Portal um chip com **"Certificado: <razão social> · <CNPJ>"** lido de `empresa_config`, para o usuário identificar à primeira vista qual cert está ativo.

### 5. Limpeza dos registros já gravados indevidamente

Criar ação manual no Portal (botão "Limpar NFs alheias", visível apenas para admin via `can('fiscal','admin')`) que:

1. Lista em um diálogo todas as linhas onde `cnpj_destinatario` é diferente de `empresa_config.cnpj` (após a migração, preenche-se a coluna em lote uma única vez via RPC `backfill_nfe_distribuicao_destinatario`).
2. Permite excluir em lote, com confirmação destrutiva.

Para a linha atual da CND 27 (gravada antes da coluna existir), o backfill já a identifica e ela aparece nessa rotina.

### 6. Mensagem de UX no botão "Buscar por chave"

No `FiscalToolbarActions.tsx`, ao receber erro do `consultarNFePorChave` com a nova mensagem (código de erro estável, ex.: `DEST_MISMATCH`), exibir toast destacando duas ações: "Conferir certificado em Administração" e "Cancelar".

## Detalhes técnicos

- **Onde validar a igualdade**: comparar apenas dígitos (`replace(/\D/g, '')`). Para CPF de destinatário (consumidor final), considerar mismatch se `empresa_config.cnpj` tem 14 dígitos.
- **Cache de `empresa_config.cnpj`**: módulo-level `let cnpjCache: string | null = null` com invalidação por TTL curto (60s) ou por evento `empresa-config-updated` já emitido em Administração.
- **Migração**:

```sql
ALTER TABLE public.nfe_distribuicao
  ADD COLUMN cnpj_destinatario text,
  ADD COLUMN nome_destinatario text;
CREATE INDEX idx_nfe_dist_destinatario ON public.nfe_distribuicao(cnpj_destinatario);
```

- **RPC de backfill** (`SECURITY DEFINER`, `search_path = public`): varre `xml_nfe`, extrai `<dest><CNPJ>` por regex e atualiza as colunas. Executável uma vez.

## Arquivos a alterar

- `src/services/fiscal/sefaz/distdfe.service.ts` — validação + extração estendida.
- `src/pages/fiscal/hooks/useNFeXmlImport.ts` — validação na importação manual.
- `src/pages/fiscal/PortalFiscal.tsx` — filtro server-side + chip do certificado + botão "Limpar NFs alheias".
- `src/pages/fiscal/components/FiscalToolbarActions.tsx` — tratamento da mensagem `DEST_MISMATCH`.
- Migração SQL nova: colunas `cnpj_destinatario`, `nome_destinatario`, índice e RPC `backfill_nfe_distribuicao_destinatario`.

## Itens fora deste plano

- Não altera o fluxo oficial de DistDFe (sincronização periódica) — a SEFAZ já filtra por CNPJ do certificado.
- Não troca o certificado A1 atual; apenas valida o que entra. A troca de certificado continua sendo feita em Administração.
