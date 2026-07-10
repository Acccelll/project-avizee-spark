# Engenharia Reversa OFX — Base para o Motor Inteligente de Importação Financeira

> Escopo: análise dos arquivos `Inter_Junho.ofx`, `MercadoPago_Junho.ofx` e `RecargaPay_Junho.ofx`.
> Documento de referência — **não altera código**. Serve como especificação oficial para evoluir o parser
> OFX atual (`src/lib/parseOFX.ts` + `src/services/financeiro/importacao/adapters/ofx.ts`) para um motor
> multi-origem (OFX, PDF cartão, CSV, Open Finance, PIX, APIs bancárias).

---

## 1. Cabeçalho OFX — metadados hoje descartados

Os três arquivos são **OFX 1.0.2 SGML** (não XML), `CHARSET:1252`, `ENCODING:USASCII`. O parser atual só
consome `STMTTRN`; **todo o cabeçalho é descartado**.

| Bloco | Campo | Inter | Mercado Pago | RecargaPay | Uso proposto |
|---|---|---|---|---|---|
| Header | `OFXHEADER/VERSION/CHARSET/ENCODING` | 100/102/1252/USASCII | idem | idem | Detectar dialeto, escolher decoder |
| `SONRS` | `DTSERVER` | 20260630235959 | 20260626235959 | 20260622235959 | Data de geração do arquivo (auditoria) |
| `SONRS` | `LANGUAGE` | POR | POR | POR | i18n do parser |
| `FI` | `ORG` | Banco Inter S.A. | MERCADO PAGO INSTITUIÇÃO DE PAGAMENTO LTDA | Banco BTG Pactual S.A. | Nome oficial da instituição |
| `FI` | `FID` | 077 | 323 | 208 | **Código COMPE** — chave para roteador de regras por banco |
| `STMTRS` | `CURDEF` | BRL | BRL | BRL | Moeda; obriga conversão se ≠ conta |
| `BANKACCTFROM` | `BANKID` | 077 | 323 | 208 | COMPE (redundante com FID) |
| `BANKACCTFROM` | `BRANCHID` | 0999 | 0999 | 0999 | Agência (mascarada pelos bancos digitais) |
| `BANKACCTFROM` | `ACCTID` | 99999999 | 99999999 | 99999999 | Conta (mascarada) — combinar com `FID` para gerar *fingerprint* |
| `BANKACCTFROM` | `ACCTTYPE` | CHECKING | CHECKING | CHECKING | CC / POUPANÇA / CREDLINE — mapear enum |
| `BANKTRANLIST` | `DTSTART / DTEND` | 20260601–20260630 | 20260603–20260626 | 20260622–20260622 | **Período** → detectar gaps |
| `LEDGERBAL` | `BALAMT / DTASOF` | 0.00 / 20260630 | 0.00 / 20260626 | 0.00 / 20260622 | **Saldo final** — reconciliar com ERP |
| (opcional) | `AVAILBAL` | — | — | — | Saldo disponível (limite/cheque especial) |
| (opcional) | `CCACCTFROM` | — | — | — | Cartão de crédito (fatura OFX) |
| (opcional) | `INVSTMTMSGSRSV1` | — | — | — | Extratos de investimento |

Observações:
- Nenhum arquivo traz **saldo inicial explícito**; reconstruir por `saldo_final − Σ movimentos`.
- Agência/conta são fictícias (`0999/99999999`) em bancos digitais — não use como chave única; combine
  `FID + hash(arquivo|periodo)` + confirmação humana.
- `DTSERVER` permite detectar arquivo re-gerado (mesmo período, novo `DTSERVER` → pode conter correções).

---

## 2. Movimentações — inventário de campos por transação

