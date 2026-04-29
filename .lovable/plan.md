## Resumo

Quatro melhorias coordenadas: (1) vencimento na NF integrado ao financeiro, (2) consulta de NF-e por chave de acesso, (3) upload seguro de certificado A1 (.pfx) com integração ao Faturamento, e (4) roles secundários cumulativos no RBAC. Tudo preserva a stack atual e segue a doutrina já memorizada (search_path=public, RPCs atômicas, RBAC via `can()`, Vault para segredos).

---

## 1. Data de vencimento na NF integrada ao financeiro

**Schema** (migração):
- `notas_fiscais` já não possui `data_vencimento`. Adicionar:
  - `data_vencimento DATE` — primeiro vencimento (ou único se à vista).
  - `numero_parcelas INT DEFAULT 1` (>=1).
  - `intervalo_parcelas_dias INT DEFAULT 30`.
  - `parcelas JSONB` — opcional, para overrides editáveis: `[{numero, data_vencimento, valor}]`. Quando `null`, calcula automaticamente.

**UI** (`NotaFiscalForm.tsx` → bloco "Pagamento"):
- Campo "1º vencimento" (DateInput) — visível sempre que `gera_financeiro=true`.
- Quando `condicao_pagamento != 'a_vista'`: campos "Nº parcelas" e "Intervalo (dias)", + tabela editável das parcelas geradas (DatePicker + valor por linha). Recalcula ao mudar total/parcelas/intervalo, mas respeita edições manuais (flag `__edited` por linha).
- À vista: vencimento default = `data_emissao`, editável.

**Integração financeiro**:
- O fluxo de geração de `financeiro_lancamentos` a partir da NF (já existente via `gera_financeiro`) passa a consumir `parcelas` (quando preenchido) ou calcular determinísticamente a partir de `data_vencimento + intervalo × n`.
- Idempotência: cada parcela carrega `nota_fiscal_id + numero_parcela` como chave lógica para não duplicar em reemissões.

---

## 2. Consulta de NF-e por chave de acesso (44 dígitos)

**Decisão técnica**: o portal público da Fazenda **não oferece API REST** — apenas web services SOAP autenticados por certificado A1. As únicas formas viáveis de baixar o XML completo são:

- **a) DistDFe (já implementado em `sefaz-distdfe`)** — webservice oficial da SEFAZ que entrega XMLs destinados ao CNPJ do certificado. **Funciona apenas para notas em que a empresa é destinatária**. Já temos `process-distdfe-cron`.
- **b) Consulta por chave via `NfeConsultaProtocolo4`** — retorna **apenas o protocolo/status**, não o XML completo (limitação da SEFAZ por sigilo fiscal).
- **c) Provedores comerciais (Tecnospeed, Migrate, NFe.io, Webmania)** — entregam XML por chave para qualquer NF emitida contra o CNPJ. Pago.

**Plano em duas camadas**:

1. **Curto prazo (sem custo)**: novo botão "Buscar por chave" no header do Fiscal. Abre dialog que aceita os 44 dígitos e:
   - Procura primeiro em `dist_dfe_documentos` (XMLs já baixados pelo cron) — se encontrar, abre direto o `TraducaoXmlDrawer` com o XML em mãos.
   - Se não encontrar, dispara `sefaz-distdfe` em modo "consulta dirigida" (`consNSU` específica) e tenta de novo.
   - Caso ainda assim não exista (NF emitida contra outro CNPJ ou ainda não disponível), mostra mensagem clara explicando o limite legal e oferece **importar XML manualmente**.

2. **Longo prazo (opcional, configurável)**: campo em Administração → Integrações → "Provedor de consulta de XML por chave" (Tecnospeed/NFe.io/Webmania/desativado) com `api_key` em Vault. Edge function `nfe-consulta-chave` que tenta provedor configurado quando DistDFe falha. Implementação só se o usuário aprovar o custo do provedor — fica como TODO documentado.

**Schema**:
- `dist_dfe_documentos` já existe (do fluxo DistDFe). Adicionar índice por `chave_acesso` se ainda não houver.

---

## 3. Certificado digital: upload .pfx + integração com Faturamento

**Hoje**: `IntegracoesSection.tsx` aceita Base64 colado em textarea e salva em `app_configuracoes['integracoes'].sefazCertificadoBase64`. Inseguro e frágil.

**Alvo** (já parcialmente preparado — `httpClient.service.ts` suporta `assinar-e-enviar-vault`):

**Storage + Vault**:
- Bucket privado `certificados-fiscais` (RLS: só admin lê/escreve).
- Path determinístico: `empresa/{empresa_id}/cert.pfx`.
- Senha do .pfx vai para **Supabase Vault** via secret `CERTIFICADO_PFX_SENHA` (RPC `salvar_secret_vault` já documentado em `mem://security/gestao-de-segredos-vault`).
- Metadados em `app_configuracoes['certificado_digital']`: `{ cnpj, razaoSocial, validadeInicio, validadeFim, atualizadoEm, storagePath }` — sem o conteúdo do .pfx.

**UI** (`IntegracoesSection.tsx`, bloco SEFAZ — substitui o textarea):
- Componente novo `CertificadoUploader.tsx`:
  - `<Input type="file" accept=".pfx,.p12">` + campo senha.
  - Ao confirmar: lê o file, faz upload ao Storage privado, chama `sefaz-proxy` action `parse-certificado` com o file enviado (não passa pelo client), salva senha no Vault, persiste metadados.
  - Mostra card de status: CNPJ, razão social, validade, **dias restantes** com badge (verde >30, âmbar 8–30, vermelho ≤7).
  - Botão "Substituir certificado" e "Remover".
  - Mantém compatibilidade: se já existir Base64 legado, oferece "Migrar para upload seguro".

