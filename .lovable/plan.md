
# Ajustes finais — sessão, criação de usuário, ações rápidas, datas, branding e grids padrão

Sete frentes objetivas, com foco em corrigir a causa real dos problemas e alinhar o comportamento ao que você descreveu.

## 1. Aviso de renovação de sessão: padrão em 55 minutos após login

Hoje há conflito entre o aviso e o keepalive automático: com keepalive ativo, o aviso quase nunca aparece.

### O que ajustar
- Alterar o comportamento padrão para:
  - `session_keepalive = false`
  - `session_warn_minutes = 5`
- Assim, em uma sessão de 1 hora, o aviso aparece por padrão aos 55 minutos do login.
- Manter a opção de ativar/desativar “Manter sessão ativa” em Preferências.
- Quando keepalive estiver ativo:
  - renovar em background;
  - não exibir aviso enquanto a sessão estiver sendo renovada com sucesso.
- Ajustar os textos da tela de Preferências para deixar claro:
  - “Avisar 5 minutos antes” = aviso em torno de 55 minutos após login.

### Arquivos
- `src/components/auth/SessionExpiryWarning.tsx`
- `src/pages/Configuracoes.tsx`

---

## 2. “Novo Usuário” ainda falha

Há um indício forte no backend: a função `admin-users` rejeita todas as requisições se `ALLOWED_ORIGIN` não estiver configurado. Como o fallback de criação já existe, o problema mais provável agora é CORS/origem, não a lógica de criação em si.

### O que ajustar
- Revisar a função `admin-users` para:
  - aceitar corretamente preview + domínio publicado + domínio customizado;
  - não quebrar toda a função quando `ALLOWED_ORIGIN` estiver ausente ou divergente;
  - validar a origem de forma segura, mas compatível com os ambientes reais do projeto.
- Melhorar o retorno de erro para a UI:
  - exibir motivo real no toast (CORS/origem, usuário existente, falha no perfil, etc.).
- Validar o fluxo completo:
  - convite por e-mail;
  - fallback com senha temporária;
  - link de redefinição.

### Arquivos
- `supabase/functions/admin-users/index.ts`
- `src/components/usuarios/UsuariosTab.tsx`

### Trabalho de backend necessário
- Ajuste de configuração/segredo de origem permitido no backend gerenciado, se necessário.

---

## 3. Ações rápidas: todas na mesma lógica de “Nova Cotação”

Hoje os atalhos apontam para listagens genéricas. O comportamento precisa abrir criação direta.

### O que ajustar
Padronizar em todos os pontos que usam ações rápidas:
- card do dashboard;
- drawer mobile;
- menu “Novo” do header;
- busca global/atalhos.

### Comportamento desejado
- Nova Cotação → `/orcamentos/novo`
- Novo Cliente → abrir criação direta de cliente
- Novo Produto → abrir criação direta de produto
- Novo Pedido → abrir criação direta de pedido, se existir fluxo suportado; se o módulo ainda não tiver criação direta, criar entrada de criação dedicada
- Nova Nota → abrir emissão direta de nota
- Baixa Financeira → apenas abrir `Lançamentos`

### Estratégia
- Criar rotas/queries de abertura direta consistentes, por exemplo:
  - `/clientes?new=1`
  - `/produtos?new=1`
  - `/fiscal?tipo=saida&new=1`
  - equivalente para pedidos
- Nas páginas correspondentes, detectar `?new=1` e chamar `openCreate()` na montagem.
- Unificar a fonte dos atalhos para desktop/mobile/header/search.

### Arquivos
- `src/components/dashboard/QuickActions.tsx`
- `src/components/navigation/MobileQuickActions.tsx`
- `src/components/navigation/AppHeader.tsx`
- `src/components/navigation/GlobalSearch.tsx`
- `src/lib/navigation.ts`
- `src/pages/Clientes.tsx`
- `src/pages/Produtos.tsx`
- `src/pages/Fiscal.tsx`
- `src/pages/Pedidos.tsx` e/ou `src/pages/PedidoForm.tsx`
- `src/App.tsx`

---

## 4. Filtro por datas do dashboard ainda “recarrega” e fecha o picker

O problema atual é estrutural: a data ainda alimenta o contexto/query cedo demais. Isso faz o dashboard rerenderizar enquanto o calendário nativo está aberto, parecendo um reload.

### O que ajustar
- Separar “data digitada/selecionada” de “data aplicada ao dashboard”.
- No `DashboardPeriodContext`:
  - manter `customStartDraft` / `customEndDraft`;
  - manter `customStartApplied` / `customEndApplied`;
  - o `range` deve usar apenas os valores aplicados.
