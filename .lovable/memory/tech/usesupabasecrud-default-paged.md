---
name: useSupabaseCrud — paginationMode explícito obrigatório
description: Default implícito 'all' dispara warning em dev; callers devem declarar 'paged' (com pageSize) ou 'all' explicitamente
type: preference
---

`useSupabaseCrud` emite warning em dev (`console.warn`) quando `pageSize`
e `paginationMode` são ambos omitidos — o fallback é `'all'` mas a intenção
não fica explícita.

**Como aplicar:**
- Cadastros pequenos (`formas_pagamento`, `bancos`, `centros_custo`,
  `unidades_medida`, `contas_contabeis`) e lookups (`clientes`,
  `fornecedores`, `produtos` em modais de NF/lançamento) → declarar
  `paginationMode: "all"`.
- Listagens transacionais (`financeiro_lancamentos`, `notas_fiscais`,
  `compras`, `estoque_movimentos`, `orcamentos`, `pedidos`, `remessas`) →
  passar `pageSize` (default da paginação canônica é 50) e usar `'paged'`.

**Proibido:** `paginationMode: "all"` em tabelas transacionais sem
justificativa documentada — risco real de carregar milhares de linhas no
cliente. A regra é validada por code review e pelo warning em dev.

**Por quê:** evita regressão silenciosa para `LIMIT 1000` do PostgREST
(quem precisa do conjunto inteiro precisa do modo `'all'` que faz chunking)
e força a decisão a ficar visível no caller.