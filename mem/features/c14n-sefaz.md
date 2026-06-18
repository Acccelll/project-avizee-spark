---
name: C14N SEFAZ
description: Implementação de XML Canonicalization (Exclusive C14N) para assinatura NFe em sefaz-proxy
type: feature
---

- Módulo canônico: `supabase/functions/_shared/xml-c14n.ts` (`canonicalizeExclusive`).
- Usa `npm:@xmldom/xmldom` para parse DOM, faz ordenação de atributos por (namespaceURI, localName), escapes XML corretos, e regra de exclusive C14N (apenas namespaces visivelmente utilizados).
- Testes em `supabase/functions/_shared/xml-c14n.test.ts` (rodar com `--node-modules-dir=auto`).
- Plugado em `sefaz-proxy/index.ts` — **default agora é C14N real** (Fase 1.2, 18/jun/2026). Opt-in inverso temporário via `SEFAZ_C14N_LEGACY=true` para forçar a implementação naïve antiga.
- **Pendente**: 1ª emissão real em homologação confirmando que SEFAZ aceita o digest do C14N real; após validação, remover o fallback legado (PR à parte).
- Limitações conhecidas: não suporta comentários, PIs, CDATA, InclusiveNamespaces. Cobre o subset necessário para NFe.
