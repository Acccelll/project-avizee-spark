

# Diagnóstico visual — Fluxos de Criação

## Inventário visual

| Fluxo | Container | Topo do form | "Criar e continuar"? | Feedback pós-create |
|---|---|---|---|---|
| Cliente, Fornecedor, Funcionário, Transportadora, Produto, Conta, Forma Pgto, Unidade, Grupo Econ. | `FormModal` | Título "Novo X" / "Editar X" sem hint extra | ❌ | toast simples, modal fecha |
| Remessa modal | `FormModal` | idem | ❌ | toast |
| Cotação Compra, Pedido Compra (modal) | `FormModal` | título + número (em edit) | ❌ | toast |
| NF | `FormModal` | título sem orientação | ❌ | toast |
| Orçamento | `PageShell` (página) | título + nº gerado, sem chip "Rascunho" | ❌ | toast + navigate |
| Pedido Compra/Cotação/Remessa Page | `PageShell` | similar a orçamento | ❌ | toast + navigate |

## Problemas reais

### 1. Topo do formulário não comunica que é criação
Hoje todos usam apenas "Novo Cliente" / "Editar Cliente" como título. Sem chip visual diferenciando o modo, sem orientação inicial ("preencha os dados básicos para criar..."), sem indicação do que é obrigatório vs opcional. Em telas de página (`PageShell`), o título "Novo Orçamento" aparece sozinho ao lado do número RPC — visualmente igual a edit.

### 2. Sem distinção visual entre criar e editar
- Mesmo botão "Salvar" em ambos (FormModalFooter já tenta com "Salvar" vs "Salvar Alterações" — mas a maioria das telas passa `primaryLabel` custom e quebra o padrão).
- Mesma cor de header.
- Em edit, `identifier` (CPF/CNPJ) aparece ao lado do título; em create, fica "vazio" — falta um chip "Novo registro" para preencher o espaço e criar simetria.

### 3. Sem orientação inicial em create
Modais de cliente/fornecedor/funcionário abrem com 6+ tabs visíveis, todas vazias. Nada diz "comece pelos dados básicos". Usuário olha 80 campos sem hierarquia mental. Falta:
- mensagem curta no topo do modo create ("Preencha os campos essenciais; complementares ficam disponíveis após salvar.")
- destaque visual nos campos obrigatórios da primeira dobra

### 4. Primeira dobra não prioriza essencial
- Em `Clientes`, o modal abre direto na tab "Dados" — ok, mas mistura "tipo pessoa", "razão social", "fantasia", "CPF/CNPJ", "IE", "RG", "data nasc.", "regime tributário" em uma grid igual. Sem "campos obrigatórios primeiro".
- Em `Fiscal`, primeiros campos visíveis são `numero`, `serie`, `modelo` — ok — mas `tipo` (entrada/saída) que **decide tudo** vem no meio.
- Em `OrcamentoForm`, primeiro campo visível costuma ser o número (auto-gerado) seguido de status — info de baixa prioridade na criação.

### 5. Falta "criar e continuar" / "criar outro"
Cadastros leves (cliente, fornecedor, produto, transportadora, conta, forma pgto, unidade) frequentemente são criados em sequência (ex.: cadastrar 5 fornecedores). Hoje cada save fecha o modal e força click no botão "Novo" de novo. Padrão Linear/Notion: secondary action "Salvar e criar outro".

### 6. Feedback pós-create muito apagado
- Toast genérico "Registro criado com sucesso" some em 4s.
- Em página (`OrcamentoForm`), navega para edit sem destaque do "que mudou" (número novo, status rascunho).
- Sem estado "acabou de criar" (banner sutil "Orçamento PV-0123 criado. Adicione itens abaixo.").

### 7. Encerramento do fluxo sem CTA contextual
Após create:
- No modal, o usuário fica olhando lista atualizada — sem "ver registro" no toast, sem highlight do row novo.
- Em página, navega para edit mas sem "próximo passo" claro (ex.: "Adicione itens" → CTA visível).

