

## Plano de execução — Lote de correções AviZee ERP

Aplicar 25 correções pontuais distribuídas em 3 blocos temáticos. Sem refatorações fora do escopo listado.

---

### Bloco A — Auth (Signup) e Sidebar

**`src/pages/Signup.tsx`**
- Container: `max-w-md` → `max-w-sm`.
- Card: `rounded-2xl p-8 space-y-5 shadow-[0_4px_24px_rgba(0,0,0,0.07)] border-t-2 border-t-primary/80`.
- Logo: `h-16 mb-5`.
- Botão toggle de senha: `tabIndex={0}`.
- Indicador de força de senha com rótulo (Fraca/Razoável/Boa/Forte), cores `bg-destructive`/`bg-warning`/`bg-success`.
- Inputs (nome, email, password): `aria-invalid` + `aria-describedby`; `<p>` de erro com `id` + `role="alert"` no padrão do `Login.tsx`.

**`src/components/AppSidebar.tsx`**
- Remover `role="navigation"` do `<aside>` (mantém o `<nav>` interno).

---

### Bloco B — Cadastros (Clientes / Fornecedores / Transportadoras / Grupos)

**Novo: `src/constants/brasil.ts`**
```ts
export const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;
```

**`src/pages/Clientes.tsx`**
- Substituir campo UF (Input) por `Select` com `UF_OPTIONS`.
- Migrar `StatCard` → `SummaryCard` (4 cards: Total, Ativos `variant="success"`, Inativos, Com Grupo).
- Verificar via `supabase--read_query` se `clientes.forma_pagamento_padrao` é `text` livre (não FK). Se sim:
  - `<SelectItem value={fp.id}>` no select de forma de pagamento.
  - Meta do `FormModal`: resolver descrição via `formasPagamento.find(fp => fp.id === ...)?.descricao ?? form.forma_pagamento_padrao`.
  - Caso a coluna esteja como FK ou contenha descrições já gravadas, **abortar item 9** e reportar (sem migração de dados nesta sprint).

**`src/pages/Fornecedores.tsx`**
- Campo UF → Select com `UF_OPTIONS`.
- `StatCard` → `SummaryCard` (remover `iconColor`, usar `variant`).

**`src/pages/Transportadoras.tsx`**
- Campo UF → Select (`setForm({ ...form, uf: v })`).
- `StatCard` → `SummaryCard`.

**`src/pages/GruposEconomicos.tsx`**
- `StatCard` → `SummaryCard`.

**`src/pages/clientes/components/ClienteEnderecosTab.tsx`**
- `useConfirmDialog` para `handleRemove` (soft delete `ativo=false`); render do `{confirmRemoveDialog}`.
- CEP via `MaskedInput mask="cep"` + botão lupa que dispara `buscarCep` e preenche logradouro/bairro/cidade/uf.
- Telefone via `MaskedInput mask="telefone"`.
- Campo UF → Select (`setForm({ ...form, uf: v })`).

**`src/pages/clientes/components/ClienteTransportadorasTab.tsx`**
- `useConfirmDialog` para `handleRemove` (soft delete `ativo=false`); render do `{confirmRemoveDialog}`.

**`src/pages/cadastros/clientes/components/columns.tsx`**
- Confirmar via `code--search_files` que `buildClienteColumns` não é importado em lugar nenhum. Se confirmado órfão, deletar o arquivo.

---

### Bloco C — DataTable, Header e Navegação

**`src/components/DataTable.tsx`**
- Mover o `Select` "Paginação / Scroll Infinito" do toolbar principal para dentro do `PopoverContent` de Colunas (após "Restaurar padrão") como seção "Modo de exibição" com radios.
- Quando `showColumnToggle === false`, criar Popover independente com ícone `Settings2` contendo apenas essa seção, para preservar o controle.

**`src/components/navigation/AppHeader.tsx`**
- Remover o botão standalone de tema do bloco desktop (mantém o item dentro do `DropdownMenuContent`).
- Extrair `AccountMenuItems` (componente local acima do `AppHeader`) com Perfil/Configurações/Tema/Sair e usá-lo nos dois `DropdownMenuContent` (mobile e desktop) para eliminar duplicação. Header do menu (nome + role dot) permanece em cada contexto.

**`src/lib/navigation.ts`**
- Trocar ícone de Fornecedores para `Store` (lucide-react). Fallback `Building2` se indisponível.
- Tornar `MobileBottomTab.path` obrigatório (`path: string`).

**`src/components/navigation/MobileBottomNav.tsx`**
- Simplificar `onClick={() => navigate(tab.path)}` (remove o guard `tab.path &&`).

---

### Verificações antes de codar (default mode)

1. `supabase--read_query` em `information_schema.columns` para confirmar tipo de `clientes.forma_pagamento_padrao` (gate do item Clientes #9).
2. `code--search_files "buildClienteColumns"` para confirmar que `src/pages/cadastros/clientes/components/columns.tsx` é morto.
3. Confirmar disponibilidade do ícone `Store` em `lucide-react` (já presente no projeto via outros usos).

---

### Tarefas (criadas no início da execução)

1. Bloco A — Signup + AppSidebar
2. Bloco B1 — `constants/brasil.ts` + UF Select nos 4 formulários
3. Bloco B2 — StatCard → SummaryCard nos 4 módulos
4. Bloco B3 — ConfirmDialog + MaskedInput em sub-tabs de Cliente
5. Bloco B4 — Verificar tipo de `forma_pagamento_padrao` e aplicar mudança (ID vs descrição) ou reportar
6. Bloco B5 — Remover `columns.tsx` órfão
7. Bloco C1 — Mover seletor Paginação/Scroll para Popover
8. Bloco C2 — AppHeader (remover toggle duplicado + extrair `AccountMenuItems`)
9. Bloco C3 — `navigation.ts` (ícone Store + path obrigatório) + simplificar `MobileBottomNav`

---

### Fora de escopo (explícito)

- Migração de dados em `clientes.forma_pagamento_padrao` (se houver descrições gravadas).
- Refatorações estruturais nos componentes tocados.
- Qualquer alteração em arquivos não listados acima.