| Campo | Semântica | Sempre presente? | Uso hoje | Uso proposto |
|---|---|---|---|---|
| `TRNTYPE` | CREDIT/DEBIT/PIX/FEE/INT/DIV/CHECK/XFER/PAYMENT/DEP/ATM/CASH/DIRECTDEP/DIRECTDEBIT/REPEATPMT/HOLD/OTHER | Sim | Ignorado | **Fonte primária** de natureza; sinal como fallback |
| `DTPOSTED` | Data de compensação | Sim | Sim | Manter; capturar timezone `[-3:BRT]` |
| `DTUSER` | Data lançada pelo usuário | Não | — | Data de competência quando existir |
| `DTAVAIL` | Disponibilidade | Não | Fallback | Prazo D+n de recebíveis |
| `TRNAMT` | Valor com sinal | Sim | Sim | Validar contra `TRNTYPE` |
| `FITID` | ID único do banco | Sim | Sim (dedup) | Chave `(FID, ACCTID, FITID)` |
| `CORRECTFITID` / `CORRECTACTION` | Correção anterior (REPLACE/DELETE) | Não | Ignorado | **Crítico** — corrige sem duplicar |
| `SRVRTID` | ID do servidor | Não | Ignorado | Rastreio |
| `CHECKNUM` | Nº do documento | Sim nos 3 | Fallback | Nº de cheque / referência |
| `REFNUM` | Referência externa | Raro | Fallback | ID de conciliação |
| `MEMO` | Histórico livre | Sim | Descrição | **Fonte principal de enriquecimento** (§4) |
| `NAME` | Nome do favorecido | Não neste dump | Fallback | Nome estruturado |
| `PAYEEID` / `PAYEE` | Favorecido completo (endereço, cidade) | Raro | — | Enriquecer cadastro |
| `BANKACCTTO` / `CCACCTTO` | Conta destino | Raro | — | **Transferência interna** (§10) |
| `SIC` | Standard Industrial Code | Cartões | — | Categorização em faturas |
| `IMAGEDATA` | Imagem do cheque | Raríssimo | — | Anexar comprovante |
| `CURRENCY` / `ORIGCURRENCY` | Moeda da transação vs. conta | Cambial | — | Multi-moeda futura |

---

## 3. Enum `TRNTYPE` — mapeamento canônico

| OFX | Natureza ERP | Observação |
|---|---|---|
| CREDIT | Entrada genérica | Especializar via MEMO |
| DEBIT | Saída genérica | Idem |
| INT | Rendimento / juros recebidos | Positivo = crédito |
| DIV | Dividendos | Investimento |
| FEE | Tarifa bancária | Categoria fixa |
| SRVCHG | Encargo de serviço | Idem |
| DEP | Depósito | Espécie |
| ATM | Saque/depósito ATM | |
| POS | Compra no débito | Cartão físico |
| XFER | Transferência TED/DOC/PIX | Precisa MEMO |
| CHECK | Cheque | |
| PAYMENT | Pagamento (boleto/conta) | |
| CASH | Movimento em espécie | |
| DIRECTDEP | Salário/pró-labore | |
| DIRECTDEBIT | Débito automático | |
| REPEATPMT | Pagamento recorrente | |
| HOLD | Bloqueio | Não contabilizar |
| OTHER | Outros | Motor de regras |

Nos três arquivos, apenas **CREDIT/DEBIT** são usados — a granularidade real vive no `MEMO`.

---

## 4. Engenharia reversa do `MEMO`

### 4.1 Banco Inter — prefixo estruturado + payload aspado

| Prefixo | Regex sugerida | Extrai | Exemplos reais |
|---|---|---|---|
| `Pix enviado:` | `^Pix enviado:\s*"?(?:Cp\s*:\s*(\d+)-)?(.+?)"?$` | favorecido, doc_curto | `Pix enviado: "Cp :10573521-AVIZEE"` |
| `Pix recebido:` | idem | pagador | `Pix recebido: "Cp :10573521-AVIZEE EQUIPAMENTOS LTDA"` |
| `Pix enviado ` (sem `:`) | `^Pix enviado\s+(.+)$` | nome livre | `Pix enviado Avizee Equipamentos Ltda` |
| `Boleto de cobranca recebido:` | `^Boleto de cobranca recebido:\s*"(\d+)/(\d+)"$` | convenio, nosso_numero | `112/90661717572` |
| `Pagamento efetuado:` | `^Pagamento efetuado:\s*"(.+)"$` | favorecido | `"EMPRESA BRASILEIRA DE CORREIOS…"`, `"Debito Automatico Fatura Cartao Inter"` |
| `Aplicacao:` / `Resgate:` | `^(Aplicacao\|Resgate):\s*"(.+)"$` | produto | `"CDB CREDITO BANCO INTER SA"` |
| `DARF NUMERADO` | literal | tributo federal | — |
| `SIMPLES NACIONAL` | literal | tributo SN | — |
| Pix por chave telefone/CPF | `^Pix (enviado\|recebido):\s*"(\d{5})\s+(\d+)\s+(.+)"$` | ddd, telefone/cpf, nome | `Pix enviado: "00019 127464840 MARCOS SILVA"` |