**Integração Faturamento**:
- `useSefazAcoes` / `enviarParaSefaz` já chamam `sefaz-proxy` sem passar credenciais → continua funcionando porque a edge usa `assinar-e-enviar-vault`.
- No `Fiscal.tsx`, antes de habilitar "Emitir NF", checar `obterCertificadoConfigurado()`:
  - Se ausente: botão desabilitado com tooltip "Configure o certificado em Administração → Integrações → SEFAZ" e link direto.
  - Se vencendo (≤30 dias): banner âmbar persistente no topo do Fiscal e do Faturamento.
  - Se vencido: bloqueia emissão, libera apenas consulta/cancelamento.
- Hook compartilhado `useCertificadoStatus()` para reusar em Fiscal, Faturamento e Admin.

**Edge function** (já existe `sefaz-proxy` com `parse-certificado`): adicionar action `parse-certificado-from-storage` que lê o .pfx do bucket usando service role e a senha do Vault, evitando trafegar credenciais no client.

---

## 4. Roles secundários cumulativos

**Hoje**: `user_roles` permite múltiplas linhas por usuário (`UNIQUE(user_id, role)`), e `has_role()` já retorna true se existir qualquer linha → **a infra já suporta múltiplos roles**. Falta UI e lógica de "herança de permissões".

**Conceito**:
- Cada role tem um **template de permissões padrão** (ex.: `estoquista` → `estoque:editar, produtos:visualizar, transferencias:criar`).
- Usuário recebe `role principal` (já existente, primeiro user_role) + N `roles secundários` (novos user_roles adicionais).
- `useCan()` já consulta `user_permissions` (overrides explícitos). Adicionamos uma camada: permissões efetivas = união(`templates de todos os roles do usuário`) ∪ overrides positivos − overrides negativos.

**Schema**:
- Nova tabela `role_permissions_template`:
  ```
  role app_role NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  PRIMARY KEY (role, resource, action)
  ```
  RLS: leitura pública autenticada, escrita só admin.
- Seed inicial com os perfis canônicos já documentados (`mem://auth/papeis-de-usuario`): admin, estoquista, financeiro, vendedor, gestor_compras, operador_logistico, viewer.

**RPCs** (`SECURITY DEFINER, search_path=public`):
- `get_user_effective_permissions(_user_id uuid)` → `setof (resource, action, allowed, source)` onde source ∈ {`template:role`, `override`} para auditabilidade.
- `set_user_roles(_user_id uuid, _roles app_role[])` → substitui atomicamente os user_roles, registra em `audit_log`.

**UI** (`UserFormModal.tsx` / `PermissionMatrix.tsx`):
- Bloco "Papéis":
  - Select "Papel principal" (1 obrigatório).
  - MultiSelect "Papéis adicionais" (0..N) — chips com "x" para remover.
  - Preview "Permissões efetivas" abaixo, calculado por `get_user_effective_permissions`, com badges indicando origem (`do papel: estoquista`, `override manual`).
- `PermissionMatrix` continua editando `user_permissions` como **overrides** explícitos (texto: "Marque para conceder além do que os papéis já dão; desmarque para remover algo concedido por papel").
- Tela nova `/administracao?tab=papeis` (ou subaba) para admin editar `role_permissions_template` — tabela com matriz role × recurso × ação.

**Frontend hook**:
- `useCan()` passa a consumir uma view materializada/RPC unificada em vez de só `user_permissions`. Cache por `user_id` no React Query (invalida ao trocar roles).

**Compatibilidade**: usuários atuais ganham automaticamente o template do role que já têm — comportamento percebido não muda, mas fica explicável e editável.

---

## Detalhes técnicos

### Migrações (uma por bloco)

```sql
-- Bloco 1: vencimento NF
ALTER TABLE notas_fiscais
  ADD COLUMN data_vencimento DATE,
  ADD COLUMN numero_parcelas INT DEFAULT 1 CHECK (numero_parcelas >= 1),
  ADD COLUMN intervalo_parcelas_dias INT DEFAULT 30 CHECK (intervalo_parcelas_dias >= 0),
  ADD COLUMN parcelas JSONB;

-- Bloco 3: certificado em Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('certificados-fiscais','certificados-fiscais',false);
-- + policies admin-only

-- Bloco 4: templates de role
CREATE TABLE role_permissions_template (
  role app_role NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (role, resource, action)
);
ALTER TABLE role_permissions_template ENABLE ROW LEVEL SECURITY;
-- + seed com perfis canônicos
-- + RPC get_user_effective_permissions e set_user_roles
```

### Memórias a atualizar
- `mem/features/fiscal-vencimento-parcelas.md` — nova.
- `mem/features/consulta-nfe-por-chave.md` — nova, registrando o limite SOAP/DistDFe.
- `mem/security/gestao-de-segredos-vault.md` — anexar fluxo do certificado em Storage.
- `mem/auth/papeis-de-usuario.md` — atualizar para mencionar templates + roles secundários.
- `mem/index.md` — referenciar as novas entradas.

---

## Ordem sugerida de execução

1. **Bloco 3 (Certificado)** — destrava o resto do fiscal e tem maior impacto de segurança.
2. **Bloco 1 (Vencimento)** — mudança simples, alto ganho UX.
3. **Bloco 2 (Consulta por chave)** — fase 1 (DistDFe + import manual). Fase 2 (provedor pago) só sob aprovação.
4. **Bloco 4 (Roles secundários)** — maior, isolado do fiscal.

Quer aprovar tudo de uma vez ou fatiar?