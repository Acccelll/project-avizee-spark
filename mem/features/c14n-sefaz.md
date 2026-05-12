---
name: C14N SEFAZ
description: Implementação de XML Canonicalization (Exclusive C14N) para assinatura NFe em sefaz-proxy
type: feature
---

- Módulo canônico: `supabase/functions/_shared/xml-c14n.ts` (`canonicalizeExclusive`).
- Usa `npm:@xmldom/xmldom` para parse DOM, faz ordenação de atributos por (namespaceURI, localName), escapes XML corretos, e regra de exclusive C14N (apenas namespaces visivelmente utilizados).
- Testes em `supabase/functions/_shared/xml-c14n.test.ts` (rodar com `--node-modules-dir=auto`).
- Plugado em `sefaz-proxy/index.ts` atrás de feature flag `SEFAZ_C14N_REAL=true`. Default = implementação legada naïve (compat com produção atual).
- **Pendente**: validar em homologação SEFAZ; comparar digest/signature do XML resultante; promover real → default e remover fallback.
- Limitações conhecidas: não suporta comentários, PIs, CDATA, InclusiveNamespaces. Cobre o subset necessário para NFe.
