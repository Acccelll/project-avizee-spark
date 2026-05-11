# Fase A — Inventário de Objetos Críticos do Schema

> Status: Em andamento. Gerado em 2026-05-11. Requer pg_dump manual.

## Objeto críticos identificados nas migrations

### Sequences (numeração atômica de documentos)

Todas com SECURITY DEFINER nas RPCs que as consomem:

- `seq_orcamento` — prefixo ORC (ex: ORC000042)
- `seq_ordem_venda` — prefixo OV
- `seq_pedido_compra` — prefixo PC
- `seq_cotacao_compra` — prefixo CC
- `seq_nota_fiscal` — NF-e número sequencial
- `nfe_numero_seq` — numeração por série NF-e
- `seq_codigo_interno_produto` — SKU interno
- (1 sequence adicional — verificar via `pg_catalog` no Dashboard)

Verificação obrigatória na baseline: `setval()` com `last_value` atual.

### Storage Buckets (5 confirmados)

- `dbavizee` — público → `false` (alterado em migration posterior)
- `email-assets` — público: `true`
- `orcamentos-pdf` — público: `false`
- `etiquetas-correios` — público: `false`
- `danfe-pdfs` — público: `false`

### Cron Jobs (via pg_cron)

- `webhooks-dispatcher-tick` — `* * * * *`
- Verificar demais jobs (`process-email-queue`, `process-distdfe-cron`,
  `process-nfe-retry-cron`) no Dashboard → `cron.job`

### SECURITY DEFINER Functions (127 migrations contêm)

Funções críticas confirmadas:

`consolidar_lote_*`, `proximo_numero_*`, `gerar_chave_acesso_nfe`,
`registrar_baixa_financeira`, `kpis_financeiro`, `kpis_fiscal`,
`produtos_estoque_summary`, `sidebar_alerts_kpis` (a criar),
`kpi_clientes_qualidade` (a criar)

### Tabelas com maior churn (mais suscetíveis a conflito de squash)

- `financeiro_lancamentos`: 44 ALTER TABLE statements
- `notas_fiscais`: 43
- `orcamentos`: 34
- `ordens_venda`: 24
- `produtos`: 22

## Passo manual necessário (fora do Lovable)

```bash
# Via Supabase CLI (recomendado):
supabase db dump \
  --project-ref cpvdncsxzostovdduhci \
  --schema public \
  > supabase/migrations/_baseline_20260511.sql.reference

# OU via Dashboard → SQL Editor, rodar o script em:
# scripts/schema-inventory.sql
```

## Status dos itens do plano

| Item | Status |
|------|--------|
| Schema drift no CI | ✅ Já feito (`ci.yml`, job `schema-drift`) |
| Drift atual = 0 colunas | ✅ Confirmado |
| Warnings falsos positivos silenciados | ✅ Feito nesta onda |
| `user_sessions` bug corrigido | ✅ Feito nesta onda |
| pg_dump baseline gerado | ⏳ Pendente (passo manual) |
| Checklist objetos críticos | ✅ Este documento |
| Fase B (baseline SQL consolidado) | ⏳ Aguardar ≤2 migrations/dia por 3 dias |
| Fase C (cutover) | 🚫 Adiar — 8-18 migrations/dia atualmente |