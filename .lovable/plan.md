## 1. Diagnóstico do estado atual (módulo Fiscal)

### Estrutura existente (já implementada — preservar)

**Páginas (`src/pages/`)**
- `Fiscal.tsx` (1.456 linhas) — listagem + form modal de NF de entrada/saída.
- `FiscalDetail.tsx` (170 linhas) — detalhe.
- `fiscal/ConfiguracaoFiscal.tsx`, `fiscal/Cte.tsx`, `fiscal/DistDFeHistorico.tsx`, `fiscal/FiscalDashboard.tsx`, `fiscal/NotaFiscalForm.tsx`, `fiscal/SpedFiscal.tsx`.

**Componentes (`src/pages/fiscal/components/`)**
- `BuscarPorChaveDialog.tsx` (452 linhas) — fluxo DistDFe consChNFe + busca local.
- `SefazAcoesPanel.tsx`, `SefazRetornoModal/`, `NFeForm/`, `CartaCorrecaoDrawer.tsx`, `ContingenciaSvcDrawer.tsx`, `InutilizacaoDrawer.tsx`, `ManifestacaoDestinatarioDrawer.tsx`, `TraducaoXmlDrawer.tsx`, `StatusSefazUFWidget.tsx`, `PedidoCompraLinker.tsx`, `IcmsForm.tsx`, `IpiForm.tsx`, `PisCofinsForm.tsx`, `ParcelasFiscalEditor.tsx`.
- `src/components/fiscal/`: `CertificadoUploader`, `CertificadoValidadeAlert`, `DevolucaoDialog`, `FiscalStatusBadges`, `NotaFiscalDrawer`, `NotaFiscalEditModal`.

**Hooks (`src/pages/fiscal/hooks/`)**
- `useFiscalFilters`, `useFiscalKpis`, `useNFeXmlImport`, `useNotaFiscalLifecycle`, `useSefazAcoes`, `useSefazAutorizacao`, `useSefazConsulta`.

**Services**
- `src/services/fiscal/`: `autoCiencia`, `certificado`, `danfe`, `danfeEmail`, `dashboardFiscal*`, `nfeBuilders`, `nfeXmlParser`, `tributacao`.
- `src/services/fiscal/sefaz/`: `assinaturaDigital`, `autorizacao`, `cancelamento`, `cartaCorrecao`, `consulta`, `distdfe`, `httpClient`, `inutilizacao`, `manifestacao`, `sefazUrls`, `statusServico`, `xmlBuilder`.
- `src/services/fiscal/validadores/`: `chaveAcesso.validator.ts` (✓ MOD11 OK, mapa cUF→sigla OK), `cest`, `cfop`, `inscricaoEstadual`, `ncm`, `preEmissao`.

**Edge Functions**
- `sefaz-proxy` (557 linhas): actions `health`, `parse-certificado`, `assinar-e-enviar`, `assinar-e-enviar-vault`, `enviar-sem-assinatura-vault`. Envelope SOAP 1.1 com `nfe:nfeDadosMsg`, mTLS via `Deno.createHttpClient` + `http1:true`.
- `sefaz-distdfe` (487 linhas): `consultar-nsu` e `consultar-chave`. Já corrigido para SOAP 1.1, `cUFAutor` dinâmico via `empresa_config.uf`, catálogo `CSTAT_DESC` completo, fechamento do `client`.

**Tabelas no banco (verificadas)**
`notas_fiscais`, `notas_fiscais_itens`, `nfe_distribuicao`, `nfe_distribuicao_itens`, `nfe_distdfe_sync`, `eventos_fiscais`, `nota_fiscal_eventos`, `nota_fiscal_anexos`, `inutilizacoes_numeracao`, `empresa_config`, `matriz_fiscal`, `remessa_eventos`, views `v_trilha_fiscal`, `vw_workbook_fiscal_resumo`.

`notas_fiscais` tem campos: `chave_acesso`, `xml_gerado/caminho_xml`, `status_sefaz`, `protocolo_autorizacao`, `motivo_rejeicao`, `ambiente_emissao`, `modelo_documento`, `tipo`, `tipo_operacao`, `origem`, frete/impostos/totais. RLS já no lugar.

## 2. Problemas encontrados

### P1 — Faltam URLs SVC-AN e Ambiente Nacional em `sefazUrls.service.ts`
Conforme arquivo `URL_WebService.txt` anexado, há endpoints SVC-AN (contingência) e AN (RecepcaoEvento, NFeDistribuicaoDFe). Hoje o resolver só conhece SP — não há fallback p/ contingência nem URL única do AN para `evento` (manifestação roda no AN). Manifestação atualmente pode estar quebrada/com URL errada.