Convenção `Cp :NNNN-NOME` = **chave PIX aleatória (Cp) + dígitos + hífen + nome** — identificador estável
de contraparte recorrente, ideal para *aliasing* automático.

### 4.2 Mercado Pago — vocabulário próprio ligado ao produto

| Frase | Significado real | Sinal |
|---|---|---|
| `Pix recebido AVIZEE` | Entrada de cliente | + |
| `Dinheiro reservado AviZee` | Reserva de risco MP (transf. interna virtual) | − |
| `Dinheiro retirado AviZee` | Devolução do reservado | + |
| `Liberação de dinheiro` | Antecipação/venda liberada | + |
| `Reembolso Compra garantida` | Estorno de reserva | + |
| `Pix enviado Avizee Equipamentos Ltda` | **Saque para conta bancária própria** | − |

Sequências `Pix recebido AVIZEE` + `Dinheiro reservado AviZee` de mesmo valor no mesmo dia (ex.: 03/06
R$ 15.111,36) representam **um único evento contábil** e devem ser colapsadas em 1 lançamento — do
contrário inflam receita/despesa.

### 4.3 RecargaPay — dupla "pagamento + resgate do limite"

`Pagamento com a carteira` (débito) + `Resgate do limite` (crédito) de mesmo valor/dia = **uso de crédito
rotativo pré-aprovado**. Conta corrente sai zerada, mas gera **exigível** para o mês seguinte — vira
contas a pagar automático.

### 4.4 Vocabulário consolidado

Persistir dicionário `{banco?, regex, tipo_evento, sinal_esperado, extrai:[campos]}` cobrindo:
`PIX_ENVIADO`, `PIX_RECEBIDO`, `PIX_INTERNO_MESMA_TITULARIDADE`, `BOLETO_RECEBIDO`, `BOLETO_PAGO`,
`PAGAMENTO_FORNECEDOR`, `PAGAMENTO_FATURA_CARTAO`, `DEBITO_AUTOMATICO`, `TRIBUTO_DARF`,
`TRIBUTO_SIMPLES`, `TRIBUTO_INSS_FGTS`, `APLICACAO_CDB`, `RESGATE_CDB`, `RENDIMENTO`, `TARIFA`, `IOF`,
`JUROS`, `ESTORNO`, `REEMBOLSO`, `RESERVA_INTERNA_MP`, `LIBERACAO_MP`, `SAQUE_MP_PARA_BANCO`,
`USO_LIMITE_RECARGAPAY`.

---

## 5. Campos derivados possíveis

| Derivado | De onde vem | Confiança |
|---|---|---|
| `natureza_erp` (receita/despesa/transferência/imposto/investimento) | TRNTYPE + regex MEMO | Alta |
| `favorecido_nome` | regex por prefixo bancário | Alta |
| `favorecido_documento` (CNPJ/CPF) | `Cp :DDD-NOME` (Inter) ou `NAME` | Média |
| `banco_favorecido` | MEMO com nome de banco / DARF / SIMPLES | Média |
| `numero_boleto` / `nosso_numero` / `convenio` | Regex `112/\d+` (Inter) | Alta |
| `forma_pagamento` | PIX / TED / BOLETO / DEB.AUT / CARTAO | Alta |
| `categoria_financeira` | dicionário (Correios→Frete, Google→Software, Uber→Transporte, CDB→Investimento, DARF→Imp. Federais…) | Média (aprendível) |
| `centro_custo` | categoria + regra por empresa | Média |
| `competencia` | DTUSER; senão DTPOSTED; para tributos, vencimento | Média |
| `is_transferencia_interna` | mesmo valor abs. + mesma data ±1d entre contas próprias | Alta |
| `evento_pareado_id` | par crédito/débito MP mesmo dia/valor | Alta |
| `hash_evento` | sha1(FID+ACCTID+FITID) | Alta |
| `hash_conteudo` | sha1(data+valor+memo_normalizado) | Média |
| `arquivo_hash` | SHA-256 do cru (já existe) | Alta |
| `saldo_final_declarado` vs `calculado` | LEDGERBAL vs. Σ | Alta |

