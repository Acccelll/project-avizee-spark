# ADR-002 — Implementação própria de C14N 1.0

**Status**: aceito · **Data**: 2026-07-13

## Contexto
A canonicalização XML C14N 1.0 é obrigatória para XMLDSig SEFAZ. Bibliotecas
em JS/TS (`xml-crypto`, `xmldsigjs`, `xml-c14n`) têm gaps no perfil SEFAZ
(namespaces herdados, xml:space, ordenação lexicográfica de atributos com
prefixo). `node-forge`, usado hoje na edge, tem os mesmos gaps. O
FiscalFramework .NET rejeitou `XmlDsigC14NTransform` pelas mesmas razões e
implementou C14N própria (`Xml/C14NCanonicalizer.cs`, ~85 linhas).

## Decisão
Implementar C14N 1.0 própria em TS (~200 linhas estimadas), sem dependência
externa, cobrindo o subset exigido pela SEFAZ:
- Normalização de espaços em atributos.
- Ordenação lexicográfica por (namespace URI, local name).
- Resolução de namespaces herdados do escopo.
- `xml:space="preserve"` respeitado.
- Elementos vazios como `<x></x>` (não `<x/>`).

## Alternativas rejeitadas
- `xml-crypto` — bugs com namespaces herdados.
- `node-forge` — comprovadamente incompleto.
- `XMLSerializer` nativo Deno — não é C14N.

## Consequências
Testável offline com vetores conhecidos; bugs reprodutíveis contra a
implementação de referência .NET; manutenção própria (spec estável desde 2001).

## Referência
FiscalFramework `src/engines/FiscalFramework.Xml/C14NCanonicalizer.cs`;
`mem/features/c14n-sefaz.md`.