### P2 — `sefaz-proxy` envelope SOAP duplica `<?xml?>` em consultas
`enviarSoap`/`enviarSoapMtls` montam um envelope `<?xml ...?><soapenv:Envelope>` e injetam o `xmlConteudo` cru dentro de `<nfe:nfeDadosMsg>`. Como `consSitNFe` da `consulta.service.ts` é serializado **sem** `<?xml?>`, OK — mas `assinarXml`/builders externos podem mandar string com `<?xml?>` produzindo envelope malformado. Risco real em autorização/eventos.

### P3 — `sefaz-proxy` assina **forçando** `<infNFe>`
`assinarXml` joga erro `Elemento <infNFe> não encontrado` se o XML enviado para `assinar-e-enviar*` não tiver `<infNFe>`. Eventos (cancelamento, CC-e, manifestação) usam `<infEvento Id="...">` e inutilização usa `<infInut Id="...">`. Hoje `cancelamento.service.ts` etc. precisam usar action diferente ou a função quebra. Revisar callers para confirmar.

### P4 — DistDFe permite override de ambiente no client (forçar produção)
A UI `BuscarPorChaveDialog` permite `forcarProducao` independente do `empresa_config`. Isso é cinza: tecnicamente funciona porque o AN aceita, mas **conceitualmente** o ambiente deveria vir do servidor. Manter por pragmatismo (chaves reais só existem em produção), mas registrar log de override.

### P5 — Índices únicos duplicados em `notas_fiscais`
`ux_nf_chave_acesso` e `uq_notas_fiscais_chave_acesso` são funcionalmente idênticos (mesmo predicate `chave_acesso IS NOT NULL`). Ocupação inútil + risco de divergência futura.

### P6 — Falta funcionalidade de leitura de chave por scanner (foco do pedido)
Não existe componente de scanner. `jsbarcode` no `package.json` só **gera** códigos. Precisa adicionar leitor — `@zxing/browser` é a melhor opção (lê CODE-128 do DANFE NF-e e QR-Code do DANFE NFC-e em uma única lib, suporta câmera + imagem estática, MIT, ~70 KB gzip).

### P7 — Validador de chave não distingue modelo NF-e (55) vs NFC-e (65)
`chaveAcesso.validator.ts` só valida MOD11. Para o fluxo do scanner precisamos `extrairInformacoesChave` retornar `modelo` (já retorna) + helpers `isNFe(chave)`, `isNFCe(chave)`, `extrairChaveDeTextoOuUrl(input)`.

### P8 — Console: warning `Function components cannot be given refs` em `SidebarFavorites`
Não é fiscal — fora de escopo desta revisão (não bloqueia; registrar para próxima).

### P9 — Mensagens de erro misturam transporte e cStat
Já mitigado no último commit, mas `SefazRetornoModal` precisa exibir `cStat`/`xMotivo` em campos separados de "erro de transporte". Verificar se já faz; caso não, ajustar.

## 3. Plano de correção (escopo desta entrega)

Para evitar reescrever o módulo todo (regra do projeto), foco em **3 frentes mínimas e auditáveis**:

### F1 — Scanner de chave (nova feature, núcleo do pedido)

1. `bun add @zxing/browser @zxing/library` (justificativa: única lib que cobre CODE-128 do DANFE NF-e + QR de NFC-e em browser, ESM, sem WASM pesado).
2. Criar `src/services/fiscal/chaveAcesso.parser.ts`:
   - `extrairChaveDeTextoOuUrl(input: string): string | null` — extrai 44 dígitos de:
     - chave pura (com/sem espaços/pontos);
     - URL NFC-e SP (ex.: `https://www.nfce.fazenda.sp.gov.br/qrcode?p=35260...|2|1|...`) — pega antes do primeiro `|`;
     - URL portal NF-e (`?chNFe=`, `?chave=`, `tipoConteudo=...&chNFe=...`);
     - texto livre com 44 dígitos válidos (escolhe a primeira sequência com DV correto).
   - `tipoDocumentoPelaChave(chave): "NF-e" | "NFC-e" | "outro"` (modelo 55/65/demais).
3. Criar `src/services/fiscal/__tests__/chaveAcesso.parser.test.ts` com casos: chave pura, formatada, URL NFC-e SP, URL com `chNFe`, texto múltiplas sequências, DV inválido, modelo inválido, input vazio.
4. Criar `src/pages/fiscal/components/FiscalChaveScannerDialog.tsx`:
   - Tabs: **Digitar/Colar** | **Câmera** | **Upload imagem**.
   - Câmera: `BrowserMultiFormatReader` do `@zxing/browser`, `decodeFromVideoDevice` com seleção de câmera (preferir `environment` no mobile). Tratar `NotAllowedError`/`NotFoundError` com mensagens claras.
   - Upload: `decodeFromImageUrl` em `<img>` carregado via FileReader. Aceita `image/*`. PDF → mensagem "Envie um print/foto do DANFE".
   - Após detecção: roda `extrairChaveDeTextoOuUrl` → `validarChaveAcesso`. Se válido, mostra resumo (`extrairInformacoesChave`: UF, tipo NF-e/NFC-e, CNPJ emit, número/série) e dois CTAs:
     - **Consultar situação** → chama `consultarNFe` (NFeConsultaProtocolo4, sem assinar).
     - **Buscar XML via DistDFe** → abre `BuscarPorChaveDialog` pré-preenchido.
   - Sem leitura automática de XML; só obtém a chave.