---

## 6. Normalização — modelo canônico único

```
TransacaoCanonica
├─ origem: { tipo: "ofx"|"pdf_cartao"|"csv"|"open_finance"|"api"|"pix", arquivo_hash, documento_id }
├─ instituicao: { compe, nome_org, tipo_conta, agencia, conta, moeda }
├─ periodo: { dt_start, dt_end, dt_server }
├─ saldo: { inicial_calc, final_declarado, disponivel }
├─ identificadores: { fitid, checknum, refnum, srvrtid, correct_fitid, correct_action,
│                     hash_evento, hash_conteudo }
├─ temporal: { dt_posted, dt_user, dt_avail, competencia }
├─ valor: { bruto, sinal, moeda_original, moeda_conta, cambio? }
├─ natureza: { trntype_ofx, evento_canonico, forma_pagamento }
├─ contraparte: { nome_bruto, nome_normalizado, documento?, banco_favorecido?, chave_pix?,
│                 agencia?, conta? }
├─ referencia_documento: { boleto_convenio?, nosso_numero?, linha_digitavel?, nfe_chave?,
│                          codigo_barras? }
├─ classificacao: { categoria, centro_custo, projeto?, tags[] }
├─ historico: { memo_original, memo_normalizado, memo_tokens[] }
├─ conciliacao: { status, lancamento_erp_id?, match_score, match_motivos[] }
├─ enriquecimento: { fornecedor_id?, cliente_id?, contrato_id?, is_transferencia_interna,
│                    par_evento_id? }
└─ auditoria: { importado_por, importado_em, versao_regra, aprendizado_aplicado[] }
```

PIX de qualquer banco colapsa no mesmo `evento_canonico`.

---

## 7. Enriquecimento automático

| Sinal no MEMO | Enriquecer |
|---|---|
| `CORREIOS`, `ECT` | categoria=Frete/Postagem, fornecedor=EBCT (34.028.316/0001-03), centro=Logística |
| `RODONAVES TRANSPORTE` | categoria=Frete, fornecedor por CNPJ |
| `SIMPLES NACIONAL` | categoria=Impostos/SN, competência=mês anterior, forma=DAS |
| `DARF NUMERADO` | categoria=Impostos Federais; código de receita via comprovante paralelo |
| `Debito Automatico Fatura Cartao Inter` | tipo=Pagamento Fatura Cartão, casar com fatura importada |
| `CDB CREDITO BANCO INTER SA` | categoria=Aplicação Financeira, centro=Financeiro (não operacional) |
| Fornecedores nominais (IABER, HOPPNER, QUICK SEALS, MAZZAFERRO, SUKUI, CLC CORDAS) | fuzzy → alias permanente |
| `Cp :10573521-AVIZEE…` (mesmo CNPJ da empresa) | **transferência interna** |
| Pix recebido de cliente cadastrado | vincular título aberto por valor+data |

---

## 8. Matching & score de confiança

| Critério | Peso |
|---|---|
| Igualdade de `hash_evento` (FID+ACCTID+FITID) | 1.0 (curto-circuito) |
| Nosso_número / linha digitável casando com título | 0.45 |
| Valor exato + data ±0d | 0.25 |
| Valor exato + data ±3d úteis | 0.15 |
| Favorecido normalizado = fornecedor/cliente do título (fuzzy ≥0.85) | 0.20 |
| Documento (CNPJ/CPF) do favorecido = do cadastro | 0.20 |
| Chave PIX conhecida da contraparte | 0.15 |
| Categoria/centro sugeridos por alias aprendido | 0.10 |
| Mesma forma de pagamento esperada | 0.05 |
| Sinal/natureza coerentes com título (a pagar × débito) | 0.05 |
| **Penalidade:** título já baixado | −∞ |

Faixas: `≥0.85 auto-match`, `0.60–0.85 sugestão forte`, `0.40–0.60 candidatos ranqueados`,
`<0.40 sem sugestão`.

---

## 9. Prevenção de duplicidade — camadas

