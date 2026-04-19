

## Plano — Correções fiscais críticas + refactors estruturais

Vou priorizar por risco: P10/P11 são bloqueadores de produção fiscal; P14 é bug puro; P13/P15/P16 são qualidade; P12 é refactor grande que precisa escopo controlado.

### Bloco 1 — Fiscal crítico (P10, P11, P14)

**P10 — `<CRT>`/`<tpAmb>` hardcoded:**
- Migration: adicionar `ambiente_sefaz TEXT DEFAULT '2' CHECK IN ('1','2')` em `empresa_config` (campo `crt` já existe? — vou verificar; se não, adicionar `crt TEXT DEFAULT '1' CHECK IN ('1','2','3')`).
- `xmlBuilder.service.ts`: adicionar `crt` e `ambiente` em `NFeData`; trocar literais nos 3 builders (NFe, cancelamento, inutilização).
- `autorizacao.service.ts` + `cancelamento.service.ts` + `inutilizacao.service.ts`: ler `empresa_config` e injetar.
- `ConfiguracaoFiscal.tsx`: toggle Homologação/Produção com `ConfirmDialog` ao ativar produção.

**P11 — `<indIEDest>` hardcoded:**
- `NFeData.destinatario`: adicionar `indIEDest`.
- Builder usa `${dados.destinatario.indIEDest}`.
- Helper `calcularIndIEDest(ie, tipoPessoa)` em `xmlBuilder.service.ts` + aplicar onde `NFeData` é montado (verificar `gerarNFParaPedido` / hooks fiscais).

**P14 — IPI sempre 0:**
- Substituir ternário quebrado em `tributacao.service.ts` por tabela `sugerirAliquotaIpi(ncm)` com comentário de "sugestão — confirmar com contador".

### Bloco 2 — Conciliação + Autosave + Mocks (P13, P15, P16)

**P13 — Similaridade bancária:**
- Reescrever `calcularSimilaridade` em `conciliacao.service.ts` com normalização (remove refs ≥5 dígitos) + bigramas (Sørensen-Dice).
- Adicionar `confidence: "alta"|"media"|"baixa"` no retorno de `sugerirConciliacao` (alta ≥0.7, media ≥0.5, baixa ≥0.35). Threshold mínimo 0.35.
- Atualizar tipo de retorno e callers (`useConciliacaoBancaria`) para repassar `confidence`. UI fica para passada futura — só o tipo já fica disponível.

**P15 — Autosave keys únicas:**
- Auditar usos de `useAutoSave` no projeto.
- Garantir storageKey com ID (`form:${id}`) ou sessionKey ref para "novo".
- Expiração 7 dias **já está aplicada** no hook (P6).

**P16 — Mock global Supabase:**
- Adicionar `vi.mock('@/integrations/supabase/client', ...)` no fim de `src/test/setup.ts` com chainable mocks padrão. Mocks por arquivo continuam podendo fazer override.

### Bloco 3 — God components (P12) — escopo controlado

Refactors grandes e arriscados. Vou fazer **apenas Clientes.tsx** nesta passada, em 4 extrações sequenciais, mantendo contrato externo igual:
- `src/pages/clientes/hooks/useClienteForm.ts` (estado do form principal)
- `src/pages/clientes/components/ClienteEnderecosTab.tsx`
- `src/pages/clientes/components/ClienteComunicacoesTab.tsx`
- `src/pages/clientes/components/ClienteTransportadorasTab.tsx`
- `Clientes.tsx` reduzido a listagem + montagem de tabs.

`OrcamentoForm.tsx` (P12B) **fica para passada própria** — 1.272 linhas com lógica de PDF/email/conversão tem risco alto demais para combinar com fiscal crítico no mesmo lote.

### Migrations
1. `ALTER TABLE empresa_config ADD COLUMN ambiente_sefaz TEXT DEFAULT '2' CHECK (ambiente_sefaz IN ('1','2'));`
2. Se `crt` não existir: `ADD COLUMN crt TEXT DEFAULT '1' CHECK (crt IN ('1','2','3'));`

### Fora de escopo
- Refactor de `OrcamentoForm.tsx` (passada própria).
- UI de exibição do `confidence` na conciliação (apenas dado disponível).
- Tabela completa de IPI por NCM (apenas capítulos comuns como sugestão).
- Validação cruzada `crt` × CSTs gerados (P10 só corrige o campo; regras de CST por regime ficam em `tributacao.service.ts`).

### Critério de aceite
- XML NF-e usa `crt` e `tpAmb` da `empresa_config`; toggle de ambiente na UI fiscal com confirmação.
- `<indIEDest>` calculado a partir do cliente (PF=9, PJ sem IE/ISENTO=9, PJ com IE=1).
- IPI sugerido > 0 para NCMs com capítulo conhecido.
- Similaridade bancária com bigramas + normalização; retorno expõe `confidence`.
- `useAutoSave` com keys únicas por registro.
- Mock global Supabase em `src/test/setup.ts`.
- `Clientes.tsx` < 400 linhas, dividido em hook + 3 sub-componentes.
- Build OK.

### Arquivos afetados
**Fiscal:** `xmlBuilder.service.ts`, `autorizacao.service.ts`, `cancelamento.service.ts`, `inutilizacao.service.ts`, `tributacao.service.ts`, `ConfiguracaoFiscal.tsx`, hooks que montam `NFeData`, migration nova.
**Conciliação:** `conciliacao.service.ts`, `useConciliacaoBancaria.ts` (tipos).
**Autosave:** auditoria + ajuste de callers.
**Testes:** `src/test/setup.ts`.
**Clientes refactor:** `Clientes.tsx` + 1 hook + 3 componentes novos em `src/pages/clientes/`.

