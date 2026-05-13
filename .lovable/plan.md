
## Diagnóstico

O fluxo de importação de XML hoje é "entrada-only" por três motivos concretos:

1. **Parser** (`src/lib/nfeXmlParser.ts`) extrai apenas `emit` (emitente) — nunca lê `<dest>`. Sem destinatário, é impossível casar cliente.
2. **`useNFeXmlImport`** (`src/pages/fiscal/hooks/useNFeXmlImport.ts`) só busca em `fornecedores` pelo CNPJ do emitente — assume sempre entrada.
3. **`aplicarImportacaoXml` em `src/pages/Fiscal.tsx`** (linha ~603) hardcoda `tipo: "entrada"` no `setForm`, preenche `fornecedor_id` e dispara `gerarFinanceiroNfeEntrada` (gera contas a pagar). O XML enviado (emit = AVIZEE, dest = SAO SALVADOR, CFOP 6102, protocolo SEFAZ presente) não tem caminho para virar NF de saída.

Fluxos relacionados que continuam intactos: emissão própria via `/fiscal/novo` (NotaFiscalForm + autorização SEFAZ), tradução XML (de-para fornecedor) e DistDFe (manifestação de notas de terceiros).

## Objetivo

Permitir importar um XML de NF-e **já emitida** cujo emitente é a própria empresa e registrá-la como NF de **saída** já confirmada (status `importada`, `status_sefaz='autorizada'` quando o XML for `procNFe` com `nProt`), com:

- Cliente casado pelo CNPJ do destinatário (com quick-add se inexistente).
- Itens já mapeados pelo `cProd` interno (sem etapa de tradução de fornecedor).
- Financeiro a **receber** gerado a partir das duplicatas do XML.
- Movimentação de estoque como **saída**.
- Bloqueio de re-importação por chave de acesso (idempotência mantida).

NF de saída emitida pelo próprio sistema (fluxo SEFAZ) e NF de entrada via XML continuam funcionando idênticos.

## Mudanças propostas

### 1. Parser — extrair destinatário e tipo da operação
`src/lib/nfeXmlParser.ts`:
- Adicionar interface `NFeDestinatario` (cnpj/cpf, razaoSocial, ie, indIEDest, uf, email, telefone).
- Em `parseNFeXml`, ler `<dest>` (CNPJ ou CPF, xNome, IE, indIEDest, enderDest/UF, email, fone).
- Ler `<ide>/<tpNF>` (`0`=entrada, `1`=saída) e `<ide>/<mod>` (já existe via `serie` mas falta o modelo do documento — `55`/`65`).
- Expor em `NFeData`: `destinatario?: NFeDestinatario`, `tpNF: "0" | "1" | null`, `modelo: string | null`.

### 2. Detecção de saída no import
`src/pages/fiscal/hooks/useNFeXmlImport.ts`:
- Aceitar novo argumento `cnpjEmpresa: string | null` (lido de `empresa_config.cnpj` no caller).
- Aceitar `clientes: ClienteMatchRef[]` em `UseNFeXmlImportArgs`.
- Calcular `tipo: "entrada" | "saida"` comparando `emit.CNPJ` ao CNPJ da empresa (e/ou `tpNF=1` quando emit≠empresa, mas neste caso é venda nossa).
- Quando `tipo="saida"`:
  - Pular toda a lógica de `produtos_fornecedores` (de-para) e tradução. Match de produto direto por `codigo_interno`/`sku` igual a `cProd`. Itens sem match ficam pendentes para vínculo manual (sem drawer de tradução — usar quick-add de produto inline já existente).
  - Resolver `clienteId` via match de CNPJ no destinatário.
  - Devolver `clienteId` no resultado (`fornecedorId` fica vazio).
- Estender `NFeXmlImportResult` com `tipo`, `clienteId`, `destinatario`.

