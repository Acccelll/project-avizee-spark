---
name: SKU por sigla de grupo
description: Regra SIGLA+NNN com RPC atômica proximo_sku_grupo + tabela grupos_produto_sku_seq
type: feature
---
- `grupos_produto.sigla` (2–4 chars uppercase, único quando preenchido).
- `grupos_produto_sku_seq(grupo_id PK, ultimo_numero)` — RLS sem políticas, acesso só via RPCs SECURITY DEFINER (search_path=public).
- `proximo_sku_grupo(_grupo_id)` retorna `SIGLA + lpad(NNN,3,'0')` (ex.: AG001).
- `inicializar_seq_sku_grupo(_grupo_id)` reposiciona contador a partir dos SKUs existentes (regex `^SIGLA[0-9]+$`).
- UI em `Produtos.tsx`: botão Wand2 ao lado do SKU + dialog "Editar sigla do grupo" (lápis ao lado do Select Grupo). Sigla aparece no SelectItem do grupo.
- Mesma RPC reusada em `QuickAddProductModal`.
- Não retroage SKUs antigos.