---
name: Portal Fiscal
description: Rota /fiscal/portal com consulta unificada de NF-e estilo TOTVS via view v_nfe_portal + RPC buscar_nfe_portal
type: feature
---

# Portal Fiscal (`/fiscal/portal`)

Tela única de consulta de NF-e recebidas (DistDF-e + importadas) inspirada no
TOTVS Processos Fiscais. Filtros server-side via RPC `buscar_nfe_portal(p_filtros jsonb, p_limit, p_offset)`
que lê a view `v_nfe_portal` (security_invoker) sobre `nfe_distribuicao` com
left join em `notas_fiscais` para enriquecer status interno.

Filtros suportados: data_inicio/fim, chave (44d), cnpj_emitente (ILIKE),
emitente (ILIKE nome), uf, serie, numero_ini/fim, status_manifestacao,
tipo_documento.

Ações por linha: Ver XML (dialog), Baixar XML (blob da coluna `xml_nfe`),
DANFE PDF (placeholder — fase 2). Header: Sincronizar SEFAZ (DistDFe NSU),
Exportar CSV (página atual).

RLS herdada de `nfe_distribuicao`. View NÃO usa SECURITY DEFINER.

Sem nova tabela. NSU stuck em homologação retorna grid vazio com aviso para
migrar para produção em Configurações Fiscais.