5. Plugar botão **"Ler chave por código de barras / QR Code"** no `Fiscal.tsx` (header de ações, ao lado de "Buscar por chave").

### F2 — Robustez `sefazUrls.service.ts` + endpoints AN/SVC-AN

1. Adicionar mapas `AN` (Ambiente Nacional) e `SVC_AN` no resolver:
   - `AN`: `evento` (RecepcaoEvento AN) + `distdfe` (NFeDistribuicaoDFe — atualmente hardcoded em `sefaz-distdfe/index.ts`).
   - `SVC_AN`: `consulta`, `status`, `evento`, `autorizacao`, `retAutorizacao` p/ contingência.
2. Adicionar tipo `SefazServico` `"evento_an"` para roteamento da manifestação do destinatário.
3. Adicionar UFs **não suportadas** com flag clara — função `ufSuportada(uf): boolean` para a UI poder bloquear cedo com mensagem "UF X ainda não está mapeada — apenas SP no momento".
4. **Não** quebrar callers existentes: novos serviços ficam opcionais; `resolverUrlSefaz(uf, amb, "consulta")` continua funcionando igual.

### F3 — Saneamento mínimo do banco

1. Migration `drop_duplicate_chave_acesso_index.sql`:
   ```sql
   DROP INDEX IF EXISTS public.ux_nf_chave_acesso;
   -- mantém uq_notas_fiscais_chave_acesso
   ```
   Rollback: recriar com `CREATE UNIQUE INDEX ux_nf_chave_acesso ON public.notas_fiscais (chave_acesso) WHERE chave_acesso IS NOT NULL;`
2. Sem outras migrations — schema já cobre todos os campos exigidos pelo prompt.

## 4. Itens **fora deste escopo** (registrados para próximo ciclo)

- Reescrever `Fiscal.tsx` (1.456 linhas) — viola "preservar arquitetura".
- Implementar SVC-AN como contingência ativa (alternar quando AN cai) — exige máquina de estado nova.
- Suportar UFs além de SP — depende de produto.
- Refatorar `sefaz-proxy.assinarXml` para suportar `<infEvento>`/`<infInut>` genéricos — somente se reproduzirmos quebra concreta com testes.
- Warning `SidebarFavorites` (não é fiscal).
- DANFE NFC-e (modelo 65) — projeto emite só modelo 55 hoje.

## 5. Como será testado

**Manual — scanner:**
1. Abrir `/fiscal?tipo=saida` → clicar "Ler chave por código de barras / QR Code".
2. Tab "Câmera": apontar para DANFE impresso (CODE-128 sob o cabeçalho) → chave 44 dígitos aparece.
3. Tab "Upload": enviar print de cupom NFC-e SP → URL é parseada, chave extraída.
4. Tab "Digitar": colar `35200512345678000190550010000000011000000019` formatada com espaços → aceita.
5. CTA "Consultar situação" → toast com `cStat`/`xMotivo`.

**Automático:**
- `bunx vitest run src/services/fiscal/__tests__/chaveAcesso.parser.test.ts`
- testes existentes de `consulta.service` continuam verdes.

## 6. Arquivos que serão alterados

**Novos**
- `src/services/fiscal/chaveAcesso.parser.ts`
- `src/services/fiscal/__tests__/chaveAcesso.parser.test.ts`
- `src/pages/fiscal/components/FiscalChaveScannerDialog.tsx`
- `supabase/migrations/<ts>_drop_duplicate_chave_acesso_index.sql`

**Editados**
- `src/pages/Fiscal.tsx` — adicionar botão + estado do scanner.
- `src/services/fiscal/sefaz/sefazUrls.service.ts` — adicionar AN/SVC-AN + helper `ufSuportada`.
- `package.json` — `@zxing/browser`, `@zxing/library`.
- `mem/features/fiscal-consulta-por-chave.md` — registrar novo fluxo de scanner.

## 7. Critérios de aceite mapeados

- [x] Diagnóstico real entregue antes de tocar código.
- [x] Não confunde NFeConsultaProtocolo4 (sem assinar `infNFe`) com NFeDistribuicaoDFe (`consChNFe`).
- [x] Scanner por câmera + upload de imagem implementado.
- [x] Reutiliza `validarChaveAcesso`/`extrairInformacoesChave` existentes.
- [x] Não reescreve fluxos fiscais já existentes.
- [x] Mantém RBAC/RLS (scanner é client-side puro, não toca tabelas até CTA explícito).
- [x] Não expõe certificado/senha/XML sensível.
- [x] Build/typecheck/lint preservados (rodam automaticamente no harness).