### 3. `aplicarImportacaoXml` em `Fiscal.tsx`
- Renomear/reescrever para popular condicionalmente `fornecedor_id` **ou** `cliente_id` conforme `tipo`.
- Setar `form.tipo`, `form.modelo_documento` (do XML), `form.chave_acesso`, e quando o XML traz `protocolo` (procNFe autorizado): pré-marcar `status="importada"` e `status_sefaz="autorizada"` + gravar protocolo (campos já existentes em `notas_fiscais`).
- Para saída: `movimenta_estoque=true`, `gera_financeiro=true` por padrão; condição de pagamento derivada das duplicatas (mesma lógica `mapTPagSefaz` já usada).
- Atualizar `xmlOriginInfo` para guardar `clienteId`/`clienteNome` quando saída (banner de origem deve dizer "NF de saída importada via XML").

### 4. Quick-add de cliente
- Se destinatário não cadastrado, abrir `QuickAddCustomerModal` (análogo ao `QuickAddSupplierModal` existente — verificar se já existe; senão criar simétrico) pré-preenchido com dados do `<dest>` e retomar o import com o `clienteId` recém-criado (`pendingXmlImport` já tem o padrão para fornecedor — replicar para cliente).

### 5. Submissão (`handleSubmit` ~linha 748)
- Onde hoje há `form.tipo === "entrada" && form.origem === "importacao_xml"` para gerar financeiro de entrada (linhas ~826-848), adicionar branch simétrico para `tipo === "saida"`:
  - Chamar uma nova `gerarFinanceiroNfeSaida(notaId, ...)` em `lifecycle.service.ts` que cria lançamentos em **contas a receber** (mesma estrutura, `tipo='receber'`, cliente_id no lugar de fornecedor_id).
  - Reaproveitar `xmlOriginInfo.cobranca.duplicatas` e `tPag`.
- Validação já existente (`form.tipo === "saida" && !form.cliente_id`) cobre o erro de cliente ausente.

### 6. Estoque
- O trigger `trg_estoque_movimentos_sync` já trata entrada/saída pelo `tipo` da NF; nada a alterar no banco se a NF importada gravar `tipo='saida'`. Validar com a primeira nota importada.

### 7. UI / labels
- `FiscalToolbarActions` / botão "Importar XML": rótulo neutro (já está). Apenas ajustar tooltip/help: "Importa NF-e de entrada (emitente externo) ou saída já emitida (emitente = sua empresa)".
- `NfeFormBody` (banner de origem XML): exibir `clienteNome` quando saída.
- `OriginContextBanner` para saída importada.

### 8. Testes
- Adicionar caso em `src/lib/importacao/__tests__/xmlImport.test.ts` cobrindo:
  - Parser extraindo `<dest>` e `tpNF`.
  - `useNFeXmlImport` retornando `tipo='saida'` quando emit==empresa e populando `clienteId`.
- Caso de regressão: XML de entrada continua devolvendo `tipo='entrada'` e `fornecedorId`.

## Fora de escopo

- Refazer o fluxo de **emissão** própria (NotaFiscalForm/SEFAZ) — segue como está.
- Tradução de itens para saída (assume-se que `cProd` é nosso SKU; itens sem match resolvem-se com o quick-add de produto já existente).
- NFC-e (modelo 65) — focado em modelo 55. NFC-e fica como evolução futura.

## Detalhes técnicos sensíveis

- **Idempotência**: `verificarDuplicidadeChave` já cobre os dois tipos (consulta por `chave_acesso`).
- **CNPJ da empresa**: ler 1× via `empresaConfig.service.getEmpresaConfigPrincipal()` e passar para o hook (cachear em `useMemo`).
- **status_sefaz='autorizada'**: precisa também gravar `protocolo_autorizacao` e `xml_autorizado` (path no Storage `dbavizee/.../nfe-autorizado`). Para a primeira versão, gravar apenas o protocolo + status; persistência do XML completo no Storage pode ficar para uma 2ª iteração se ficar grande demais — confirmar no review.
- **Triggers de proteção** (`trg_nf_protege_edicao`): ao gravar diretamente como `confirmada/importada` via `salvar_nota_fiscal`, validar que o caminho de criação não dispara o bloqueio (ele só atua em UPDATE; INSERT inicial é permitido — confirmar lendo a função).
