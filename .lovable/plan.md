# Causa e correção

**Causa:** o template em uso (`OrcamentoPdfTemplate.tsx`) declara `fontFamily: 'Roboto Mono', monospace` em 6 lugares, mas Roboto Mono **não está carregada** no `index.html` (só Montserrat e JetBrains Mono). O navegador cai no monoespaçado do sistema (Menlo/Consolas), que renderiza zero pontilhado/cortado. O fix anterior atingiu apenas o template "Brand". Além disso, sua diretriz é Montserrat em todo o projeto, inclusive PDF.

**Correção (3 arquivos, frontend apenas):**

1. `src/components/Orcamento/OrcamentoPdfTemplate.tsx` — remover as 6 ocorrências de `fontFamily: "'Roboto Mono', monospace"` (número do orçamento, código do item, qtd, unit, total da linha, totais e Valor Total). Em cada local trocar por `fontVariantNumeric: "tabular-nums"` (herda Montserrat do container raiz), mantendo alinhamento numérico das colunas.

2. `src/components/Orcamento/OrcamentoPdfTemplateBrand.tsx` — no helper `mono` (linhas 64-69), trocar `'JetBrains Mono', ui-monospace, monospace` por herdar Montserrat com `fontVariantNumeric: "tabular-nums"` e `fontFeatureSettings: '"tnum"'`. Atualizar o comentário do topo do arquivo.

3. `index.html` — remover `JetBrains+Mono:wght@400;500;600;700` das 3 tags `<link>` do Google Fonts, deixando apenas Montserrat (reduz peso e elimina a família que causava o zero pontilhado também no template Brand).

**Verificação:** abrir `/orcamentos/<id>` → "N° 100283" sem pontos nos zeros, em ambos os templates (padrão e marca); colunas Qtd/Unit/Total continuam alinhadas via `tabular-nums`.

**Fora de escopo:** `tailwind.config.ts` (`mono: ['Roboto Mono']`) e `src/index.css` (uso em outras telas) ficam como estão — esta tarefa atinge só o PDF do orçamento.