1. **Mesma transação re-importada**: chave `(FID, ACCTID, FITID)`; respeitar
   `CORRECTFITID/CORRECTACTION=REPLACE|DELETE`.
2. **Mesmo arquivo reenviado**: `arquivo_hash` (SHA-256) → retornar resumo anterior.
3. **Mesmo evento por 2 canais** (OFX + Open Finance): `hash_conteudo`.
4. **Mesmo evento em 2 contas próprias**: par `Σ=0` no dia → 1 transferência (não 2).
5. **Reserva/Resgate MP** e **Pagamento/Resgate-limite RecargaPay**: colapsar em 1 evento.
6. **Estorno bancário**: par crédito/débito mesmo valor com MEMO `estorno|reembolso` em intervalo curto.

---

## 10. Detecção de transferências entre contas próprias

Regra: `mesmo_grupo_empresa` + `|valor_A|=|valor_B|` + `|dt_A−dt_B| ≤ 1 dia útil` + favorecido de A
contém CNPJ/nome da conta B. Casos reais nos arquivos:

- Inter 26/06 **−16.800,00** `Pix enviado: "Cp :10573521-AVIZEE"` ↔ MP 26/06 **+16.800,00**
  `Pix recebido AVIZEE`.
- Inter 03/06 **−15.111,36** ↔ MP 03/06 **+15.111,36**.
- Inter 16/06 **+857,08** ↔ MP 16/06 **−857,08** (retorno).

Todos viram **1** `TRANSFERENCIA_INTERNA`.

---

## 11. Motor de aprendizado contínuo

Toda intervenção do usuário gera um fato que retroalimenta o motor:

- alterar categoria → regra `memo_regex → categoria`, com contador de acertos.
- alterar fornecedor/cliente → **alias** `nome_bruto → entidade_id`.
- alterar centro de custo → regra `(categoria, fornecedor) → centro`.
- alterar tipo (despesa↔transferência) → override por `hash_conteudo`.
- desmarcar sugestão → reduz peso da regra.

Arquitetura:

```text
[OFX/PDF/CSV/OF/API] → Adapter → StagedTx → Normalizador → Enriquecedor
                                                    │
                                    ┌───────────────┴────────────────┐
                                    ▼                                ▼
                          Motor de Regras (aliases,          Motor de Matching
                          regex, categorias aprendidas)      (conciliação com ERP)
                                    │                                │
                                    └───────────► TransacaoCanonica ◄┘
                                                    │
                                                    ▼
                                          UI de conciliação (feedback)
                                                    │
                                                    ▼
                                     Store de Aprendizado (regras versionadas)
```

Cada regra guarda: escopo (empresa/global), condição, ação, origem (usuário/heurística/IA), acertos,
erros, versão, autor, data. Regras com `precisão < 0.6` são degradadas ou desativadas.

---

## 12. Modelo de domínio recomendado

Complementar às tabelas existentes (`financeiro_extrato_importacoes`, `financeiro_importacoes_docs`):

- `fin_instituicoes` (compe, nome, dialeto_ofx, timezone_default).
- `fin_contas_proprias` (empresa_id, compe, agencia, conta, tipo, apelido, chaves_pix[]).
- `fin_extrato_transacao` (campos §6, `documento_importacao_id`).
- `fin_extrato_transacao_pair` (par transferência interna / reserva MP / limite RecargaPay).
- `fin_memo_regras` (regex, banco?, evento_canonico, extrai_json, peso, versão).
- `fin_aliases_contraparte` (empresa_id, nome_bruto_normalizado, entidade_tipo, entidade_id, origem, hits).
- `fin_categorias_regras` (condicao_json, categoria_id, centro_id, peso, hits, erros).
- `fin_aprendizado_eventos` (log append-only das intervenções do usuário).
- `fin_conciliacao_match` (transacao_id, lancamento_id, score, motivos_json, origem: auto/manual/ia).

Índices críticos: `UNIQUE(fid, acctid, fitid)`, `INDEX(hash_conteudo)`, `INDEX(dt_posted, empresa_id)`,
`INDEX(favorecido_normalizado gin_trgm)`.

---

## 13. Limitações do padrão OFX e mitigações