### 8. Cancelar visualmente igual a Salvar em alguns pontos
- `FormModalFooter` ✓ separa bem (outline vs primary).
- Mas em `OrcamentoForm` e outros pages, botões "Cancelar"/"Salvar" no header às vezes ficam pequenos/iguais.
- Em `BaixaParcialDialog` e modais legacy, botões na mesma linha sem hierarquia.

### 9. Sem indicador de progresso em forms longos
`Clientes`, `Funcionarios`, `Produtos` têm 5-7 tabs com 8-15 campos cada. Já existe `FormProgress` (component) — mas só `Produtos` usa. Cliente/Fornecedor/Funcionário se beneficiariam: usuário vê "3 de 5 seções preenchidas".

### 10. Footer sticky inconsistente
`FormModal` ✓ tem footer sticky via `footer` prop. Mas várias telas ainda inserem botões dentro do `<form>` no fim, sem sticky → em modal scroll, usuário precisa rolar até o fim para salvar. Telas afetadas: `ContasBancarias`, `FormasPagamento`, `UnidadesMedida`, `GruposEconomicos`, `Remessas` modal.

### 11. Campos obrigatórios sem marcação visual consistente
- Alguns labels têm `*` (Funcionários: "Nome *", "CPF *").
- Outros não (Clientes, Fornecedores, Produtos).
- Sem padrão. `Label` component não suporta `required` prop.

### 12. Steppers ausentes em fluxos multi-etapa
Orçamento e Pedido Compra são naturalmente sequenciais (cliente → itens → condições → frete), mas renderizados como uma página plana com cards empilhados. Sem stepper, sem "salvar rascunho a cada etapa". Não é problema crítico (ERPs costumam usar form único), mas falta um indicador visual de "onde estou no fluxo".

## Padrão-base proposto

### A. Chip "Novo registro" no topo (FormModal + PageShell)
- `FormModal`: quando `mode === "create"` (nova prop `mode?: "create" | "edit"`), renderiza chip verde sutil "Novo" ao lado do título. Em edit, mantém comportamento atual com `identifier`.
- `PageShell`: nova prop `badge?: ReactNode` para chip ao lado do título (opcional).

### B. `Label` com `required` prop
- Adicionar prop opcional `required?: boolean` ao `Label` que renderiza asterisco vermelho com tooltip "Obrigatório".
- Não migrar todos os labels nesta passada — fornecer e adotar nos 4 forms críticos (Cliente, Fornecedor, Funcionário, Produto).

### C. Hint inicial em create (FormModal)
- Nova prop `createHint?: ReactNode` no `FormModal`. Quando passada e `mode === "create"`, renderiza banner sutil acima do conteúdo:
  ```
  💡 Preencha os campos essenciais; informações complementares ficam disponíveis após salvar.
  ```

### D. "Salvar e criar outro" em FormModalFooter
- Nova prop `onSaveAndNew?: () => void` no `FormModalFooter`. Quando passada e `mode === "create"`, adiciona botão secundário "Salvar e criar outro" entre cancelar e salvar.
- Implementação: ao clicar, chama submit e mantém modal aberto com form resetado.
- Adotar em 4 cadastros leves de alta cardinalidade: Produto, Cliente, Fornecedor, Forma Pgto.

### E. Toast pós-create com identificador
- Helper novo `toastCrud.createdWithId(entity, id)` — toast com título "X criado" + sublabel "ID: PV-0123" + duração 5s.
- Adotar em hooks que têm número/código (Orçamento, Pedido, Cotação, NF).

### F. Banner "acabou de criar" em pages
- Em `OrcamentoForm` (e similares), quando navegar `?created=1` na URL, mostra banner verde sutil por ~10s "Orçamento PV-0123 criado. Adicione itens abaixo." com CTA scroll-to-itens.
- Implementação: query param `?created=1` na navegação pós-save; banner desmonta no primeiro click ou após timeout.

