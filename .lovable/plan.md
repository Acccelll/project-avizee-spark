

# Revisão End-to-End — Projeto AviZee ERP

## Resumo Executivo

O projeto está em estado funcional sólido: **TypeScript compila sem erros**, **623 de 624 testes passam**, e a arquitetura é coerente. Há áreas específicas que precisam de atenção, organizadas abaixo por prioridade.

---

## 1. CRÍTICO — Segurança (2 findings)

### 1.1 `user_permissions` expõe permissões de todos os usuários
- Qualquer usuário autenticado pode ler as permissões de qualquer outro usuário via SELECT.
- **Correção:** Restringir a policy SELECT para `WHERE user_id = auth.uid()`, mantendo acesso total para admins via `has_role`.

### 1.2 Storage `dbavizee` sem verificação de ownership
- Qualquer autenticado pode ler/sobrescrever/deletar arquivos de outros usuários.
- **Correção:** Adicionar verificação de `auth.uid()` no path ou em tabela de ownership.

### 1.3 Funções SQL sem `search_path` definido (119 warnings)
- Todas as funções RPC criadas nas migrations não definem `SET search_path = public`.
- **Correção:** Migration corretiva para as funções críticas (`consolidar_lote_*`, `has_role`, `sync_produto_estoque_atual`).

### 1.4 RLS permissiva em tabelas de cadastro
- Tabelas `clientes`, `fornecedores`, `produtos`, `grupos_produto`, `contas_contabeis`, `formas_pagamento` têm INSERT/UPDATE/DELETE com `USING(true)` — qualquer autenticado pode apagar dados.
- **Ação:** Avaliar quais tabelas devem restringir DELETE/UPDATE a admin ou roles específicos.

---

## 2. ALTO — Teste Falhando

### 2.1 `OrcamentoForm.test.tsx` — 1 falha
- **Causa:** Mock do Supabase não implementa `.limit()` na cadeia `supabase.from('empresa_config').select('*').limit(1).single()`.
- **Correção:** Atualizar o mock em `src/test/setup.ts` para suportar `.limit()` retornando `this`.

---

## 3. ALTO — Dívida Técnica

### 3.1 `@ts-nocheck` em 36 arquivos
Arquivos mais críticos (hooks de importação e páginas transacionais):
- 4 hooks de importação (`useImportacaoCadastros/Estoque/Financeiro/Faturamento`)
- Páginas: `OrcamentoForm`, `MigracaoDados`, `Financeiro`, `Fiscal`
- Componentes: `UsuariosTab`, `ClienteView`

### 3.2 `as any` em 59 arquivos
- Muitos são consequência do `@ts-nocheck` (uma vez removido, os `as any` ficam explícitos).
- Hooks de importação usam `as any` extensivamente nos dados de staging.

### 3.3 Enriquecimento (`useImportacaoEnriquecimento`) NÃO usa staging real
- A consolidação (`finalizeImport`) faz escrita direta nas tabelas finais (`produtos_fornecedores`, `formas_pagamento`, `contas_contabeis`, `contas_bancarias`) em loop individual — sem transação, sem RPC.
- **Risco:** Falha parcial deixa dados inconsistentes.
- **Correção:** Migrar para RPC transacional como os outros hooks.

---

## 4. MÉDIO — Arquitetura e Manutenibilidade

### 4.1 Arquivos grandes (God Components restantes)
| Arquivo | Linhas |
|---------|--------|
| `Clientes.tsx` | 1622 |
| `Administracao.tsx` | 1462 |
| `UsuariosTab.tsx` | 1252 |
| `Produtos.tsx` | 1121 |
| `OrcamentoForm.tsx` | 1063 |
| `NotaFiscalEditModal.tsx` | 1059 |
| `GruposEconomicos.tsx` | 1049 |

Estes são candidatos a decomposição futura seguindo o padrão já aplicado em `FreteSimuladorCard` e `CotacaoCompraDrawer`.

### 4.2 Edge Functions sem testes
- 5 Edge Functions (`admin-users`, `correios-api`, `process-email-queue`, `setup-admin`, `social-sync`) sem cobertura de teste.

### 4.3 Migrations acumuladas (35 arquivos)
- Sem impacto funcional, mas dificulta leitura. Considerar squash em versão futura de baseline.

---

## 5. BAIXO — Melhorias Sugeridas

### 5.1 `useImportacaoXml` ainda grava direto em `compras`
- Linha 143: `supabase.from("compras").insert(...)` — não segue o padrão de staging.

### 5.2 `OrcamentoForm.tsx` faz queries diretas ao Supabase
- 10 chamadas `supabase.from(...)` diretas na página em vez de usar hooks/services.

### 5.3 Sem CI/CD para testes
- Os testes rodam localmente mas não há evidência de pipeline automatizado.

---

## Plano de Correção Recomendado

### Fase A — Segurança (imediata)
1. Migration para restringir `user_permissions` SELECT a `user_id = auth.uid() OR has_role(admin)`
2. Migration para storage policies com ownership check
3. Migration para adicionar `SET search_path = public` nas funções RPC críticas
4. Revisar policies permissivas em tabelas de cadastro (restringir DELETE a admin)

### Fase B — Estabilidade (curto prazo)
5. Corrigir mock do Supabase para `.limit()` no setup de testes
6. Migrar `useImportacaoEnriquecimento` para RPC transacional
7. Remover `@ts-nocheck` dos 4 hooks de importação (já refatorados recentemente)

### Fase C — Qualidade (médio prazo)
8. Decompor `Clientes.tsx`, `Produtos.tsx`, `OrcamentoForm.tsx`
9. Extrair queries diretas do `OrcamentoForm` para um service
10. Remover `@ts-nocheck` das páginas restantes progressivamente

---

## Métricas Atuais

| Indicador | Valor |
|-----------|-------|
| Total de arquivos `.ts`/`.tsx` | ~90K linhas |
| TypeScript `--noEmit` | 0 erros |
| Testes | 623/624 passando (99.8%) |
| `@ts-nocheck` | 36 arquivos |
| `as any` | 59 arquivos |
| Security findings (críticos) | 2 |
| Security warnings (RLS) | ~100+ |
| Edge Functions | 5 (sem testes) |
| Migrations | 35 |