| Limitação | Impacto | Mitigação |
|---|---|---|
| SGML sem fechamento nos leafs | Parsing frágil | Já tratado; manter testes |
| Charset declarado ≠ conteúdo (CP1252/Latin1 misto) | Acento corrompido | Detector heurístico + fallback |
| Agência/conta mascaradas em bancos digitais | Não serve como chave | `FID` + confirmação + apelido |
| MEMO livre, dialeto por banco | Regras por banco | Dicionário por `FID` versionado |
| Ausência de CNPJ/CPF do favorecido | Categoria imprecisa | Aliases + enriquecimento externo opcional |
| DARF sem código de receita | Impossível classificar tributo | Casar com comprovante |
| Sem MCC/SIC em conta corrente | Categorização manual | Motor de regras |
| Transferências não marcadas | Duplicação | Regra §10 |
| Reservas MP inflam receita | Falsa receita | Colapso §4.2 |
| `CORRECTFITID` raro | Estorno some | Aceitar quando existir; senão detectar par |
| Sem taxa/IOF discriminados no PIX | Custo escondido | Cruzar com relatório MDR |
| Fuso horário implícito | Data ±1 dia | Parsear `[-3:BRT]` |
| Sem streaming | Arquivos grandes travam | Parser incremental por bloco |

---

## 14. Recomendações arquiteturais (parser de próxima geração)

1. **Adapter por origem** → `StagedTx` com metadados do cabeçalho.
2. **Normalizador** → dicionário por `FID`, encoding, timezone, sinal.
3. **Extrator MEMO** → regex versionadas + tokenização + fuzzy contra cadastro.
4. **Enriquecedor** → fornecedor/cliente/categoria/centro/forma/documento.
5. **Detector de eventos compostos** → transferências, reservas MP, uso de limite, estornos, CDB.
6. **Matcher** → conciliação com títulos abertos (§8) + explicabilidade.
7. **Store de Aprendizado** → regras/aliases versionados, com métricas.
8. **Auditoria** → `raw` original + versão de regras aplicadas → permite reprocessar.
9. **Preview idempotente** → dry-run antes do commit.
10. **Multi-origem convergente** → mesma `TransacaoCanonica` para OFX/PDF/CSV/OF/PIX.
11. **Observabilidade** por FID: % auto-categorizado, % auto-conciliado, precisão, tempo.
12. **Segurança** → mascarar conta/agência em logs; RLS por empresa; `raw_texto` restrito.
13. **Feature flags** por dialeto (`ofx.dialeto.inter.v2`) para rollout seguro.
14. **Reprocessamento** → job reaplica regras novas em histórico não conciliado, sem duplicar.

---

## 15. Melhorias adicionais (não solicitadas)

- Baseline de saldo por conta: reconciliar `LEDGERBAL` do OFX com saldo calculado; alertar divergência.
- Detecção de gap: se `DTSTART` novo > `DTEND+1` do último importado, avisar buraco.
- Sugestão automática de conta bancária a partir de `FID + ACCTID`.
- Painel "Aprender comigo": fila de não classificados com "sempre categorizar assim".
- Explainability: mostrar regras/aliases que geraram cada sugestão.
- Import por e-mail (`financeiro@empresa` aceita OFX/PDF anexos).
- Open Finance como fonte incremental no mesmo pipeline.
- Antifraude: alertar quando fornecedor recebe PIX em chave diferente do histórico.
- Parser específico para DARF/SIMPLES com calendário fiscal.
- Cartões: casar `Debito Automatico Fatura` com fatura importada; senão exigir upload.
- Multi-empresa: dicionário global + overlay por empresa.
- IA (LLM) só como fallback quando score < 0.4; resultado vira regra permanente.

---

## 16. Próximos passos

Este documento é a entrega. Ao ser aprovado, servirá de referência para as próximas fases (cada uma
entrando como plano próprio):

1. Ampliar o adapter OFX para capturar cabeçalho, `LEDGERBAL`, `CORRECTFITID`, `NAME`, `PAYEE`, `BANKACCTTO`.
2. Persistir `TransacaoCanonica` (nova tabela + migração das existentes).
3. Substituir o dicionário atual pelo motor de regras versionado.
4. Detector de transferência interna e colapso MP/RecargaPay.
5. Evoluir o matcher com os pesos do §8.
6. Ligar o store de aprendizado à UI de conciliação.