### G. Footer sticky padronizado
- Padronizar uso de `footer={<FormModalFooter ... />}` em todos os modais. Migrar 5 telas que ainda têm botões inline no fim.

### H. Hierarquia create vs edit no header (FormModal)
- Em create: chip "Novo" (verde sutil) + título.
- Em edit: identifier (CPF/SKU/número) + status badge + meta (atualmente já existe).
- Diferenciação visual instantânea.

## Implementação (escopo)

### Componentes core
1. `src/components/ui/label.tsx` — adicionar `required?: boolean` com asterisco.
2. `src/components/FormModal.tsx` — adicionar `mode?: "create" | "edit"`, renderizar chip "Novo" quando create, suportar `createHint`.
3. `src/components/FormModalFooter.tsx` — adicionar `onSaveAndNew` opcional + botão.
4. `src/components/PageShell.tsx` — adicionar `badge?: ReactNode` ao lado do título.
5. `src/lib/toastMessages.ts` — adicionar `toastCrud.createdWithId(entity, id)`.

### Adopters (sample, não exaustivo)
6. `src/pages/Clientes.tsx` — `mode="create"` no FormModal, `createHint`, marcar required em "Nome", "CPF/CNPJ", "Tipo pessoa".
7. `src/pages/Fornecedores.tsx` — mesmo padrão + `onSaveAndNew`.
8. `src/pages/Funcionarios.tsx` — `mode`, `createHint`, required já marcados (validar consistência).
9. `src/pages/Produtos.tsx` — `mode`, `createHint`, `onSaveAndNew`.
10. `src/pages/Fiscal.tsx` — `mode`, `createHint` específico ("Importe XML para preenchimento automático").
11. `src/pages/CotacoesCompra.tsx` — `mode`, `createHint`.
12. `src/pages/Remessas.tsx` — `mode`.
13. `src/pages/ContasBancarias.tsx`, `FormasPagamento.tsx`, `UnidadesMedida.tsx`, `GruposEconomicos.tsx`, `Transportadoras.tsx` — `mode` + footer sticky se faltar.
14. `src/pages/OrcamentoForm.tsx` — `badge` "Novo" ou nº gerado; banner pós-create via `?created=1`.

### Banner pós-create
15. `src/components/JustCreatedBanner.tsx` — **novo**: banner dismissable que lê `?created=1` da URL.
16. Adotar em `OrcamentoForm`, `PedidoCompraForm`, `CotacaoCompraForm`, `RemessaForm`.

## Fora do escopo
- Stepper visual em orçamento/pedido (mudança de paradigma; fica para passada futura).
- Migrar todos os labels do projeto para `required`.
- Highlight do row novo na lista pós-create (mudança em DataTable).
- Refatorar modais grandes (Clientes 1633 linhas) em sub-componentes — refactor amplo.
- Trocar `FormProgress` (já existe e é opt-in) — adoção em todos os forms grandes fica para outra passada.

## Critério de aceite
- `FormModal` com chip "Novo" visível em create, distinto de edit.
- `Label` aceita `required` e renderiza asterisco vermelho.
- `FormModalFooter` aceita `onSaveAndNew` e renderiza botão secundário em create.
- Pelo menos 4 cadastros leves usam "Salvar e criar outro".
- 4 cadastros pesados (Cliente, Fornecedor, Funcionário, Produto) marcam campos obrigatórios visualmente.
- Banner pós-create aparece nos 4 documentos pesados (Orçamento, Pedido, Cotação, Remessa) via `?created=1`.
- `toastCrud.createdWithId` disponível e usado em hooks que geram número.
- Footer sticky em todos os modais (5 telas migradas).
- Build OK; zero regressão funcional.

## Entregáveis
Resumo final por categoria: chip create, hint inicial, required nos labels, salvar-e-criar-outro, banner pós-create, toast com identificador, footer sticky.

