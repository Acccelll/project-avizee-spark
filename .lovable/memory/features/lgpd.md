---
name: LGPD
description: Tabela lgpd_solicitacoes + RPCs exportar_dados_titular/anonimizar_titular + UI em /administracao?tab=lgpd; anonimização preserva NFs autorizadas e histórico financeiro
type: feature
---
# LGPD — base de conformidade

- Tabela `lgpd_solicitacoes` (admin-only via RLS) registra cada solicitação de exportação ou anonimização com `titular_tipo`, `titular_id`, `tipo`, `status`, `motivo`, `payload`, `solicitado_por`.
- Coluna `consentimento_lgpd_em timestamptz` em `clientes`, `fornecedores`, `funcionarios` (nullable).
- RPC `exportar_dados_titular(_tipo,_id)` retorna jsonb com cadastro + relações. Admin-only, SECURITY DEFINER, search_path=public.
- RPC `anonimizar_titular(_tipo,_id,_motivo)` substitui PII por valores anonimizados (`[ANONIMIZADO #hash]`), seta `ativo=false`. **Preserva NFs autorizadas e financeiro_lancamentos históricos**.
- UI: `/administracao?tab=lgpd` (LgpdSection). Serviço: `src/services/lgpd.service.ts`.
