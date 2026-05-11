## Escopo

Melhorias visuais e de organização do menu lateral (`AppSidebar` + componentes em `src/components/sidebar/` + `src/lib/navigation.ts`). Sem mudar lógica de permissão, badges (origem dos números) ou rotas.

Atendo as 5 prioridades **altas** do feedback + 2 médias de baixo risco. As baixas e estruturais maiores (subgrupos terceiro nível, redesenho de Cadastros) ficam fora — listadas em "Não inclui" para futuro.

---

## Mudanças

### 1. Renomear "Suprimentos e Logística" → "Estoque e Logística"
`src/lib/navigation.ts`, `navSections[key='estoque'].title`. Resolve a quebra de linha no print e fica mais coerente com os subitens (Posição Atual / Logística). Sem impacto em rotas, keys ou permissões.

### 2. Corrigir overflow horizontal do sidebar
`src/components/sidebar/SidebarSectionItem.tsx` e `SidebarSection.tsx`:
- Garantir `min-w-0` no flex container do botão e `truncate` (já existe em alguns lugares — auditar).
- No `<aside>` do `AppSidebar`, manter `overflow-hidden` lateral (já tem) e no `<nav>` trocar `overflow-y-auto` por `overflow-y-auto overflow-x-hidden` explícito.
- Adicionar `title={item.title}` no botão do item (tooltip nativo) para nomes longos truncados (ex.: "Auditoria de Duplicidades", "Backlog faturamento").

### 3. Eliminar duplicação de badge "Financeiro 86 / Lançamentos 86"
`src/hooks/useSidebarBadges.ts`:
- Manter o badge consolidado no **grupo** Financeiro (somatório vencidos+a vencer).
- Remover a entrada `'/financeiro'` de `itemBadges` para que o subitem "Lançamentos" não exiba o mesmo número. O usuário entende pela hierarquia que o total do módulo vem de lançamentos.
- Mesmo tratamento para Fiscal (`/fiscal` e `/faturamento`): manter no grupo, remover do leaf duplicado quando o número é idêntico ao do grupo. Decisão: preservar `/faturamento` (NF-e entrada) porque mede dimensão diferente de `/fiscal` (rejeitadas saída) — apenas remover `/financeiro` e `/estoque` (são iguais ao grupo).
- `/orcamentos` e `/administracao` permanecem (são informações específicas, não duplicam o módulo de forma ambígua porque o módulo Comercial tem outros itens; admin idem).

### 4. Reforçar diferenciação visual ativo / hover / favorito
`src/components/sidebar/SidebarSectionItem.tsx`:
- Item ativo: já tem fundo `bg-primary/10` + texto primary; **adicionar barra lateral esquerda de 2px** (já existe na Section pai, replicar no leaf — hoje só está em `SidebarFavorites`).
- Hover inativo: manter `hover:bg-accent` (sutil).
- Estrela: comportamento atual está correto (vazia em hover, preenchida quando favoritado) — apenas garantir contraste do ícone vazio (`text-muted-foreground` → ok).
- Documentar no `mem://` o contrato visual.

### 5. Reordenar Fiscal por uso operacional
`src/lib/navigation.ts`, ordem dos itens em `fiscal.items[0].items`:
```
Emitir NF-e
Notas de Saída
Notas de Entrada
Consulta documentos
Faturamento
Backlog faturamento
Dashboard Fiscal
Histórico DistDF-e
Cadastros fiscais
```
Sem criar terceiro nível (subgrupo Operação/Gestão/Configuração) — adiar até validar com usuários.

### 6. (Médio) Placeholder de busca melhor
`AppSidebar.tsx` linha 125: "Buscar..." → "Buscar módulos, telas..." (mais descritivo).

### 7. (Médio) Estado dos grupos já persiste por usuário
Verificado em `useNavigationState` — usa `useUserPreference` com chave `sidebar_sections_state_v2`. **Já atendido**, apenas mencionar na nota.

---

## Não inclui (defer)

- Reorganizar Cadastros em subgrupos (Pessoas/Comercial/Interno) — está compreensível.
- Separar Configurações de Administração como módulo próprio — exigiria decisão de produto e mexer em permissões.
- Subgrupos de 3º nível em Fiscal — só reordenar agora.
- Modo compacto, tooltip popover em módulos colapsados (já tem flyout), badges clicáveis com filtro, "colapsar todos os grupos rapidamente".
- Seção Favoritos: **já existe** (`SidebarFavorites` no topo, `useFavoritos` persistido em `user_preferences`), apenas validar que a estrela atual de fato popula a seção — nenhuma mudança de código necessária.

---

## Validação

- Build TS passa.
- Visual: abrir `/`, expandir Financeiro → confirmar badge só no grupo; abrir Fiscal → confirmar nova ordem; ver "Estoque e Logística" em uma linha; sidebar sem barra horizontal.
- Sem alteração em testes existentes (smoke tests não dependem de rótulos de menu).
