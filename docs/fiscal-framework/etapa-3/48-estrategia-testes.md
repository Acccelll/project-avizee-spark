# 48 · Estratégia de testes

Pirâmide: **muitos unitários · alguns integração · poucos E2E · manuais fiscais em homologação SEFAZ**.

## Camadas

### Unitários (~70% da suíte)
- **Onde**: `src/fiscal-framework/**/*.test.ts`.
- **Alvo**: Domain (100% cobertura obrigatória), Engines (95%+), Cross (80%+).
- **Ferramenta**: Vitest.
- **Isolamento**: sem I/O, sem Deno APIs. Clock mockado (`IFiscalClock.fixed`).
- **Exemplos**:
  - Cálculo de DV da chave.
  - Serialização determinística de `XmlNode`.
  - C14N: input conhecido → bytes esperados (golden test).
  - `FiscalResult` propagação.
  - Máquinas de estado — todas as transições válidas/inválidas.
  - `has_role` combinações.

### Integração (~20%)
- **Onde**: `src/tests/integration/`.
- **Alvo**: Application layer + banco real (Supabase local ou test project).
- **Cobre**: pipeline serialize → sign → validate → persist (mock transport).
- **Isolamento**: transaction rollback ou schema descartável por teste.
- **Exemplos**:
  - `AutorizarNFe` end-to-end sem SEFAZ (mock retorna cStat=100).
  - `SincronizarDFe` com fixture de docZip.
  - Idempotência: dois envios com mesma Idempotency-Key.
  - RLS: usuário A não vê nota de empresa B.

### Contrato (~5%)
- **Onde**: `src/fiscal-framework/**/*.contract.test.ts`.
- **Alvo**: adherência das implementações aos contratos de `fiscal-core`.
- **Padrão**: uma suite genérica por interface (`IXmlSigner`, `ITransportChannel`, `ISchemaValidator`) executada contra cada implementação.
- **Exemplo**: qualquer `IXmlSigner` deve produzir assinatura validável por `ISignatureValidator`.

### E2E (~5%)
- **Onde**: `e2e/specs/`.
- **Ferramenta**: Playwright.
- **Alvo**: fluxos de UI + edge + banco. SEFAZ mockado.
- **Exemplos existentes**: `nfe-homologacao.spec.ts`, `conciliacao-ofx.spec.ts`.
- **Novos** (Etapa 4+):
  - Emissão NF-e completa via UI (mock SEFAZ).
  - Cancelamento < 24h.
  - CCe com validação de texto.
  - Import XML + resolução de fornecedor rápido.
  - Upload certificado + emissão consecutiva.

### Fiscais em homologação SEFAZ real
- **Onde**: `e2e/fiscal-hom/` (não roda em CI).
- **Requer**: certificado A1 real, credenciais UF configuradas, ambiente homologação.
- **Cobertura**: cada operação (autorizar/cancelar/CCe/inutilizar/manifestar/DFe) contra pelo menos 3 UFs (SP, RJ, MG) + AN.
- **Frequência**: pré-release (mensal ou por milestone).
- **Manual approval**: exige aprovação de operador fiscal antes de rodar.

## Testes específicos fiscais

### Testes de XML
- **Golden files**: XMLs de exemplo (rejeições e aprovações conhecidas) em `test/fixtures/xml/`.
- **Round-trip**: `serialize(parse(xml)) === xml` (bytewise após C14N).
- **Casos**: NF-e simples, com múltiplos itens, com CST/CSOSN variados, com transporte, com pagamentos, com CCe.

### Testes de assinatura
- **Golden**: XML + certificado de teste → assinatura esperada.
- **Round-trip**: assinar + validar deve passar; adulterar 1 char no XML deve falhar.
- **Cadeia**: cert com múltiplas folhas — extração correta da folha do titular.
- **Suítes**: RSA-SHA1 e RSA-SHA256 (quando ativado).

### Testes SOAP
- **Envelopes**: single-wrapper e double-wrapper (AN) — bytes esperados.
- **SOAPAction**: incluída/omitida conforme autorizador.
- **Parse resposta**: fixtures de todas as UF (formatos ligeiramente distintos).

### Testes de contingência
- **Cenários**: autorizador principal cStat≠107 → sugere SVC-AN; SVC-AN também falha → não emite.
- **Ativação/encerramento**: fluxo administrativo.
- **Regularização**: nota SVC deve constar como pendente até transmissão ao principal.

### Testes de performance
- **Serialização**: 1000 notas seq < 5s.
- **C14N**: 1MB XML < 200ms.
- **Assinatura**: cert cache válido → < 100ms/nota.
- **DistDFe**: 1000 chaves decodificadas < 30s.

### Testes de carga
- **Ferramenta**: k6 ou Artillery (a decidir; sem infra hoje).
- **Cenários**:
  - 60 autorizações/min sustentado por 1h (limite v1).
  - Pico de 200 autorizações/min por 5min (verificar breaker + fila).
  - DistDFe multi-empresa simultâneo (10 tenants).
- **Métricas**: p50/p95/p99 latência, taxa de erro, comportamento do breaker.

## Testes de segurança

- **RLS**: matriz usuário × recurso × ação (bateria completa em `src/tests/security/`).
- **IDOR**: forçar `empresa_id` diferente no body → deve ignorar/rejeitar.
- **Injection**: campos de input passam por sanitizador; SQL só via parâmetro nomeado.
- **Rate limit**: teste de estouro devolve 429.
- **Auth**: rota fiscal sem JWT → 401; com JWT sem escopo → 403.
- **Auditoria tamper**: tentativa de UPDATE/DELETE em `fiscal_auditoria` bloqueada.
- **Secret leak**: sanitizador testa que senha/PFX não aparecem em log/resposta.

## Testes de idempotência

- Dois requests com mesma `Idempotency-Key` + payload igual → segunda devolve resposta cacheada com `Idempotent-Replay: true`.
- Mesma key + payload diferente → 409.
- Sem key + retry natural → UNIQUE constraint impede duplicação.

## Cobertura mínima por camada

| Camada | Cobertura |
|---|---|
| `fiscal-core` | 100% (branches) |
| Engines | 95% |
| Cross | 80% |
| Modules | 90% (domain logic), 100% (máquina de estado) |
| Application | 85% |
| Fachada | 70% |
| UI fiscal | 60% (smoke) |

## CI

- **PR**: unit + integration + contract + E2E mock.
- **Merge main**: adiciona lint, tsgo, bundle budget.
- **Nightly**: performance benchmarks.
- **Pré-release**: fiscal homologação SEFAZ (manual approval).

## Fixtures

- `test/fixtures/xml/`: NF-e exemplos.
- `test/fixtures/pfx/`: certificado de teste (não real; gerado por script).
- `test/fixtures/sefaz-responses/`: respostas por cStat.
- `test/fixtures/dfe-doczip/`: pacotes docZip codificados.

## Anti-padrões em testes

- Depender de SEFAZ real em unitário.
- Usar `new Date()` em teste (usa `IFiscalClock.fixed`).
- Depender de ordem de execução.
- Mockar Domain (mockar Infra sim).
- Testar implementação (testar comportamento observável).
- Certificado real commitado.
- Fixtures gigantes copiadas em cada teste (usar `loadFixture(name)`).

## Critério de "pronto para produção" (por operação)

1. Unit + integration + contract green.
2. E2E mock green.
3. Teste fiscal homologação em ao menos 1 UF verde.
4. Documentação atualizada.
5. ADR (se aplicável).
6. Feature flag `fiscal:v2:*` criada.
7. Rollback documentado.