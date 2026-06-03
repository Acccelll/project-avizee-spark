## Objetivo

1. Permitir excluir **definitivamente** NFs canceladas que **nunca foram autorizadas pela SEFAZ** (caso da NF 000089033 — lançamento manual errado).
2. Adicionar ação **"Importar/Anexar XML"** em uma NF já existente — anexa o XML cru, aplica a tradução (de-para fornecedor) e atualiza os campos fiscais, sem criar uma nova NF.

---

## Parte 1 — Habilitar exclusão definitiva de NF cancelada (não-SEFAZ)

A RPC `hard_delete_record('notas_fiscais', ...)` já existe e só exige role `admin`; ela faz cascade em itens, eventos, anexos, financeiro e remessas. O bloqueio é apenas no UI.

**Arquivo:** `src/components/fiscal/NotaFiscalDrawer.tsx` (linhas 900–911)

Substituir a condição atual:
```
selected.status === "rascunho" && status_sefaz === "nao_enviada"
```
por:
```
isAdmin
&& !["autorizada","cancelada_sefaz"].includes(status_sefaz)
&& !selected.chave_acesso?.startsWith("nfe_protocolada")   // sem protocolo SEFAZ
&& ["rascunho","pendente","cancelada","rejeitada"].includes(selected.status)
```

Ou seja: admin pode excluir definitivamente qualquer NF que **não foi autorizada na SEFAZ**, incluindo canceladas/rejeitadas/rascunhos. O `title` do botão é ajustado para refletir a regra: "Permitida quando a NF nunca foi autorizada pela SEFAZ".

Espelhar o mesmo gate em `src/pages/Fiscal.tsx` se houver botão duplicado na grid (verificar `handleInativar`/menu por linha — atualmente só há "Inativar").

**Resultado esperado:** no drawer da NF 000089033 (cancelada, SEFAZ "Não enviada"), aparece o botão "Excluir definitivamente" ao lado de "Inativar". A confirmação continua passando pelo `PermanentDeleteDialog` existente.

---

## Parte 2 — "Anexar XML" a uma NF existente

Hoje o fluxo de importação XML (`processarXmlImportado` + `aplicarImportacaoXml` em `Fiscal.tsx`) sempre cria uma NF nova. Vamos reaproveitar o pipeline (parser + `TraducaoXmlDrawer` + upload ao Storage + `produtos_fornecedores`), mas escrevendo em uma NF já existente.

### UX

- **No drawer da NF (`NotaFiscalDrawer.tsx`)**, na aba **Arquivos** (e como ação secundária no header quando `!chave_acesso` ou origem `manual`), adicionar botão **"Anexar XML"**.
- Disponível quando: `tipo === "entrada"` E o usuário tem permissão de editar fiscal. Bloqueado quando a NF já está autorizada na SEFAZ pelo próprio ERP (não faz sentido sobrescrever).
- Ao clicar: abre o seletor de arquivo XML → roda o mesmo parser → abre o `TraducaoXmlDrawer` (modo "anexar a existente").

### Comportamento ao confirmar a tradução

Criar nova função `anexarXmlNaNotaExistente(nfId, nfe, linhas, fiscalMap, xmlText)` em `src/services/fiscal/lifecycle.service.ts` (ou novo `xmlAttach.service.ts`):

1. **Valida divergências leves**: número, série, CNPJ emitente, valor total. Se divergir, mostra dialog "Os dados do XML divergem do lançamento manual. Continuar?" listando os campos.
2. **Upload do XML** via `uploadNfeXml` (mesmo helper já usado).
3. **UPDATE `notas_fiscais`** preenchendo: `chave_acesso`, `caminho_xml`, `origem='xml_anexado'`, e — quando faltarem — protocolo, datas e valores de impostos do XML. **Nunca** sobrescreve `status`/`status_sefaz` se a NF já estiver confirmada.
4. **Substitui itens**: `DELETE FROM notas_fiscais_itens WHERE nota_fiscal_id = nfId` e re-insere os itens traduzidos preservando `*_origem` (XML cru) e os campos internos (produto_id, quantidade convertida, valor unitário interno) — mesma lógica do `aplicarImportacaoXml`.
5. **Persiste de-para** via `salvarDeParaFornecedor` para linhas marcadas.
6. Registra `registrarEventoFiscal({ tipo_evento: "xml_anexado", descricao: "XML anexado e tradução aplicada à NF existente." })`.
7. Toast de sucesso + `fetchData()` + recarrega drawer.

A operação inteira roda em uma **stored procedure** (RPC `nf_anexar_xml_traducao`) para garantir atomicidade — segue o padrão `mem://tech/padroes-de-persistencia-transacional`. A migration cria a função com `SECURITY DEFINER`, `search_path = public` e gate por `permission('faturamento_fiscal','editar')`.

### Pontos de reuso

- Parser XML, `TraducaoXmlDrawer`, `useNFeXmlImport` — sem mudança.
- Em `Fiscal.tsx`, o estado `pendingXmlImport` ganha um campo opcional `anexarNaNotaId?: string`. Quando preenchido, ao confirmar a tradução chama `anexarXmlNaNotaExistente` em vez de `aplicarImportacaoXml`.

---

## Arquivos afetados

```text
src/components/fiscal/NotaFiscalDrawer.tsx        # gate do "Excluir definitivamente" + botão "Anexar XML"
src/pages/Fiscal.tsx                               # branch anexar vs criar no fluxo XML
src/services/fiscal/lifecycle.service.ts           # anexarXmlNaNotaExistente (cliente RPC)
supabase/migrations/<novo>.sql                     # RPC nf_anexar_xml_traducao + audit event
```

Sem mudanças em `useNFeXmlImport`, `TraducaoXmlDrawer`, `xmlStorage.service` nem nas regras de `hard_delete_record`.

---

## QA manual após implementação

1. Abrir NF 000089033 → confirmar botão **Excluir definitivamente** visível → excluir → checar sumiço da lista e log em `audit_log`.
2. Lançar manualmente uma NF de entrada → na aba Arquivos clicar **Anexar XML** → escolher XML real do fornecedor → confirmar tradução → verificar: `chave_acesso` preenchida, itens substituídos, de-para gravado em `produtos_fornecedores`, evento `xml_anexado` no histórico.
3. Tentar anexar XML em NF já autorizada pela SEFAZ → botão deve ficar desabilitado com tooltip explicativo.