- No header:
  - inputs editam apenas o draft;
  - botão “Aplicar” atualiza o range real;
  - botão “Limpar” ou “Hoje” pode continuar agindo no draft sem disparar queries imediatamente.
- Validar:
  - data inicial <= data final;
  - não aplicar datas inválidas.
- Auditar outros pontos que atualizam URL/filtro em todo `onChange` de `<input type="date">`, principalmente telas com filtros em query string.

### Arquivos
- `src/contexts/DashboardPeriodContext.tsx`
- `src/components/dashboard/DashboardHeader.tsx`
- `src/lib/safeDateInput.ts`
- telas com filtros de data semelhantes, se confirmado no mesmo padrão

---

## 5. Branding do menu lateral e login

Hoje o sistema usa imagem fixa `logoavizee.png` no sidebar e nas telas de autenticação. Isso impede a personalização que você pediu.

### O que ajustar no layout
#### Menu expandido
- remover o texto fixo “AviZee”;
- dar mais espaço para a marca;
- usar:
  - símbolo + texto de marca configurável;
  - subtítulo discreto “ERP” ao lado, se definido.

#### Menu recolhido
- exibir apenas o símbolo;
- posicionar visualmente o símbolo à esquerda da seta, com espaçamento mais limpo e centralização consistente.

### O que ajustar na identidade visual
Adicionar, em Administração → Empresa:
- upload da logo principal;
- upload do símbolo;
- campo de texto da marca;
- campo opcional de texto curto/subtítulo (default: “ERP”).

Garantir que isso alimente:
- menu lateral;
- login;
- signup;
- recuperação de senha;
- redefinição de senha;
- telas de loading/autenticação relacionadas.

### Impacto técnico
O schema atual de `empresa_config` tem `logo_url`, mas não tem campo para símbolo separado nem texto de marca dedicado.

### Trabalho necessário
- adicionar colunas de branding, por exemplo:
  - `simbolo_url`
  - `marca_texto`
  - `marca_subtitulo`
- carregar isso no app inteiro via configuração central.

### Arquivos
- `src/pages/Administracao.tsx`
- `src/components/AppSidebar.tsx`
- `src/contexts/AppConfigContext.tsx`
- `src/pages/Login.tsx`
- `src/pages/Signup.tsx`
- `src/pages/ForgotPassword.tsx`
- `src/pages/ResetPassword.tsx`
- `src/components/auth/AuthLoadingScreen.tsx`

### Mudança de banco
- migration para expandir `empresa_config` com campos de branding.

---

## 6. Grids padrão dos cadastros

Aplicar como padrão visual, mantendo as demais colunas disponíveis no seletor de colunas.

### Produtos
Manter como está, mas:
- ocultar por padrão:
  - `Classificação`
  - `Status`
- manter visíveis:
  - `Custo`
  - `Margem`

### Clientes
Manter como está, mas:
- ocultar por padrão:
  - `Status`

### Fornecedores
Manter como está, mas:
- ocultar por padrão:
  - `Prazo`
  - `Cidade`
  - `Status`

### Transportadoras
Manter como está, mas:
- ocultar por padrão:
  - `Status`

### Estratégia
- marcar essas colunas com `hidden: true` nas definições.
- garantir que “Restaurar padrão” da `DataTable` respeite esse novo padrão.
- preservar personalizações já salvas dos usuários sempre que possível; aplicar o novo padrão como base para novos estados e restauração padrão.

### Arquivos
- `src/pages/Produtos.tsx`
- `src/pages/Clientes.tsx`
- `src/pages/Fornecedores.tsx`
- `src/pages/Transportadoras.tsx`
- `src/components/DataTable.tsx`

---

## 7. Ordem recomendada de implementação

1. Corrigir `admin-users` e validar criação de usuário
2. Reestruturar filtro de datas do dashboard
3. Ajustar comportamento padrão da sessão para aviso aos 55 minutos
4. Unificar ações rápidas com criação direta
5. Implementar branding configurável (logo + símbolo + texto)
6. Refinar visual do sidebar expandido/recolhido
7. Aplicar novos padrões das grids

---

## Detalhes técnicos

### Mudanças de código
- `SessionExpiryWarning` passa a operar com padrão compatível com aviso aos 55 minutos.
- Dashboard deixa de refazer query ao selecionar cada data no picker.
- Ações rápidas passam a disparar criação real, não apenas abrir listagens.
- Sidebar e autenticação deixam de depender de asset fixo e passam a consumir branding configurável.
- Grids passam a ter padrão inicial mais limpo, sem perder flexibilidade.

### Mudanças de backend
- Ajuste na função `admin-users` para origem/CORS e diagnóstico real.
- Migration em `empresa_config` para branding completo.

### Sem mudar stack
- Tudo segue no padrão atual do projeto, sem refatoração ampla nem troca de arquitetura.
