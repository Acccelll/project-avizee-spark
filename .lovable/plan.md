# Auditoria pós-merge bc1449f3 — Copiar como novo (somente leitura)

Nenhum arquivo, banco ou migração alterado. Sem publicação, Vercel ou testes GitHub. HEAD = bc1449f3 (#137), sobre #136 e #135.

## 1. Sessão e interfaces percorridas
- Sem sessão autenticada (`external_unmanaged`: o Lovable não consegue entrar no seu Supabase próprio).
- `/produtos?copyId=x` em 1280x800 e 390x844 redirecionou para `/login` nos dois tamanhos, sem erros JS.
- Não percorri grid, painel de detalhes, formulário nem cópia. Tudo abaixo vem da leitura do código.

## 2. Confirmado no código
| # | Arquivo:linha | Achado | Relevância |
|---|---|---|---|
| C1 | ProdutoForm.tsx:338 | **TS2322** `source.tipo_item` (string) atribuído a `TipoItem` — erro ativo no log de build. A edição (linha 258) tem o mesmo padrão sem erro porque converte para `Produto`. | Alta: quebra o typecheck/CI; em tempo de execução funciona. |
| C2 | ProdutoFormModal.tsx:55 | Depois de "Salvar e novo" iniciado de uma cópia, o título continua "Copiar como novo", mas o formulário já está vazio (ProdutoForm.tsx:544-561). Título só para leitor de tela (sr-only). | Baixa. |
| C3 | ProdutoForm.tsx:320-321 + 159 | A cópia chama `resetForm(empty)` e depois `setForm(dados)`, e o baseline de vínculos fica em "[]". Resultado: a cópia já abre marcada como "alterada" e fechar sem mexer pede confirmação. Coerente (nada foi salvo), mas é proposital ou não? | Baixa/UX. |
| C4 | ProdutoForm.tsx:322-345 | O mapeamento está correto: não copia `id`, `sku`, `codigo_interno` nem estoque atual; força `ativo: true`; nome "Cópia de …". Composição e fornecedores vêm sem `id` (inserção nova pelas RPCs). | OK. |
| C5 | ProdutoForm.tsx:313-314, 350-354, 430, 711/738/1557/1587 | Se a origem não existe ou os vínculos falham, aparece `loadError` e todos os botões de salvar ficam bloqueados (submit também, linha 430). A retentativa usa `loadAttempt`. | OK. |
| C6 | Produtos.tsx:237-245 | `copyId` é lido da URL, abre o modal e sai da URL (`replace`). Ação no grid: `onDuplicate={openCopy}` (Produtos.tsx:554). Painel: botão no desktop (ProdutoView.tsx:286) e item no menu "Mais ações" no mobile (244). | OK. |
| C7 | ProdutoForm.tsx:499-508, 532 | Uma nova tentativa depois de salvamento parcial reaproveita `pendingCreatedIdRef`, sem gerar outra cópia. O fluxo de cópia herda essa proteção. | OK. |

## 3. Riscos hipotéticos (não comprovados)
- H1: o painel chama `navigate` e depois `setTimeout(clearStack)`. Se `clearStack` também mexer na URL, `copyId` pode se perder antes de ser lido (Produtos.tsx:237). Precisa de teste com login.
- H2: `fornecedores.eh_principal` é copiado como está. Se a origem tiver mais de um principal (dado legado), a validação pode recusar. Não verifiquei a regra no banco.
- H3: SKU vazio na cópia depende da geração automática por grupo (mem sku-por-grupo). Se o grupo exigir sigla e ela não existir, o usuário fica bloqueado sem uma explicação clara.
- H4: preço de custo da composição usa `c.produtos?.preco_custo`, uma leitura pontual. Se a origem for antiga, pode ficar defasado até o lookup recarregar.
- H5: o atalho do grid no mobile (MobileCardList) depende do DataTable mostrar `onDuplicate` nos cartões. Não confirmei visualmente.

## 4. Compilação
- Último log de build: 1 erro (C1). Não rodei testes nem lint.

## 5. Não validado (falta de login)
Grid real, painel desktop/mobile, abertura e preenchimento da cópia, falha induzida, "Salvar e novo", confirmação ao sair e atualização do grid.

## Próximo passo sugerido (só se aprovado)
Corrigir apenas C1 (converter `tipo_item` para `TipoItem` na linha 338). C2 e C3 ficam opcionais.
